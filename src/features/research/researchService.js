const { EventEmitter } = require('events');
const crypto = require('crypto');
const modelStateService = require('../common/services/modelStateService');
const { createLLM } = require('../common/ai/factory');
const { getSystemPrompt } = require('../common/prompts/promptBuilder');
const authService = require('../common/services/authService');
const researchStudyRepository = require('./repositories/researchStudy');
const researchQuestionRepository = require('./repositories/researchQuestion');
const questionResponseRepository = require('./repositories/questionResponse');
const researchSessionRepository = require('./repositories/researchSession');
const sessionRepository = require('../common/repositories/session');
const internalBridge = require('../../bridge/internalBridge');
const { localStudiesRepository } = require('../common/repositories/localStudies');
const QuestionDetectionService = require('./questionDetectionService');
const screenRecordingService = require('./screenRecordingService');

// Utility functions
function tsSec() { 
    return Math.floor(Date.now() / 1000); 
}

function concatClean(a, b) {
    if (!a) return b;
    if (!b) return a;
    return (a + ' ' + b).trim();
}

class ResearchService extends EventEmitter {
    constructor() {
        super();
        this.mode = 'manual'; // 'interviewer-driven' | 'manual'
        this.currentStudy = null;
        this.currentSession = null;
        this.activeQuestions = new Map(); // questionId -> questionData
        this.questionStatus = new Map(); // questionId -> 'pending' | 'in_progress' | 'completed'
        this.responses = new Map(); // questionId -> responseData
        this.insights = new Map(); // questionId -> insightData
        
        // Question detection service
        this.questionDetectionService = new QuestionDetectionService();
        this.setupQuestionDetectionEvents();
        
        this.activeQuestions = new Map(); // questionId -> question data
        this.questionResponses = new Map(); // questionId -> response data
        this.transcriptBuffer = []; // Recent transcript segments for analysis
        this.lastAnalysisTime = 0;
        this.analysisInterval = 1000; // Minimum 1 second between analyses to prevent spam
        this.isLiveAnalysisActive = false;
        this.currentQuestionBeingAsked = null; // Track which question is currently being asked
        this.currentAnswerBeingGiven = ''; // Track the current answer being provided
        this.pendingAnalysis = false; // Track if analysis is already scheduled
        
        // Follow-up question management
        this.bestFollowUpQuestions = []; // 2 best current follow-up questions from AI
        this.displayedFollowUpQuestions = []; // Questions currently shown to user with timestamps
        this.followUpQuestionTimeout = 10000; // 10 seconds timeout for expiring questions
        this.followUpQuestionMetrics = {
            totalSuggested: 0,
            totalAsked: 0,
            responses: []
        };
        this.lastFollowUpUpdateTime = 0; // Track when follow-ups were last updated
        this.followUpUpdateInterval = 8000; // Minimum 8 seconds between follow-up updates
        this._listenService = null; // Lazy-loaded to avoid circular dependency
        
        // Interviewer-driven question activation
        this.lastInterviewerQuestionAt = 0; // Timestamp when interviewer last asked a question
        this.questionEmbeddings = new Map(); // questionId -> Float32Array embeddings
        this.participantTurnBuffer = ''; // Buffer for debounced participant scoring
        this.lastParticipantScoringAt = 0; // Timestamp of last scoring operation
        
        // NEW: Speech completion detection
        this.speakerTurnManager = {
            currentSpeaker: null,
            currentTurnBuffer: '',
            currentTurnStartTime: null,
            turnCompletionTimeout: null,
            turnCompletionDelay: 2000, // 2 seconds of silence to consider turn complete
            interviewerTurnHistory: [] // Keep last few complete interviewer turns
        };
        
        // Metrics and telemetry
        this.metrics = {
            interviewerTurns: 0,
            questionActivations: 0,
            participantTurns: 0,
            monotonicBlocks: 0,
            followUpsShown: 0
        };
        
        console.log('[ResearchService] Service initialized with speech completion detection');
    }

    // Lazy load listen service to avoid circular dependency
    _getListenService() {
        if (!this._listenService) {
            this._listenService = require('../listen/listenService');
        }
        return this._listenService;
    }

    /**
     * Set up event listeners for question detection service
     */
    setupQuestionDetectionEvents() {
        this.questionDetectionService.on('question-detected', (data) => {
            console.log('[ResearchService] Question detected:', data);
            this._handleQuestionDetected(data);
            
            // Forward to all listeners (UI, etc.)
            this.emit('question-detected', data);
        });

        this.questionDetectionService.on('detection-started', (data) => {
            console.log('[ResearchService] Question detection started:', data);
            this.emit('detection-started', data);
        });

        this.questionDetectionService.on('detection-stopped', () => {
            console.log('[ResearchService] Question detection stopped');
            this.emit('detection-stopped');
        });
    }

    /**
     * Handle detected questions from the detection service
     * @param {Object} detectionData - Question detection event data
     */
    _handleQuestionDetected(detectionData) {
        const { type, questionId, text, score, confidence } = detectionData;

        console.log('[ResearchService] Processing detected question:', {
            type, questionId, text, score, confidence
        });

        switch (type) {
            case 'scripted':
                if (questionId && this.activeQuestions.has(questionId)) {
                    // Mark question as in progress
                    this.questionStatus.set(questionId, 'in_progress');
                    console.log(`[ResearchService] Marked scripted question ${questionId} as in_progress`);
                    
                    // Emit current question change
                    this.emit('current-question-changed', {
                        questionId,
                        question: this.activeQuestions.get(questionId),
                        detectionData
                    });
                }
                break;

            case 'ambiguous':
                console.log(`[ResearchService] Ambiguous question detected (score: ${score})`);
                // Could emit to UI for manual clarification
                this.emit('ambiguous-question-detected', detectionData);
                break;

            case 'off_script':
                console.log(`[ResearchService] Off-script question detected: "${text}"`);
                // Track off-script questions for analysis
                this.emit('off-script-question-detected', detectionData);
                break;
        }

        // Always emit the raw detection for UI display
        this.emit('question-detection-update', {
            type,
            questionId,
            text,
            score,
            confidence,
            timestamp: detectionData.utc
        });
    }

    /**
     * Process incoming transcript for question detection
     * @param {string} transcript - Audio transcript
     * @param {string} speaker - Speaker identification
     */
    async processTranscript(transcript, speaker = 'moderator') {
        if (this.questionDetectionService.isActive) {
            await this.questionDetectionService.processTranscript(transcript, speaker);
        }
    }

    /**
     * Manual override for current question (keyboard shortcut support)
     * @param {string} questionId - Question ID to set as current
     */
    manualQuestionOverride(questionId) {
        if (this.questionDetectionService.isActive) {
            this.questionDetectionService.manualOverride(questionId);
        }
    }

    // ==================== STUDY MANAGEMENT ====================
    
    async createStudy(studyData) {
        console.log('[ResearchService] createStudy called with data:', studyData);
        const studyId = crypto.randomUUID();
        const currentUser = authService.getCurrentUser();
        const uid = currentUser ? currentUser.uid : 'default_user';
        
        const study = {
            id: studyId,
            uid: uid,
            title: studyData.title,
            description: studyData.description || '',
            research_type: studyData.research_type || 'user_interview',
            methodology: studyData.methodology || 'semi_structured',
            participant_profile: studyData.participant_profile || '',
            goals: studyData.goals || '',
            context: studyData.context || '',
            status: 'draft',
            created_at: Math.floor(Date.now() / 1000),
            updated_at: Math.floor(Date.now() / 1000)
        };
        
        console.log('[ResearchService] About to create study:', study);
        await researchStudyRepository.create(study);
        console.log(`[ResearchService] Created study: ${studyId}`);
        return study;
    }

    // Alias method for consistency with bridge
    async getStudies() {
        // Return local studies for dropdown selection
        // Later this will be replaced with API calls
        return localStudiesRepository.getAllStudies();
    }

    async getLocalStudy(studyId) {
        return localStudiesRepository.getStudyById(studyId);
    }

    async getLocalStudyQuestions(studyId) {
        return localStudiesRepository.getStudyQuestions(studyId);
    }

    async updateStudy(studyId, updateData) {
        const updated = await researchStudyRepository.update(studyId, {
            ...updateData,
            updated_at: Math.floor(Date.now() / 1000)
        });
        
        if (this.currentStudy && this.currentStudy.id === studyId) {
            this.currentStudy = { ...this.currentStudy, ...updateData };
        }
        
        return updated;
    }

    async getStudy(studyId) {
        const currentUser = authService.getCurrentUser();
        const uid = currentUser ? currentUser.uid : 'default_user';
        return await researchStudyRepository.getById(studyId, uid);
    }

    async getAllStudies() {
        const currentUser = authService.getCurrentUser();
        const uid = currentUser ? currentUser.uid : 'default_user';
        return await researchStudyRepository.getAll(uid);
    }

    async deleteStudy(studyId) {
        const currentUser = authService.getCurrentUser();
        const uid = currentUser ? currentUser.uid : 'default_user';
        
        // Delete related questions and responses
        await researchQuestionRepository.deleteByStudyId(studyId);
        await questionResponseRepository.deleteByStudyId(studyId);
        await researchStudyRepository.delete(studyId, uid);
        
        if (this.currentStudy && this.currentStudy.id === studyId) {
            this.currentStudy = null;
            this.activeQuestions.clear();
        }
        
        console.log(`[ResearchService] Deleted study: ${studyId}`);
    }

