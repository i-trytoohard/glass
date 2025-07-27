#!/usr/bin/env node

/**
 * Audio Log Analyzer for Glass - Updated for STT-level logging
 * 
 * This script analyzes audio chunks that are logged RIGHT BEFORE being sent
 * to STT providers, ensuring we see exactly what STT services receive.
 * 
 * Usage: node test-audio-timing.js [path-to-audio-log-directory]
 */

const fs = require('fs');
const path = require('path');

// Test configuration consistency
function testConfigConsistency() {
    try {
        const config = require('./src/features/common/config/config');
        const audioConfig = config.getAudioConfig();
        
        console.log('🔧 Audio Configuration (STT Service Level):');
        console.log(`   Sample Rate: ${audioConfig.sampleRate}Hz`);
        console.log(`   Chunk Duration: ${audioConfig.chunkDuration}s (${audioConfig.chunkDuration * 1000}ms)`);
        console.log(`   Buffer Size: ${audioConfig.bufferSize} samples`);
        console.log(`   Format: ${audioConfig.format}`);
        console.log(`   Channels: ${audioConfig.channels}`);
        console.log(`   Logging Enabled: ${audioConfig.enableLogging}`);
        console.log('');
        console.log('📍 Note: Audio is now logged at STT service level (exactly what STT providers receive)');
        console.log('');
        
        return audioConfig;
    } catch (error) {
        console.warn('⚠️  Could not load config (expected in test environment)');
        return {
            sampleRate: 24000,
            chunkDuration: 0.1,
            format: 'pcm16',
            channels: 1
        };
    }
}

function analyzeAudioTiming(logDir) {
    const audioConfig = testConfigConsistency();
    const expectedInterval = audioConfig.chunkDuration * 1000;
    
    const micDir = path.join(logDir, 'mic');
    
    if (!fs.existsSync(micDir)) {
        console.log('❌ No mic directory found in:', logDir);
        return;
    }
    
    const files = fs.readdirSync(micDir)
        .filter(f => f.endsWith('.json'))
        .sort()
        .slice(0, 20); // Check first 20 files
    
    console.log(`🔍 Analyzing timing of first ${files.length} audio chunks...\n`);
    
    let lastTimestamp = null;
    let intervals = [];
    
    for (const file of files) {
        const filePath = path.join(micDir, file);
        const metadata = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const timestamp = new Date(metadata.timestamp);
        
        if (lastTimestamp) {
            const interval = timestamp - lastTimestamp;
            intervals.push(interval);
            
            const tolerance = expectedInterval * 0.1; // 10% tolerance
            const isGood = Math.abs(interval - expectedInterval) <= tolerance;
            const status = isGood ? '✅' : '❌';
            console.log(`${status} ${metadata.filename}: ${interval}ms gap`);
        } else {
            console.log(`📍 ${metadata.filename}: Starting point`);
        }
        
        lastTimestamp = timestamp;
    }
    
    if (intervals.length > 0) {
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const tolerance = expectedInterval * 0.1;
        const goodIntervals = intervals.filter(i => Math.abs(i - expectedInterval) <= tolerance).length;
        const successRate = (goodIntervals / intervals.length) * 100;
        
        console.log(`\n📊 Results:`);
        console.log(`   Average interval: ${avgInterval.toFixed(1)}ms`);
        console.log(`   Expected: ${expectedInterval}ms (±${tolerance.toFixed(1)}ms tolerance)`);
        console.log(`   Success rate: ${successRate.toFixed(1)}% (${goodIntervals}/${intervals.length})`);
        
        if (successRate >= 80) {
            console.log(`\n🎉 SUCCESS! Audio timing is fixed!`);
        } else {
            console.log(`\n⚠️  Still issues with audio timing.`);
        }
    }
}

// CLI usage
if (require.main === module) {
    const logDir = process.argv[2] || '';
    
    if (!logDir) {
        console.log(`
Usage: node test-audio-timing.js <audio-log-directory>

Example:
  node test-audio-timing.js "/Users/username/Library/Application Support/Glass/audio-logs/2025-07-25T16-00-00"
`);
        process.exit(1);
    }
    
    analyzeAudioTiming(logDir);
}

module.exports = { analyzeAudioTiming }; 