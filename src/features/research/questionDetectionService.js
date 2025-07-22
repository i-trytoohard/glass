const EventEmitter = require('events');

/**
 * QuestionDetectionService
 * 
 * Detects when moderators ask questions during research sessions by:
 * 1. Processing real-time audio through STT
 * 2. Identifying questions using regex and NLP
 * 3. Matching against study questions using embeddings
 * 4. Flagging off-script questions
 */
class QuestionDetectionService extends EventEmitter {
    constructor() {
        super();
        this.isActive = false;
        this.currentStudyQuestions = [];
        this.questionBank = new Map(); // questionId -> { question, embedding }
        this.lastUtterance = '';
        this.confidence_threshold_high = 0.78; // High confidence for direct match
        this.confidence_threshold_low = 0.50;  // Below this is off-script
        this.sttBuffer = [];
        this.processingTimeoutId = null;
        
        console.log('[QuestionDetectionService] Service initialized');
    }

    /**
     * Start question detection for a research session
     * @param {Array} studyQuestions - Array of study question objects
     */
    async startDetection(studyQuestions = []) {
        try {
            console.log('[QuestionDetectionService] Starting detection with', studyQuestions.length, 'study questions');
            
            this.currentStudyQuestions = studyQuestions;
            await this._buildQuestionBank(studyQuestions);
            
            this.isActive = true;
            this.emit('detection-started', { questionCount: studyQuestions.length });
            
            console.log('[QuestionDetectionService] Detection started successfully');
        } catch (error) {
            console.error('[QuestionDetectionService] Failed to start detection:', error);
            throw error;
        }
    }

    /**
     * Stop question detection
     */
    stopDetection() {
        console.log('[QuestionDetectionService] Stopping detection');
        this.isActive = false;
        this.currentStudyQuestions = [];
        this.questionBank.clear();
        
        if (this.processingTimeoutId) {
            clearTimeout(this.processingTimeoutId);
            this.processingTimeoutId = null;
        }
        
        this.emit('detection-stopped');
    }

    /**
     * Process incoming audio transcript
     * @param {string} transcript - The transcribed text
     * @param {string} speaker - Speaker identification ('moderator', 'participant', etc.)
     */
    async processTranscript(transcript, speaker = 'moderator') {
        if (!this.isActive || !transcript || transcript.trim().length === 0) {
            return;
        }

        // Only process moderator speech for question detection
        if (speaker !== 'moderator') {
            return;
        }

        console.log('[QuestionDetectionService] Processing transcript:', { transcript, speaker });

        // Add to buffer for sentence completion detection
        this.sttBuffer.push({ text: transcript, timestamp: Date.now() });
        
        // Keep buffer size manageable
        if (this.sttBuffer.length > 10) {
            this.sttBuffer = this.sttBuffer.slice(-10);
        }

        // Debounce processing to wait for complete sentences
        if (this.processingTimeoutId) {
            clearTimeout(this.processingTimeoutId);
        }
        
        this.processingTimeoutId = setTimeout(() => {
            this._processBufferedTranscript();
        }, 1500); // Wait 1.5s for sentence completion
    }

    /**
     * Process buffered transcript for complete sentences
     */
    async _processBufferedTranscript() {
        if (this.sttBuffer.length === 0) return;

        // Combine recent buffer into complete text
        const combinedText = this.sttBuffer
            .map(item => item.text)
            .join(' ')
            .trim();

        console.log('[QuestionDetectionService] Processing combined text:', combinedText);

        // Check if this looks like a question
        if (!this._looksLikeQuestion(combinedText)) {
            console.log('[QuestionDetectionService] Text does not appear to be a question');
            return;
        }

        // Avoid processing the same utterance twice
        if (combinedText === this.lastUtterance) {
            console.log('[QuestionDetectionService] Skipping duplicate utterance');
            return;
        }
        this.lastUtterance = combinedText;

        // Find best matching study question
        const matchResult = await this._findBestQuestionMatch(combinedText);
        
        const event = {
            utc: Date.now(),
            text: combinedText,
            ...matchResult
        };

        console.log('[QuestionDetectionService] Question detected:', event);
        this.emit('question-detected', event);

        // Clear buffer after processing
        this.sttBuffer = [];
    }

    /**
     * Check if text looks like a question
     * @param {string} text - Text to analyze
     * @returns {boolean}
     */
    _looksLikeQuestion(text) {
        const cleanText = text.trim().toLowerCase();
        
        // Basic question indicators
        const questionWords = [
            'what', 'how', 'why', 'when', 'where', 'who', 'which', 'whose',
            'can you', 'could you', 'would you', 'do you', 'did you', 'will you',
            'are you', 'have you', 'tell me', 'describe', 'explain', 'think about',
            'experience with', 'feel about', 'opinion on', 'thoughts on'
        ];

        // Check for question mark
        if (text.includes('?')) return true;

        // Check for question words at the beginning
        const startsWithQuestion = questionWords.some(word => 
            cleanText.startsWith(word + ' ') || cleanText.startsWith(word + ',')
        );
        
        if (startsWithQuestion) return true;

        // Check for question pattern anywhere in text
        const containsQuestionPattern = questionWords.some(word => 
            cleanText.includes(' ' + word + ' ') || cleanText.includes(' ' + word + ',')
        );

        if (containsQuestionPattern) return true;

        // Check for study question keywords (more flexible matching)
        const studyKeywords = [
            'fintech', 'banking', 'app', 'application', 'service', 
            'feature', 'function', 'task', 'frustration', 'challenge',
            'decision', 'choose', 'select', 'ideal', 'perfect', 'security'
        ];

        const hasStudyKeywords = studyKeywords.some(keyword => 
            cleanText.includes(keyword)
        );

        // If it has study keywords and seems like it could be a question context
        if (hasStudyKeywords && (cleanText.length > 10)) {
            console.log('[QuestionDetectionService] Potential question based on study keywords:', cleanText);
            return true;
        }

        return false;
    }