    // ==================== QUESTION MANAGEMENT ====================
    
    async addQuestion(studyId, questionData) {
        const questionId = crypto.randomUUID();
        const question = {
            id: questionId,
            study_id: studyId,
            question_text: questionData.question_text,
            question_type: questionData.question_type || 'open',
            category: questionData.category || 'behavior',
            priority: questionData.priority || 'medium',
            order_index: questionData.order_index || 0,
            is_required: questionData.is_required ? 1 : 0,
            follow_up_hints: JSON.stringify(questionData.follow_up_hints || []),
            created_at: Math.floor(Date.now() / 1000)
        };
        
        await researchQuestionRepository.create(question);
        console.log(`[ResearchService] Added question to study ${studyId}: ${questionId}`);
        return question;
    }

    async updateQuestion(questionId, updateData) {
        if (updateData.follow_up_hints) {
            updateData.follow_up_hints = JSON.stringify(updateData.follow_up_hints);
        }
        return await researchQuestionRepository.update(questionId, updateData);
    }

    async getStudyQuestions(studyId) {
        const questions = await researchQuestionRepository.getByStudyId(studyId);
        return questions.map(q => ({
            ...q,
            follow_up_hints: q.follow_up_hints ? JSON.parse(q.follow_up_hints) : []
        }));
    }

    async deleteQuestion(questionId) {
        await questionResponseRepository.deleteByQuestionId(questionId);
        await researchQuestionRepository.delete(questionId);
        
        if (this.activeQuestions.has(questionId)) {
            this.activeQuestions.delete(questionId);
            this.questionResponses.delete(questionId);
        }
    }

    // ==================== RESEARCH SESSION MANAGEMENT ====================
    
    async startResearchSession(studyId, participantData = {}) {
        console.log('[ResearchService] Starting research session with studyId:', studyId);
        
        // Get or create a regular session
        const sessionId = await sessionRepository.getOrCreateActive('research');
        await sessionRepository.updateType(sessionId, 'research');
        console.log('[ResearchService] Session created/retrieved:', sessionId);
        
        // Load study from local repository first, fallback to database
        let study = localStudiesRepository.getStudyById(studyId);
        console.log('[ResearchService] Local study lookup result:', {
            found: !!study,
            studyId: studyId,
            studyTitle: study?.title || 'Not found'
        });
        
        if (study) {
            console.log('[ResearchService] Using local study:', study.title);
            this.currentStudy = study;
            console.log('[ResearchService] Set currentStudy:', {
                id: this.currentStudy.id,
                title: this.currentStudy.title,
                hasQuestions: !!this.currentStudy.questions,
                questionCount: this.currentStudy.questions?.length || 0
            });
            
            // Load questions from local study
            const questions = localStudiesRepository.getStudyQuestions(studyId);
            console.log('[ResearchService] Loaded questions from local study:', questions.length);
            
            this.activeQuestions.clear();
            this.questionResponses.clear();
            
            questions.forEach(question => {
                this.activeQuestions.set(question.id, question);
                this.questionResponses.set(question.id, {
                    id: crypto.randomUUID(),
                    session_id: sessionId,
                    question_id: question.id,
                    status: 'not_asked',
                    completeness_score: 0.0,
                    ai_confidence: 0.0,
                    follow_up_needed: 0,
                    // New fields for interviewer-driven detection
                    summarized_answer: '',
                    max_completeness: 0.0,
                    needs_clarification_flag: 0,
                    last_model_score: 0.0,
                    created_at: tsSec(),
                    updated_at: tsSec()
                });
            });
        } else {
            // Fallback to database study (existing logic)
            console.log('[ResearchService] Using database study');
            this.currentStudy = await this.getStudy(studyId);
            if (!this.currentStudy) {
                throw new Error(`Study not found: ${studyId}`);
            }
            
            const questions = await this.getStudyQuestions(studyId);
            console.log('[ResearchService] Loaded questions from database study:', questions.length);
            this.activeQuestions.clear();
            this.questionResponses.clear();
            
            questions.forEach(question => {
                this.activeQuestions.set(question.id, question);
                this.questionResponses.set(question.id, {
                    id: crypto.randomUUID(),
                    session_id: sessionId,
                    question_id: question.id,
                    status: 'not_asked',
                    completeness_score: 0.0,
                    ai_confidence: 0.0,
                    follow_up_needed: 0,
                    // New fields for interviewer-driven detection
                    summarized_answer: '',
                    max_completeness: 0.0,
                    needs_clarification_flag: 0,
                    last_model_score: 0.0,
                    created_at: tsSec(),
                    updated_at: tsSec()
                });
            });
        }
        
        // Create research session record
        this.currentSession = {
            session_id: sessionId,
            study_id: studyId,
            participant_id: participantData.participant_id || `participant_${Date.now()}`,
            participant_notes: participantData.participant_notes || '',
            session_notes: '',
            research_mode: 'live',
            questions_asked: 0,
            questions_completed: 0,
            session_quality_score: 0.0,
            created_at: Math.floor(Date.now() / 1000)
        };
        
        await researchSessionRepository.create(this.currentSession);
        console.log('[ResearchService] Research session record created:', this.currentSession.session_id);
        
        // Start live analysis
        this.isLiveAnalysisActive = true;
        this.transcriptBuffer = [];
        this.lastAnalysisTime = Date.now();
        this.pendingAnalysis = false;
        
        // Reset follow-up question state
        this.bestFollowUpQuestions = [];
        this.displayedFollowUpQuestions = [];
        this.lastFollowUpUpdateTime = 0;
        this.followUpQuestionMetrics = {
            totalSuggested: 0,
            totalAsked: 0,
            responses: []
        };
        
        // Start listen service to capture audio for analysis
        try {
            console.log('[ResearchService] Starting listen service for audio capture...');
            const listenService = this._getListenService();
            await listenService.handleListenRequest('Listen');
            console.log('[ResearchService] Listen service started successfully');
            
            // Ensure listen window is visible for microphone capture
            console.log('[ResearchService] Making listen window visible for microphone capture...');
            internalBridge.emit('window:requestVisibility', { name: 'listen', visible: true });
            
            // Wait a moment for window to be ready, then start microphone capture
            setTimeout(() => {
                console.log('[ResearchService] Triggering microphone capture start...');
                listenService.sendToRenderer('change-listen-capture-state', { status: "start" });
            }, 1000);
            
            // Also start audio capture
            console.log('[ResearchService] Starting macOS audio capture...');
            await listenService.startMacOSAudioCapture();
            console.log('[ResearchService] Audio capture started successfully');
        } catch (error) {
            console.error('[ResearchService] Failed to start listen service or audio capture:', error);
            // Don't fail the research session if listen service fails
        }
        
        // Start the session
        console.log(`[ResearchService] Research session started for study: ${studyId}`);

        // Start question detection with study questions
        if (this.currentStudy && this.currentStudy.questions) {
            console.log('[ResearchService] Starting question detection with', this.currentStudy.questions.length, 'questions');
            try {
                await this.questionDetectionService.startDetection(this.currentStudy.questions);
            } catch (error) {
                console.error('[ResearchService] Failed to start question detection:', error);
                // Continue without question detection if it fails
            }
        }

        // NEW: Start screen recording for research session
        try {
            console.log('[ResearchService] Starting screen recording for research session...');
            const recordingResult = await screenRecordingService.startRecording(sessionId, {
                videoBitsPerSecond: 2500000, // 2.5 Mbps for good quality
                audioBitsPerSecond: 128000   // 128 kbps for system audio
            });
            
            if (recordingResult.success) {
                console.log('[ResearchService] Screen recording started successfully:', recordingResult.recordingPath);
                
                // Emit recording started event to UI
                this.emit('screen-recording-started', {
                    sessionId,
                    recordingPath: recordingResult.recordingPath
                });
                
                // Tell the renderer to start screen capture
                internalBridge.emit('research:startScreenRecording', {
                    sessionId,
                    options: {
                        videoBitsPerSecond: 2500000, // 2.5 Mbps for good quality
                        audioBitsPerSecond: 128000   // 128 kbps for system audio
                    }
                });
            } else {
                console.warn('[ResearchService] Failed to start screen recording:', recordingResult.error);
                // Continue without screen recording if it fails
            }
        } catch (error) {
            console.error('[ResearchService] Error starting screen recording:', error);
            // Continue without screen recording if it fails
        }
        
        // Prepare session data to emit
        const sessionData = { 
            studyId, 
            sessionId, 
            questionsCount: this.activeQuestions.size, // Use activeQuestions.size instead of undefined questions.length
            study: this.currentStudy // Include the full study object
        };
        
        console.log('[ResearchService] Emitting session-started event with data:', {
            studyId: sessionData.studyId,
            sessionId: sessionData.sessionId,
            questionsCount: sessionData.questionsCount,
            studyTitle: sessionData.study?.title || 'No study',
            studyHasQuestions: !!sessionData.study?.questions,
            studyQuestionCount: sessionData.study?.questions?.length || 0
        });
        
        // Emit initial status with first question ready
        this.emit('session-started', sessionData);
        
        // Emit initial analysis update to show first question
        setTimeout(() => {
            this.emit('analysis-update', {
                status: this.getSessionStatus(),
                suggestions: [],
                currentQuestion: null,
                nextQuestion: this.getNextQuestionToAsk()
            });
        }, 100); // Small delay to ensure UI is ready
        
        return {
            sessionId,
            study: this.currentStudy,
            questions: Array.from(this.activeQuestions.values()),
            status: this.getSessionStatus()
        };
    }

