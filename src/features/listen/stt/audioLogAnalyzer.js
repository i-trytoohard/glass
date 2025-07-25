#!/usr/bin/env node

/**
 * Audio Log Analyzer for Glass
 * Utility to analyze, convert, and manage captured audio logs
 */

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

class AudioLogAnalyzer {
    constructor(logDirectory) {
        this.logDirectory = logDirectory;
    }

    /**
     * Analyze a session directory and provide statistics
     */
    async analyzeSession() {
        try {
            const metadata = await this.getSessionMetadata();
            const micStats = await this.analyzeAudioType('mic');
            const systemStats = await this.analyzeAudioType('system');

            return {
                metadata,
                micAudio: micStats,
                systemAudio: systemStats,
                totalDuration: micStats.duration + systemStats.duration,
                totalFiles: micStats.fileCount + systemStats.fileCount,
                totalSize: micStats.totalSize + systemStats.totalSize
            };
        } catch (error) {
            console.error('Failed to analyze session:', error);
            return null;
        }
    }

    /**
     * Get session metadata
     */
    async getSessionMetadata() {
        const metadataPath = path.join(this.logDirectory, 'session-metadata.json');
        try {
            const content = await fs.readFile(metadataPath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            return null;
        }
    }

    /**
     * Analyze audio files of a specific type (mic/system)
     */
    async analyzeAudioType(audioType) {
        const audioDir = path.join(this.logDirectory, audioType);
        
        try {
            const files = await fs.readdir(audioDir);
            const pcmFiles = files.filter(file => file.endsWith('.pcm'));
            
            let totalSize = 0;
            const fileDetails = [];
            
            for (const file of pcmFiles) {
                const filePath = path.join(audioDir, file);
                const stats = await fs.stat(filePath);
                totalSize += stats.size;
                
                // Try to load corresponding metadata
                const metadataFile = file.replace('.pcm', '.json');
                let metadata = null;
                try {
                    const metadataContent = await fs.readFile(
                        path.join(audioDir, metadataFile), 
                        'utf8'
                    );
                    metadata = JSON.parse(metadataContent);
                } catch (e) {
                    // Metadata not found, continue
                }
                
                fileDetails.push({
                    filename: file,
                    sizeBytes: stats.size,
                    metadata
                });
            }
            
            // Calculate duration (assuming 16-bit PCM at 24kHz)
            const bytesPerSecond = 24000 * 2; // 24kHz * 2 bytes per sample
            const duration = totalSize / bytesPerSecond;
            
            return {
                fileCount: pcmFiles.length,
                totalSize,
                duration,
                files: fileDetails
            };
            
        } catch (error) {
            return {
                fileCount: 0,
                totalSize: 0,
                duration: 0,
                files: [],
                error: error.message
            };
        }
    }

    /**
     * Convert PCM files to WAV format using ffmpeg
     */
    async convertToWav(audioType, outputDir) {
        const audioDir = path.join(this.logDirectory, audioType);
        const files = await fs.readdir(audioDir);
        const pcmFiles = files.filter(file => file.endsWith('.pcm'));
        
        // Ensure output directory exists
        await fs.mkdir(outputDir, { recursive: true });
        
        console.log(`Converting ${pcmFiles.length} ${audioType} files to WAV...`);
        
        for (const file of pcmFiles) {
            const inputPath = path.join(audioDir, file);
            const outputPath = path.join(outputDir, file.replace('.pcm', '.wav'));
            
            await this.convertPcmToWav(inputPath, outputPath);
            console.log(`✓ Converted: ${file}`);
        }
        
        console.log(`Conversion complete! Files saved to: ${outputDir}`);
    }

    /**
     * Convert single PCM file to WAV using ffmpeg
     */
    convertPcmToWav(inputPath, outputPath) {
        return new Promise((resolve, reject) => {
            const ffmpeg = spawn('ffmpeg', [
                '-f', 's16le',          // Input format: signed 16-bit little endian
                '-ar', '24000',         // Sample rate: 24kHz
                '-ac', '1',             // Channels: mono
                '-i', inputPath,        // Input file
                '-y',                   // Overwrite output file
                outputPath              // Output file
            ]);

            ffmpeg.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`ffmpeg exited with code ${code}`));
                }
            });

            ffmpeg.on('error', reject);
        });
    }

    /**
     * Generate a report of the session analysis
     */
    async generateReport() {
        const analysis = await this.analyzeSession();
        if (!analysis) {
            return 'Failed to analyze session';
        }

        const formatSize = (bytes) => {
            const mb = bytes / (1024 * 1024);
            return `${mb.toFixed(2)} MB`;
        };

        const formatDuration = (seconds) => {
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        };

        return `
Glass Audio Log Analysis Report
===============================

Session: ${path.basename(this.logDirectory)}
Started: ${analysis.metadata?.sessionStart || 'Unknown'}

Audio Statistics:
- Total Duration: ${formatDuration(analysis.totalDuration)}
- Total Files: ${analysis.totalFiles}
- Total Size: ${formatSize(analysis.totalSize)}

Microphone Audio:
- Files: ${analysis.micAudio.fileCount}
- Duration: ${formatDuration(analysis.micAudio.duration)}
- Size: ${formatSize(analysis.micAudio.totalSize)}

System Audio:
- Files: ${analysis.systemAudio.fileCount}
- Duration: ${formatDuration(analysis.systemAudio.duration)}
- Size: ${formatSize(analysis.systemAudio.totalSize)}

Technical Details:
- Sample Rate: ${analysis.metadata?.sampleRate || 24000} Hz
- Format: ${analysis.metadata?.format || 'PCM16'}
- Channels: ${analysis.metadata?.channels || 1}
`;
    }
}

// CLI interface
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log(`
Usage: node audioLogAnalyzer.js <command> <logDirectory> [options]

Commands:
  analyze <dir>              - Analyze session and show statistics
  convert <dir> <outputDir>  - Convert PCM files to WAV format
  report <dir>              - Generate detailed report

Examples:
  node audioLogAnalyzer.js analyze ./audio-logs/2024-01-15T10-30-00
  node audioLogAnalyzer.js convert ./audio-logs/2024-01-15T10-30-00 ./converted
  node audioLogAnalyzer.js report ./audio-logs/2024-01-15T10-30-00
`);
        process.exit(1);
    }

    const [command, logDir, ...options] = args;
    const analyzer = new AudioLogAnalyzer(logDir);

    (async () => {
        try {
            switch (command) {
                case 'analyze':
                    const analysis = await analyzer.analyzeSession();
                    console.log(JSON.stringify(analysis, null, 2));
                    break;
                    
                case 'convert':
                    if (options.length === 0) {
                        console.error('Output directory required for convert command');
                        process.exit(1);
                    }
                    await analyzer.convertToWav('mic', path.join(options[0], 'mic'));
                    await analyzer.convertToWav('system', path.join(options[0], 'system'));
                    break;
                    
                case 'report':
                    const report = await analyzer.generateReport();
                    console.log(report);
                    break;
                    
                default:
                    console.error(`Unknown command: ${command}`);
                    process.exit(1);
            }
        } catch (error) {
            console.error('Error:', error.message);
            process.exit(1);
        }
    })();
}

module.exports = AudioLogAnalyzer; 