    /**
     * Build question bank with embeddings
     * @param {Array} studyQuestions - Study questions to build bank from
     */
    async _buildQuestionBank(studyQuestions) {
        console.log('[QuestionDetectionService] Building question bank...');
        
        this.questionBank.clear();
        
        for (const question of studyQuestions) {
            try {
                const embedding = await this._generateEmbedding(question.text);
                this.questionBank.set(question.id, {
                    question: question,
                    embedding: embedding
                });
                
                console.log(`[QuestionDetectionService] Added question to bank: ${question.id}`);
            } catch (error) {
                console.error(`[QuestionDetectionService] Failed to embed question ${question.id}:`, error);
            }
        }
        
        console.log('[QuestionDetectionService] Question bank built with', this.questionBank.size, 'questions');
    }

    /**
     * Find best matching study question using embeddings
     * @param {string} utterance - The detected question utterance
     * @returns {Object} Match result with type, questionId, score, etc.
     */
    async _findBestQuestionMatch(utterance) {
        if (this.questionBank.size === 0) {
            return {
                type: 'off_script',
                score: 0,
                questionId: null
            };
        }

        try {
            const utteranceEmbedding = await this._generateEmbedding(utterance);
            let bestMatch = null;
            let bestScore = 0;

            // Compare against all study questions
            for (const [questionId, data] of this.questionBank) {
                const score = this._cosineSimilarity(utteranceEmbedding, data.embedding);
                
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = {
                        questionId: questionId,
                        question: data.question,
                        score: score
                    };
                }
            }

            console.log('[QuestionDetectionService] Best match:', { 
                questionId: bestMatch?.questionId, 
                score: bestScore,
                threshold_high: this.confidence_threshold_high,
                threshold_low: this.confidence_threshold_low
            });

            // Determine match type based on confidence thresholds
            if (bestScore >= this.confidence_threshold_high) {
                return {
                    type: 'scripted',
                    questionId: bestMatch.questionId,
                    score: bestScore,
                    confidence: 'high'
                };
            } else if (bestScore >= this.confidence_threshold_low) {
                return {
                    type: 'ambiguous',
                    questionId: bestMatch.questionId,
                    candidates: [bestMatch.questionId],
                    score: bestScore,
                    confidence: 'medium'
                };
            } else {
                return {
                    type: 'off_script',
                    questionId: null,
                    score: bestScore,
                    confidence: 'low'
                };
            }

        } catch (error) {
            console.error('[QuestionDetectionService] Error in question matching:', error);
            return {
                type: 'off_script',
                questionId: null,
                score: 0,
                error: error.message
            };
        }
    }

    /**
     * Generate embedding for text (placeholder - integrate with your embedding service)
     * @param {string} text - Text to embed
     * @returns {Array} Embedding vector
     */
    async _generateEmbedding(text) {
        // TODO: Integrate with actual embedding service (OpenAI, Cohere, etc.)
        // For now, using a simple word-based hash as placeholder
        return this._simpleTextEmbedding(text);
    }

    /**
     * Simple text embedding using word hashing (placeholder)
     * @param {string} text - Text to embed
     * @returns {Array} Simple embedding vector
     */
    _simpleTextEmbedding(text) {
        const words = text.toLowerCase().split(/\s+/);
        const vector = new Array(100).fill(0);
        
        words.forEach((word, index) => {
            const hash = this._simpleHash(word);
            vector[hash % 100] += 1;
        });
        
        // Normalize vector
        const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
        return magnitude > 0 ? vector.map(val => val / magnitude) : vector;
    }

    /**
     * Simple hash function for words
     * @param {string} str - String to hash
     * @returns {number} Hash value
     */
    _simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }

    /**
     * Calculate cosine similarity between two vectors
     * @param {Array} vecA - First vector
     * @param {Array} vecB - Second vector
     * @returns {number} Similarity score (0-1)
     */
    _cosineSimilarity(vecA, vecB) {
        if (vecA.length !== vecB.length) {
            console.warn('[QuestionDetectionService] Vector length mismatch');
            return 0;
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }

        if (normA === 0 || normB === 0) {
            return 0;
        }

        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    /**
     * Manually override the current question (for UI shortcuts)
     * @param {string} questionId - Question ID to set as current
     */
    manualOverride(questionId) {
        if (!this.isActive) return;

        const questionData = this.questionBank.get(questionId);
        if (!questionData) {
            console.warn('[QuestionDetectionService] Manual override: Question not found:', questionId);
            return;
        }

        const event = {
            utc: Date.now(),
            type: 'scripted',
            questionId: questionId,
            score: 1.0,
            confidence: 'manual_override',
            text: questionData.question.text
        };

        console.log('[QuestionDetectionService] Manual override triggered:', event);
        this.emit('question-detected', event);
    }
}

module.exports = QuestionDetectionService; 