    /**
     * Stop the current research session
     * @returns {boolean} Success status
     */
    async stopResearchSession() {
        if (!this.currentSession) {
            console.log('[ResearchService] No active session to stop');
            return false;
        }

        console.log('[ResearchService] Stopping research session:', this.currentSession);

        try {
            // Stop question detection
            this.questionDetectionService.stopDetection();

            // NEW: Clean up speech completion detection state
            this._resetTurnState();
            this.speakerTurnManager.interviewerTurnHistory = [];

            // End session in database
            const sessionRepo = require('../common/repositories/session'); // Assuming getSessionRepository is in session.js
            await sessionRepo.endSession(this.currentSession.session_id, {
                questions_completed: Array.from(this.questionStatus.entries())
                    .filter(([_, status]) => status === 'completed').length,
                total_questions: this.activeQuestions.size,
                completion_percentage: this.getCompletionPercentage()
            });

            console.log('[ResearchService] Research session stopped successfully');

            const stoppedSessionId = this.currentSession.session_id;
            const stoppedStudyId = this.currentStudy?.id;

            // Reset state
            this.currentSession = null;
            this.currentStudy = null;
            this.activeQuestions.clear();
            this.questionStatus.clear();
            this.responses.clear();
            this.insights.clear();

            // Emit session ended
            this.emit('session-ended', {
                sessionId: stoppedSessionId,
                studyId: stoppedStudyId
            });

            return true;

        } catch (error) {
            console.error('[ResearchService] Error stopping research session:', error);
            throw error;
        }
    }

    /**
     * Get completion percentage for the current session
     * @returns {number} Percentage (0-100)
     */
    getCompletionPercentage() {
        if (this.activeQuestions.size === 0) return 0;
        
        const completedCount = Array.from(this.questionStatus.entries())
            .filter(([_, status]) => status === 'completed').length;
        
        return Math.round((completedCount / this.activeQuestions.size) * 100);
    }

    async endResearchSession() {
        if (!this.currentSession) {
            return;
        }
        
        this.isLiveAnalysisActive = false;
        this.pendingAnalysis = false;
        
        // NEW: Clean up speech completion detection state
        this._resetTurnState();
        this.speakerTurnManager.interviewerTurnHistory = [];
        
        // Stop listen service and audio capture
        try {
            console.log('[ResearchService] Stopping audio capture and listen service...');
            const listenService = this._getListenService();
            await listenService.stopMacOSAudioCapture();
            await listenService.handleListenRequest('Stop');
            
            // Hide listen window
            console.log('[ResearchService] Hiding listen window...');
            internalBridge.emit('window:requestVisibility', { name: 'listen', visible: false });
            
            console.log('[ResearchService] Audio capture and listen service stopped successfully');
        } catch (error) {
            console.error('[ResearchService] Failed to stop listen service or audio capture:', error);
        }
        
        // NEW: Stop screen recording
        try {
            console.log('[ResearchService] Stopping screen recording...');
            
            // Tell renderer to stop recording first
            internalBridge.emit('research:stopScreenRecording');
            
            // Stop recording in service (will be finalized when renderer sends data)
            const recordingResult = await screenRecordingService.stopRecording();
            
            if (recordingResult.success) {
                console.log('[ResearchService] Screen recording stopped successfully');
                console.log('[ResearchService] Recording saved to:', recordingResult.recordingPath);
                
                this.emit('screen-recording-stopped', {
                    sessionId: this.currentSession.session_id,
                    recordingPath: recordingResult.recordingPath,
                    duration: recordingResult.duration
                });
            } else {
                console.warn('[ResearchService] Failed to stop screen recording:', recordingResult.error);
            }
        } catch (error) {
            console.error('[ResearchService] Error stopping screen recording:', error);
        }
        
        // Save all responses
        for (const response of this.questionResponses.values()) {
            if (response.status !== 'not_asked') {
                await questionResponseRepository.createOrUpdate(response);
            }
        }
        
        // Update session summary
        const status = this.getSessionStatus();
        await researchSessionRepository.update(this.currentSession.session_id, {
            questions_asked: status.questionsAsked,
            questions_completed: status.questionsCompleted,
            session_quality_score: this.calculateSessionQuality(),
            research_mode: 'completed'
        });
        
        // End the regular session
        await sessionRepository.end(this.currentSession.session_id);
        
        console.log(`[ResearchService] Ended research session: ${this.currentSession.session_id}`);
        
        // Dump session metrics
        this._dumpSessionMetrics();
        
        // Reset state
        this.currentStudy = null;
        this.currentSession = null;
        this.activeQuestions.clear();
        this.questionResponses.clear();
        this.transcriptBuffer = [];
        this.bestFollowUpQuestions = [];
        this.displayedFollowUpQuestions = [];
        
        this.emit('session-ended');
    }

    async pauseResearchSession() {
        if (!this.currentSession) {
            throw new Error('No active research session to pause');
        }

        try {
            console.log('[ResearchService] Pausing research session...');
            
            // Stop audio capture but keep session data
            const listenService = this._getListenService();
            await listenService.stopMacOSAudioCapture();
            
            // Stop live analysis
            this.isLiveAnalysisActive = false;
            this.pendingAnalysis = false;
            
            // Update session status
            await researchSessionRepository.update(this.currentSession.session_id, {
                research_mode: 'paused'
            });
            
            console.log('[ResearchService] Research session paused successfully');
            this.emit('session-paused');
            
        } catch (error) {
            console.error('[ResearchService] Failed to pause research session:', error);
            throw error;
        }
    }

    async resumeResearchSession() {
        if (!this.currentSession) {
            throw new Error('No research session to resume');
        }

        try {
            console.log('[ResearchService] Resuming research session...');
            
            // Restart audio capture
            const listenService = this._getListenService();
            await listenService.startMacOSAudioCapture();
            
            // Restart live analysis
            this.isLiveAnalysisActive = true;
            this.lastAnalysisTime = Date.now();
            this.pendingAnalysis = false;
            
            // Update session status
            await researchSessionRepository.update(this.currentSession.session_id, {
                research_mode: 'live'
            });
            
            console.log('[ResearchService] Research session resumed successfully');
            this.emit('session-resumed');
            
        } catch (error) {
            console.error('[ResearchService] Failed to resume research session:', error);
            throw error;
        }
    }

    // ==================== LIVE ANALYSIS ====================
    
    async processTranscriptSegment(speaker, text, timestamp) {
        if (!this.isLiveAnalysisActive || !this.currentStudy) {
            console.log('[ResearchService] Skipping transcript - analysis not active or no study');
            return;
        }
        
        console.log(`[ResearchService] Processing transcript: ${speaker} - ${text.substring(0, 50)}...`);
        
        // NEW: Implement speech completion detection
        await this._handleSpeechTurn(speaker, text, timestamp);
        
        // Still forward to question detection service for compatibility
        if (this.questionDetectionService.isActive) {
            console.log('[ResearchService] Forwarding to question detection service:', { text: text.substring(0, 50), speaker });
            await this.questionDetectionService.processTranscript(text, speaker === 'Me' ? 'moderator' : 'participant');
        }
        
        // Add to transcript buffer (for AI analysis)
        this.transcriptBuffer.push({
            speaker,
            text,
            timestamp,
            processed: false
        });
        
        // Keep buffer manageable (last 50 segments)
        if (this.transcriptBuffer.length > 50) {
            this.transcriptBuffer.shift();
        }
    }

    /**
     * Handle speech turns with completion detection
     * Only process complete speaker turns, not partial segments
     */
    async _handleSpeechTurn(speaker, text, timestamp) {
        const turnManager = this.speakerTurnManager;
        
        // CRITICAL: Only process microphone audio ("Me") for QUESTION DETECTION
        // System audio ("Them") contains participant responses + background noise
        const isMicrophoneAudio = speaker === 'Me';
        const isSystemAudio = speaker === 'Them';
        
        if (isMicrophoneAudio) {
            console.log(`[ResearchService] 🎤 Processing microphone audio for question detection: "${text.substring(0, 50)}..."`);
            await this._handleInterviewerSpeechTurn(speaker, text, timestamp);
        } else if (isSystemAudio) {
            console.log(`[ResearchService] 🔊 Processing system audio for participant responses: "${text.substring(0, 50)}..."`);
            await this._handleParticipantSpeechTurn(speaker, text, timestamp);
        } else {
            console.log(`[ResearchService] ⚠️ Unknown speaker: ${speaker} - "${text.substring(0, 50)}..."`);
        }
    }

