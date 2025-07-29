const { EventEmitter } = require('events');
const modelStateService = require('../common/services/modelStateService');
const { createEmbedding, createLLM } = require('../common/ai/factory');

// Utility function to create formatted timestamps for logs
function timestamp() {
    return new Date().toISOString().substr(11, 12); // HH:MM:SS.mmm format
}

// Utility function for timestamped logging
function logWithTimestamp(level = 'log', ...args) {
    console[level](`${timestamp()} [QuestionDetectionService]`, ...args);
}

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
        this.processingTimeoutId = null; // Legacy - will be removed
        this.refinementTimeoutId = null; // New: timeout for delayed refinement processing
        this.lastQuestionAt = 0;
        this.currentQuestionId = null;
        this.lastImmediatelyProcessedText = null; // Track what we've already processed immediately
        
        // Embedding client (lazy-loaded)
        this.embeddingClient = null;
        this.embeddingModel = 'text-embedding-3-small'; // OpenAI's efficient embedding model
        
        // LLM client for question extraction fallback (lazy-loaded)
        this.llmClient = null;
        
        // Simple cache for LLM question extraction (avoid duplicate calls)
        this.llmCache = new Map(); // text -> extracted questions
        this.maxCacheSize = 50; // Keep cache manageable
        
        // Confidence thresholds - adjusted for LLM embeddings (higher similarity expected)
        this.confidence_threshold_high = 0.75; // High confidence for direct match (more permissive for real-world usage)
        this.confidence_threshold_low = 0.55;  // Below this is likely off-script (lowered from 0.70)
        
        logWithTimestamp('log', `Service initialized`);
    }

    /**
     * Start question detection for a research session
     * @param {Array} studyQuestions - Array of study question objects
     */
    async startDetection(studyQuestions = []) {
        try {
            logWithTimestamp('log', `Starting detection with`, studyQuestions.length, 'study questions');
            
            this.currentStudyQuestions = studyQuestions;
            await this._buildQuestionBank(studyQuestions);
            
            this.isActive = true;
            this.emit('detection-started', { questionCount: studyQuestions.length });
            
            logWithTimestamp('log', `Detection started successfully`);
        } catch (error) {
            logWithTimestamp('error', `Failed to start detection:`, error);
            throw error;
        }
    }

    /**
     * Stop question detection
     */
    stopDetection() {
        logWithTimestamp('log', `Stopping detection`);
        
        this.isActive = false;
        this.questionBank.clear();
        this.sttBuffer = [];
        this.lastImmediatelyProcessedText = null;
        
        // Clean up timeouts
        if (this.processingTimeoutId) {
            clearTimeout(this.processingTimeoutId);
            this.processingTimeoutId = null;
        }
        if (this.refinementTimeoutId) {
            clearTimeout(this.refinementTimeoutId);
            this.refinementTimeoutId = null;
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

        // SAFETY CHECK: Only process moderator/interviewer audio for question detection
        // Ignore participant responses to avoid false question detection
        if (speaker !== 'moderator') {
            logWithTimestamp('log', `Ignoring non-moderator audio from ${speaker}: "${transcript.substring(0, 30)}..."`);
            return;
        }

        logWithTimestamp('log', `Processing moderator transcript for question detection:`, { 
            text: transcript.substring(0, 50) + '...', 
            speaker 
        });

        // Add to buffer for sentence completion detection
        this.sttBuffer.push({ text: transcript, timestamp: Date.now() });
        
        // Increased buffer size to handle longer questions (up to ~2 minutes of speech)
        if (this.sttBuffer.length > 25) {
            this.sttBuffer = this.sttBuffer.slice(-25);
        }

        // NEW APPROACH: Process immediately for speed, then refine for accuracy
        
        // 1. IMMEDIATE PROCESSING: Process current buffer right away for fast response
        //    But only if we haven't already processed this text immediately
        const currentText = this.sttBuffer.map(item => item.text).join(' ').trim();
        const hasNewContent = currentText !== this.lastImmediatelyProcessedText;
        
        if (hasNewContent) {
            logWithTimestamp('log', `Processing immediately for fast response...`);
            this.lastImmediatelyProcessedText = currentText;
            await this._processBufferedTranscript('immediate');
        } else {
            logWithTimestamp('log', `Skipping immediate processing - no new content since last immediate pass`);
        }

        // 2. DELAYED REFINEMENT: Also schedule a refinement pass with more complete text
        if (this.refinementTimeoutId) {
            clearTimeout(this.refinementTimeoutId);
        }
        
        const combinedText = this.sttBuffer.map(item => item.text).join(' ');
        const mightBeQuestion = this._containsQuestionIndicators(combinedText);
        const refinementTimeout = mightBeQuestion ? 600 : 400; // Time to wait for complete sentences
        
        logWithTimestamp('log', `Scheduling refinement in ${refinementTimeout}ms (question indicators: ${mightBeQuestion})`);
        
        this.refinementTimeoutId = setTimeout(async () => {
            logWithTimestamp('log', `Running refinement pass with buffer content (fallback)...`);
            await this._processBufferedTranscript('refinement');
        }, refinementTimeout);
    }

    /**
     * Process a complete interviewer turn with full context
     * This is called by ResearchService when it has the complete interviewer turn
     * @param {string} fullTurnText - Complete interviewer turn text
     */
    async processCompleteInterviewerTurn(fullTurnText) {
        if (!this.isActive || !fullTurnText || fullTurnText.trim().length === 0) return;
        
        logWithTimestamp('log', `Processing complete interviewer turn: "${fullTurnText.substring(0, 100)}..."`);
        
        // Cancel any pending refinement timeout since we have the complete turn
        if (this.refinementTimeoutId) {
            clearTimeout(this.refinementTimeoutId);
            this.refinementTimeoutId = null;
            logWithTimestamp('log', `Cancelled pending refinement - using complete turn context`);
        }
        
        // Process with full context for better question matching
        await this._processBufferedTranscript('refinement', fullTurnText);
    }

    /**
     * Process buffered transcript for complete sentences
     * @param {string} mode - 'immediate' for fast processing, 'refinement' for complete text
     * @param {string} fullContext - Complete interviewer turn context (for refinement mode)
     */
    async _processBufferedTranscript(mode = 'refinement', fullContext = null) {
        if (this.sttBuffer.length === 0 && !fullContext) return;

        // For refinement mode with full context: use the complete interviewer turn
        // For immediate mode or no context: use the current buffer
        const combinedText = (mode === 'refinement' && fullContext) 
            ? fullContext.trim()
            : this.sttBuffer
            .map(item => item.text)
            .join(' ')
            .trim();

        logWithTimestamp('log', `Processing combined text (${mode} mode):`, combinedText);
        
        if (mode === 'refinement' && fullContext) {
            logWithTimestamp('log', `Using full interviewer turn context for refinement (${combinedText.length} chars)`);
        }

        // NEW: Extract potential questions from mixed content
        const extractedQuestions = await this._extractQuestionsFromText(combinedText);
        
        if (extractedQuestions.length === 0) {
            logWithTimestamp('log', `No questions found in text (${mode} mode)`);
            return;
        }

        // Process each extracted question
        for (const questionText of extractedQuestions) {
            logWithTimestamp('log', `Processing extracted question (${mode} mode):`, questionText);
            
            // For immediate mode: always process (fast feedback)
            // For refinement mode: avoid processing the same question twice
            if (mode === 'refinement' && questionText === this.lastUtterance) {
                logWithTimestamp('log', `Skipping duplicate utterance in refinement mode`);
                continue;
            }
            
            // Update last utterance to prevent future duplicates
            this.lastUtterance = questionText;

        // Find best matching study question
            const matchResult = await this._findBestQuestionMatch(questionText);
        
        const event = {
            utc: Date.now(),
                text: questionText,
                mode: mode, // Track which mode detected this
            ...matchResult
        };

            logWithTimestamp('log', `Question detected (${mode} mode):`, event);
        this.emit('question-detected', event);
        }

        // Clear buffer after refinement processing (but not immediate processing)
        if (mode === 'refinement') {
        this.sttBuffer = [];
            logWithTimestamp('log', `Buffer cleared after refinement processing`);
            // Clear the immediate processing tracker after refinement
            this.lastImmediatelyProcessedText = null;
        }
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
        
        logWithTimestamp('log', `Split into sentences:`, sentences);
        
        for (const sentence of sentences) {
            if (this._looksLikeQuestion(sentence)) {
                // Clean up the sentence
                let cleanQuestion = sentence.trim();
                
                // Add question mark if missing but clearly a question
                if (!cleanQuestion.endsWith('?') && this._isDefinitelyQuestion(cleanQuestion)) {
                    cleanQuestion += '?';
                }
                
                questions.push(cleanQuestion);
                logWithTimestamp('log', `Extracted question (pattern-based):`, cleanQuestion);
            }
        }
        
        // If pattern-based extraction found questions, return them
        if (questions.length > 0) {
            return questions;
        }
        
        // Fallback: LLM-based intelligent question extraction
        logWithTimestamp('log', `Pattern-based extraction failed, trying LLM fallback...`);
        
        try {
            const llmQuestions = await this._extractQuestionsWithLLM(text);
            if (llmQuestions.length > 0) {
                logWithTimestamp('log', `LLM extracted questions:`, llmQuestions);
                return llmQuestions;
            }
        } catch (error) {
            logWithTimestamp('error', `LLM question extraction failed:`, error.message);
        }
        
        // Final fallback: If LLM also fails, check if whole text might be a question
        if (this._looksLikeQuestion(text)) {
            logWithTimestamp('log', `Using whole text as potential question`);
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
                logWithTimestamp('log', `Text not worth LLM analysis, skipping`);
                return [];
            }
            
            // Check cache first
            const cachedQuestions = this.llmCache.get(text);
            if (cachedQuestions) {
                logWithTimestamp('log', `Using cached LLM questions for:`, text);
                return cachedQuestions;
            }

            // Lazy-load LLM client
            if (!this.llmClient) {
                await this._initializeLLMClient();
            }
            
            if (!this.llmClient) {
                logWithTimestamp('warn', `LLM client not available for question extraction`);
                return [];
            }
            
            const prompt = this._buildQuestionExtractionPrompt(text);
            
            logWithTimestamp('log', `Sending text to LLM for question extraction...`);
            const response = await this.llmClient.chat([
                { role: 'user', content: prompt }
            ]);
            
            const result = this._parseQuestionExtractionResponse(response.content);
            logWithTimestamp('log', `LLM extraction result:`, result);
            
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
            logWithTimestamp('error', `LLM question extraction error:`, error);
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
            
            logWithTimestamp('log', `Initializing LLM client for question extraction...`);
            
            const modelInfo = await modelStateService.getCurrentModelInfo('llm');
            
            if (!modelInfo || !modelInfo.apiKey) {
                logWithTimestamp('warn', `No LLM configuration found`);
                return;
            }
            
            this.llmClient = createLLM(modelInfo.provider, {
                apiKey: modelInfo.apiKey,
                model: modelInfo.model,
                temperature: 0.1, // Low temperature for consistent extraction
                maxTokens: 500    // Short responses for question extraction
            });
            
            logWithTimestamp('log', `LLM client initialized (${modelInfo.provider})`);
            
        } catch (error) {
            logWithTimestamp('error', `Failed to initialize LLM client:`, error);
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
                logWithTimestamp('warn', `No JSON found in LLM response`);
                return { questions: [] };
            }
            
            const result = JSON.parse(jsonMatch[0]);
            
            // Validate result structure
            if (!Array.isArray(result.questions)) {
                logWithTimestamp('warn', `Invalid LLM response structure`);
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
            logWithTimestamp('error', `Failed to parse LLM response:`, error);
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
            logWithTimestamp('log', `Question detected by start pattern`);
            return true;
        }

        // Check for question pattern anywhere in text (for mixed content)
        const containsQuestionPattern = questionWords.some(word => {
            const pattern = word.replace(/\s+/g, '\\s+');
            const regex = new RegExp(`\\b${pattern}\\b`, 'i');
            return regex.test(cleanText);
        });

        if (containsQuestionPattern) {
            logWithTimestamp('log', `Question detected by contained pattern`);
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
                logWithTimestamp('log', `Question detected by study keywords + context`);
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
            logWithTimestamp('log', `Question detected by intonation pattern`);
            return true;
        }

        return false;
    }

    /**
     * Build question bank with embeddings
     * @param {Array} studyQuestions - Study questions to build bank from
     */
    async _buildQuestionBank(studyQuestions) {
        logWithTimestamp('log', `Building question bank...`);
        
        this.questionBank.clear();
        
        for (const question of studyQuestions) {
            try {
                // Fix: Use question_text property instead of text
                const embedding = await this._generateEmbedding(question.question_text);
                this.questionBank.set(question.id, {
                    question: question,
                    embedding: embedding
                });
                
                logWithTimestamp('log', `Added question to bank: ${question.id} - "${question.question_text?.substring(0, 50)}..."`);
            } catch (error) {
                logWithTimestamp('error', `Failed to embed question ${question.id}:`, error);
            }
        }
        
        logWithTimestamp('log', `Question bank built with`, this.questionBank.size, `questions`);
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

            logWithTimestamp('log', `Best match:`, { 
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
            logWithTimestamp('error', `Error in question matching:`, error);
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
                logWithTimestamp('log', `Generating LLM embedding for: "${text.substring(0, 50)}..."`);
                const embedding = await this.embeddingClient.embed(text);
                logWithTimestamp('log', `Generated ${embedding.length}-dimensional embedding`);
                return embedding;
            } else {
                logWithTimestamp('warn', `LLM embeddings not available, using fallback`);
                return this._simpleTextEmbedding(text);
            }
        } catch (error) {
            logWithTimestamp('error', `LLM embedding failed, using fallback:`, error.message);
        return this._simpleTextEmbedding(text);
        }
    }

    /**
     * Initialize embedding client using current LLM configuration
     */
    async _initializeEmbeddingClient() {
        try {
            logWithTimestamp('log', `Initializing embedding client...`);
            
            // Get current LLM configuration
            const modelInfo = await modelStateService.getCurrentModelInfo('llm');
            
            if (!modelInfo || !modelInfo.apiKey) {
                logWithTimestamp('warn', `No LLM configuration found for embeddings`);
                return;
            }
            
            logWithTimestamp('log', `Using provider: ${modelInfo.provider} for embeddings`);
            
            // Create embedding client (currently OpenAI and Gemini supported)
            if (modelInfo.provider === 'openai' || modelInfo.provider === 'openai-glass') {
                this.embeddingClient = createEmbedding(modelInfo.provider, {
                    apiKey: modelInfo.apiKey,
                    model: this.embeddingModel
                });
                // OpenAI embeddings typically have higher similarity scores
                this.confidence_threshold_high = 0.75;
                this.confidence_threshold_low = 0.55;
                logWithTimestamp('log', `OpenAI embedding client initialized`);
            } else if (modelInfo.provider === 'gemini') {
                this.embeddingClient = createEmbedding(modelInfo.provider, {
                    apiKey: modelInfo.apiKey,
                    model: 'text-embedding-004' // Gemini's embedding model
                });
                // Gemini embeddings may have different similarity ranges
                this.confidence_threshold_high = 0.80;
                this.confidence_threshold_low = 0.65;
                logWithTimestamp('log', `Gemini embedding client initialized`);
            } else {
                logWithTimestamp('warn', `Embeddings not supported for provider: ${modelInfo.provider}`);
            }
            
        } catch (error) {
            logWithTimestamp('error', `Failed to initialize embedding client:`, error);
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
            logWithTimestamp('warn', `Invalid text for embedding:`, text);
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
            logWithTimestamp('warn', `Vector length mismatch`);
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
            logWithTimestamp('warn', `Manual override: Question not found:`, questionId);
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

        logWithTimestamp('log', `Manual override triggered:`, event);
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