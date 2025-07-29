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

// Utility function to create formatted timestamps for logs
function timestamp() {
    return new Date().toISOString().substr(11, 12); // HH:MM:SS.mmm format
}

// Utility function for timestamped logging
function logWithTimestamp(level = 'log', ...args) {
    console[level](`${timestamp()} [ResearchService]`, ...args);
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
        this.analysisInterval = 100; // Reduced from 150ms to 100ms for even faster insight updates
        this.isLiveAnalysisActive = false;
        this.currentQuestionBeingAsked = null; // Track which question is currently being asked
        this.currentAnswerBeingGiven = ''; // Track the current answer being provided
        this.pendingAnalysis = false; // Track if analysis is already scheduled
        
        // Follow-up question management
        this.bestFollowUpQuestions = []; // 2 best current follow-up questions from AI
        this.displayedFollowUpQuestions = []; // Questions currently shown to user with timestamps
        this.followUpQuestionTimeout = 6000; // 6 seconds timeout for faster question cycling
        this.followUpQuestionMetrics = {
            totalSuggested: 0,
            totalAsked: 0,
            responses: []
        };
        this.lastFollowUpUpdateTime = 0; // Track when follow-ups were last updated
        this.followUpUpdateInterval = 1500; // Reduced from 2000ms for even faster follow-up updates
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
            turnCompletionDelay: 800, // Reduced from 1200ms for much faster turn detection
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
        
        logWithTimestamp('log', 'Service initialized with speech completion detection');
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
            logWithTimestamp('log', 'Question detected:', data);
            this._handleQuestionDetected(data);
            
            // Forward to all listeners (UI, etc.)
            this.emit('question-detected', data);
        });

        this.questionDetectionService.on('detection-started', (data) => {
            logWithTimestamp('log', 'Question detection started:', data);
            this.emit('detection-started', data);
        });

        this.questionDetectionService.on('detection-stopped', () => {
            logWithTimestamp('log', 'Question detection stopped');
            this.emit('detection-stopped');
        });
    }

    /**
     * Handle detected questions from the detection service
     * @param {Object} detectionData - Question detection event data
     */
    _handleQuestionDetected(detectionData) {
        const { type, questionId, text, score, confidence } = detectionData;

        logWithTimestamp('log', 'Processing detected question:', {
            type, questionId, text, score, confidence
        });

        switch (type) {
            case 'scripted':
                if (questionId && this.activeQuestions.has(questionId)) {
                    // Mark question as in progress
                    this.questionStatus.set(questionId, 'in_progress');
                    logWithTimestamp('log', ` Marked scripted question ${questionId} as in_progress`);
                    
                    // REMOVED: current-question-changed emit - this was causing UI to overwrite analysis-update data
                    // The analysis-update event now provides all current question data (answer + insights)
                    // this.emit('current-question-changed', { questionId, question: this.activeQuestions.get(questionId), detectionData });
                }
                break;

            case 'ambiguous':
                logWithTimestamp('log', ` Ambiguous question detected (score: ${score})`);
                // Could emit to UI for manual clarification
                this.emit('ambiguous-question-detected', detectionData);
                break;

            case 'off_script':
                logWithTimestamp('log', ` Off-script question detected: "${text}"`);
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
        logWithTimestamp('log', 'createStudy called with data:', studyData);
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
        
        logWithTimestamp('log', 'About to create study:', study);
        await researchStudyRepository.create(study);
        logWithTimestamp('log', ` Created study: ${studyId}`);
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
        
        logWithTimestamp('log', ` Deleted study: ${studyId}`);
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
        logWithTimestamp('log', ` Added question to study ${studyId}: ${questionId}`);
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
        logWithTimestamp('log', 'Starting research session with studyId:', studyId);
        
        // Get or create a regular session
        const sessionId = await sessionRepository.getOrCreateActive('research');
        await sessionRepository.updateType(sessionId, 'research');
        logWithTimestamp('log', 'Session created/retrieved:', sessionId);
        
        // Load study from local repository first, fallback to database
        let study = localStudiesRepository.getStudyById(studyId);
        logWithTimestamp('log', 'Local study lookup result:', {
            found: !!study,
            studyId: studyId,
            studyTitle: study?.title || 'Not found'
        });
        
        if (study) {
            logWithTimestamp('log', 'Using local study:', study.title);
            this.currentStudy = study;
            logWithTimestamp('log', 'Set currentStudy:', {
                id: this.currentStudy.id,
                title: this.currentStudy.title,
                hasQuestions: !!this.currentStudy.questions,
                questionCount: this.currentStudy.questions?.length || 0
            });
            
            // Load questions from local study
            const questions = localStudiesRepository.getStudyQuestions(studyId);
            logWithTimestamp('log', 'Loaded questions from local study:', questions.length);
            
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
            logWithTimestamp('log', 'Using database study');
            this.currentStudy = await this.getStudy(studyId);
            if (!this.currentStudy) {
                throw new Error(`Study not found: ${studyId}`);
            }
            
            const questions = await this.getStudyQuestions(studyId);
            logWithTimestamp('log', 'Loaded questions from database study:', questions.length);
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
        logWithTimestamp('log', 'Research session record created:', this.currentSession.session_id);
        
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
            logWithTimestamp('log', 'Starting listen service for audio capture...');
            const listenService = this._getListenService();
            await listenService.handleListenRequest('Listen');
            logWithTimestamp('log', 'Listen service started successfully');
            
            // Ensure research window is visible for microphone capture
            logWithTimestamp('log', 'Making research window visible for microphone capture...');
            internalBridge.emit('window:requestVisibility', { name: 'research', visible: true });
            
            // Use proper window positioning via WindowManager instead of forcing bounds
            try {
            logWithTimestamp('log', 'Ensuring research window uses proper layout positioning');
                // The window visibility request will handle proper positioning via WindowLayoutManager
                // No need to force specific bounds - let the layout system handle it
            } catch (error) {
                logWithTimestamp('error', ' Error with window positioning:', error);
            }
            
            // Wait a moment for window to be ready, then start microphone capture
            setTimeout(() => {
                logWithTimestamp('log', 'Triggering microphone capture start...');
                listenService.sendToRenderer('change-listen-capture-state', { status: "start" });
            }, 100); // Reduced from 300ms for much faster startup
            
            // Also start audio capture
            logWithTimestamp('log', 'Starting macOS audio capture...');
            await listenService.startMacOSAudioCapture();
            logWithTimestamp('log', 'Audio capture started successfully');
        } catch (error) {
            logWithTimestamp('error', ' Failed to start listen service or audio capture:', error);
            // Don't fail the research session if listen service fails
        }
        
        // Start the session
        logWithTimestamp('log', ` Research session started for study: ${studyId}`);

        // Start question detection with study questions
        if (this.currentStudy && this.currentStudy.questions) {
            logWithTimestamp('log', 'Starting question detection with', this.currentStudy.questions.length, 'questions');
            try {
                await this.questionDetectionService.startDetection(this.currentStudy.questions);
            } catch (error) {
                logWithTimestamp('error', ' Failed to start question detection:', error);
                // Continue without question detection if it fails
            }
        }

        // NEW: Start screen recording for research session
        try {
            logWithTimestamp('log', 'Starting screen recording for research session...');
            const recordingResult = await screenRecordingService.startRecording(sessionId, {
                videoBitsPerSecond: 2500000, // 2.5 Mbps for good quality
                audioBitsPerSecond: 128000   // 128 kbps for system audio
            });
            
            if (recordingResult.success) {
                logWithTimestamp('log', 'Screen recording started successfully:', recordingResult.recordingPath);
                
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
                logWithTimestamp('warn', ' Failed to start screen recording:', recordingResult.error);
                // Continue without screen recording if it fails
            }
        } catch (error) {
            logWithTimestamp('error', ' Error starting screen recording:', error);
            // Continue without screen recording if it fails
        }

        // Prepare session data to emit
        const sessionData = { 
            studyId, 
            sessionId, 
            questionsCount: this.activeQuestions.size, // Use activeQuestions.size instead of undefined questions.length
            study: this.currentStudy // Include the full study object
        };
        
        logWithTimestamp('log', 'Emitting session-started event with data:', {
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
            logWithTimestamp('log', 'Stopping audio capture and listen service...');
            const listenService = this._getListenService();
            await listenService.stopMacOSAudioCapture();
            await listenService.handleListenRequest('Stop');
            
            // Hide research window
            logWithTimestamp('log', 'Hiding research window...');
            internalBridge.emit('window:requestVisibility', { name: 'research', visible: false });
            
            logWithTimestamp('log', 'Audio capture and listen service stopped successfully');
        } catch (error) {
            logWithTimestamp('error', ' Failed to stop listen service or audio capture:', error);
        }
        
        // NEW: Stop screen recording
        try {
            logWithTimestamp('log', 'Stopping screen recording...');
            
            // Tell renderer to stop recording first
            internalBridge.emit('research:stopScreenRecording');
            
            // Stop recording in service (will be finalized when renderer sends data)
            const recordingResult = await screenRecordingService.stopRecording();
            
            if (recordingResult.success) {
                logWithTimestamp('log', 'Screen recording stopped successfully');
                logWithTimestamp('log', 'Recording saved to:', recordingResult.recordingPath);
                
                this.emit('screen-recording-stopped', {
                    sessionId: this.currentSession.session_id,
                    recordingPath: recordingResult.recordingPath,
                    duration: recordingResult.duration
                });
            } else {
                logWithTimestamp('warn', ' Failed to stop screen recording:', recordingResult.error);
            }
        } catch (error) {
            logWithTimestamp('error', ' Error stopping screen recording:', error);
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
        
        logWithTimestamp('log', ` Ended research session: ${this.currentSession.session_id}`);
        
        // Dump session metrics
        this._dumpSessionMetrics();
        
        // Stop question detection and clean up its state
        if (this.questionDetectionService) {
            this.questionDetectionService.stopDetection();
        }
        
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
            logWithTimestamp('log', 'Pausing research session...');
            
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
            
            logWithTimestamp('log', 'Research session paused successfully');
            this.emit('session-paused');
            
        } catch (error) {
            logWithTimestamp('error', ' Failed to pause research session:', error);
            throw error;
        }
    }

    async resumeResearchSession() {
        if (!this.currentSession) {
            throw new Error('No research session to resume');
        }

        try {
            logWithTimestamp('log', 'Resuming research session...');
            
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
            
            logWithTimestamp('log', 'Research session resumed successfully');
            this.emit('session-resumed');
            
        } catch (error) {
            logWithTimestamp('error', ' Failed to resume research session:', error);
            throw error;
        }
    }

    // ==================== LIVE ANALYSIS ====================
    
    async processTranscriptSegment(speaker, text, timestamp) {
        if (!this.isLiveAnalysisActive || !this.currentStudy) {
            logWithTimestamp('log', '🔍 DEBUG: Skipping transcript - analysis not active or no study');
            return;
        }
        
        logWithTimestamp('log', ` Processing transcript: ${speaker} - "${text.substring(0, 50)}..."`);
        
        // NEW: Implement speech completion detection
        await this._handleSpeechTurn(speaker, text, timestamp);
        
        // REMOVED: Duplicate forwarding to question detection
        // Question detection is already handled by processTranscript() method
        // called from sttService and featureBridge - no need to forward again here
        
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
        // CRITICAL: Only process microphone audio ("Me") for QUESTION DETECTION
        // System audio ("Them") contains participant responses + background noise
        const isMicrophoneAudio = speaker === 'Me';
        const isSystemAudio = speaker === 'Them';
        
        if (isMicrophoneAudio) {
            logWithTimestamp('log', ` 🎤 Processing microphone audio for question detection: "${text.substring(0, 50)}..."`);
            await this._handleInterviewerSpeechTurn(speaker, text, timestamp);
        } else if (isSystemAudio) {
            logWithTimestamp('log', ` 🔊 Processing system audio for participant responses: "${text.substring(0, 50)}..."`);
            await this._handleParticipantSpeechTurn(speaker, text, timestamp);
        } else {
            logWithTimestamp('log', ` ⚠️ Unknown speaker: ${speaker} - "${text.substring(0, 50)}..."`);
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
                logWithTimestamp('log', ` 🎤 Interviewer resuming after system audio`);
            }
            
            // Reset for new interviewer turn
            this._resetTurnState();
            turnManager.currentSpeaker = speaker;
            turnManager.currentTurnStartTime = timestamp;
            logWithTimestamp('log', ` 🎤 Starting new interviewer turn`);
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
            logWithTimestamp('log', ` 🎤 Interviewer turn completed after ${turnManager.turnCompletionDelay}ms silence`);
            
            await this._processCompleteInterviewerTurn(
                turnManager.currentTurnBuffer,
                turnManager.currentTurnStartTime,
                Date.now()
            );
            
            this._resetTurnState();
        }, turnManager.turnCompletionDelay);
        
        logWithTimestamp('log', ` 🎤 Interviewer turn accumulated: "${turnManager.currentTurnBuffer.substring(0, 80)}..."`);
    }

    /**
     * Handle system audio (participant + background) - used for response tracking only
     */
    async _handleParticipantSpeechTurn(speaker, text, timestamp) {
        // System audio is processed immediately as complete participant responses
        // (no turn accumulation needed since it's already post-processed)
        logWithTimestamp('log', ` 🔊 Processing immediate participant response: "${text.substring(0, 80)}..."`);
        
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
            
            logWithTimestamp('log', ` 📝 Participant response added to active question ${this.currentQuestionBeingAsked.substring(0, 8)}: "${text.substring(0, 100)}..."`);
        } else {
            logWithTimestamp('log', ` 🔊 Participant speaking but no active question: "${text.substring(0, 50)}..."`);
        }
        
        // Only trigger AI analysis if there's an active current question
        // Don't try to map free-form participant responses to study questions
        if (!this.currentQuestionBeingAsked) {
            logWithTimestamp('log', ` ⚠️ Skipping AI analysis - no active question to analyze response for`);
            return;
        }
        
        // Trigger AI analysis for participant responses to the current question
        const now = Date.now();
        const timeSinceLastAnalysis = now - this.lastAnalysisTime;
        
        if (timeSinceLastAnalysis >= this.analysisInterval && !this.pendingAnalysis) {
            logWithTimestamp('log', ` Triggering AI analysis for current question: ${this.currentQuestionBeingAsked.substring(0, 8)}`);
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
            logWithTimestamp('log', 'Skipping empty turn');
            return;
        }
        
        const trimmedText = completeTurnText.trim();
        logWithTimestamp('log', ` 🎯 Processing COMPLETE turn: ${speaker} - "${trimmedText.substring(0, 100)}..."`);
        logWithTimestamp('log', ` Turn duration: ${endTime - startTime}ms`);
    }

    /**
     * Process complete interviewer turn - only activate questions when interviewer finishes speaking
     * This is now only called for microphone audio ("Me")
     */
    async _processCompleteInterviewerTurn(completeTurnText, startTime, endTime) {
        this.metrics.interviewerTurns++;
        
        // NEW: Process complete turn with question detection service for better refinement
        // This provides the full interviewer turn context instead of just fragments
        if (this.questionDetectionService.isActive) {
            logWithTimestamp('log', ` 🔍 Sending complete interviewer turn to question detection for refinement`);
            await this.questionDetectionService.processCompleteInterviewerTurn(completeTurnText);
        }
        
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
            logWithTimestamp('log', ` ✅ Complete interviewer question detected from microphone: "${completeTurnText.substring(0, 100)}..."`);
            
            // Classify complete turn to study question
            const classification = await this.classifyInterviewerTurnToQuestion(completeTurnText);
            
            if (classification.questionId) {
                // Activate the matched question (only from microphone audio)
                this._activateQuestion(
                    classification.questionId, 
                    endTime, 
                    completeTurnText
                );
                
                logWithTimestamp('log', ` 🎯 Question activated from microphone audio: ${classification.questionId.substring(0, 8)}`);
        } else {
                logWithTimestamp('log', ` Complete microphone question but no study question match (off-script)`);
            }
        } else {
            logWithTimestamp('log', ` Complete microphone turn but no question pattern detected: "${completeTurnText.substring(0, 50)}..."`);
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
        
        logWithTimestamp('log', '🔄 Turn state reset');
    }

    async analyzeRecentTranscript() {
        const unprocessedSegments = this.transcriptBuffer.filter(seg => !seg.processed);
        logWithTimestamp('log', ` Analyzing ${unprocessedSegments.length} unprocessed transcript segments`);
        
        if (unprocessedSegments.length === 0) {
            logWithTimestamp('log', 'No unprocessed segments to analyze');
            return;
        }
        
        try {
            // Get recent transcript text
            const recentText = unprocessedSegments
                .map(seg => `${seg.speaker}: ${seg.text}`)
                .join('\n');
            
            logWithTimestamp('log', ` Transcript to analyze:\n${recentText}`);
            
            // Only analyze against the current active question, not all study questions
            // This prevents AI from mapping responses to unrelated questions
            if (!this.currentQuestionBeingAsked) {
                logWithTimestamp('log', ` ⚠️ No current question - skipping AI analysis`);
                return;
            }
            
            const currentQuestion = this.activeQuestions.get(this.currentQuestionBeingAsked);
            if (!currentQuestion) {
                logWithTimestamp('warn', ` Current question ${this.currentQuestionBeingAsked} not found in active questions`);
                return;
            }
            
            // Prepare only the current question for analysis
            const questionContext = [{
                id: currentQuestion.id,
                text: currentQuestion.question_text,
                category: currentQuestion.category,
                status: this.questionResponses.get(currentQuestion.id)?.status || 'not_asked'
            }];
            
            logWithTimestamp('log', ` Analyzing response against current question: ${currentQuestion.id.substring(0, 8)} - "${currentQuestion.question_text.substring(0, 60)}..." (status: ${questionContext[0].status})`);
            
            // AI analysis - focused only on the current question
            const analysis = await this.performQuestionAnalysis(recentText, questionContext);
            logWithTimestamp('log', '🔍 DEBUG: AI analysis completed:', analysis);
            logWithTimestamp('log', '🔍 DEBUG: AI suggestions received:', analysis.suggestions?.length || 0, 'suggestions');
            if (analysis.suggestions && analysis.suggestions.length > 0) {
                analysis.suggestions.forEach((suggestion, index) => {
                    logWithTimestamp('log', ` 🔍 DEBUG: AI suggestion ${index + 1}: "${suggestion}"`);
                });
            }
            
            // Log which questions the AI thinks are being addressed
            if (analysis.question_updates) {
                analysis.question_updates.forEach(update => {
                    const question = this.activeQuestions.get(update.questionId);
                    logWithTimestamp('log', ` AI update for question ${update.questionId.substring(0, 8)}: "${question?.question_text?.substring(0, 60)}..." -> status: ${update.status}, score: ${update.completeness_score}`);
                    
                    // Debug key_insights specifically
                    if (update.key_insights) {
                        logWithTimestamp('log', ` 🔍 AI key_insights for ${update.questionId.substring(0, 8)}:`, {
                            type: typeof update.key_insights,
                            isArray: Array.isArray(update.key_insights),
                            length: update.key_insights?.length,
                            value: update.key_insights
                        });
                    }
                });
            }
            
            // Update question responses based on analysis
            await this.updateQuestionResponses(analysis, unprocessedSegments);
            
            // Update current question and answer tracking
            await this.updateCurrentQuestionTracking(analysis, unprocessedSegments);
            
            // Mark segments as processed
            unprocessedSegments.forEach(seg => seg.processed = true);
            
            // Update follow-up questions with intelligent management
            logWithTimestamp('log', ` AI returned ${analysis.suggestions?.length || 0} suggestions`);
            this.updateFollowUpQuestions(analysis.suggestions || []);
            
            // Emit updates
            this.emit('analysis-update', {
                status: this.getSessionStatus(),
                suggestions: this.getDisplayedFollowUpQuestions(),
                currentQuestion: this.getCurrentQuestionContext(),
                nextQuestion: this.getNextQuestionToAsk(),
                followUpMetrics: this.followUpQuestionMetrics
            });
            
            logWithTimestamp('log', '📡 Analysis update emitted to UI - UI should refresh insights now');
            
        } catch (error) {
            logWithTimestamp('error', ' Analysis error:', error);
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
                content: `Analyze this transcript and generate key insights quickly:

TRANSCRIPT:
${transcriptText}

Respond with JSON containing:
1. "question_updates": [{questionId, status, completeness_score, key_insights, follow_up_needed}]
2. "suggestions": [1-2 specific follow-up questions based on what was said]
3. "overall_analysis": Brief summary

CRITICAL RULES FOR KEY INSIGHTS:
- ONLY generate insights if participant provided meaningful, specific information
- DO NOT create insights saying "no information provided", "participant didn't answer", etc.
- Leave key_insights EMPTY [] if the response lacks substance
- Focus on actual user behaviors, pain points, preferences, or experiences mentioned
- Each insight should be actionable and specific to what was actually said
- WRITE CONCISE, DIRECT INSIGHTS - remove unnecessary words like "User", "Participant", "Experiences"
- Use lowercase and bullet-point style, not full sentences

EXAMPLES OF GOOD INSIGHTS (CONCISE STYLE):
✅ "mobile banking preferred due to convenience"
✅ "multi-factor authentication during travel is frustrating"
✅ "uses 3 different apps - no single solution meets all needs"

EXAMPLES OF BAD INSIGHTS (DON'T GENERATE THESE):
❌ "Participant did not provide clear information"
❌ "No specific details were mentioned"
❌ "Response was unclear or incomplete"

If the participant gave a non-answer, unclear response, or just said a random word, return empty key_insights: []`
            }
        ];
        
        const llm = createLLM(modelInfo.provider, {
            apiKey: modelInfo.apiKey,
            model: modelInfo.model,
            temperature: 0.4, // Slightly higher for faster, more creative insights
            maxTokens: 800 // Reduced from 1500 for faster processing focused on insights
        });
        
        const completion = await llm.chat(messages);
        
        try {
            // Robust JSON extraction - handle markdown fences, prose, etc.
            return this.extractJson(completion.content);
        } catch (parseError) {
            logWithTimestamp('error', ' Failed to parse AI response:', parseError.message);
            logWithTimestamp('error', ' Raw AI response:', completion.content);
            return { question_updates: [], suggestions: [], overall_analysis: '' };
        }
    }

    buildResearchAnalysisPrompt(questions) {
        return `You are a UX research assistant analyzing live interview transcripts. Generate insights quickly.

STUDY: ${this.currentStudy.title}
GOALS: ${this.currentStudy.goals}

QUESTIONS TO TRACK:
${questions.map(q => `- ${q.id}: ${q.text} (${q.status})`).join('\n')}

RULES:
1. Use exact question IDs from above in questionId field
2. Only update status for clear question-answer exchanges
3. Generate 2-5 specific key insights per response - USE CONCISE, BULLET-POINT STYLE
4. Suggest specific follow-ups that reference participant's words
5. Focus on user pain points, behaviors, motivations

STATUS: not_asked/partial/complete/needs_clarification
COMPLETENESS: 0.0-1.0 (conservative scoring)
INSIGHTS: Write concise, direct insights without "User", "Participant" - lowercase bullet style

Return valid JSON only.`;
    }

    async updateQuestionResponses(analysis, transcriptSegments) {
        if (!analysis.question_updates) return;
        
        logWithTimestamp('log', ` Applying ${analysis.question_updates.length} question updates with monotonic enforcement`);
        
        for (const update of analysis.question_updates) {
            const questionId = update.questionId;
            
            // P0 Fix: Validate questionId exists in our active questions
            if (!this.activeQuestions.has(questionId)) {
                logWithTimestamp('warn', ` AI returned invalid questionId: "${questionId}" - skipping update`);
                continue;
            }
            
            // NEW: Only allow updates to the current active question
            // This prevents AI from updating unrelated study questions
            if (this.currentQuestionBeingAsked && questionId !== this.currentQuestionBeingAsked) {
                logWithTimestamp('warn', ` AI tried to update question ${questionId.substring(0, 8)} but current question is ${this.currentQuestionBeingAsked.substring(0, 8)} - skipping update`);
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
        logWithTimestamp('log', ` === AI ANALYSIS TRACKING ===`);
        logWithTimestamp('log', ` Current question: ${this.currentQuestionBeingAsked?.substring(0, 8)}...`);
        logWithTimestamp('log', ` Analysis question_updates:`, analysis.question_updates);
        
        // NEW: Since we now handle turn completion detection above, this method focuses on AI analysis only
        
        // Process AI updates for currently active question only (no auto-switching from AI)
        if (analysis.question_updates && this.currentQuestionBeingAsked) {
            logWithTimestamp('log', ` Processing AI updates for active question only...`);
            
            // Only process updates for the currently active question
            const activeQuestionUpdates = analysis.question_updates.filter(update => 
                update.questionId === this.currentQuestionBeingAsked
            );
            
            if (activeQuestionUpdates.length > 0) {
                const update = activeQuestionUpdates[0];
                logWithTimestamp('log', ` Processing AI update for active question ${update.questionId.substring(0, 8)}: score=${update.completeness_score}, status=${update.status}`);
                
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
                logWithTimestamp('log', ` Ignoring ${ignoredUpdates.length} AI-suggested question switches; using speech completion detection instead`);
            }
        } else if (analysis.question_updates && analysis.question_updates.length > 0 && !this.currentQuestionBeingAsked) {
            // Fallback: If AI suggests a question is active but we have no active question from speech detection
            logWithTimestamp('log', 'AI suggests question activity but no active question from speech detection - this may indicate an issue');
        }
        
        // Log current state for debugging
        if (this.currentQuestionBeingAsked) {
            const question = this.activeQuestions.get(this.currentQuestionBeingAsked);
            logWithTimestamp('log', ` Current question: "${question?.question_text?.substring(0, 50)}..."`);
            logWithTimestamp('log', ` Current answer: "${this.currentAnswerBeingGiven?.substring(0, 100)}..."`);
        } else {
            logWithTimestamp('log', ` No current question identified from speech completion detection`);
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
            
            logWithTimestamp('log', ` Similarity check: "${questionText.substring(0, 30)}..." = ${Math.round(similarity * 100)}%`);
            
            if (similarity > bestScore && similarity >= threshold) {
                bestScore = similarity;
                bestMatch = question;
            }
        }

        if (bestMatch) {
            logWithTimestamp('log', ` Best match found with ${Math.round(bestScore * 100)}% similarity: ${bestMatch.question_text?.substring(0, 50)}...`);
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
            logWithTimestamp('log', ` Follow-ups not needed - conversation is flowing well`);
            return [];
        }
        
        // Filter individual suggestions for quality
        const highQualitySuggestions = suggestions.filter(suggestion => {
            return this.isHighQualityFollowUp(suggestion);
        });
        
        logWithTimestamp('log', ` Quality filtered suggestions from ${suggestions.length} to ${highQualitySuggestions.length}`);
        return highQualitySuggestions;
    }

    shouldSuggestFollowUps() {
        logWithTimestamp('log', ` 🔍 DEBUG: Checking if should suggest follow-ups...`);
        
        // Allow follow-ups during any conversation, not just when a specific question is active
        // This enables follow-ups during free-form conversation
        if (!this.currentQuestionBeingAsked) {
            logWithTimestamp('log', ` 🔍 DEBUG: No active question, but allowing follow-ups during free conversation`);
            
            // Check if there's any recent conversation to base follow-ups on
            if (this.transcriptBuffer.length === 0) {
                logWithTimestamp('log', ` 🔍 DEBUG: No conversation yet - no follow-ups needed`);
            return false;
        }
            
            // Allow follow-ups if there's been conversation
            logWithTimestamp('log', ` 🔍 DEBUG: Recent conversation detected - follow-ups allowed`);
            return true;
        }
        
        logWithTimestamp('log', ` 🔍 DEBUG: Active question: ${this.currentQuestionBeingAsked?.substring(0, 8)}...`);
        
        // Check the completeness of current and recent questions
        const currentResponse = this.questionResponses.get(this.currentQuestionBeingAsked);
        if (!currentResponse) {
            logWithTimestamp('log', ` 🔍 DEBUG: No response found for active question`);
            return false;
        }
        
        logWithTimestamp('log', ` 🔍 DEBUG: Current response - score: ${currentResponse.completeness_score}, status: ${currentResponse.status}`);
        
        // Only suggest if the current question needs more detail
        const needsMoreDetail = currentResponse.completeness_score < 0.7 || 
                               currentResponse.status === 'partial' ||
                               currentResponse.status === 'needs_clarification';
        
        if (!needsMoreDetail) {
            logWithTimestamp('log', ` 🔍 DEBUG: Current question sufficiently complete (score: ${currentResponse.completeness_score}, status: ${currentResponse.status})`);
            return false;
        }
        
        logWithTimestamp('log', ` 🔍 DEBUG: Question needs more detail - checking other conditions...`);
        
        // Don't suggest if participant just started answering (give them time)
        if (this.currentAnswerBeingGiven && this.currentAnswerBeingGiven.length < 50) {
            logWithTimestamp('log', ` 🔍 DEBUG: Participant just started answering (${this.currentAnswerBeingGiven.length} chars), waiting for more content`);
            return false;
        }
        
        logWithTimestamp('log', ` 🔍 DEBUG: Current answer length: ${this.currentAnswerBeingGiven?.length || 0} chars`);
        
        // Don't suggest if we're already showing recent, relevant follow-ups
        if (this.displayedFollowUpQuestions.length > 0) {
            const mostRecentFollowUp = Math.max(...this.displayedFollowUpQuestions.map(q => q.displayedAt));
            const timeSinceLastFollowUp = Date.now() - mostRecentFollowUp;
            
            // Use configured interval instead of hardcoded 15 seconds - much more responsive!
            if (timeSinceLastFollowUp < this.followUpUpdateInterval) {
                logWithTimestamp('log', ` 🔍 DEBUG: Already showing recent follow-ups, waiting ${this.followUpUpdateInterval - timeSinceLastFollowUp}ms`);
                return false;
            }
        }
        
        logWithTimestamp('log', ` 🔍 DEBUG: All conditions passed - should suggest follow-ups!`);
        return true;
    }

    isHighQualityFollowUp(suggestion) {
        if (!suggestion || typeof suggestion !== 'string' || suggestion.length < 20) {
            return false;
        }
        
        // TEMPORARILY DISABLED - Debug why no follow-ups are showing
        logWithTimestamp('log', ` 🔍 DEBUG: Evaluating suggestion: "${suggestion}"`);
        
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
            logWithTimestamp('log', ` Filtered out low-quality suggestion: "${suggestion.substring(0, 50)}..."`);
            return false;
        }
        
        // Require suggestions to be specific and reference participant's actual words
        const hasSpecificReference = /you mentioned|when you said|you described|you talked about/i.test(suggestion);
        if (!hasSpecificReference) {
            logWithTimestamp('log', ` Filtered out non-specific suggestion: "${suggestion.substring(0, 50)}..."`);
            return false;
        }
        
        // Must be asking for concrete details, examples, or clarification
        const hasGoodIntent = /how does|what happens|can you describe|give an example|specific situation|what would/i.test(suggestion);
        if (!hasGoodIntent) {
            logWithTimestamp('log', ` Filtered out vague suggestion: "${suggestion.substring(0, 50)}..."`);
            return false;
        }
        
        return true;
        */
    }

    // ==================== MONOTONIC COMPLETENESS ENFORCEMENT ====================
    
    _applyMonotonicUpdate(questionId, {new_completeness, needs_clarification, delta_insights}) {
        const r = this.questionResponses.get(questionId);
        if (!r) {
            logWithTimestamp('warn', ` Cannot apply monotonic update - questionId not found: ${questionId}`);
            return;
        }

        const prev = r.completeness_score ?? 0;
        
        // Enforce monotonic completeness - never decrease
        if (typeof new_completeness === 'number' && new_completeness > prev) {
            r.completeness_score = new_completeness;
            r.max_completeness = Math.max(r.max_completeness || 0, new_completeness);
            logWithTimestamp('log', ` Completeness increased: ${questionId.substring(0, 8)} ${prev} -> ${new_completeness}`);
        } else if (typeof new_completeness === 'number' && new_completeness < prev) {
            // Log monotonic block but don't decrease
            this.metrics.monotonicBlocks++;
            r.last_model_score = new_completeness;
            logWithTimestamp('log', ` Monotonic block: ${questionId.substring(0, 8)} tried to decrease ${prev} -> ${new_completeness}`);
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
            logWithTimestamp('log', ` Clarification needed for question: ${questionId.substring(0, 8)}`);
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

        // Merge delta insights with smart deduplication
        if (delta_insights?.length) {
            logWithTimestamp('log', ` 🔍 Delta insights debug:`, {
                type: typeof delta_insights,
                isArray: Array.isArray(delta_insights),
                length: delta_insights.length,
                rawValue: delta_insights
            });
            
            const prevInsights = r.key_insights ? JSON.parse(r.key_insights) : [];
            
            // Ensure delta_insights is an array and contains valid strings
            const validDeltaInsights = Array.isArray(delta_insights) ? 
                delta_insights.filter(insight => this._isQualityInsight(insight)) : 
                [];
                
            logWithTimestamp('log', ` 🔍 Filtered delta insights: ${validDeltaInsights.length} valid items`);
            
            // Deduplicate insights: Only add new insights that aren't already present
            const deduplicatedInsights = validDeltaInsights.filter(newInsight => {
                const similarity = prevInsights.find(existingInsight => 
                    this._areInsightsSimilar(newInsight, existingInsight)
                );
                return !similarity; // Only include if not similar to existing
            });
            
            if (deduplicatedInsights.length > 0) {
                logWithTimestamp('log', ` 🔍 Adding ${deduplicatedInsights.length} new unique insights`);
                r.key_insights = JSON.stringify([...prevInsights, ...deduplicatedInsights]);
            } else {
                logWithTimestamp('log', ` 🔍 No new unique insights to add (${validDeltaInsights.length} were duplicates)`);
            }
        }

        r.updated_at = tsSec();
        this.questionResponses.set(questionId, r);
        
        logWithTimestamp('log', ` Updated question ${questionId.substring(0, 8)}: score=${r.completeness_score}, status=${r.status}`);
    }

    // ==================== INTERVIEWER-DRIVEN QUESTION ACTIVATION ====================
    
    _activateQuestion(questionId, timestamp, turnText) {
        if (!this.activeQuestions.has(questionId)) {
            logWithTimestamp('warn', ` Cannot activate invalid questionId: ${questionId}`);
            return false;
        }
        
        const question = this.activeQuestions.get(questionId);
        const previousQuestionId = this.currentQuestionBeingAsked;
        
        this.currentQuestionBeingAsked = questionId;
        this.currentAnswerBeingGiven = ''; // Reset answer for new question
        this.lastInterviewerQuestionAt = timestamp;
        this.metrics.questionActivations++;
        
        logWithTimestamp('log', ` 🔍 DEBUG: ✅ Question activated: ${questionId.substring(0, 8)} - "${question.question_text?.substring(0, 60)}..."`);
        logWithTimestamp('log', ` 🔍 DEBUG: Interviewer turn: "${turnText.substring(0, 100)}..."`);
        logWithTimestamp('log', ` 🔍 DEBUG: Previous question: ${previousQuestionId?.substring(0, 8) || 'none'}`);
        
        if (previousQuestionId && previousQuestionId !== questionId) {
            logWithTimestamp('log', ` 🔍 DEBUG: Switched from question ${previousQuestionId.substring(0, 8)}`);
        }
        
        // NEW: Immediately update UI when question is activated
        logWithTimestamp('log', ` 📡 Emitting immediate UI update for activated question ${questionId.substring(0, 8)}`);
        this.emit('analysis-update', {
            status: this.getSessionStatus(),
            suggestions: this.displayedFollowUpQuestions || [],
            currentQuestion: this.getCurrentQuestionContext(),
            nextQuestion: this.getNextQuestionToAsk(),
            followUpMetrics: this.followUpQuestionMetrics
        });
        
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
                logWithTimestamp('log', ` Interview turn classification: ${best.id.substring(0, 8)} (${Math.round(best.similarity * 100)}% confidence)`);
                return {
                    questionId: best.id,
                    confidence: best.similarity,
                    is_clarification: false // Simple version for now
                };
            }
            
            logWithTimestamp('log', ` Interview turn classification: no match (best: ${Math.round((best?.similarity || 0) * 100)}%)`);
            return {
                questionId: null,
                confidence: best?.similarity || 0,
                is_clarification: false
            };
        } catch (error) {
            logWithTimestamp('error', ' Error in interviewer turn classification:', error);
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
        
        // Safely parse key_insights with proper type checking
        let keyInsights = [];
        if (response?.key_insights) {
            try {
                const parsed = JSON.parse(response.key_insights);
                // Ensure it's an array, not a string or other type
                const rawInsights = Array.isArray(parsed) ? parsed : [];
                
                // FINAL DEDUPLICATION: Remove any duplicates before sending to UI
                keyInsights = [];
                for (const insight of rawInsights) {
                    const isDuplicate = keyInsights.some(existing => 
                        this._areInsightsSimilar(insight, existing)
                    );
                    if (!isDuplicate) {
                        keyInsights.push(insight);
                    } else {
                        logWithTimestamp('log', ` 🔍 UI FILTER: Removed duplicate insight: "${insight.substring(0, 60)}..."`);
                    }
                }
                
                logWithTimestamp('log', ` 📊 UI UPDATE: Sending ${keyInsights.length} insights for question ${this.currentQuestionBeingAsked.substring(0, 8)} (filtered from ${rawInsights.length})`);
                if (keyInsights.length > 0) {
                    logWithTimestamp('log', ` 📊 UI UPDATE: Insights being sent:`, keyInsights);
                }
            } catch (error) {
                logWithTimestamp('warn', ' Failed to parse key_insights:', error, 'Raw data:', response.key_insights);
                keyInsights = [];
            }
        } else {
            logWithTimestamp('log', ` 📊 UI UPDATE: No insights available for question ${this.currentQuestionBeingAsked.substring(0, 8)}`);
        }
        
        const currentQuestionData = {
            questionId: this.currentQuestionBeingAsked,
            questionText: question?.question_text || '',
            currentAnswer: this.currentAnswerBeingGiven || '',
            keyInsights,
            status: response?.status || 'not_asked',
            completeness_score: response?.completeness_score || 0.0
        };
        
        logWithTimestamp('log', ` 📊 UI UPDATE: Full current question data:`, {
            questionId: currentQuestionData.questionId.substring(0, 8),
            hasAnswer: !!currentQuestionData.currentAnswer,
            answerLength: currentQuestionData.currentAnswer.length,
            insightCount: currentQuestionData.keyInsights.length,
            status: currentQuestionData.status,
            score: currentQuestionData.completeness_score
        });
        
        return currentQuestionData;
    }

    getNextQuestionToAsk() {
        // Find the next logical question to ask (prioritize moving forward over completion)
        const questionEntries = Array.from(this.questionResponses.entries());
        logWithTimestamp('log', ` Finding next question from ${questionEntries.length} questions`);
        
        // Priority 1: Next unasked question (ordered by order_index) - keep conversation moving forward
        const unaskedQuestions = questionEntries
            .filter(([id, response]) => response.status === 'not_asked')
            .map(([id, response]) => {
                const question = this.activeQuestions.get(id);
                return { id, response, question, order_index: question?.order_index || 0 };
            })
            .sort((a, b) => a.order_index - b.order_index);
            
        logWithTimestamp('log', ` Found ${unaskedQuestions.length} unasked questions`);
        if (unaskedQuestions.length > 0) {
            const nextQuestion = unaskedQuestions[0];
            logWithTimestamp('log', ` Next question: ${nextQuestion.question?.question_text?.substring(0, 50)}...`);
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
            logWithTimestamp('log', ` Next question: needs completion - ${question?.question_text?.substring(0, 50)}...`);
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
            logWithTimestamp('log', ` Next question: follow-up needed - ${question?.question_text?.substring(0, 50)}...`);
            return {
                questionId: needFollowUp[0],
                questionText: question?.question_text || '',
                reason: 'follow-up needed'
            };
        }
        
        logWithTimestamp('log', ` No next question found - all questions addressed`);
        return null;
    }



    // ==================== FOLLOW-UP QUESTION MANAGEMENT ====================
    
    updateFollowUpQuestions(newSuggestions) {
        const now = Date.now();
        const timeSinceLastUpdate = now - this.lastFollowUpUpdateTime;
        
        logWithTimestamp('log', ` updateFollowUpQuestions called with ${newSuggestions?.length || 0} suggestions`);
        if (newSuggestions && newSuggestions.length > 0) {

        }
        
        // Quality filter: Only keep follow-ups that are actually needed
        const filteredSuggestions = this.filterHighQualityFollowUps(newSuggestions);
        
        // Update best follow-up questions (take top 2)
        this.bestFollowUpQuestions = filteredSuggestions.slice(0, 2);
        this.followUpQuestionMetrics.totalSuggested += newSuggestions.length;
        
        logWithTimestamp('log', ` Received ${newSuggestions.length} raw suggestions, filtered to ${filteredSuggestions.length} high-quality ones`);
        
        // Always expire old questions first
        this.expireOldFollowUpQuestions(now);
        
        // Only update displayed questions if enough time has passed AND suggestions are different
        const shouldUpdateFollowUps = this._shouldUpdateDisplayedFollowUps(filteredSuggestions, timeSinceLastUpdate);
        
        if (shouldUpdateFollowUps && filteredSuggestions.length > 0) {
            logWithTimestamp('log', ` 🔍 DEBUG: Updating displayed follow-up questions`);
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
                    logWithTimestamp('log', ` 🔍 DEBUG: Added new follow-up question to display:`, suggestion);
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
                logWithTimestamp('log', ` 🔍 DEBUG: No high-quality follow-ups to display`);
            } else {
                logWithTimestamp('log', ` 🔍 DEBUG: Skipping follow-up update - too soon or no significant changes`);
            }
        }
        
        logWithTimestamp('log', ` 🔍 DEBUG: Currently displaying ${this.displayedFollowUpQuestions.length} follow-up questions:`, this.displayedFollowUpQuestions.map(q => q.text));
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
        
        logWithTimestamp('log', ` Follow-up similarity check: ${overlap}/${newTexts.length} overlap (${Math.round(similarityRatio * 100)}% similar), isDifferent: ${isDifferent}`);
        
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
                logWithTimestamp('log', ` Expiring follow-up question after ${age}ms:`, question.text);
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
            
            logWithTimestamp('log', ` Follow-up question marked as asked:`, question.text);
            logWithTimestamp('log', ` Total asked: ${this.followUpQuestionMetrics.totalAsked}/${this.followUpQuestionMetrics.totalSuggested}`);
        }
    }

    // ==================== METRICS AND TELEMETRY ====================
    
    _dumpSessionMetrics() {
        logWithTimestamp('log', ` ======= SESSION METRICS =======`);
        logWithTimestamp('log', ` Interviewer turns: ${this.metrics.interviewerTurns}`);
        logWithTimestamp('log', ` Question activations: ${this.metrics.questionActivations}`);
        logWithTimestamp('log', ` Participant turns: ${this.metrics.participantTurns}`);
        logWithTimestamp('log', ` Monotonic blocks: ${this.metrics.monotonicBlocks}`);
        logWithTimestamp('log', ` Follow-ups shown: ${this.metrics.followUpsShown}`);
        
        const activationRate = this.metrics.interviewerTurns > 0 ? 
            (this.metrics.questionActivations / this.metrics.interviewerTurns * 100).toFixed(1) + '%' : 'N/A';
        logWithTimestamp('log', ` Question activation rate: ${activationRate}`);
        logWithTimestamp('log', ` ===============================`);
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

    // ==================== SESSION STATE METHODS ====================
    
    /**
     * Check if a research session is currently active
     * @returns {boolean} True if session is active and listening
     */
    isSessionActive() {
        return !!(this.currentSession && this.isLiveAnalysisActive);
    }

    /**
     * Get current session info for external services
     * @returns {object|null} Session info or null if not active
     */
    getCurrentSessionInfo() {
        if (!this.isSessionActive()) return null;
        
        return {
            sessionId: this.currentSession.session_id,
            studyId: this.currentSession.study_id,
            isLiveAnalysisActive: this.isLiveAnalysisActive,
            hasActiveQuestion: !!this.currentQuestionBeingAsked
        };
    }

    /**
     * Check if an insight is high quality and meaningful
     * @param {string} insight - The insight to evaluate
     * @returns {boolean} True if insight is worth keeping
     */
    _isQualityInsight(insight) {
        if (!insight || typeof insight !== 'string') return false;
        
        const trimmed = insight.trim();
        if (trimmed.length < 10) return false; // Too short
        
        // Filter out "no information" type insights
        const badPhrases = [
            'no information',
            'did not provide', 
            'participant did not',
            'no specific',
            'no clear',
            'unclear',
            'not mentioned',
            'did not answer',
            'did not elaborate',
            'no details',
            'not provided',
            'response was',
            'single word',
            'actionable insights',
            'behaviors has been provided'
        ];
        
        const lowerInsight = trimmed.toLowerCase();
        return !badPhrases.some(phrase => lowerInsight.includes(phrase));
    }
    
    /**
     * Check if two insights are similar (to prevent duplicates)
     * @param {string} insight1 
     * @param {string} insight2 
     * @returns {boolean} True if insights are similar enough to be considered duplicates
     */
    _areInsightsSimilar(insight1, insight2) {
        if (!insight1 || !insight2) return false;
        
        const normalize = (text) => text.toLowerCase().replace(/[^\w\s]/g, '').trim();
        const norm1 = normalize(insight1);
        const norm2 = normalize(insight2);
        
        // Exact match after normalization
        if (norm1 === norm2) return true;
        
        // IMPROVED: Semantic similarity detection for better deduplication
        
        // 1. Extract key concepts/words (focus on meaningful terms)
        const extractKeywords = (text) => {
            return text.split(/\s+/)
                .filter(word => word.length > 3) // Skip short words
                .filter(word => !['uses', 'user', 'apps', 'that', 'this', 'with', 'for', 'the', 'and', 'indicating', 'suggesting', 'preference', 'need'].includes(word))
                .sort();
        };
        
        const keywords1 = extractKeywords(norm1);
        const keywords2 = extractKeywords(norm2);
        
        // 2. Check for high keyword overlap (semantic similarity)
        const commonKeywords = keywords1.filter(word => keywords2.includes(word));
        const keywordSimilarity = commonKeywords.length / Math.max(keywords1.length, keywords2.length);
        
        // 3. Check if insights cover the same topic
        if (keywordSimilarity > 0.6 && commonKeywords.length >= 2) {
            logWithTimestamp('log', ` 🔍 DUPLICATE DETECTED: "${insight1.substring(0, 50)}..." ≈ "${insight2.substring(0, 50)}..." (${Math.round(keywordSimilarity * 100)}% similar)`);
            return true;
        }
        
        // 4. Fallback: Character-level overlap for near-exact matches
        if (norm1.length > 30 && norm2.length > 30) {
            const longer = norm1.length > norm2.length ? norm1 : norm2;
            const shorter = norm1.length > norm2.length ? norm2 : norm1;
            const overlapThreshold = shorter.length * 0.85; // Reduced from 90% to 85%
            
            // Check if shorter is almost entirely contained in longer
            let maxMatch = 0;
            for (let i = 0; i <= longer.length - shorter.length; i++) {
                const substring = longer.substring(i, i + shorter.length);
                let matches = 0;
                for (let j = 0; j < shorter.length; j++) {
                    if (substring[j] === shorter[j]) matches++;
                }
                maxMatch = Math.max(maxMatch, matches);
            }
            
            if (maxMatch >= overlapThreshold) {
                logWithTimestamp('log', ` 🔍 DUPLICATE DETECTED: Character overlap (${Math.round(maxMatch/shorter.length * 100)}%)`);
                return true;
            }
        }
        
        return false;
    }
}

module.exports = new ResearchService(); 