    /**
     * Handle microphone audio (interviewer) - used for question detection
     */
    async _handleInterviewerSpeechTurn(speaker, text, timestamp) {
        const turnManager = this.speakerTurnManager;
        
        // Detect if this is a new interviewer turn (system audio interrupted)
        const wasSystemAudio = turnManager.currentSpeaker === 'Them';
        
        if (wasSystemAudio || !turnManager.currentSpeaker) {
            if (wasSystemAudio) {
                console.log(`[ResearchService] 🎤 Interviewer resuming after system audio`);
            }
            
            // Reset for new interviewer turn
            this._resetTurnState();
            turnManager.currentSpeaker = speaker;
            turnManager.currentTurnStartTime = timestamp;
            console.log(`[ResearchService] 🎤 Starting new interviewer turn`);
        }
        
        // Accumulate text for current interviewer turn
        turnManager.currentTurnBuffer = turnManager.currentTurnBuffer 
            ? `${turnManager.currentTurnBuffer} ${text}`.trim()
            : text.trim();
        
        // Reset turn completion timeout (interviewer is still talking)
        if (turnManager.turnCompletionTimeout) {
            clearTimeout(turnManager.turnCompletionTimeout);
        }
        
        // Set timeout to detect interviewer turn completion (silence)
        turnManager.turnCompletionTimeout = setTimeout(async () => {
            console.log(`[ResearchService] 🎤 Interviewer turn completed after ${turnManager.turnCompletionDelay}ms silence`);
            
            await this._processCompleteInterviewerTurn(
                turnManager.currentTurnBuffer,
                turnManager.currentTurnStartTime,
                Date.now()
            );
            
            this._resetTurnState();
        }, turnManager.turnCompletionDelay);
        
        console.log(`[ResearchService] 🎤 Interviewer turn accumulated: "${turnManager.currentTurnBuffer.substring(0, 80)}..."`);
    }

    /**
     * Handle system audio (participant + background) - used for response tracking only
     */
    async _handleParticipantSpeechTurn(speaker, text, timestamp) {
        // System audio is processed immediately as complete participant responses
        // (no turn accumulation needed since it's already post-processed)
        console.log(`[ResearchService] 🔊 Processing immediate participant response: "${text.substring(0, 80)}..."`);
        
        this.metrics.participantTurns++;
        
        if (this.currentQuestionBeingAsked) {
            // Accumulate answer for active question
            this.currentAnswerBeingGiven = this.currentAnswerBeingGiven 
                ? `${this.currentAnswerBeingGiven} ${text}`.trim()
                : text.trim();
            
            // Keep answer reasonably sized (last 1000 characters)
            if (this.currentAnswerBeingGiven.length > 1000) {
                this.currentAnswerBeingGiven = '...' + this.currentAnswerBeingGiven.slice(-1000);
            }
            
            console.log(`[ResearchService] 📝 Participant response added to active question ${this.currentQuestionBeingAsked.substring(0, 8)}: "${text.substring(0, 100)}..."`);
        } else {
            console.log(`[ResearchService] 🔊 Participant speaking but no active question: "${text.substring(0, 50)}..."`);
        }
        
        // Trigger AI analysis for participant responses
        const now = Date.now();
        const timeSinceLastAnalysis = now - this.lastAnalysisTime;
        
        if (timeSinceLastAnalysis >= this.analysisInterval && !this.pendingAnalysis) {
            console.log('[ResearchService] Triggering AI analysis for participant response...');
            await this.analyzeRecentTranscript();
            this.lastAnalysisTime = now;
        }
    }

    /**
     * Process a complete speaker turn (only called when turn is finished)
     */
    async _processCompleteTurn(speaker, completeTurnText, startTime, endTime) {
        // This method is now primarily used by the interviewer turn completion
        // Participant responses are handled immediately in _handleParticipantSpeechTurn
        
        if (!completeTurnText || completeTurnText.trim().length === 0) {
            console.log('[ResearchService] Skipping empty turn');
            return;
        }
        
        const trimmedText = completeTurnText.trim();
        console.log(`[ResearchService] 🎯 Processing COMPLETE turn: ${speaker} - "${trimmedText.substring(0, 100)}..."`);
        console.log(`[ResearchService] Turn duration: ${endTime - startTime}ms`);
    }

    /**
     * Process complete interviewer turn - only activate questions when interviewer finishes speaking
     * This is now only called for microphone audio ("Me")
     */
    async _processCompleteInterviewerTurn(completeTurnText, startTime, endTime) {
        this.metrics.interviewerTurns++;
        
        // Store in interviewer turn history
        this.speakerTurnManager.interviewerTurnHistory.push({
            text: completeTurnText,
            startTime,
            endTime,
            processed: true,
            source: 'microphone' // Mark as microphone-only
        });
        
        // Keep only last 5 interviewer turns
        if (this.speakerTurnManager.interviewerTurnHistory.length > 5) {
            this.speakerTurnManager.interviewerTurnHistory.shift();
        }
        
        // Only process if this looks like a question
        if (this.hasQuestionPattern(completeTurnText)) {
            console.log(`[ResearchService] ✅ Complete interviewer question detected from microphone: "${completeTurnText.substring(0, 100)}..."`);
            
            // Classify complete turn to study question
            const classification = await this.classifyInterviewerTurnToQuestion(completeTurnText);
            
            if (classification.questionId) {
                // Activate the matched question (only from microphone audio)
                this._activateQuestion(
                    classification.questionId, 
                    endTime, 
                    completeTurnText
                );
                
                console.log(`[ResearchService] 🎯 Question activated from microphone audio: ${classification.questionId.substring(0, 8)}`);
            } else {
                console.log(`[ResearchService] Complete microphone question but no study question match (off-script)`);
            }
        } else {
            console.log(`[ResearchService] Complete microphone turn but no question pattern detected: "${completeTurnText.substring(0, 50)}..."`);
        }
    }



    /**
     * Reset turn state when speaker changes or turn completes
     */
    _resetTurnState() {
        const turnManager = this.speakerTurnManager;
        
        if (turnManager.turnCompletionTimeout) {
            clearTimeout(turnManager.turnCompletionTimeout);
            turnManager.turnCompletionTimeout = null;
        }
        
        turnManager.currentSpeaker = null;
        turnManager.currentTurnBuffer = '';
        turnManager.currentTurnStartTime = null;
        
        console.log('[ResearchService] 🔄 Turn state reset');
    }

    async analyzeRecentTranscript() {
        const unprocessedSegments = this.transcriptBuffer.filter(seg => !seg.processed);
        console.log(`[ResearchService] Analyzing ${unprocessedSegments.length} unprocessed transcript segments`);
        
        if (unprocessedSegments.length === 0) {
            console.log('[ResearchService] No unprocessed segments to analyze');
            return;
        }
        
        try {
            // Get recent transcript text
            const recentText = unprocessedSegments
                .map(seg => `${seg.speaker}: ${seg.text}`)
                .join('\n');
            
            console.log(`[ResearchService] Transcript to analyze:\n${recentText}`);
            
            // Prepare questions for analysis
            const activeQuestionsList = Array.from(this.activeQuestions.values());
            const questionContext = activeQuestionsList.map(q => ({
                id: q.id,
                text: q.question_text,
                category: q.category,
                status: this.questionResponses.get(q.id)?.status || 'not_asked'
            }));
            
            console.log(`[ResearchService] Analyzing against ${questionContext.length} questions`);
            questionContext.forEach(q => {
                console.log(`[ResearchService] Question ${q.id.substring(0, 8)}: "${q.text.substring(0, 60)}..." (status: ${q.status})`);
            });
            
            // AI analysis
            const analysis = await this.performQuestionAnalysis(recentText, questionContext);
            console.log('[ResearchService] 🔍 DEBUG: AI analysis completed:', analysis);
            console.log('[ResearchService] 🔍 DEBUG: AI suggestions received:', analysis.suggestions?.length || 0, 'suggestions');
            if (analysis.suggestions && analysis.suggestions.length > 0) {
                analysis.suggestions.forEach((suggestion, index) => {
                    console.log(`[ResearchService] 🔍 DEBUG: AI suggestion ${index + 1}: "${suggestion}"`);
                });
            }
            
            // Log which questions the AI thinks are being addressed
            if (analysis.question_updates) {
                analysis.question_updates.forEach(update => {
                    const question = this.activeQuestions.get(update.questionId);
                    console.log(`[ResearchService] AI update for question ${update.questionId.substring(0, 8)}: "${question?.question_text?.substring(0, 60)}..." -> status: ${update.status}, score: ${update.completeness_score}`);
                });
            }
            
            // Update question responses based on analysis
            await this.updateQuestionResponses(analysis, unprocessedSegments);
            
            // Update current question and answer tracking
            await this.updateCurrentQuestionTracking(analysis, unprocessedSegments);
            
            // Mark segments as processed
            unprocessedSegments.forEach(seg => seg.processed = true);
            
            // Update follow-up questions with intelligent management
            this.updateFollowUpQuestions(analysis.suggestions || []);
            
            // Emit updates
            this.emit('analysis-update', {
                status: this.getSessionStatus(),
                suggestions: this.getDisplayedFollowUpQuestions(),
                currentQuestion: this.getCurrentQuestionContext(),
                nextQuestion: this.getNextQuestionToAsk(),
                followUpMetrics: this.followUpQuestionMetrics
            });
            
            console.log('[ResearchService] Analysis update emitted to UI');
            
        } catch (error) {
            console.error('[ResearchService] Analysis error:', error);
        }
    }

