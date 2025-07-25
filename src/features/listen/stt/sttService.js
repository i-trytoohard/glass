const { BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { createSTT } = require('../../common/ai/factory');
const modelStateService = require('../../common/services/modelStateService');

const COMPLETION_DEBOUNCE_MS = 2000;

// ── New heartbeat / renewal constants ────────────────────────────────────────────
// Interval to send low-cost keep-alive messages so the remote service does not
// treat the connection as idle. One minute is safely below the typical 2-5 min
// idle timeout window seen on provider websockets.
const KEEP_ALIVE_INTERVAL_MS = 60 * 1000;         // 1 minute

// Interval after which we pro-actively tear down and recreate the STT sessions
// to dodge the 30-minute hard timeout enforced by some providers. 20 minutes
// gives a 10-minute safety buffer.
const SESSION_RENEW_INTERVAL_MS = 20 * 60 * 1000; // 20 minutes

// Duration to allow the old and new sockets to run in parallel so we don't
// miss any packets at the exact swap moment.
const SOCKET_OVERLAP_MS = 2 * 1000; // 2 seconds

class SttService {
    constructor() {
        this.mySttSession = null;
        this.theirSttSession = null;
        this.myCurrentUtterance = '';
        this.theirCurrentUtterance = '';
        
        // Turn-completion debouncing
        this.myCompletionBuffer = '';
        this.theirCompletionBuffer = '';
        this.myCompletionTimer = null;
        this.theirCompletionTimer = null;
        
        // System audio capture
        this.systemAudioProc = null;

        // Keep-alive / renewal timers
        this.keepAliveInterval = null;
        this.sessionRenewTimeout = null;

        // Callbacks
        this.onTranscriptionComplete = null;
        this.onStatusUpdate = null;

        this.modelInfo = null; 
        
        // Audio logging configuration
        this.audioLoggingEnabled = process.env.GLASS_AUDIO_LOGGING !== 'false'; // Enable by default
        this.audioLogDir = null;
        this.sessionStartTime = null;
        this.audioChunkCounter = 0;
        
        // Initialize audio logging
        this.initializeAudioLogging();
    }

    /**
     * Initialize audio logging directory and setup
     */
    async initializeAudioLogging() {
        if (!this.audioLoggingEnabled) {
            console.log('[SttService] Audio logging disabled');
            return;
        }

        try {
            const { app } = require('electron');
            const logsBaseDir = path.join(app.getPath('userData'), 'audio-logs');
            
            // Create session-specific directory with timestamp
            this.sessionStartTime = new Date();
            const sessionDirName = this.sessionStartTime.toISOString().replace(/[:.]/g, '-').slice(0, 19);
            this.audioLogDir = path.join(logsBaseDir, sessionDirName);
            
            // Ensure directories exist
            await fs.mkdir(this.audioLogDir, { recursive: true });
            
            // Create separate directories for mic and system audio
            await fs.mkdir(path.join(this.audioLogDir, 'mic'), { recursive: true });
            await fs.mkdir(path.join(this.audioLogDir, 'system'), { recursive: true });
            
            console.log(`[SttService] Audio logging initialized: ${this.audioLogDir}`);
            
            // Create session metadata file
            const metadata = {
                sessionStart: this.sessionStartTime.toISOString(),
                sampleRate: 24000,
                format: 'pcm16',
                channels: 1,
                chunkDuration: '100ms'
            };
            
            await fs.writeFile(
                path.join(this.audioLogDir, 'session-metadata.json'),
                JSON.stringify(metadata, null, 2)
            );
            
            // Create README for users
            await this.createLogReadme();
            
        } catch (error) {
            console.error('[SttService] Failed to initialize audio logging:', error);
            this.audioLoggingEnabled = false;
        }
    }

    /**
     * Save audio chunk to disk for logging
     * @param {string} audioData - Base64 encoded audio data
     * @param {string} audioType - 'mic' or 'system'
     * @param {string} mimeType - Audio MIME type
     */
    async saveAudioChunk(audioData, audioType, mimeType = 'audio/pcm;rate=24000') {
        if (!this.audioLoggingEnabled || !this.audioLogDir) {
            return;
        }

        try {
            const timestamp = new Date().toISOString();
            const chunkId = String(this.audioChunkCounter++).padStart(6, '0');
            const filename = `${timestamp.replace(/[:.]/g, '-')}_${chunkId}.pcm`;
            const filepath = path.join(this.audioLogDir, audioType, filename);
            
            // Convert base64 to buffer and save
            const audioBuffer = Buffer.from(audioData, 'base64');
            await fs.writeFile(filepath, audioBuffer);
            
            // Create chunk metadata
            const chunkMetadata = {
                timestamp,
                chunkId: parseInt(chunkId),
                audioType,
                mimeType,
                sizeBytes: audioBuffer.length,
                filename
            };
            
            const metadataPath = path.join(this.audioLogDir, audioType, `${timestamp.replace(/[:.]/g, '-')}_${chunkId}.json`);
            await fs.writeFile(metadataPath, JSON.stringify(chunkMetadata, null, 2));
            
        } catch (error) {
            console.error(`[SttService] Failed to save ${audioType} audio chunk:`, error);
        }
    }

    /**
     * Get audio logging status and statistics
     */
    getAudioLoggingInfo() {
        return {
            enabled: this.audioLoggingEnabled,
            logDirectory: this.audioLogDir,
            sessionStart: this.sessionStartTime,
            chunksLogged: this.audioChunkCounter
        };
    }

    /**
     * Clean up old audio log directories (keep last N sessions)
     * @param {number} keepSessions - Number of recent sessions to keep (default: 10)
     */
    async cleanupOldAudioLogs(keepSessions = 10) {
        if (!this.audioLoggingEnabled) {
            return;
        }

        try {
            const { app } = require('electron');
            const logsBaseDir = path.join(app.getPath('userData'), 'audio-logs');
            
            const entries = await fs.readdir(logsBaseDir, { withFileTypes: true });
            const sessionDirs = entries
                .filter(entry => entry.isDirectory())
                .map(entry => ({
                    name: entry.name,
                    path: path.join(logsBaseDir, entry.name),
                    timestamp: entry.name // ISO format sorts chronologically
                }))
                .sort((a, b) => b.timestamp.localeCompare(a.timestamp)); // Most recent first

            // Keep only the most recent sessions
            const dirsToDelete = sessionDirs.slice(keepSessions);
            
            for (const dir of dirsToDelete) {
                await fs.rm(dir.path, { recursive: true, force: true });
                console.log(`[SttService] Cleaned up old audio logs: ${dir.name}`);
            }
            
            console.log(`[SttService] Audio log cleanup complete. Kept ${Math.min(sessionDirs.length, keepSessions)} sessions.`);
            
        } catch (error) {
            console.error('[SttService] Failed to cleanup old audio logs:', error);
        }
    }

    /**
     * Disable audio logging for current session
     */
    disableAudioLogging() {
        console.log('[SttService] Audio logging disabled for current session');
        this.audioLoggingEnabled = false;
    }

    /**
     * Create a README file in the log directory explaining the format
     */
    async createLogReadme() {
        if (!this.audioLogDir) return;
        
        const readmeContent = `# Glass Audio Logs

This directory contains raw audio data captured before being sent to STT providers.

## Directory Structure
- \`mic/\` - Microphone audio (researcher questions)
- \`system/\` - System audio (participant responses)  
- \`session-metadata.json\` - Session configuration and timing

## File Format
- \`*.pcm\` - Raw PCM16 audio data (24kHz, mono, 16-bit)
- \`*.json\` - Metadata for each audio chunk

## Usage
To convert PCM files to WAV for playback:
\`\`\`bash
ffmpeg -f s16le -ar 24000 -ac 1 -i input.pcm output.wav
\`\`\`

## Privacy Note
These files contain raw audio data. Handle according to your privacy and data retention policies.

Generated: ${new Date().toISOString()}
`;

        try {
            await fs.writeFile(path.join(this.audioLogDir, 'README.md'), readmeContent);
        } catch (error) {
            console.error('[SttService] Failed to create README:', error);
        }
    }

    setCallbacks({ onTranscriptionComplete, onStatusUpdate }) {
        this.onTranscriptionComplete = onTranscriptionComplete;
        this.onStatusUpdate = onStatusUpdate;
    }

    sendToRenderer(eventName, data) {
        BrowserWindow.getAllWindows().forEach(win => {
            if (win && !win.isDestroyed()) {
                win.webContents.send(eventName, data);
            }
        });
        
        // Forward transcripts to research service for question detection
        if (eventName === 'stt-update' && data.text && data.text.trim()) {
            this.forwardToQuestionDetection(data);
        }
    }

    /**
     * Forward transcript to research service for question detection
     * @param {Object} transcriptData - STT update data
     */
    forwardToQuestionDetection(transcriptData) {
        try {
            // Import research service directly like featureBridge does
            const researchService = require('../../research/researchService');
            
            // Determine speaker - for now assume "Them" is moderator
            const speaker = transcriptData.speaker === 'Them' ? 'moderator' : 'participant';
            
            // Only forward if it's a final transcription (not partial)
            if (!transcriptData.isPartial && transcriptData.isFinal) {
                researchService.processTranscript(transcriptData.text, speaker);
            }
        } catch (error) {
            // Silently handle error to avoid breaking STT service
            console.log('[SttService] Could not forward to question detection:', error.message);
        }
    }

    async handleSendSystemAudioContent(data, mimeType) {
        try {
            await this.sendSystemAudioContent(data, mimeType);
            this.sendToRenderer('system-audio-data', { data });
            return { success: true };
        } catch (error) {
            console.error('Error sending system audio:', error);
            return { success: false, error: error.message };
        }
    }

    flushMyCompletion() {
        const finalText = (this.myCompletionBuffer + this.myCurrentUtterance).trim();
        if (!this.modelInfo || !finalText) return;

        // Notify completion callback
        if (this.onTranscriptionComplete) {
            this.onTranscriptionComplete('Me', finalText);
        }
        
        // Send to renderer as final
        this.sendToRenderer('stt-update', {
            speaker: 'Me',
            text: finalText,
            isPartial: false,
            isFinal: true,
            timestamp: Date.now(),
        });

        this.myCompletionBuffer = '';
        this.myCompletionTimer = null;
        this.myCurrentUtterance = '';
        
        if (this.onStatusUpdate) {
            this.onStatusUpdate('Listening...');
        }
    }

    flushTheirCompletion() {
        const finalText = (this.theirCompletionBuffer + this.theirCurrentUtterance).trim();
        if (!this.modelInfo || !finalText) return;
        
        // Notify completion callback
        if (this.onTranscriptionComplete) {
            this.onTranscriptionComplete('Them', finalText);
        }
        
        // Send to renderer as final
        this.sendToRenderer('stt-update', {
            speaker: 'Them',
            text: finalText,
            isPartial: false,
            isFinal: true,
            timestamp: Date.now(),
        });

        this.theirCompletionBuffer = '';
        this.theirCompletionTimer = null;
        this.theirCurrentUtterance = '';
        
        if (this.onStatusUpdate) {
            this.onStatusUpdate('Listening...');
        }
    }

    debounceMyCompletion(text) {
        if (this.modelInfo?.provider === 'gemini') {
            this.myCompletionBuffer += text;
        } else {
            this.myCompletionBuffer += (this.myCompletionBuffer ? ' ' : '') + text;
        }

        if (this.myCompletionTimer) clearTimeout(this.myCompletionTimer);
        this.myCompletionTimer = setTimeout(() => this.flushMyCompletion(), COMPLETION_DEBOUNCE_MS);
    }

    debounceTheirCompletion(text) {
        if (this.modelInfo?.provider === 'gemini') {
            this.theirCompletionBuffer += text;
        } else {
            this.theirCompletionBuffer += (this.theirCompletionBuffer ? ' ' : '') + text;
        }

        if (this.theirCompletionTimer) clearTimeout(this.theirCompletionTimer);
        this.theirCompletionTimer = setTimeout(() => this.flushTheirCompletion(), COMPLETION_DEBOUNCE_MS);
    }

    async initializeSttSessions(language = 'en') {
        const effectiveLanguage = process.env.OPENAI_TRANSCRIBE_LANG || language || 'en';

        const modelInfo = await modelStateService.getCurrentModelInfo('stt');
        if (!modelInfo || !modelInfo.apiKey) {
            throw new Error('AI model or API key is not configured.');
        }
        this.modelInfo = modelInfo;
        console.log(`[SttService] Initializing STT for ${modelInfo.provider} using model ${modelInfo.model}`);

        const handleMyMessage = message => {
            if (!this.modelInfo) {
                console.log('[SttService] Ignoring message - session already closed');
                return;
            }
            // console.log('[SttService] handleMyMessage', message);
            
            if (this.modelInfo.provider === 'whisper') {
                // Whisper STT emits 'transcription' events with different structure
                if (message.text && message.text.trim()) {
                    const finalText = message.text.trim();
                    
                    // Filter out Whisper noise transcriptions
                    const noisePatterns = [
                        '[BLANK_AUDIO]',
                        '[INAUDIBLE]',
                        '[MUSIC]',
                        '[SOUND]',
                        '[NOISE]',
                        '(BLANK_AUDIO)',
                        '(INAUDIBLE)',
                        '(MUSIC)',
                        '(SOUND)',
                        '(NOISE)'
                    ];
                    
                    const isNoise = noisePatterns.some(pattern => 
                        finalText.includes(pattern) || finalText === pattern
                    );
                    
                    
                    if (!isNoise && finalText.length > 2) {
                        this.debounceMyCompletion(finalText);
                        
                        this.sendToRenderer('stt-update', {
                            speaker: 'Me',
                            text: finalText,
                            isPartial: false,
                            isFinal: true,
                            timestamp: Date.now(),
                        });
                    } else {
                        console.log(`[Whisper-Me] Filtered noise: "${finalText}"`);
                    }
                }
                return;
            } else if (this.modelInfo.provider === 'gemini') {
                if (!message.serverContent?.modelTurn) {
                    console.log('[Gemini STT - Me]', JSON.stringify(message, null, 2));
                }

                if (message.serverContent?.turnComplete) {
                    if (this.myCompletionTimer) {
                        clearTimeout(this.myCompletionTimer);
                        this.flushMyCompletion();
                    }
                    return;
                }
            
                const transcription = message.serverContent?.inputTranscription;
                if (!transcription || !transcription.text) return;
                
                const textChunk = transcription.text;
                if (!textChunk.trim() || textChunk.trim() === '<noise>') {
                    return; // 1. Ignore whitespace-only chunks or noise
                }
            
                this.debounceMyCompletion(textChunk);
                
                this.sendToRenderer('stt-update', {
                    speaker: 'Me',
                    text: this.myCompletionBuffer,
                    isPartial: true,
                    isFinal: false,
                    timestamp: Date.now(),
                });
                
            // Deepgram 
            } else if (this.modelInfo.provider === 'deepgram') {
                const text = message.channel?.alternatives?.[0]?.transcript;
                if (!text || text.trim().length === 0) return;

                const isFinal = message.is_final;
                console.log(`[SttService-Me-Deepgram] Received: isFinal=${isFinal}, text="${text}"`);

                if (isFinal) {
                    // 최종 결과가 도착하면, 현재 진행중인 부분 발화는 비우고
                    // 최종 텍스트로 debounce를 실행합니다.
                    this.myCurrentUtterance = ''; 
                    this.debounceMyCompletion(text); 
                } else {
                    // 부분 결과(interim)인 경우, 화면에 실시간으로 업데이트합니다.
                    if (this.myCompletionTimer) clearTimeout(this.myCompletionTimer);
                    this.myCompletionTimer = null;

                    this.myCurrentUtterance = text;
                    
                    const continuousText = (this.myCompletionBuffer + ' ' + this.myCurrentUtterance).trim();

                    this.sendToRenderer('stt-update', {
                        speaker: 'Me',
                        text: continuousText,
                        isPartial: true,
                        isFinal: false,
                        timestamp: Date.now(),
                    });
                }
                
            } else {
                const type = message.type;
                const text = message.transcript || message.delta || (message.alternatives && message.alternatives[0]?.transcript) || '';

                if (type === 'conversation.item.input_audio_transcription.delta') {
                    if (this.myCompletionTimer) clearTimeout(this.myCompletionTimer);
                    this.myCompletionTimer = null;
                    this.myCurrentUtterance += text;
                    const continuousText = this.myCompletionBuffer + (this.myCompletionBuffer ? ' ' : '') + this.myCurrentUtterance;
                    if (text && !text.includes('vq_lbr_audio_')) {
                        this.sendToRenderer('stt-update', {
                            speaker: 'Me',
                            text: continuousText,
                            isPartial: true,
                            isFinal: false,
                            timestamp: Date.now(),
                        });
                    }
                } else if (type === 'conversation.item.input_audio_transcription.completed') {
                    if (text && text.trim()) {
                        const finalUtteranceText = text.trim();
                        this.myCurrentUtterance = '';
                        this.debounceMyCompletion(finalUtteranceText);
                    }
                }
            }

            if (message.error) {
                console.error('[Me] STT Session Error:', message.error);
            }
        };

        const handleTheirMessage = message => {
            if (!message || typeof message !== 'object') return;

            if (!this.modelInfo) {
                console.log('[SttService] Ignoring message - session already closed');
                return;
            }
            
            if (this.modelInfo.provider === 'whisper') {
                // Whisper STT emits 'transcription' events with different structure
                if (message.text && message.text.trim()) {
                    const finalText = message.text.trim();
                    
                    // Filter out Whisper noise transcriptions
                    const noisePatterns = [
                        '[BLANK_AUDIO]',
                        '[INAUDIBLE]',
                        '[MUSIC]',
                        '[SOUND]',
                        '[NOISE]',
                        '(BLANK_AUDIO)',
                        '(INAUDIBLE)',
                        '(MUSIC)',
                        '(SOUND)',
                        '(NOISE)'
                    ];
                    
                    const isNoise = noisePatterns.some(pattern => 
                        finalText.includes(pattern) || finalText === pattern
                    );
                    
                    
                    // Only process if it's not noise, not a false positive, and has meaningful content
                    if (!isNoise && finalText.length > 2) {
                        this.debounceTheirCompletion(finalText);
                        
                        this.sendToRenderer('stt-update', {
                            speaker: 'Them',
                            text: finalText,
                            isPartial: false,
                            isFinal: true,
                            timestamp: Date.now(),
                        });
                    } else {
                        console.log(`[Whisper-Them] Filtered noise: "${finalText}"`);
                    }
                }
                return;
            } else if (this.modelInfo.provider === 'gemini') {
                if (!message.serverContent?.modelTurn) {
                    console.log('[Gemini STT - Them]', JSON.stringify(message, null, 2));
                }

                if (message.serverContent?.turnComplete) {
                    if (this.theirCompletionTimer) {
                        clearTimeout(this.theirCompletionTimer);
                        this.flushTheirCompletion();
                    }
                    return;
                }
            
                const transcription = message.serverContent?.inputTranscription;
                if (!transcription || !transcription.text) return;

                const textChunk = transcription.text;
                if (!textChunk.trim() || textChunk.trim() === '<noise>') {
                    return; // 1. Ignore whitespace-only chunks or noise
                }

                this.debounceTheirCompletion(textChunk);
                
                this.sendToRenderer('stt-update', {
                    speaker: 'Them',
                    text: this.theirCompletionBuffer,
                    isPartial: true,
                    isFinal: false,
                    timestamp: Date.now(),
                });

            // Deepgram
            } else if (this.modelInfo.provider === 'deepgram') {
                const text = message.channel?.alternatives?.[0]?.transcript;
                if (!text || text.trim().length === 0) return;

                const isFinal = message.is_final;

                if (isFinal) {
                    this.theirCurrentUtterance = ''; 
                    this.debounceTheirCompletion(text); 
                } else {
                    if (this.theirCompletionTimer) clearTimeout(this.theirCompletionTimer);
                    this.theirCompletionTimer = null;

                    this.theirCurrentUtterance = text;
                    
                    const continuousText = (this.theirCompletionBuffer + ' ' + this.theirCurrentUtterance).trim();

                    this.sendToRenderer('stt-update', {
                        speaker: 'Them',
                        text: continuousText,
                        isPartial: true,
                        isFinal: false,
                        timestamp: Date.now(),
                    });
                }

            } else {
                const type = message.type;
                const text = message.transcript || message.delta || (message.alternatives && message.alternatives[0]?.transcript) || '';
                if (type === 'conversation.item.input_audio_transcription.delta') {
                    if (this.theirCompletionTimer) clearTimeout(this.theirCompletionTimer);
                    this.theirCompletionTimer = null;
                    this.theirCurrentUtterance += text;
                    const continuousText = this.theirCompletionBuffer + (this.theirCompletionBuffer ? ' ' : '') + this.theirCurrentUtterance;
                    if (text && !text.includes('vq_lbr_audio_')) {
                        this.sendToRenderer('stt-update', {
                            speaker: 'Them',
                            text: continuousText,
                            isPartial: true,
                            isFinal: false,
                            timestamp: Date.now(),
                        });
                    }
                } else if (type === 'conversation.item.input_audio_transcription.completed') {
                    if (text && text.trim()) {
                        const finalUtteranceText = text.trim();
                        this.theirCurrentUtterance = '';
                        this.debounceTheirCompletion(finalUtteranceText);
                    }
                }
            }
            
            if (message.error) {
                console.error('[Them] STT Session Error:', message.error);
            }
        };

        const mySttConfig = {
            language: effectiveLanguage,
            callbacks: {
                onmessage: handleMyMessage,
                onerror: error => console.error('My STT session error:', error.message),
                onclose: event => console.log('My STT session closed:', event.reason),
            },
        };
        
        const theirSttConfig = {
            language: effectiveLanguage,
            callbacks: {
                onmessage: handleTheirMessage,
                onerror: error => console.error('Their STT session error:', error.message),
                onclose: event => console.log('Their STT session closed:', event.reason),
            },
        };
        
        const sttOptions = {
            apiKey: this.modelInfo.apiKey,
            language: effectiveLanguage,
            usePortkey: this.modelInfo.provider === 'openai-glass',
            portkeyVirtualKey: this.modelInfo.provider === 'openai-glass' ? this.modelInfo.apiKey : undefined,
        };

        // Add sessionType for Whisper to distinguish between My and Their sessions
        const myOptions = { ...sttOptions, callbacks: mySttConfig.callbacks, sessionType: 'my' };
        const theirOptions = { ...sttOptions, callbacks: theirSttConfig.callbacks, sessionType: 'their' };

        [this.mySttSession, this.theirSttSession] = await Promise.all([
            createSTT(this.modelInfo.provider, myOptions),
            createSTT(this.modelInfo.provider, theirOptions),
        ]);

        console.log('✅ Both STT sessions initialized successfully.');

        // ── Setup keep-alive heart-beats ────────────────────────────────────────
        if (this.keepAliveInterval) clearInterval(this.keepAliveInterval);
        this.keepAliveInterval = setInterval(() => {
            this._sendKeepAlive();
        }, KEEP_ALIVE_INTERVAL_MS);

        // ── Schedule session auto-renewal ───────────────────────────────────────
        if (this.sessionRenewTimeout) clearTimeout(this.sessionRenewTimeout);
        this.sessionRenewTimeout = setTimeout(async () => {
            try {
                console.log('[SttService] Auto-renewing STT sessions…');
                await this.renewSessions(language);
            } catch (err) {
                console.error('[SttService] Failed to renew STT sessions:', err);
            }
        }, SESSION_RENEW_INTERVAL_MS);

        return true;
    }

    /**
     * Send a lightweight keep-alive to prevent idle disconnects.
     * Currently only implemented for OpenAI provider because Gemini's SDK
     * already performs its own heart-beats.
     */
    _sendKeepAlive() {
        if (!this.isSessionActive()) return;

        if (this.modelInfo?.provider === 'openai') {
            try {
                this.mySttSession?.keepAlive?.();
                this.theirSttSession?.keepAlive?.();
            } catch (err) {
                console.error('[SttService] keepAlive error:', err.message);
            }
        }
    }

    /**
     * Gracefully tears down then recreates the STT sessions. Should be invoked
     * on a timer to avoid provider-side hard timeouts.
     */
    async renewSessions(language = 'en') {
        if (!this.isSessionActive()) {
            console.warn('[SttService] renewSessions called but no active session.');
            return;
        }

        const oldMySession = this.mySttSession;
        const oldTheirSession = this.theirSttSession;

        console.log('[SttService] Spawning fresh STT sessions in the background…');

        // We reuse initializeSttSessions to create fresh sessions with the same
        // language and handlers. The method will update the session pointers
        // and timers, but crucially it does NOT touch the system audio capture
        // pipeline, so audio continues flowing uninterrupted.
        await this.initializeSttSessions(language);

        // Close the old sessions after a short overlap window.
        setTimeout(() => {
            try {
                oldMySession?.close?.();
                oldTheirSession?.close?.();
                console.log('[SttService] Old STT sessions closed after hand-off.');
            } catch (err) {
                console.error('[SttService] Error closing old STT sessions:', err.message);
            }
        }, SOCKET_OVERLAP_MS);
    }

    async sendMicAudioContent(data, mimeType) {
        // const provider = await this.getAiProvider();
        // const isGemini = provider === 'gemini';
        
        if (!this.mySttSession) {
            throw new Error('User STT session not active');
        }

        // Log audio chunk before processing
        await this.saveAudioChunk(data, 'mic', mimeType);

        let modelInfo = this.modelInfo;
        if (!modelInfo) {
            console.warn('[SttService] modelInfo not found, fetching on-the-fly as a fallback...');
            modelInfo = await modelStateService.getCurrentModelInfo('stt');
        }
        if (!modelInfo) {
            throw new Error('STT model info could not be retrieved.');
        }

        let payload;
        if (modelInfo.provider === 'gemini') {
            payload = { audio: { data, mimeType: mimeType || 'audio/pcm;rate=24000' } };
        } else if (modelInfo.provider === 'deepgram') {
            payload = Buffer.from(data, 'base64'); 
        } else {
            payload = data;
        }
        await this.mySttSession.sendRealtimeInput(payload);
    }

    async sendSystemAudioContent(data, mimeType) {
        if (!this.theirSttSession) {
            throw new Error('Their STT session not active');
        }

        // Log audio chunk before processing  
        await this.saveAudioChunk(data, 'system', mimeType);

        let modelInfo = this.modelInfo;
        if (!modelInfo) {
            console.warn('[SttService] modelInfo not found, fetching on-the-fly as a fallback...');
            modelInfo = await modelStateService.getCurrentModelInfo('stt');
        }
        if (!modelInfo) {
            throw new Error('STT model info could not be retrieved.');
        }

        let payload;
        if (modelInfo.provider === 'gemini') {
            payload = { audio: { data, mimeType: mimeType || 'audio/pcm;rate=24000' } };
        } else if (modelInfo.provider === 'deepgram') {
            payload = Buffer.from(data, 'base64');
        } else {
            payload = data;
        }

        await this.theirSttSession.sendRealtimeInput(payload);
    }

    killExistingSystemAudioDump() {
        return new Promise(resolve => {
            console.log('Checking for existing SystemAudioDump processes...');

            const killProc = spawn('pkill', ['-f', 'SystemAudioDump'], {
                stdio: 'ignore',
            });

            killProc.on('close', code => {
                if (code === 0) {
                    console.log('Killed existing SystemAudioDump processes');
                } else {
                    console.log('No existing SystemAudioDump processes found');
                }
                resolve();
            });

            killProc.on('error', err => {
                console.log('Error checking for existing processes (this is normal):', err.message);
                resolve();
            });

            setTimeout(() => {
                killProc.kill();
                resolve();
            }, 2000);
        });
    }

    async startMacOSAudioCapture() {
        if (process.platform !== 'darwin' || !this.theirSttSession) return false;

        await this.killExistingSystemAudioDump();
        console.log('Starting macOS audio capture for "Them"...');

        const { app } = require('electron');
        const path = require('path');
        const systemAudioPath = app.isPackaged
            ? path.join(process.resourcesPath, 'app.asar.unpacked', 'src', 'ui', 'assets', 'SystemAudioDump')
            : path.join(app.getAppPath(), 'src', 'ui', 'assets', 'SystemAudioDump');

        console.log('SystemAudioDump path:', systemAudioPath);

        this.systemAudioProc = spawn(systemAudioPath, [], {
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        if (!this.systemAudioProc.pid) {
            console.error('Failed to start SystemAudioDump');
            return false;
        }

        console.log('SystemAudioDump started with PID:', this.systemAudioProc.pid);

        const CHUNK_DURATION = 0.1;
        const SAMPLE_RATE = 24000;
        const BYTES_PER_SAMPLE = 2;
        const CHANNELS = 2;
        const CHUNK_SIZE = SAMPLE_RATE * BYTES_PER_SAMPLE * CHANNELS * CHUNK_DURATION;

        let audioBuffer = Buffer.alloc(0);

        // const provider = await this.getAiProvider();
        // const isGemini = provider === 'gemini';

        let modelInfo = this.modelInfo;
        if (!modelInfo) {
            console.warn('[SttService] modelInfo not found, fetching on-the-fly as a fallback...');
            modelInfo = await modelStateService.getCurrentModelInfo('stt');
        }
        if (!modelInfo) {
            throw new Error('STT model info could not be retrieved.');
        }

        this.systemAudioProc.stdout.on('data', async data => {
            audioBuffer = Buffer.concat([audioBuffer, data]);

            while (audioBuffer.length >= CHUNK_SIZE) {
                const chunk = audioBuffer.slice(0, CHUNK_SIZE);
                audioBuffer = audioBuffer.slice(CHUNK_SIZE);

                const monoChunk = CHANNELS === 2 ? this.convertStereoToMono(chunk) : chunk;
                const base64Data = monoChunk.toString('base64');

                this.sendToRenderer('system-audio-data', { data: base64Data });

                if (this.theirSttSession) {
                    try {
                        let payload;
                        if (modelInfo.provider === 'gemini') {
                            payload = { audio: { data: base64Data, mimeType: 'audio/pcm;rate=24000' } };
                        } else if (modelInfo.provider === 'deepgram') {
                            payload = Buffer.from(base64Data, 'base64');
                        } else {
                            payload = base64Data;
                        }

                        await this.theirSttSession.sendRealtimeInput(payload);
                    } catch (err) {
                        console.error('Error sending system audio:', err.message);
                    }
                }
            }
        });

        this.systemAudioProc.stderr.on('data', data => {
            console.error('SystemAudioDump stderr:', data.toString());
        });

        this.systemAudioProc.on('close', code => {
            console.log('SystemAudioDump process closed with code:', code);
            this.systemAudioProc = null;
        });

        this.systemAudioProc.on('error', err => {
            console.error('SystemAudioDump process error:', err);
            this.systemAudioProc = null;
        });

        return true;
    }

    convertStereoToMono(stereoBuffer) {
        const samples = stereoBuffer.length / 4;
        const monoBuffer = Buffer.alloc(samples * 2);

        for (let i = 0; i < samples; i++) {
            const leftSample = stereoBuffer.readInt16LE(i * 4);
            monoBuffer.writeInt16LE(leftSample, i * 2);
        }

        return monoBuffer;
    }

    stopMacOSAudioCapture() {
        if (this.systemAudioProc) {
            console.log('Stopping SystemAudioDump...');
            this.systemAudioProc.kill('SIGTERM');
            this.systemAudioProc = null;
        }
    }

    isSessionActive() {
        return !!this.mySttSession && !!this.theirSttSession;
    }

    async closeSessions() {
        this.stopMacOSAudioCapture();

        // Clear heartbeat / renewal timers
        if (this.keepAliveInterval) {
            clearInterval(this.keepAliveInterval);
            this.keepAliveInterval = null;
        }
        if (this.sessionRenewTimeout) {
            clearTimeout(this.sessionRenewTimeout);
            this.sessionRenewTimeout = null;
        }

        // Clear timers
        if (this.myCompletionTimer) {
            clearTimeout(this.myCompletionTimer);
            this.myCompletionTimer = null;
        }
        if (this.theirCompletionTimer) {
            clearTimeout(this.theirCompletionTimer);
            this.theirCompletionTimer = null;
        }

        const closePromises = [];
        if (this.mySttSession) {
            closePromises.push(this.mySttSession.close());
            this.mySttSession = null;
        }
        if (this.theirSttSession) {
            closePromises.push(this.theirSttSession.close());
            this.theirSttSession = null;
        }

        await Promise.all(closePromises);
        console.log('All STT sessions closed.');

        // Reset state
        this.myCurrentUtterance = '';
        this.theirCurrentUtterance = '';
        this.myCompletionBuffer = '';
        this.theirCompletionBuffer = '';
        this.modelInfo = null; 
    }
}

module.exports = SttService; 