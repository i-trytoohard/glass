const { EventEmitter } = require('events');
const modelStateService = require('../common/services/modelStateService');
const { createEmbedding, createLLM } = require('../common/ai/factory');

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
        this.questionBank = new Map(); // questionId -> { question, embedding }
        this.sttBuffer = [];
        this.bufferTimeout = null;
        this.processingTimeoutId = null;
        this.lastQuestionAt = 0;
        this.currentQuestionId = null;
        
        // Embedding client (lazy-loaded)
        this.embeddingClient = null;
        this.embeddingModel = 'text-embedding-3-small'; // OpenAI's efficient embedding model
        
        // LLM client for question extraction fallback (lazy-loaded)
        this.llmClient = null;
        
        // Simple cache for LLM question extraction (avoid duplicate calls)
        this.llmCache = new Map(); // text -> extracted questions
        this.maxCacheSize = 50; // Keep cache manageable
        
        // Confidence thresholds - adjusted for LLM embeddings (higher similarity expected)
        this.confidence_threshold_high = 0.85; // High confidence for direct match (LLM embeddings are more precise)
        this.confidence_threshold_low = 0.70;  // Below this is likely off-script
        
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
        this.questionBank.clear();
        this.sttBuffer = [];
        
        // Clean up timeouts
        if (this.processingTimeoutId) {
            clearTimeout(this.processingTimeoutId);
            this.processingTimeoutId = null;
        }
        
        // Clean up clients
        this.embeddingClient = null;
        this.llmClient = null;
        
        // Clear caches
        this.llmCache.clear();
        
        this.emit('detection-stopped');
    }

    /**
     * Process transcript segments for question detection
     * @param {string} transcript - Audio transcript text
     * @param {string} speaker - Speaker identification
     */
    async processTranscript(transcript, speaker = 'moderator') {
        if (!this.isActive) return;

        console.log('[QuestionDetectionService] Processing transcript:', { 
            text: transcript.substring(0, 50) + '...', 
            speaker 
        });

        // Add to buffer for sentence completion detection
        this.sttBuffer.push({ text: transcript, timestamp: Date.now() });
        
        // Increased buffer size to handle longer questions (up to ~2 minutes of speech)
        if (this.sttBuffer.length > 25) {
            this.sttBuffer = this.sttBuffer.slice(-25);
        }

        // Debounce processing to wait for complete sentences
        if (this.processingTimeoutId) {
            clearTimeout(this.processingTimeoutId);
        }
        
        // Dynamic timeout based on content - longer for potential questions
        const combinedText = this.sttBuffer.map(item => item.text).join(' ');
        const mightBeQuestion = this._containsQuestionIndicators(combinedText);
        const timeout = mightBeQuestion ? 2500 : 1500; // Wait longer for questions
        
        console.log(`[QuestionDetectionService] Setting ${timeout}ms timeout (question indicators: ${mightBeQuestion})`);
        
        this.processingTimeoutId = setTimeout(() => {
            this._processBufferedTranscript();
        }, timeout);
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

        // NEW: Extract potential questions from mixed content
        const extractedQuestions = await this._extractQuestionsFromText(combinedText);
        
        if (extractedQuestions.length === 0) {
            console.log('[QuestionDetectionService] No questions found in text');
            return;
        }

        // Process each extracted question
        for (const questionText of extractedQuestions) {
            console.log('[QuestionDetectionService] Processing extracted question:', questionText);
            
            // Avoid processing the same utterance twice
            if (questionText === this.lastUtterance) {
                console.log('[QuestionDetectionService] Skipping duplicate utterance');
                continue;
            }
            this.lastUtterance = questionText;

            // Find best matching study question
            const matchResult = await this._findBestQuestionMatch(questionText);
            
            const event = {
                utc: Date.now(),
                text: questionText,
                ...matchResult
            };

            console.log('[QuestionDetectionService] Question detected:', event);
            this.emit('question-detected', event);
        }

        // Clear buffer after processing
        this.sttBuffer = [];
    }

    /**
     * Extract question sentences from mixed dialogue
     * @param {string} text - Full text that may contain questions and other dialogue
     * @returns {Array<string>} Array of extracted question sentences
     */
    async _extractQuestionsFromText(text) {
        const questions = [];
        
        // First attempt: Pattern-based extraction (fast and reliable for clear cases)
        const sentences = text
            .split(/[.!?]+/)
            .map(s => s.trim())
            .filter(s => s.length > 0);
        
        console.log('[QuestionDetectionService] Split into sentences:', sentences);
        
        for (const sentence of sentences) {
            if (this._looksLikeQuestion(sentence)) {
                // Clean up the sentence
                let cleanQuestion = sentence.trim();
                
                // Add question mark if missing but clearly a question
                if (!cleanQuestion.endsWith('?') && this._isDefinitelyQuestion(cleanQuestion)) {
                    cleanQuestion += '?';
                }
                
                questions.push(cleanQuestion);
                console.log('[QuestionDetectionService] Extracted question (pattern-based):', cleanQuestion);
            }
        }
        
        // If pattern-based extraction found questions, return them
        if (questions.length > 0) {
            return questions;
        }
        
        // Fallback: LLM-based intelligent question extraction
        console.log('[QuestionDetectionService] Pattern-based extraction failed, trying LLM fallback...');
        
        try {
            const llmQuestions = await this._extractQuestionsWithLLM(text);
            if (llmQuestions.length > 0) {
                console.log('[QuestionDetectionService] LLM extracted questions:', llmQuestions);
                return llmQuestions;
            }
        } catch (error) {
            console.error('[QuestionDetectionService] LLM question extraction failed:', error.message);
        }
        
        // Final fallback: If LLM also fails, check if whole text might be a question
        if (this._looksLikeQuestion(text)) {
            console.log('[QuestionDetectionService] Using whole text as potential question');
            const cleanText = text.trim();
            return [cleanText.endsWith('?') ? cleanText : cleanText + '?'];
        }
        
        return [];
    }

    /**
     * Use LLM to intelligently extract questions from mixed dialogue
     * @param {string} text - Mixed text that may contain questions
     * @returns {Promise<Array<string>>} Array of extracted questions
     */
    async _extractQuestionsWithLLM(text) {
        try {
            // Performance optimization: Skip LLM for obvious non-questions
            if (!this._worthLLMAnalysis(text)) {
                console.log('[QuestionDetectionService] Text not worth LLM analysis, skipping');
                return [];
            }
            
            // Check cache first
            const cachedQuestions = this.llmCache.get(text);
            if (cachedQuestions) {
                console.log('[QuestionDetectionService] Using cached LLM questions for:', text);
                return cachedQuestions;
            }

            // Lazy-load LLM client
            if (!this.llmClient) {
                await this._initializeLLMClient();
            }
            
            if (!this.llmClient) {
                console.warn('[QuestionDetectionService] LLM client not available for question extraction');
                return [];
            }
            
            const prompt = this._buildQuestionExtractionPrompt(text);
            
            console.log('[QuestionDetectionService] Sending text to LLM for question extraction...');
            const response = await this.llmClient.chat([
                { role: 'user', content: prompt }
            ]);
            
            const result = this._parseQuestionExtractionResponse(response.content);
            console.log('[QuestionDetectionService] LLM extraction result:', result);
            
            // Cache the result
            if (result.questions.length > 0) {
                this.llmCache.set(text, result.questions);
                // Evict oldest if cache is full
                if (this.llmCache.size > this.maxCacheSize) {
                    this.llmCache.delete(this.llmCache.keys().next().value);
                }
            }
            
            return result.questions || [];
            
        } catch (error) {
            console.error('[QuestionDetectionService] LLM question extraction error:', error);
            return [];
        }
    }

    /**
     * Check if text is worth sending to LLM for analysis
     * @param {string} text 
     * @returns {boolean}
     */
    _worthLLMAnalysis(text) {
        if (!text || text.trim().length < 5) {
            return false; // Too short
        }
        
        if (text.trim().length > 500) {
            return false; // Too long (likely not a single conversation turn)
        }
        
        const cleanText = text.toLowerCase().trim();
        
        // Skip obvious non-questions
        const nonQuestionPhrases = [
            'okay', 'yeah', 'sure', 'right', 'exactly', 'totally', 
            'i see', 'got it', 'makes sense', 'interesting', 'cool',
            'mhm', 'mmm', 'uh huh', 'alright', 'thanks', 'thank you'
        ];
        
        const isObviousNonQuestion = nonQuestionPhrases.some(phrase => 
            cleanText === phrase || cleanText === phrase + '.'
        );
        
        if (isObviousNonQuestion) {
            return false;
        }
        
        // Must contain at least some question indicators to be worth LLM analysis
        const questionIndicators = [
            '?', 'what', 'how', 'why', 'when', 'where', 'who', 'which',
            'can', 'could', 'would', 'should', 'do', 'did', 'are', 'is',
            'tell', 'describe', 'explain', 'think', 'feel', 'experience',
            'opinion', 'thoughts', 'preference', 'like', 'dislike'
        ];
        
        const hasQuestionIndicators = questionIndicators.some(indicator => 
            cleanText.includes(indicator)
        );
        
        return hasQuestionIndicators;
    }

    /**
     * Initialize LLM client for question extraction
     */
    async _initializeLLMClient() {
        try {
            if (this.llmClient) return; // Already initialized
            
            console.log('[QuestionDetectionService] Initializing LLM client for question extraction...');
            
            const modelInfo = await modelStateService.getCurrentModelInfo('llm');
            
            if (!modelInfo || !modelInfo.apiKey) {
                console.warn('[QuestionDetectionService] No LLM configuration found');
                return;
            }
            
            this.llmClient = createLLM(modelInfo.provider, {
                apiKey: modelInfo.apiKey,
                model: modelInfo.model,
                temperature: 0.1, // Low temperature for consistent extraction
                maxTokens: 500    // Short responses for question extraction
            });
            
            console.log(`[QuestionDetectionService] LLM client initialized (${modelInfo.provider})`);
            
        } catch (error) {
            console.error('[QuestionDetectionService] Failed to initialize LLM client:', error);
            this.llmClient = null;
        }
    }

    /**
     * Build prompt for LLM question extraction
     * @param {string} text - Text to analyze
     * @returns {string} Prompt for LLM
     */
    _buildQuestionExtractionPrompt(text) {
        return `You are analyzing conversation text to extract research interview questions. 

TEXT TO ANALYZE:
"${text}"

TASK: Identify and extract any questions that an interviewer might be asking a participant. These could be:
- Direct questions (What do you think about...?)
- Requests for information (Tell me about..., Describe your...)
- Opinion/experience inquiries (How do you feel about..., What's your experience with...)

RULES:
1. Only extract text that is clearly a question or request for information
2. Ignore casual dialogue, confirmations, or statements
3. Extract the exact question text, cleaning up any speech artifacts
4. If multiple questions exist, extract each one separately
5. If no clear questions exist, return empty array

RESPONSE FORMAT:
Return a JSON object with this exact structure:
{
  "questions": ["extracted question 1", "extracted question 2"],
  "explanation": "brief explanation of what was found"
}

Examples:
- "Yeah, that sounds good. Can you tell me about your experience?" → {"questions": ["Can you tell me about your experience?"], "explanation": "Found one question about experience"}
- "Interesting. How do you feel about that? What would you change?" → {"questions": ["How do you feel about that?", "What would you change?"], "explanation": "Found two opinion questions"}
- "Okay, yeah, I see." → {"questions": [], "explanation": "No questions found, only acknowledgments"}`;
    }

    /**
     * Parse LLM response for question extraction
     * @param {string} response - LLM response content
     * @returns {Object} Parsed result with questions array
     */
    _parseQuestionExtractionResponse(response) {
        try {
            // Try to extract JSON from response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                console.warn('[QuestionDetectionService] No JSON found in LLM response');
                return { questions: [] };
            }
            
            const result = JSON.parse(jsonMatch[0]);
            
            // Validate result structure
            if (!Array.isArray(result.questions)) {
                console.warn('[QuestionDetectionService] Invalid LLM response structure');
                return { questions: [] };
            }
            
            // Filter and clean questions
            const cleanQuestions = result.questions
                .filter(q => typeof q === 'string' && q.trim().length > 0)
                .map(q => q.trim())
                .filter(q => q.length > 5); // Minimum reasonable question length
            
            return {
                questions: cleanQuestions,
                explanation: result.explanation || 'LLM extraction completed'
            };
            
        } catch (error) {
            console.error('[QuestionDetectionService] Failed to parse LLM response:', error);
            return { questions: [] };
        }
    }

    /**
     * Check if text is definitely a question (high confidence)
     * @param {string} text 
     * @returns {boolean}
     */
    _isDefinitelyQuestion(text) {
        const cleanText = text.trim().toLowerCase();
        
        const definiteQuestionStarters = [
            'what', 'how', 'why', 'when', 'where', 'who', 'which',
            'can you', 'could you', 'would you', 'do you', 'did you', 
            'are you', 'have you', 'tell me', 'describe'
        ];
        
        return definiteQuestionStarters.some(starter => 
            cleanText.startsWith(starter + ' ')
        );
    }

    /**
     * Check if text appears to be a question
     * @param {string} text 
     * @returns {boolean}
     */
    _looksLikeQuestion(text) {
        if (!text || text.trim().length < 3) return false;
        
        const cleanText = text.trim().toLowerCase();
        
        // Check for question mark - strongest indicator
        if (text.includes('?')) return true;

        // Comprehensive question indicators
        const questionWords = [
            // WH-words
            'what', 'how', 'why', 'when', 'where', 'who', 'which', 'whose',
            // Modal + you patterns
            'can you', 'could you', 'would you', 'will you', 'should you',
            'do you', 'did you', 'are you', 'have you', 'had you',
            // Imperative question starters
            'tell me', 'describe', 'explain', 'walk me through', 'share',
            'think about', 'talk about', 'give me', 'show me',
            // Experience/opinion questions
            'experience with', 'feel about', 'opinion on', 'thoughts on',
            'impression of', 'perspective on', 'view on'
        ];

        // Check for question words at the beginning (most common)
        const startsWithQuestion = questionWords.some(word => {
            const pattern = word.replace(/\s+/g, '\\s+'); // Handle multi-word patterns
            const regex = new RegExp(`^${pattern}\\b`, 'i');
            return regex.test(cleanText);
        });
        
        if (startsWithQuestion) {
            console.log('[QuestionDetectionService] Question detected by start pattern');
            return true;
        }

        // Check for question pattern anywhere in text (for mixed content)
        const containsQuestionPattern = questionWords.some(word => {
            const pattern = word.replace(/\s+/g, '\\s+');
            const regex = new RegExp(`\\b${pattern}\\b`, 'i');
            return regex.test(cleanText);
        });

        if (containsQuestionPattern) {
            console.log('[QuestionDetectionService] Question detected by contained pattern');
            return true;
        }

        // Check for study-specific question keywords (domain-aware detection)
        const studyKeywords = [
            // Fintech/banking terms
            'fintech', 'banking', 'financial', 'payment', 'transaction', 'money',
            'app', 'application', 'service', 'platform', 'tool',
            // UX research terms  
            'feature', 'function', 'task', 'process', 'workflow',
            'frustration', 'challenge', 'problem', 'difficulty',
            'decision', 'choose', 'select', 'prefer', 'like', 'dislike',
            'ideal', 'perfect', 'dream', 'wish', 'want', 'need',
            'security', 'trust', 'safety', 'privacy', 'protection',
            // Experience terms
            'experience', 'journey', 'interaction', 'usage', 'behavior'
        ];

        const hasStudyKeywords = studyKeywords.some(keyword => 
            cleanText.includes(keyword)
        );

        // More flexible length requirement for keyword-based detection
        if (hasStudyKeywords && cleanText.length > 8) {
            // Additional checks to reduce false positives
            const hasQuestionContext = /\b(your|you|how|what|when|why|tell|describe|think|feel|experience)\b/.test(cleanText);
            
            if (hasQuestionContext) {
                console.log('[QuestionDetectionService] Question detected by study keywords + context');
                return true;
            }
        }

        // Check for question intonation patterns in text
        const questionIntonationPatterns = [
            /\b(right|correct|yes|no)\?*$/i,  // Tag questions: "...right?" "...correct?"
            /^(is|are|do|does|did|will|would|can|could)\b/i,  // Yes/no question starters
            /\b(or not|either|choice|option)\b/i  // Choice questions
        ];

        const hasQuestionIntonation = questionIntonationPatterns.some(pattern => 
            pattern.test(cleanText)
        );

        if (hasQuestionIntonation) {
            console.log('[QuestionDetectionService] Question detected by intonation pattern');
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
                // Fix: Use question_text property instead of text
                const embedding = await this._generateEmbedding(question.question_text);
                this.questionBank.set(question.id, {
                    question: question,
                    embedding: embedding
                });
                
                console.log(`[QuestionDetectionService] Added question to bank: ${question.id} - "${question.question_text?.substring(0, 50)}..."`);
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
                questionId: bestMatch?.questionId?.substring(0, 8), 
                questionText: bestMatch?.question?.question_text?.substring(0, 50),
                score: Math.round(bestScore * 100) / 100,
                threshold_high: this.confidence_threshold_high,
                threshold_low: this.confidence_threshold_low,
                embeddingType: this.embeddingClient ? 'LLM' : 'fallback'
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
     * Generate embedding for text using LLM provider with fallback
     * @param {string} text - Text to embed
     * @returns {Array} Embedding vector
     */
    async _generateEmbedding(text) {
        try {
            // Lazy-load embedding client
            if (!this.embeddingClient) {
                await this._initializeEmbeddingClient();
            }
            
            if (this.embeddingClient) {
                console.log(`[QuestionDetectionService] Generating LLM embedding for: "${text.substring(0, 50)}..."`);
                const embedding = await this.embeddingClient.embed(text);
                console.log(`[QuestionDetectionService] Generated ${embedding.length}-dimensional embedding`);
                return embedding;
            } else {
                console.warn('[QuestionDetectionService] LLM embeddings not available, using fallback');
                return this._simpleTextEmbedding(text);
            }
        } catch (error) {
            console.error('[QuestionDetectionService] LLM embedding failed, using fallback:', error.message);
            return this._simpleTextEmbedding(text);
        }
    }

    /**
     * Initialize embedding client using current LLM configuration
     */
    async _initializeEmbeddingClient() {
        try {
            console.log('[QuestionDetectionService] Initializing embedding client...');
            
            // Get current LLM configuration
            const modelInfo = await modelStateService.getCurrentModelInfo('llm');
            
            if (!modelInfo || !modelInfo.apiKey) {
                console.warn('[QuestionDetectionService] No LLM configuration found for embeddings');
                return;
            }
            
            console.log(`[QuestionDetectionService] Using provider: ${modelInfo.provider} for embeddings`);
            
            // Create embedding client (currently OpenAI and Gemini supported)
            if (modelInfo.provider === 'openai' || modelInfo.provider === 'openai-glass') {
                this.embeddingClient = createEmbedding(modelInfo.provider, {
                    apiKey: modelInfo.apiKey,
                    model: this.embeddingModel
                });
                // OpenAI embeddings typically have higher similarity scores
                this.confidence_threshold_high = 0.85;
                this.confidence_threshold_low = 0.70;
                console.log('[QuestionDetectionService] OpenAI embedding client initialized');
            } else if (modelInfo.provider === 'gemini') {
                this.embeddingClient = createEmbedding(modelInfo.provider, {
                    apiKey: modelInfo.apiKey,
                    model: 'text-embedding-004' // Gemini's embedding model
                });
                // Gemini embeddings may have different similarity ranges
                this.confidence_threshold_high = 0.80;
                this.confidence_threshold_low = 0.65;
                console.log('[QuestionDetectionService] Gemini embedding client initialized');
            } else {
                console.warn(`[QuestionDetectionService] Embeddings not supported for provider: ${modelInfo.provider}`);
            }
            
        } catch (error) {
            console.error('[QuestionDetectionService] Failed to initialize embedding client:', error);
            this.embeddingClient = null;
        }
    }

    /**
     * Simple text embedding using word hashing (placeholder)
     * @param {string} text - Text to embed
     * @returns {Array} Simple embedding vector
     */
    _simpleTextEmbedding(text) {
        // Safety check for undefined or null text
        if (!text || typeof text !== 'string') {
            console.warn('[QuestionDetectionService] Invalid text for embedding:', text);
            return new Array(100).fill(0);
        }
        
        const words = text.toLowerCase().split(/\s+/);
        const vector = new Array(100).fill(0);
        
        words.forEach((word, index) => {
            const hash = this._simpleHash(word);
            vector[hash % 100] += 1;
        });
        
        return vector;
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

    /**
     * Quick check if text contains question indicators (for timeout adjustment)
     * @param {string} text 
     * @returns {boolean}
     */
    _containsQuestionIndicators(text) {
        if (!text) return false;
        
        const quickIndicators = [
            '?', 'what', 'how', 'why', 'when', 'where', 'who', 'which',
            'can you', 'could you', 'tell me', 'describe', 'explain'
        ];
        
        const lowerText = text.toLowerCase();
        return quickIndicators.some(indicator => lowerText.includes(indicator));
    }
}

module.exports = QuestionDetectionService; 