    async performQuestionAnalysis(transcriptText, questions) {
        const modelInfo = await modelStateService.getCurrentModelInfo('llm');
        if (!modelInfo || !modelInfo.apiKey) {
            throw new Error('AI model not configured for research analysis');
        }
        
        const systemPrompt = this.buildResearchAnalysisPrompt(questions);
        
        const messages = [
            { role: 'system', content: systemPrompt },
            { 
                role: 'user', 
                content: `Analyze this recent transcript segment and provide question tracking updates:

TRANSCRIPT:
${transcriptText}

Please respond with a JSON object containing:
1. "question_updates": Array of {questionId, status, completeness_score, key_insights, follow_up_needed}
2. "suggestions": Array of 1-2 specific follow-up questions that reference what the participant just said
3. "overall_analysis": Brief summary of conversation progress

Focus on generating contextual follow-ups that directly build on the participant's specific responses.`
            }
        ];
        
        const llm = createLLM(modelInfo.provider, {
            apiKey: modelInfo.apiKey,
            model: modelInfo.model,
            temperature: 0.3,
            maxTokens: 1500
        });
        
        const completion = await llm.chat(messages);
        
        try {
            // Robust JSON extraction - handle markdown fences, prose, etc.
            return this.extractJson(completion.content);
        } catch (parseError) {
            console.error('[ResearchService] Failed to parse AI response:', parseError.message);
            console.error('[ResearchService] Raw AI response:', completion.content);
            return { question_updates: [], suggestions: [], overall_analysis: '' };
        }
    }

    buildResearchAnalysisPrompt(questions) {
        return `You are an expert UX research assistant analyzing live interview transcripts. Your goal is to track which research questions are being answered and suggest intelligent follow-ups.

RESEARCH CONTEXT:
Study: ${this.currentStudy.title}
Goals: ${this.currentStudy.goals}
Methodology: ${this.currentStudy.methodology}

QUESTIONS TO TRACK:
${questions.map(q => `- ${q.id}: [${q.category}] ${q.text} (Current status: ${q.status})`).join('\n')}

CRITICAL VALIDATION RULES:
1. ONLY update a question's status if there is CLEAR EVIDENCE that:
   - The interviewer actually asked a question related to the research question
   - The participant provided a meaningful response (not just garbled text or fragments)
   - The transcript is coherent and readable (not corrupted STT output)

2. DO NOT update status for:
   - Garbled or incoherent text (e.g., "current.txt Canara iscribe")
   - Single words or fragments without context
   - Text that appears to be STT transcription errors
   - Cases where no clear question-answer exchange occurred

CRITICAL ID RULE: For each question above, I show id=(uuid). In your question_updates array, you MUST use that exact UUID string in the questionId field. Copy/paste exactly from the list above - do not shorten, truncate, or renumber. Any questionId that doesn't exactly match will be ignored.

ANALYSIS GUIDELINES:
1. Question Status Mapping (BE CONSERVATIVE):
   - "not_asked": Question hasn't been addressed yet OR transcript is unclear/garbled
   - "partial": Question clearly asked and participant gave a brief but coherent response
   - "complete": Question clearly asked and adequately answered with sufficient detail
   - "needs_clarification": Answer given but unclear or contradictory

2. Completeness Scoring (0.0-1.0) - BE STRICT:
   - Only give scores > 0.0 when you can clearly identify both a question being asked AND a coherent response
   - 0.1-0.3: Question asked but response is very brief or vague (but still coherent)
   - 0.4-0.6: Question asked and answered with some relevant details
   - 0.7-0.9: Question asked and comprehensively answered
   - NEVER score above 0.0 for garbled, incoherent, or fragmented text

3. Transcript Quality Check:
   - If the transcript appears garbled, corrupted, or nonsensical, do NOT update any question statuses
   - Look for coherent sentence structure and logical conversation flow
   - Reject updates for text like "current.txt Canara iscribe" or similar STT errors

3. Follow-up Suggestions:
   - ONLY suggest follow-ups when the participant's response is incomplete, vague, or needs clarification
   - Do NOT suggest follow-ups if the conversation is flowing naturally or if questions are being adequately answered
   - When you do suggest, make them SPECIFIC and reference exact details the participant mentioned
   - Ask for concrete examples, specific situations, or deeper exploration of pain points they raised
   - Use phrases like "You mentioned X..." or "When you said Y..." to show you're building on their words
   - Focus on actionable details: "how does", "what happens when", "can you describe a specific time"
   - Avoid generic suggestions like "tell me more" or "anything else" - be precise about what you need to know

4. Key Insights:
   - Extract actionable insights about user behavior, pain points, motivations
   - Note emotional responses and non-verbal cues mentioned
   - Identify patterns or themes emerging

RESPONSE FORMAT: Valid JSON only, no additional text.`;
    }

    async updateQuestionResponses(analysis, transcriptSegments) {
        if (!analysis.question_updates) return;
        
        console.log(`[ResearchService] Applying ${analysis.question_updates.length} question updates with monotonic enforcement`);
        
        for (const update of analysis.question_updates) {
            const questionId = update.questionId;
            
            // P0 Fix: Validate questionId exists in our active questions
            if (!this.activeQuestions.has(questionId)) {
                console.warn(`[ResearchService] AI returned invalid questionId: "${questionId}" - skipping update`);
                continue;
            }
            
            // Use monotonic update instead of direct assignment
            this._applyMonotonicUpdate(questionId, {
                new_completeness: update.completeness_score,
                needs_clarification: update.follow_up_needed || update.status === 'needs_clarification',
                delta_insights: update.key_insights || []
            });
            
            // Update additional fields (non-monotonic)
            const response = this.questionResponses.get(questionId);
            if (response) {
                response.ai_confidence = update.ai_confidence || 0.7;
                
                // Extract relevant transcript text
                if (transcriptSegments.length > 0) {
                    response.transcript_segment_start = transcriptSegments[0].timestamp;
                    response.transcript_segment_end = transcriptSegments[transcriptSegments.length - 1].timestamp;
                    response.response_text = transcriptSegments.map(s => s.text).join(' ');
                }
                
                this.questionResponses.set(questionId, response);
            }
        }
    }

    async updateCurrentQuestionTracking(analysis, transcriptSegments) {
        console.log(`[ResearchService] === AI ANALYSIS TRACKING ===`);
        console.log(`[ResearchService] Current question: ${this.currentQuestionBeingAsked?.substring(0, 8)}...`);
        console.log(`[ResearchService] Analysis question_updates:`, analysis.question_updates);
        
        // NEW: Since we now handle turn completion detection above, this method focuses on AI analysis only
        
        // Process AI updates for currently active question only (no auto-switching from AI)
        if (analysis.question_updates && this.currentQuestionBeingAsked) {
            console.log(`[ResearchService] Processing AI updates for active question only...`);
            
            // Only process updates for the currently active question
            const activeQuestionUpdates = analysis.question_updates.filter(update => 
                update.questionId === this.currentQuestionBeingAsked
            );
            
            if (activeQuestionUpdates.length > 0) {
                const update = activeQuestionUpdates[0];
                console.log(`[ResearchService] Processing AI update for active question ${update.questionId.substring(0, 8)}: score=${update.completeness_score}, status=${update.status}`);
                
                // Apply monotonic update for the active question
                this._applyMonotonicUpdate(update.questionId, {
                    new_completeness: update.completeness_score,
                    needs_clarification: update.follow_up_needed || update.status === 'needs_clarification',
                    delta_insights: update.key_insights || []
                });
            }
            
            // Log but ignore updates for non-active questions
            const ignoredUpdates = analysis.question_updates.filter(update => 
                update.questionId !== this.currentQuestionBeingAsked
            );
            if (ignoredUpdates.length > 0) {
                console.log(`[ResearchService] Ignoring ${ignoredUpdates.length} AI-suggested question switches; using speech completion detection instead`);
            }
        } else if (analysis.question_updates && analysis.question_updates.length > 0 && !this.currentQuestionBeingAsked) {
            // Fallback: If AI suggests a question is active but we have no active question from speech detection
            console.log('[ResearchService] AI suggests question activity but no active question from speech detection - this may indicate an issue');
        }
        
        // Log current state for debugging
        if (this.currentQuestionBeingAsked) {
            const question = this.activeQuestions.get(this.currentQuestionBeingAsked);
            console.log(`[ResearchService] Current question: "${question?.question_text?.substring(0, 50)}..."`);
            console.log(`[ResearchService] Current answer: "${this.currentAnswerBeingGiven?.substring(0, 100)}..."`);
        } else {
            console.log(`[ResearchService] No current question identified from speech completion detection`);
        }
    }

