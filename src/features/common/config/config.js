// Configuration management for environment-based settings
const os = require('os');
const path = require('path');
const fs = require('fs');

class Config {
    constructor() {
        this.env = process.env.NODE_ENV || 'development';
        this.defaults = {
            apiUrl: process.env.pickleglass_API_URL || 'http://localhost:9001',
            apiTimeout: 10000,
            
            webUrl: process.env.pickleglass_WEB_URL || 'http://localhost:3000',
            
            enableJWT: false,
            fallbackToHeaderAuth: false,
            
            cacheTimeout: 5 * 60 * 1000,
            enableCaching: true,
            
            syncInterval: 0,
            healthCheckInterval: 30 * 1000,
            
            defaultWindowWidth: 400,
            defaultWindowHeight: 60,
            
            enableOfflineMode: true,
            enableFileBasedCommunication: false,
            enableSQLiteStorage: true,
            
            logLevel: 'info',
            enableDebugLogging: false,
            
            // Audio Processing Configuration
            audio: {
                sampleRate: 24000,
                chunkDuration: 0.1,        // seconds (100ms)
                bufferSize: 2048,          // samples
                enableLogging: true,       // can be overridden by GLASS_AUDIO_LOGGING env var
                format: 'pcm16',
                channels: 1,
                
                // Timing controls
                minChunkInterval: 90,      // minimum ms between chunks
                maxChunkInterval: 110      // maximum ms between chunks (for validation)
            }
        };
        
        this.config = { ...this.defaults };
        this.loadEnvironmentConfig();
        this.loadUserConfig();
    }
    
    loadEnvironmentConfig() {
        if (process.env.pickleglass_API_URL) {
            this.config.apiUrl = process.env.pickleglass_API_URL;
            console.log(`[Config] API URL from env: ${this.config.apiUrl}`);
        }
        
        if (process.env.pickleglass_WEB_URL) {
            this.config.webUrl = process.env.pickleglass_WEB_URL;
            console.log(`[Config] Web URL from env: ${this.config.webUrl}`);
        }
        
        if (process.env.pickleglass_API_TIMEOUT) {
            this.config.apiTimeout = parseInt(process.env.pickleglass_API_TIMEOUT);
        }
        
        if (process.env.pickleglass_ENABLE_JWT) {
            this.config.enableJWT = process.env.pickleglass_ENABLE_JWT === 'true';
        }
        
        if (process.env.pickleglass_CACHE_TIMEOUT) {
            this.config.cacheTimeout = parseInt(process.env.pickleglass_CACHE_TIMEOUT);
        }
        
        if (process.env.pickleglass_LOG_LEVEL) {
            this.config.logLevel = process.env.pickleglass_LOG_LEVEL;
        }
        
        if (process.env.pickleglass_DEBUG) {
            this.config.enableDebugLogging = process.env.pickleglass_DEBUG === 'true';
        }
        
        // Audio configuration from environment
        if (process.env.GLASS_AUDIO_CHUNK_DURATION) {
            this.config.audio.chunkDuration = parseFloat(process.env.GLASS_AUDIO_CHUNK_DURATION);
            console.log(`[Config] Audio chunk duration from env: ${this.config.audio.chunkDuration}s`);
        }
        
        if (process.env.GLASS_AUDIO_SAMPLE_RATE) {
            this.config.audio.sampleRate = parseInt(process.env.GLASS_AUDIO_SAMPLE_RATE);
            console.log(`[Config] Audio sample rate from env: ${this.config.audio.sampleRate}Hz`);
        }
        
        if (process.env.GLASS_AUDIO_BUFFER_SIZE) {
            this.config.audio.bufferSize = parseInt(process.env.GLASS_AUDIO_BUFFER_SIZE);
            console.log(`[Config] Audio buffer size from env: ${this.config.audio.bufferSize}`);
        }
        
        if (process.env.GLASS_AUDIO_LOGGING !== undefined) {
            this.config.audio.enableLogging = process.env.GLASS_AUDIO_LOGGING !== 'false';
        }

        if (this.env === 'production') {
            this.config.enableDebugLogging = false;
            this.config.logLevel = 'warn';
        } else if (this.env === 'development') {
            this.config.enableDebugLogging = true;
            this.config.logLevel = 'debug';
        }
    }
    
    loadUserConfig() {
        try {
            const userConfigPath = this.getUserConfigPath();
            if (fs.existsSync(userConfigPath)) {
                const userConfig = JSON.parse(fs.readFileSync(userConfigPath, 'utf-8'));
                this.config = { ...this.config, ...userConfig };
                console.log('[Config] User config loaded from:', userConfigPath);
            }
        } catch (error) {
            console.warn('[Config] Failed to load user config:', error.message);
        }
    }
    
    getUserConfigPath() {
        const configDir = path.join(os.homedir(), '.pickleglass');
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        return path.join(configDir, 'config.json');
    }
    
    get(key) {
        return this.config[key];
    }
    
    set(key, value) {
        this.config[key] = value;
    }
    
    getAll() {
        return { ...this.config };
    }
    
    saveUserConfig() {
        try {
            const userConfigPath = this.getUserConfigPath();
            const userConfig = { ...this.config };
            
            Object.keys(this.defaults).forEach(key => {
                if (userConfig[key] === this.defaults[key]) {
                    delete userConfig[key];
                }
            });
            
            fs.writeFileSync(userConfigPath, JSON.stringify(userConfig, null, 2));
            console.log('[Config] User config saved to:', userConfigPath);
        } catch (error) {
            console.error('[Config] Failed to save user config:', error);
        }
    }
    
    reset() {
        this.config = { ...this.defaults };
        this.loadEnvironmentConfig();
    }
    
    isDevelopment() {
        return this.env === 'development';
    }
    
    isProduction() {
        return this.env === 'production';
    }
    
    shouldLog(level) {
        const levels = ['debug', 'info', 'warn', 'error'];
        const currentLevelIndex = levels.indexOf(this.config.logLevel);
        const requestedLevelIndex = levels.indexOf(level);
        return requestedLevelIndex >= currentLevelIndex;
    }
    
    // Audio configuration convenience methods
    getAudioConfig() {
        return { ...this.config.audio };
    }
    
    getAudioChunkDurationMs() {
        return this.config.audio.chunkDuration * 1000;
    }
    
    getAudioSamplesPerChunk() {
        return this.config.audio.sampleRate * this.config.audio.chunkDuration;
    }
    
    isAudioLoggingEnabled() {
        return this.config.audio.enableLogging;
    }
}

const config = new Config();

module.exports = config;