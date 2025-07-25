// Screen Recording Client-Side Module
// Handles MediaRecorder functionality for research sessions

class ScreenRecordingClient {
    constructor() {
        this.mediaRecorder = null;
        this.mediaStream = null;
        this.recordedChunks = [];
        this.isRecording = false;
        this.sessionId = null;
        
        console.log('[ScreenRecordingClient] Initialized');
        
        // Listen for recording control events from main process
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Listen for start recording event
        window.internalBridge?.on('research:startScreenRecording', async (event, data) => {
            console.log('[ScreenRecordingClient] Received start recording event:', data);
            await this.startRecording(data.sessionId, data.options);
        });

        // Listen for stop recording event
        window.internalBridge?.on('research:stopScreenRecording', async () => {
            console.log('[ScreenRecordingClient] Received stop recording event');
            await this.stopRecording();
        });
    }

    /**
     * Start screen recording
     */
    async startRecording(sessionId, options = {}) {
        if (this.isRecording) {
            console.warn('[ScreenRecordingClient] Recording already in progress');
            return false;
        }

        try {
            console.log(`[ScreenRecordingClient] Starting screen recording for session: ${sessionId}`);
            
            // Request screen capture
            this.mediaStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    mediaSource: 'screen',
                    width: { ideal: 1920, max: 1920 },
                    height: { ideal: 1080, max: 1080 },
                    frameRate: { ideal: 30, max: 60 }
                },
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    sampleRate: 44100
                }
            });

            console.log('[ScreenRecordingClient] Display media obtained');

            // Set up MediaRecorder
            const recordingOptions = {
                mimeType: this.getSupportedMimeType(),
                videoBitsPerSecond: options.videoBitsPerSecond || 2500000, // 2.5 Mbps
                audioBitsPerSecond: options.audioBitsPerSecond || 128000    // 128 kbps
            };

            this.mediaRecorder = new MediaRecorder(this.mediaStream, recordingOptions);
            this.sessionId = sessionId;
            this.recordedChunks = [];

            // Set up event handlers
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                    console.log(`[ScreenRecordingClient] Recorded chunk: ${event.data.size} bytes`);
                }
            };

            this.mediaRecorder.onstop = async () => {
                console.log('[ScreenRecordingClient] MediaRecorder stopped');
                await this.handleRecordingComplete();
            };

            this.mediaRecorder.onerror = (event) => {
                console.error('[ScreenRecordingClient] MediaRecorder error:', event.error);
                this.handleRecordingError(event.error);
            };

            this.mediaRecorder.onstart = () => {
                console.log('[ScreenRecordingClient] MediaRecorder started');
                this.isRecording = true;
            };

            // Handle stream ending (user stops sharing)
            this.mediaStream.getVideoTracks()[0].addEventListener('ended', () => {
                console.log('[ScreenRecordingClient] Screen sharing ended by user');
                this.stopRecording();
            });

            // Start recording
            this.mediaRecorder.start(1000); // Collect data every second
            
            console.log('[ScreenRecordingClient] Screen recording started successfully');
            return true;

        } catch (error) {
            console.error('[ScreenRecordingClient] Failed to start recording:', error);
            this.handleRecordingError(error);
            return false;
        }
    }

    /**
     * Stop screen recording
     */
    async stopRecording() {
        if (!this.isRecording) {
            console.warn('[ScreenRecordingClient] No active recording to stop');
            return false;
        }

        try {
            console.log('[ScreenRecordingClient] Stopping screen recording');

            if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
                this.mediaRecorder.stop();
            }

            if (this.mediaStream) {
                this.mediaStream.getTracks().forEach(track => track.stop());
            }

            this.isRecording = false;
            
            console.log('[ScreenRecordingClient] Screen recording stopped');
            return true;

        } catch (error) {
            console.error('[ScreenRecordingClient] Failed to stop recording:', error);
            this.handleRecordingError(error);
            return false;
        }
    }

    /**
     * Handle recording completion - save data to main process
     */
    async handleRecordingComplete() {
        if (this.recordedChunks.length === 0) {
            console.warn('[ScreenRecordingClient] No recorded chunks to save');
            return;
        }

        try {
            console.log(`[ScreenRecordingClient] Processing ${this.recordedChunks.length} recorded chunks`);

            // Create blob from recorded chunks
            const mimeType = this.getSupportedMimeType();
            const blob = new Blob(this.recordedChunks, { type: mimeType });
            
            // Convert to array buffer
            const arrayBuffer = await blob.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);

            console.log(`[ScreenRecordingClient] Recording blob size: ${blob.size} bytes`);

            // Send recording data to main process
            if (window.api?.research?.saveScreenRecording) {
                const result = await window.api.research.saveScreenRecording({
                    sessionId: this.sessionId,
                    recordingData: Array.from(uint8Array), // Convert to regular array for IPC
                    mimeType: mimeType,
                    size: blob.size
                });

                if (result.success) {
                    console.log('[ScreenRecordingClient] Recording saved successfully');
                } else {
                    console.error('[ScreenRecordingClient] Failed to save recording:', result.error);
                }
            } else {
                console.warn('[ScreenRecordingClient] API for saving recording not available');
            }

            // Clean up
            this.recordedChunks = [];
            this.sessionId = null;
            this.mediaStream = null;
            this.mediaRecorder = null;

        } catch (error) {
            console.error('[ScreenRecordingClient] Failed to handle recording completion:', error);
        }
    }

    /**
     * Handle recording errors
     */
    handleRecordingError(error) {
        console.error('[ScreenRecordingClient] Recording error:', error);
        
        // Clean up on error
        this.isRecording = false;
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.sessionId = null;

        // Notify main process of error
        if (window.api?.research?.reportRecordingError) {
            window.api.research.reportRecordingError({
                error: error.message || error.toString(),
                sessionId: this.sessionId
            });
        }
    }

    /**
     * Get supported MIME type for recording
     */
    getSupportedMimeType() {
        const types = [
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm;codecs=h264,opus',
            'video/webm',
            'video/mp4'
        ];

        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) {
                console.log(`[ScreenRecordingClient] Using MIME type: ${type}`);
                return type;
            }
        }

        console.warn('[ScreenRecordingClient] No preferred MIME type supported, using default');
        return 'video/webm';
    }

    /**
     * Check if screen recording is supported
     */
    static isSupported() {
        return !!(navigator.mediaDevices && 
                 navigator.mediaDevices.getDisplayMedia && 
                 window.MediaRecorder);
    }

    /**
     * Get current recording status
     */
    getStatus() {
        return {
            isRecording: this.isRecording,
            sessionId: this.sessionId,
            hasStream: !!this.mediaStream,
            hasRecorder: !!this.mediaRecorder,
            chunkCount: this.recordedChunks.length
        };
    }
}

// Create global instance
const screenRecordingClient = new ScreenRecordingClient();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = screenRecordingClient;
}

// Make available globally
window.screenRecordingClient = screenRecordingClient;

console.log('[ScreenRecordingClient] Module loaded, recording supported:', ScreenRecordingClient.isSupported()); 