    findClosestStudyQuestion(interviewerText) {
        if (!interviewerText || !this.activeQuestions || this.activeQuestions.size === 0) {
            return null;
        }

        const interviewerLower = interviewerText.toLowerCase();
        let bestMatch = null;
        let bestScore = 0;
        const threshold = 0.15; // Minimum similarity threshold (lowered for improved algorithm)

        for (const [questionId, question] of this.activeQuestions.entries()) {
            const questionText = question.question_text.toLowerCase();
            
            // Calculate similarity score using word overlap
            const similarity = this.calculateSimilarity(interviewerLower, questionText);
            
            console.log(`[ResearchService] Similarity check: "${questionText.substring(0, 30)}..." = ${Math.round(similarity * 100)}%`);
            
            if (similarity > bestScore && similarity >= threshold) {
                bestScore = similarity;
                bestMatch = question;
            }
        }

        if (bestMatch) {
            console.log(`[ResearchService] Best match found with ${Math.round(bestScore * 100)}% similarity: ${bestMatch.question_text?.substring(0, 50)}...`);
        }

        return bestMatch;
    }

    calculateSimilarity(text1, text2) {
        // Improved similarity calculation that handles paraphrased questions better
        const normalize = (text) => text.toLowerCase()
            .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
            .replace(/\s+/g, ' ') // Normalize multiple spaces
            .trim();
        
        const normalized1 = normalize(text1);
        const normalized2 = normalize(text2);
        
        // Split into words, keep words with length > 1 (include "do", "is", etc.)
        const words1 = normalized1.split(' ').filter(word => word.length > 1);
        const words2 = normalized2.split(' ').filter(word => word.length > 1);
        
        if (words1.length === 0 || words2.length === 0) return 0;
        
        // Simple stemming - remove common endings
        const stemWord = (word) => {
            return word
                .replace(/(?:ing|ed|er|est|ly|tion|sion)$/, '') // Remove common suffixes
                .replace(/(?:s)$/, ''); // Remove plural 's'
        };
        
        const stemmed1 = words1.map(stemWord);
        const stemmed2 = words2.map(stemWord);
        
        // Calculate multiple similarity metrics
        
        // 1. Exact word matches (higher weight)
        const exactMatches = words1.filter(word => words2.includes(word)).length;
        
        // 2. Stemmed word matches (medium weight)
        const stemmedMatches = stemmed1.filter(stem => stemmed2.includes(stem)).length;
        
        // 3. Partial word matches for longer words (lower weight)
        let partialMatches = 0;
        for (const word1 of words1) {
            if (word1.length >= 4) { // Only for longer words
                for (const word2 of words2) {
                    if (word2.length >= 4 && (word1.includes(word2) || word2.includes(word1))) {
                        partialMatches += 0.5;
                        break;
                    }
                }
            }
        }
        
        // 4. Key question words bonus (question starters, important words)
        const questionWords = ['what', 'how', 'why', 'when', 'where', 'who', 'which', 
                              'can', 'could', 'would', 'should', 'do', 'does', 'did',
                              'describe', 'tell', 'explain', 'think', 'feel', 'experience'];
        
        let questionWordMatches = 0;
        for (const qWord of questionWords) {
            if (words1.includes(qWord) && words2.includes(qWord)) {
                questionWordMatches += 1;
            }
        }
        
        // Calculate weighted score
        const totalPossibleMatches = Math.max(words1.length, words2.length);
        const weightedScore = (
            (exactMatches * 1.0) +           // Exact matches: full weight
            (stemmedMatches * 0.8) +         // Stemmed matches: 80% weight  
            (partialMatches * 0.6) +         // Partial matches: 60% weight
            (questionWordMatches * 1.2)      // Question words: 120% weight (bonus)
        ) / totalPossibleMatches;
        
        // Cap at 1.0 and apply minimum threshold
        return Math.min(1.0, weightedScore);
    }

    hasQuestionPattern(text) {
        if (!text || text.trim().length < 3) return false;
        
        const normalizedText = text.toLowerCase().trim();
        
        // Check for question mark
        if (text.includes('?')) return true;
        
        // Check for question words at start
        const questionStarters = ['what', 'how', 'why', 'when', 'where', 'who', 'which', 'can', 'could', 'would', 'should', 'do', 'does', 'did', 'is', 'are', 'will'];
        const firstWord = normalizedText.split(/\s+/)[0];
        if (questionStarters.includes(firstWord)) return true;
        
        // Check for common interview phrases
        const interviewPhrases = ['tell me about', 'describe', 'explain', 'walk me through', 'share', 'imagine'];
        if (interviewPhrases.some(phrase => normalizedText.includes(phrase))) return true;
        
        return false;
    }

    filterHighQualityFollowUps(suggestions) {
        if (!suggestions || suggestions.length === 0) return [];
        
        // Check if follow-ups are actually needed based on conversation state
        if (!this.shouldSuggestFollowUps()) {
            console.log(`[ResearchService] Follow-ups not needed - conversation is flowing well`);
            return [];
        }
        
        // Filter individual suggestions for quality
        const highQualitySuggestions = suggestions.filter(suggestion => {
            return this.isHighQualityFollowUp(suggestion);
        });
        
        console.log(`[ResearchService] Quality filtered suggestions from ${suggestions.length} to ${highQualitySuggestions.length}`);
        return highQualitySuggestions;
    }

    shouldSuggestFollowUps() {
        console.log(`[ResearchService] 🔍 DEBUG: Checking if should suggest follow-ups...`);
        
        // Don't suggest follow-ups if we have no active question context
        if (!this.currentQuestionBeingAsked) {
            console.log(`[ResearchService] 🔍 DEBUG: No active question - currentQuestionBeingAsked is ${this.currentQuestionBeingAsked}`);
            return false;
        }
        
        console.log(`[ResearchService] 🔍 DEBUG: Active question: ${this.currentQuestionBeingAsked?.substring(0, 8)}...`);
        
        // Check the completeness of current and recent questions
        const currentResponse = this.questionResponses.get(this.currentQuestionBeingAsked);
        if (!currentResponse) {
            console.log(`[ResearchService] 🔍 DEBUG: No response found for active question`);
            return false;
        }
        
        console.log(`[ResearchService] 🔍 DEBUG: Current response - score: ${currentResponse.completeness_score}, status: ${currentResponse.status}`);
        
        // Only suggest if the current question needs more detail
        const needsMoreDetail = currentResponse.completeness_score < 0.7 || 
                               currentResponse.status === 'partial' ||
                               currentResponse.status === 'needs_clarification';
        
        if (!needsMoreDetail) {
            console.log(`[ResearchService] 🔍 DEBUG: Current question sufficiently complete (score: ${currentResponse.completeness_score}, status: ${currentResponse.status})`);
            return false;
        }
        
        console.log(`[ResearchService] 🔍 DEBUG: Question needs more detail - checking other conditions...`);
        
        // Don't suggest if participant just started answering (give them time)
        if (this.currentAnswerBeingGiven && this.currentAnswerBeingGiven.length < 50) {
            console.log(`[ResearchService] 🔍 DEBUG: Participant just started answering (${this.currentAnswerBeingGiven.length} chars), waiting for more content`);
            return false;
        }
        
        console.log(`[ResearchService] 🔍 DEBUG: Current answer length: ${this.currentAnswerBeingGiven?.length || 0} chars`);
        
        // Don't suggest if we're already showing recent, relevant follow-ups
        if (this.displayedFollowUpQuestions.length > 0) {
            const mostRecentFollowUp = Math.max(...this.displayedFollowUpQuestions.map(q => q.displayedAt));
            const timeSinceLastFollowUp = Date.now() - mostRecentFollowUp;
            
            if (timeSinceLastFollowUp < 15000) { // Less than 15 seconds
                console.log(`[ResearchService] 🔍 DEBUG: Already showing recent follow-ups, waiting ${15000 - timeSinceLastFollowUp}ms`);
                return false;
            }
        }
        
        console.log(`[ResearchService] 🔍 DEBUG: All conditions passed - should suggest follow-ups!`);
        return true;
    }

    isHighQualityFollowUp(suggestion) {
        if (!suggestion || typeof suggestion !== 'string' || suggestion.length < 20) {
            return false;
        }
        
        // TEMPORARILY DISABLED - Debug why no follow-ups are showing
        console.log(`[ResearchService] 🔍 DEBUG: Evaluating suggestion: "${suggestion}"`);
        
        // For debugging, let's temporarily accept all suggestions that are reasonable length
        // TODO: Re-enable strict filtering once we confirm suggestions are being generated
        return true;
        
        // TO RE-ENABLE STRICT FILTERS: Delete the "return true;" line above and uncomment below:
        /* ORIGINAL STRICT FILTERS - TEMPORARILY DISABLED FOR DEBUGGING
        const lowerSuggestion = suggestion.toLowerCase();
        
        // Filter out generic or low-value suggestions
        const lowQualityPatterns = [
            'can you tell me more',
            'could you elaborate',
            'anything else',
            'is there anything',
            'what do you think',
            'how do you feel about that'
        ];
        
        const hasLowQualityPattern = lowQualityPatterns.some(pattern => 
            lowerSuggestion.includes(pattern)
        );
        
        if (hasLowQualityPattern) {
            console.log(`[ResearchService] Filtered out low-quality suggestion: "${suggestion.substring(0, 50)}..."`);
            return false;
        }
        
        // Require suggestions to be specific and reference participant's actual words
        const hasSpecificReference = /you mentioned|when you said|you described|you talked about/i.test(suggestion);
        if (!hasSpecificReference) {
            console.log(`[ResearchService] Filtered out non-specific suggestion: "${suggestion.substring(0, 50)}..."`);
            return false;
        }
        
        // Must be asking for concrete details, examples, or clarification
        const hasGoodIntent = /how does|what happens|can you describe|give an example|specific situation|what would/i.test(suggestion);
        if (!hasGoodIntent) {
            console.log(`[ResearchService] Filtered out vague suggestion: "${suggestion.substring(0, 50)}..."`);
            return false;
        }
        
        return true;
        */
    }

