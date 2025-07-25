const { EventEmitter } = require('events');
const path = require('path');
const fs = require('fs').promises;
const { app } = require('electron');

class ScreenRecordingService extends EventEmitter {
    constructor() {
        super();
        this.isRecording = false;
        this.currentSession = null;
        this.recordingStartTime = null;
        this.recordingPath = null;
        
        console.log('[ScreenRecordingService] Initialized');
    }

    /**
     * Start screen recording for a research session
     * @param {string} sessionId - Research session ID
     * @param {Object} options - Recording options
     */
    async startRecording(sessionId, options = {}) {
        if (this.isRecording) {
            console.log('[ScreenRecordingService] Recording already in progress');
            return { success: false, error: 'Recording already in progress' };
        }

        try {
            console.log(`[ScreenRecordingService] Starting screen recording for session ${sessionId}`);

            // Create recordings directory if it doesn't exist
            const recordingsDir = this._getRecordingsDirectory();
            await fs.mkdir(recordingsDir, { recursive: true });

            // Generate recording filename
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `research-session-${sessionId}-${timestamp}.webm`;
            this.recordingPath = path.join(recordingsDir, filename);

            this.currentSession = sessionId;
            this.recordingStartTime = Date.now();
            this.isRecording = true;

            console.log(`[ScreenRecordingService] Recording will be saved to: ${this.recordingPath}`);

            this.emit('recording-started', {
                sessionId,
                recordingPath: this.recordingPath,
                startTime: this.recordingStartTime,
                options: {
                    videoBitsPerSecond: options.videoBitsPerSecond || 2500000, // 2.5 Mbps
                    audioBitsPerSecond: options.audioBitsPerSecond || 128000,   // 128 kbps
                    mimeType: 'video/webm;codecs=vp8,opus'
                }
            });

            return { 
                success: true, 
                recordingPath: this.recordingPath,
                startTime: this.recordingStartTime
            };

        } catch (error) {
            console.error('[ScreenRecordingService] Failed to start recording:', error);
            this.emit('recording-error', { error: error.message, sessionId });
            return { success: false, error: error.message };
        }
    }

    /**
     * Stop screen recording
     */
    async stopRecording() {
        if (!this.isRecording) {
            console.log('[ScreenRecordingService] No active recording to stop');
            return { success: false, error: 'No active recording' };
        }

        try {
            console.log('[ScreenRecordingService] Stopping screen recording');

            this.isRecording = false;
            const duration = Date.now() - this.recordingStartTime;
            
            console.log(`[ScreenRecordingService] Recording stopped. Duration: ${duration}ms`);

            this.emit('recording-stopped', {
                sessionId: this.currentSession,
                recordingPath: this.recordingPath,
                duration
            });

            return { 
                success: true, 
                recordingPath: this.recordingPath,
                duration
            };

        } catch (error) {
            console.error('[ScreenRecordingService] Failed to stop recording:', error);
            this.emit('recording-error', { error: error.message, sessionId: this.currentSession });
            return { success: false, error: error.message };
        }
    }

    /**
     * Save recording data from renderer process
     * @param {Buffer} recordingData - The recorded video data
     */
    async saveRecording(recordingData) {
        if (!this.recordingPath) {
            throw new Error('No recording path set');
        }

        try {
            console.log(`[ScreenRecordingService] Saving recording data to: ${this.recordingPath}`);
            
            await fs.writeFile(this.recordingPath, recordingData);

            const stats = await fs.stat(this.recordingPath);
            console.log(`[ScreenRecordingService] Recording saved: ${this.recordingPath} (${stats.size} bytes)`);

            this.emit('recording-saved', {
                sessionId: this.currentSession,
                recordingPath: this.recordingPath,
                fileSize: stats.size
            });

            // Clean up
            this.currentSession = null;
            this.recordingStartTime = null;
            this.recordingPath = null;

            return {
                success: true,
                fileSize: stats.size
            };

        } catch (error) {
            console.error('[ScreenRecordingService] Failed to save recording:', error);
            this.emit('recording-error', { 
                error: error.message, 
                sessionId: this.currentSession 
            });
            throw error;
        }
    }

    /**
     * Get the recordings directory path
     */
    _getRecordingsDirectory() {
        const userDataPath = app.getPath('userData');
        return path.join(userDataPath, 'research-recordings');
    }

    /**
     * Get recording status
     */
    getStatus() {
        return {
            isRecording: this.isRecording,
            currentSession: this.currentSession,
            recordingStartTime: this.recordingStartTime,
            recordingPath: this.recordingPath
        };
    }

    /**
     * Get list of saved recordings
     */
    async getRecordings() {
        try {
            const recordingsDir = this._getRecordingsDirectory();
            const files = await fs.readdir(recordingsDir).catch(() => []);
            
            const recordings = [];
            for (const file of files) {
                if (file.endsWith('.webm')) {
                    const filePath = path.join(recordingsDir, file);
                    const stats = await fs.stat(filePath);
                    
                    // Parse session ID from filename
                    const sessionIdMatch = file.match(/research-session-([^-]+)/);
                    const sessionId = sessionIdMatch ? sessionIdMatch[1] : 'unknown';
                    
                    recordings.push({
                        filename: file,
                        path: filePath,
                        sessionId,
                        size: stats.size,
                        created: stats.birthtime,
                        modified: stats.mtime
                    });
                }
            }

            return recordings.sort((a, b) => b.created - a.created);

        } catch (error) {
            console.error('[ScreenRecordingService] Failed to get recordings:', error);
            return [];
        }
    }

    /**
     * Delete a recording file
     */
    async deleteRecording(filename) {
        try {
            const recordingsDir = this._getRecordingsDirectory();
            const filePath = path.join(recordingsDir, filename);
            await fs.unlink(filePath);
            console.log(`[ScreenRecordingService] Deleted recording: ${filename}`);
            return { success: true };
        } catch (error) {
            console.error(`[ScreenRecordingService] Failed to delete recording ${filename}:`, error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Open recordings directory in file explorer
     */
    async openRecordingsDirectory() {
        try {
            const recordingsDir = this._getRecordingsDirectory();
            await fs.mkdir(recordingsDir, { recursive: true });
            
            const { shell } = require('electron');
            await shell.openPath(recordingsDir);
            
            return { success: true, path: recordingsDir };
        } catch (error) {
            console.error('[ScreenRecordingService] Failed to open recordings directory:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new ScreenRecordingService(); 