    // ==================== MONOTONIC COMPLETENESS ENFORCEMENT ====================
    
    _applyMonotonicUpdate(questionId, {new_completeness, needs_clarification, delta_insights}) {
        const r = this.questionResponses.get(questionId);
        if (!r) {
            console.warn(`[ResearchService] Cannot apply monotonic update - questionId not found: ${questionId}`);
            return;
        }

        const prev = r.completeness_score ?? 0;
        
        // Enforce monotonic completeness - never decrease
        if (typeof new_completeness === 'number' && new_completeness > prev) {
            r.completeness_score = new_completeness;
            r.max_completeness = Math.max(r.max_completeness || 0, new_completeness);
            console.log(`[ResearchService] Completeness increased: ${questionId.substring(0, 8)} ${prev} -> ${new_completeness}`);
        } else if (typeof new_completeness === 'number' && new_completeness < prev) {
            // Log monotonic block but don't decrease
            this.metrics.monotonicBlocks++;
            r.last_model_score = new_completeness;
            console.log(`[ResearchService] Monotonic block: ${questionId.substring(0, 8)} tried to decrease ${prev} -> ${new_completeness}`);
        } else {
            // Same score or invalid - just record what model suggested
            r.last_model_score = new_completeness ?? prev;
        }

        // Handle clarification flag
        if (needs_clarification) {
            r.needs_clarification_flag = 1;
            if (r.status !== 'complete') {
                r.follow_up_needed = 1;
            }
            console.log(`[ResearchService] Clarification needed for question: ${questionId.substring(0, 8)}`);
        }

        // Status promotion rules based on completeness
        if (r.status === 'not_asked' && r.completeness_score > 0) {
            r.status = 'partial';
        }
        if (r.completeness_score >= 0.9) {
            r.status = 'complete';
        } else if (r.completeness_score >= 0.6 && r.status !== 'complete') {
            r.status = 'partial';
        }

        // Merge delta insights
        if (delta_insights?.length) {
            const prevInsights = r.key_insights ? JSON.parse(r.key_insights) : [];
            r.key_insights = JSON.stringify([...prevInsights, ...delta_insights]);
        }

        r.updated_at = tsSec();
        this.questionResponses.set(questionId, r);
        
        console.log(`[ResearchService] Updated question ${questionId.substring(0, 8)}: score=${r.completeness_score}, status=${r.status}`);
    }

    // ==================== INTERVIEWER-DRIVEN QUESTION ACTIVATION ====================
    
    _activateQuestion(questionId, timestamp, turnText) {
        if (!this.activeQuestions.has(questionId)) {
            console.warn(`[ResearchService] Cannot activate invalid questionId: ${questionId}`);
            return false;
        }
        
        const question = this.activeQuestions.get(questionId);
        const previousQuestionId = this.currentQuestionBeingAsked;
        
        this.currentQuestionBeingAsked = questionId;
        this.currentAnswerBeingGiven = ''; // Reset answer for new question
        this.lastInterviewerQuestionAt = timestamp;
        this.metrics.questionActivations++;
        
        console.log(`[ResearchService] 🔍 DEBUG: ✅ Question activated: ${questionId.substring(0, 8)} - "${question.question_text?.substring(0, 60)}..."`);
        console.log(`[ResearchService] 🔍 DEBUG: Interviewer turn: "${turnText.substring(0, 100)}..."`);
        console.log(`[ResearchService] 🔍 DEBUG: Previous question: ${previousQuestionId?.substring(0, 8) || 'none'}`);
        
        if (previousQuestionId && previousQuestionId !== questionId) {
            console.log(`[ResearchService] 🔍 DEBUG: Switched from question ${previousQuestionId.substring(0, 8)}`);
        }
        
        return true;
    }

    async classifyInterviewerTurnToQuestion(turnText) {
        try {
            // Use simple similarity for now (can be enhanced with embeddings later)
            const candidates = Array.from(this.activeQuestions.values()).map(q => ({
                id: q.id,
                text: q.question_text,
                similarity: this.calculateSimilarity(turnText.toLowerCase(), q.question_text.toLowerCase())
            })).sort((a, b) => b.similarity - a.similarity);

            const best = candidates[0];
            const threshold = 0.15; // Same as existing threshold
            
            if (best && best.similarity >= threshold) {
                console.log(`[ResearchService] Interview turn classification: ${best.id.substring(0, 8)} (${Math.round(best.similarity * 100)}% confidence)`);
                return {
                    questionId: best.id,
                    confidence: best.similarity,
                    is_clarification: false // Simple version for now
                };
            }
            
            console.log(`[ResearchService] Interview turn classification: no match (best: ${Math.round((best?.similarity || 0) * 100)}%)`);
            return {
                questionId: null,
                confidence: best?.similarity || 0,
                is_clarification: false
            };
        } catch (error) {
            console.error('[ResearchService] Error in interviewer turn classification:', error);
            return { questionId: null, confidence: 0, is_clarification: false };
        }
    }

    extractJson(content) {
        // Handle common LLM response patterns
        let cleaned = content.trim();
        
        // Remove markdown json fences
        cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
        
        // Remove markdown code fences without language
        cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
        
        // Find the first complete JSON object
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('No JSON object found in response');
        }
        
        let jsonStr = jsonMatch[0];
        
        // Try to clean up common issues
        // Remove trailing commas before closing braces/brackets
        jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
        
        return JSON.parse(jsonStr);
    }

    getCurrentQuestionContext() {
        if (!this.currentQuestionBeingAsked) return null;
        
        const question = this.activeQuestions.get(this.currentQuestionBeingAsked);
        const response = this.questionResponses.get(this.currentQuestionBeingAsked);
        
        return {
            questionId: this.currentQuestionBeingAsked,
            questionText: question?.question_text || '',
            currentAnswer: this.currentAnswerBeingGiven || '',
            status: response?.status || 'not_asked',
            completeness_score: response?.completeness_score || 0.0
        };
    }

    getNextQuestionToAsk() {
        // Find the next logical question to ask (prioritize moving forward over completion)
        const questionEntries = Array.from(this.questionResponses.entries());
        console.log(`[ResearchService] Finding next question from ${questionEntries.length} questions`);
        
        // Priority 1: Next unasked question (ordered by order_index) - keep conversation moving forward
        const unaskedQuestions = questionEntries
            .filter(([id, response]) => response.status === 'not_asked')
            .map(([id, response]) => {
                const question = this.activeQuestions.get(id);
                return { id, response, question, order_index: question?.order_index || 0 };
            })
            .sort((a, b) => a.order_index - b.order_index);
            
        console.log(`[ResearchService] Found ${unaskedQuestions.length} unasked questions`);
        if (unaskedQuestions.length > 0) {
            const nextQuestion = unaskedQuestions[0];
            console.log(`[ResearchService] Next question: ${nextQuestion.question?.question_text?.substring(0, 50)}...`);
            return {
                questionId: nextQuestion.id,
                questionText: nextQuestion.question?.question_text || '',
                reason: 'next in sequence'
            };
        }
        
        // Priority 2: Partial questions that need completion (lower priority than new questions)
        const partialQuestion = questionEntries.find(([id, response]) => 
            response.status === 'partial' && id !== this.currentQuestionBeingAsked
        );
        if (partialQuestion) {
            const question = this.activeQuestions.get(partialQuestion[0]);
            console.log(`[ResearchService] Next question: needs completion - ${question?.question_text?.substring(0, 50)}...`);
            return {
                questionId: partialQuestion[0],
                questionText: question?.question_text || '',
                reason: 'needs completion'
            };
        }
        
        // Priority 3: Questions that need follow-up (only if no new questions available)
        const needFollowUp = questionEntries.find(([id, response]) => 
            response.follow_up_needed === 1 && id !== this.currentQuestionBeingAsked
        );
        if (needFollowUp) {
            const question = this.activeQuestions.get(needFollowUp[0]);
            console.log(`[ResearchService] Next question: follow-up needed - ${question?.question_text?.substring(0, 50)}...`);
            return {
                questionId: needFollowUp[0],
                questionText: question?.question_text || '',
                reason: 'follow-up needed'
            };
        }
        
        console.log(`[ResearchService] No next question found - all questions addressed`);
        return null;
    }



    // ==================== FOLLOW-UP QUESTION MANAGEMENT ====================
    
    updateFollowUpQuestions(newSuggestions) {
        const now = Date.now();
        const timeSinceLastUpdate = now - this.lastFollowUpUpdateTime;
        
        console.log(`[ResearchService] 🔍 DEBUG: updateFollowUpQuestions called with ${newSuggestions?.length || 0} suggestions`);
        if (newSuggestions && newSuggestions.length > 0) {
            console.log(`[ResearchService] 🔍 DEBUG: Raw suggestions from AI:`, newSuggestions);
        }
        
        // Quality filter: Only keep follow-ups that are actually needed
        const filteredSuggestions = this.filterHighQualityFollowUps(newSuggestions);
        
        // Update best follow-up questions (take top 2)
        this.bestFollowUpQuestions = filteredSuggestions.slice(0, 2);
        this.followUpQuestionMetrics.totalSuggested += newSuggestions.length;
        
        console.log(`[ResearchService] 🔍 DEBUG: Received ${newSuggestions.length} raw suggestions, filtered to ${filteredSuggestions.length} high-quality ones`);
        console.log(`[ResearchService] 🔍 DEBUG: Time since last follow-up update: ${timeSinceLastUpdate}ms`);
        
        // Always expire old questions first
        this.expireOldFollowUpQuestions(now);
        
        // Only update displayed questions if enough time has passed AND suggestions are different
        const shouldUpdateFollowUps = this._shouldUpdateDisplayedFollowUps(filteredSuggestions, timeSinceLastUpdate);
        
        if (shouldUpdateFollowUps && filteredSuggestions.length > 0) {
            console.log(`[ResearchService] 🔍 DEBUG: Updating displayed follow-up questions`);
            this.lastFollowUpUpdateTime = now;
            
            // Add new questions that aren't already displayed
            for (const suggestion of this.bestFollowUpQuestions) {
                const isAlreadyDisplayed = this.displayedFollowUpQuestions.some(q => q.text === suggestion);
                if (!isAlreadyDisplayed) {
                    this.displayedFollowUpQuestions.push({
                        text: suggestion,
                        displayedAt: now,
                        id: `followup_${now}_${Math.random().toString(36).substr(2, 9)}`
                    });
                    this.metrics.followUpsShown++;
                    console.log(`[ResearchService] 🔍 DEBUG: Added new follow-up question to display:`, suggestion);
                }
            }
            
            // Keep only top 2 displayed questions
            if (this.displayedFollowUpQuestions.length > 2) {
                this.displayedFollowUpQuestions = this.displayedFollowUpQuestions
                    .sort((a, b) => b.displayedAt - a.displayedAt)
                    .slice(0, 2);
            }
        } else {
            if (filteredSuggestions.length === 0) {
                console.log(`[ResearchService] 🔍 DEBUG: No high-quality follow-ups to display`);
            } else {
                console.log(`[ResearchService] 🔍 DEBUG: Skipping follow-up update - too soon or no significant changes`);
            }
        }
        
        console.log(`[ResearchService] 🔍 DEBUG: Currently displaying ${this.displayedFollowUpQuestions.length} follow-up questions:`, this.displayedFollowUpQuestions.map(q => q.text));
    }
    
    _shouldUpdateDisplayedFollowUps(newSuggestions, timeSinceLastUpdate) {
        // If no questions are currently displayed, always update
        if (this.displayedFollowUpQuestions.length === 0) {
            return true;
        }
        
        // Enforce minimum time between updates (unless it's been really long)
        if (timeSinceLastUpdate < this.followUpUpdateInterval && timeSinceLastUpdate < 30000) {
            return false;
        }
        
        // Check if new suggestions are meaningfully different
        const currentTexts = this.displayedFollowUpQuestions.map(q => q.text);
        const newTexts = newSuggestions.slice(0, 2);
        
        // Calculate similarity - how many of the new suggestions are already displayed
        const overlap = newTexts.filter(text => currentTexts.includes(text)).length;
        const similarityRatio = overlap / Math.max(newTexts.length, 1);
        
        // Only update if suggestions are significantly different (less than 50% overlap)
        const isDifferent = similarityRatio < 0.5;
        
        console.log(`[ResearchService] Follow-up similarity check: ${overlap}/${newTexts.length} overlap (${Math.round(similarityRatio * 100)}% similar), isDifferent: ${isDifferent}`);
        
        return isDifferent;
    }
    
    expireOldFollowUpQuestions(currentTime) {
        const expiredQuestions = [];
        
        this.displayedFollowUpQuestions = this.displayedFollowUpQuestions.filter(question => {
            const age = currentTime - question.displayedAt;
            const isBestQuestion = this.bestFollowUpQuestions.includes(question.text);
            
            // Keep if it's still one of the best questions OR if it's newer than timeout
            if (isBestQuestion || age < this.followUpQuestionTimeout) {
                return true;
            } else {
                expiredQuestions.push(question);
                console.log(`[ResearchService] Expiring follow-up question after ${age}ms:`, question.text);
                return false;
            }
        });
        
        // Emit expiration events for UI animations
        if (expiredQuestions.length > 0) {
            this.emit('followup-questions-expired', { expiredQuestions });
        }
    }
    
    getDisplayedFollowUpQuestions() {
        const now = Date.now();
        
        // Clean up expired questions before returning
        this.expireOldFollowUpQuestions(now);
        
        return this.displayedFollowUpQuestions.map(q => ({
            id: q.id,
            text: q.text,
            displayedAt: q.displayedAt,
            age: now - q.displayedAt
        }));
    }
    
    markFollowUpQuestionAsked(questionId, response = '') {
        const question = this.displayedFollowUpQuestions.find(q => q.id === questionId);
        if (question) {
            this.followUpQuestionMetrics.totalAsked++;
            this.followUpQuestionMetrics.responses.push({
                question: question.text,
                response: response,
                askedAt: Date.now(),
                questionId: questionId
            });
            
            console.log(`[ResearchService] Follow-up question marked as asked:`, question.text);
            console.log(`[ResearchService] Total asked: ${this.followUpQuestionMetrics.totalAsked}/${this.followUpQuestionMetrics.totalSuggested}`);
        }
    }

    // ==================== METRICS AND TELEMETRY ====================
    
    _dumpSessionMetrics() {
        console.log(`[ResearchService] ======= SESSION METRICS =======`);
        console.log(`[ResearchService] Interviewer turns: ${this.metrics.interviewerTurns}`);
        console.log(`[ResearchService] Question activations: ${this.metrics.questionActivations}`);
        console.log(`[ResearchService] Participant turns: ${this.metrics.participantTurns}`);
        console.log(`[ResearchService] Monotonic blocks: ${this.metrics.monotonicBlocks}`);
        console.log(`[ResearchService] Follow-ups shown: ${this.metrics.followUpsShown}`);
        
        const activationRate = this.metrics.interviewerTurns > 0 ? 
            (this.metrics.questionActivations / this.metrics.interviewerTurns * 100).toFixed(1) + '%' : 'N/A';
        console.log(`[ResearchService] Question activation rate: ${activationRate}`);
        console.log(`[ResearchService] ===============================`);
    }

    // ==================== STATUS AND UTILITIES ====================
    
    getSessionStatus() {
        if (!this.currentSession || this.activeQuestions.size === 0) {
            return null;
        }
        
        const responses = Array.from(this.questionResponses.values());
        const questionsAsked = responses.filter(r => r.status !== 'not_asked').length;
        const questionsCompleted = responses.filter(r => r.status === 'complete').length;
        const needFollowUp = responses.filter(r => r.follow_up_needed === 1).length;
        
        const questionBreakdown = {};
        for (const [questionId, response] of this.questionResponses.entries()) {
            const question = this.activeQuestions.get(questionId);
            questionBreakdown[questionId] = {
                text: question.question_text,
                category: question.category,
                priority: question.priority,
                status: response.status,
                completeness_score: response.completeness_score,
                follow_up_needed: response.follow_up_needed === 1
            };
        }
        
        return {
            studyTitle: this.currentStudy.title,
            sessionId: this.currentSession.session_id,
            totalQuestions: this.activeQuestions.size,
            questionsAsked,
            questionsCompleted,
            needFollowUp,
            completionPercentage: Math.round((questionsCompleted / this.activeQuestions.size) * 100),
            questionBreakdown
        };
    }

    calculateSessionQuality() {
        const responses = Array.from(this.questionResponses.values());
        if (responses.length === 0) return 0.0;
        
        const avgCompleteness = responses.reduce((sum, r) => sum + r.completeness_score, 0) / responses.length;
        const requiredQuestions = Array.from(this.activeQuestions.values()).filter(q => q.is_required);
        const requiredAnswered = requiredQuestions.filter(q => {
            const response = this.questionResponses.get(q.id);
            return response && response.status === 'complete';
        }).length;
        
        const requiredScore = requiredQuestions.length > 0 ? requiredAnswered / requiredQuestions.length : 1.0;
        
        return (avgCompleteness * 0.7 + requiredScore * 0.3);
    }

    // ==================== EXPORT AND REPORTING ====================
    
    async getSessionReport(sessionId) {
        const session = await researchSessionRepository.getById(sessionId);
        if (!session) return null;
        
        const study = await researchStudyRepository.getById(session.study_id);
        const responses = await questionResponseRepository.getBySessionId(sessionId);
        
        return {
            session,
            study,
            responses: responses.map(r => ({
                ...r,
                key_insights: r.key_insights ? JSON.parse(r.key_insights) : []
            }))
        };
    }
}

module.exports = new ResearchService(); 