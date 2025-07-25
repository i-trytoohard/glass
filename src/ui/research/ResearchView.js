import { html, css, LitElement } from '../assets/lit-core-2.7.4.min.js';

console.log('[ResearchView] Module loading - ResearchView.js file being imported');

export class ResearchView extends LitElement {
    static styles = css`
        :host {
            display: block;
            width: 100%;
            height: 100vh; /* Use viewport height instead of 100% */
            max-height: 100vh; /* Ensure it never exceeds viewport */
            overflow: hidden; /* Host should not scroll */
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
            font-size: 13px;
            line-height: 1.4;
            color: var(--text-color, #333);
            background: transparent;
        }

        .research-container {
            display: flex;
            flex-direction: column;
            height: 100%;
            width: 100%;
            background: rgba(20, 20, 20, 0.8);
            border-radius: 12px;
            outline: 0.5px rgba(255, 255, 255, 0.2) solid;
            outline-offset: -1px;
            box-sizing: border-box;
            position: relative;
            overflow-y: auto;
            padding: 12px 12px;
            z-index: 1000;
        }

        .research-container::-webkit-scrollbar {
            width: 6px;
        }

        .research-container::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 3px;
        }

        .research-container::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.2);
            border-radius: 3px;
        }

        .research-container::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.3);
        }

        .research-container::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.15);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            border-radius: 12px;
            filter: blur(10px);
            z-index: -1;
        }

        .research-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 8px;
            padding-right: 16px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.2);
            flex-shrink: 0; /* Prevent header from shrinking */
        }

        .research-title {
            font-size: 18px;
            font-weight: 600;
            color: white;
        }

        .research-mode {
            padding: 6px 12px;
            background: #4299e1;
            color: white;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 500;
            text-transform: uppercase;
            margin-right: 12px;
            flex-shrink: 0;
        }

        .research-mode.setup { background: #ed8936; }
        .research-mode.live { background: #48bb78; }
        .research-mode.analysis { background: #9f7aea; }

        .setup-wizard {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .wizard-section {
            background: #f7fafc;
            padding: 12px;
            border-radius: 6px;
            border: 1px solid #e2e8f0;
        }

        .wizard-section h3 {
            margin: 0 0 8px 0;
            font-size: 14px;
            font-weight: 600;
            color: #2d3748;
        }

        .form-group {
            display: flex;
            flex-direction: column;
            gap: 4px;
            margin-bottom: 10px;
        }

        .form-group label {
            font-size: 12px;
            font-weight: 500;
            color: #4a5568;
        }

        .form-group input,
        .form-group textarea,
        .form-group select {
            padding: 6px 8px;
            border: 1px solid #d1d5db;
            border-radius: 4px;
            font-size: 12px;
            font-family: inherit;
        }

        .form-group textarea {
            resize: vertical;
            min-height: 50px;
        }

        .questions-list {
            display: flex;
            flex-direction: column;
            gap: 6px;
            max-height: 200px;
            overflow-y: auto;
        }

        .question-item {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            padding: 8px;
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            gap: 8px;
        }

        .question-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .question-text {
            font-size: 14px;
            color: #2d3748;
            line-height: 1.4;
        }

        .question-meta {
            display: flex;
            gap: 8px;
            font-size: 12px;
        }

        .question-category {
            padding: 2px 6px;
            background: #bee3f8;
            color: #2b6cb0;
            border-radius: 4px;
        }

        .question-actions {
            display: flex;
            gap: 6px;
        }

        .btn {
            padding: 6px 12px;
            border: none;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
        }

        .btn-small {
            padding: 4px 8px;
            font-size: 11px;
        }

        .btn-primary {
            background: #4299e1;
            color: white;
        }

        .btn-primary:hover {
            background: #3182ce;
        }

        .btn-secondary {
            background: #e2e8f0;
            color: #4a5568;
        }

        .btn-secondary:hover {
            background: #cbd5e0;
        }

        .btn-danger {
            background: #f56565;
            color: white;
        }

        .btn-danger:hover {
            background: #e53e3e;
        }

        .btn-small {
            padding: 3px 6px;
            font-size: 10px;
        }

        .live-dashboard {
            display: flex;
            flex-direction: column;
            gap: 10px;
            padding-bottom: 20px;
        }

        .session-status {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 12px;
            padding: 16px;
            background: #f7fafc;
            border-radius: 8px;
        }

        .status-card {
            text-align: center;
            padding: 12px;
            background: white;
            border-radius: 6px;
            border: 1px solid #e2e8f0;
        }

        .status-number {
            font-size: 24px;
            font-weight: 700;
            color: #2d3748;
            display: block;
        }

        .status-label {
            font-size: 12px;
            color: #718096;
            text-transform: uppercase;
            margin-top: 4px;
        }

        .live-questions {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 8px;
            overflow-y: auto;
        }

        .live-question {
            display: flex;
            align-items: center;
            padding: 12px;
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            gap: 12px;
        }

        .question-status-indicator {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            flex-shrink: 0;
        }

        .question-status-indicator.not-asked { background: #e2e8f0; }
        .question-status-indicator.partial { background: #fbb6ce; }
        .question-status-indicator.complete { background: #9ae6b4; }
        .question-status-indicator.needs-clarification { background: #fbd38d; }

        .suggestions-panel {
            background: #f0fff4;
            border: 1px solid #9ae6b4;
            border-radius: 8px;
            padding: 16px;
        }

        .suggestions-title {
            font-size: 16px;
            font-weight: 600;
            color: #2f855a;
            margin-bottom: 12px;
        }

        .suggestion-item {
            padding: 8px 12px;
            background: white;
            border: 1px solid #c6f6d5;
            border-radius: 6px;
            margin-bottom: 8px;
            font-size: 14px;
            color: #2d3748;
        }

        .hidden {
            display: none;
        }

        .add-question-form {
            display: flex;
            flex-direction: column;
            gap: 12px;
            background: #f7fafc;
            padding: 16px;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
        }

        /* New Live Dashboard Styles */
        .section {
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 16px;
        }

        .section-title {
            margin: 0 0 12px 0;
            font-size: 16px;
            font-weight: 600;
            color: white;
        }

        .section-title.collapsible {
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            user-select: none;
        }

        .section-title.collapsible:hover {
            color: #4299e1;
        }

        .collapse-icon {
            font-size: 12px;
            transition: transform 0.2s ease;
        }

        .collapse-icon.expanded {
            transform: rotate(90deg);
        }

        .collapsible-content {
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.3s ease, padding 0.3s ease;
            padding-top: 0;
            padding-bottom: 0;
        }

        .collapsible-content.expanded {
            max-height: 500px;
            padding-top: 8px;
            padding-bottom: 8px;
        }

        /* Suggested Follow-ups */
        .suggested-followups {
            background: linear-gradient(135deg, #f0fff4, #e6fffa);
            border-color: #9ae6b4;
        }

        .followups-container {
            display: flex;
            flex-direction: column;
            gap: 0px; /* Removed gap since we're using margin-bottom in animations */
        }

        .followup-item {
            padding: 12px;
            background: white;
            border: 1px solid #c6f6d5;
            border-radius: 6px;
            color: #2d3748;
            border-left: 4px solid #48bb78;
            cursor: pointer;
            transition: all 0.3s ease;
            opacity: 0;
            transform: translateY(10px);
            animation: fadeIn 0.5s ease-out forwards;
        }

        .followup-item:hover {
            background: #f0fff4;
            border-color: #9ae6b4;
            transform: translateY(-1px);
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .followup-item.expiring {
            animation: fadeOut 0.5s ease-out forwards;
        }

        @keyframes fadeIn {
            0% {
                opacity: 0;
                transform: translateY(10px);
                max-height: 0;
                padding-top: 0;
                padding-bottom: 0;
                margin-bottom: 0;
            }
            100% {
                opacity: 1;
                transform: translateY(0);
                max-height: 100px;
                padding-top: 12px;
                padding-bottom: 12px;
                margin-bottom: 8px;
            }
        }

        @keyframes fadeOut {
            0% {
                opacity: 1;
                transform: translateY(0);
                max-height: 100px;
                padding-top: 12px;
                padding-bottom: 12px;
                margin-bottom: 8px;
            }
            100% {
                opacity: 0;
                transform: translateY(-10px);
                max-height: 0;
                padding-top: 0;
                padding-bottom: 0;
                margin-bottom: 0;
            }
        }

        .followup-text {
            font-size: 14px;
            line-height: 1.4;
            margin-bottom: 4px;
        }

        .followup-age {
            font-size: 11px;
            color: #718096;
            opacity: 0.7;
        }

        .followup-stats {
            font-size: 12px;
            color: #718096;
            font-weight: normal;
            margin-left: 8px;
        }

        /* Current Question */
        .current-question {
            background: rgba(40, 40, 40, 0.7);
            border-color: rgba(255, 255, 255, 0.08);
        }

        .question-display {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .question-text {
            font-size: 16px;
            font-weight: 500;
            color: white;
            line-height: 1.4;
        }

        .answer-section {
            background: rgba(30, 30, 30, 0.8);
            padding: 12px;
            border-radius: 6px;
            border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .answer-label {
            font-size: 12px;
            font-weight: 600;
            color: #e0e0e0;
            margin-bottom: 6px;
        }

        .answer-text {
            font-size: 14px;
            color: #e0e0e0;
            margin-bottom: 8px;
            min-height: 20px;
            font-style: italic;
        }

        .completeness-bar {
            width: 100%;
            height: 6px;
            background: #e2e8f0;
            border-radius: 3px;
            overflow: hidden;
            margin-bottom: 4px;
        }

        .completeness-fill {
            height: 100%;
            background: linear-gradient(90deg, #ed8936, #48bb78);
            transition: width 0.3s ease;
        }

        .completeness-label {
            font-size: 12px;
            color: #718096;
            text-align: right;
        }

        .no-current-question, .no-next-question {
            color: #718096;
            font-style: italic;
            text-align: center;
            padding: 20px;
        }

        /* Next Question */
        .next-question {
            background: rgba(40, 40, 40, 0.7);
            border-color: rgba(255, 255, 255, 0.08);
        }

        .next-question-display {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .next-question-text {
            font-size: 15px;
            font-weight: 500;
            color: white;
        }

        .next-question-reason {
            font-size: 12px;
            color: #e0e0e0;
            background: rgba(30, 30, 30, 0.8);
            padding: 6px 10px;
            border-radius: 4px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            align-self: flex-start;
        }



        /* Question Items */
        .question-item {
            display: flex;
            align-items: flex-start;
            padding: 12px;
            background: rgba(30, 30, 30, 0.8);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 6px;
            margin-bottom: 8px;
            gap: 12px;
        }

        .question-item:last-child {
            margin-bottom: 0;
        }

        .question-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        /* Session Controls */
        .session-controls {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px;
            background: #f7fafc;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
        }

        .session-stats {
            display: flex;
            gap: 16px;
        }

        .stat {
            font-size: 14px;
            color: #4a5568;
            font-weight: 500;
        }

        .empty-state {
            color: #a0aec0;
            font-style: italic;
            text-align: center;
            padding: 12px;
        }

        .current-question.off-script {
            border-left: 4px solid #f56565;
            background: rgba(245, 101, 101, 0.1);
        }

        .current-question.off-script .question-text {
            color: #fc8181;
        }

        .question-shortcuts-hint {
            position: absolute;
            top: 8px;
            right: 8px;
            font-size: 10px;
            color: rgba(255, 255, 255, 0.4);
            background: rgba(0, 0, 0, 0.3);
            padding: 4px 8px;
            border-radius: 4px;
        }

    `;

    static properties = {
        mode: { type: String, state: true },
        currentStudy: { type: Object, state: true },
        sessionStatus: { type: Object, state: true },
        questions: { type: Array, state: true },
        currentQuestion: { type: Object, state: true },
        nextQuestion: { type: Object, state: true },
        showPendingQuestions: { type: Boolean, state: true },
        showAskedQuestions: { type: Boolean, state: true },
        
        // Question Detection Properties
        detectedQuestion: { type: Object, state: true },
        questionDetectionActive: { type: Boolean, state: true },
        detectionConfidence: { type: Number, state: true },
        lastDetectionUpdate: { type: Object, state: true }
    };

    constructor() {
        super();
        this.mode = 'live'; // 'setup' | 'live' | 'analysis'
        this.currentStudy = null;
        this.sessionStatus = {
            isActive: false,
            questionsCompleted: 0,
            totalQuestions: 0,
            completionPercentage: 0,
            questionBreakdown: {}
        };
        this.questions = [];
        this.currentQuestion = null;
        this.nextQuestion = null;
        this.showPendingQuestions = true;
        this.showAskedQuestions = false;
        
        // Question Detection
        this.detectedQuestion = null;
        this.questionDetectionActive = false;
        this.detectionConfidence = 0;
        this.lastDetectionUpdate = null;
        
        console.log('[ResearchView] Constructor - Component initialized');
    }

    firstUpdated() {
        super.firstUpdated();
        this._initializeShortcuts();
        this._startDetectionService();
        
        // NEW: Initialize screen recording client
        this._initializeScreenRecording();
        
        // Debug scrolling - log dimensions and styles
        this._debugScrolling();
        
        // Re-check after a delay to ensure layout is complete
        setTimeout(() => this._debugScrolling(), 1000);
        
        // Listen for window resize to debug dynamic changes
        window.addEventListener('resize', () => {
            console.log('[ResearchView] Window resized, re-checking scroll...');
            setTimeout(() => this._debugScrolling(), 100);
        });
    }

    /**
     * Initialize screen recording client
     */
    async _initializeScreenRecording() {
        try {
            console.log('[ResearchView] Initializing screen recording client...');
            
            // Dynamically import the screen recording client
            const script = document.createElement('script');
            script.src = './screenRecording.client.js';
            script.type = 'module';
            
            script.onload = () => {
                console.log('[ResearchView] Screen recording client loaded successfully');
                
                // Listen for screen recording events
                if (window.api?.research) {
                    window.api.research.onScreenRecordingStarted((event, data) => {
                        console.log('[ResearchView] Screen recording started:', data);
                        // Could update UI to show recording indicator
                    });
                    
                    window.api.research.onScreenRecordingStopped((event, data) => {
                        console.log('[ResearchView] Screen recording stopped:', data);
                        // Could update UI to show recording saved
                    });
                }
            };
            
            script.onerror = (error) => {
                console.error('[ResearchView] Failed to load screen recording client:', error);
            };
            
            document.head.appendChild(script);
            
        } catch (error) {
            console.error('[ResearchView] Error initializing screen recording:', error);
        }
    }

    _debugScrolling() {
        console.log('\n=== SCROLL DEBUG START ===');
        
        // 1. Window dimensions
        console.log('Window dimensions:', {
            innerWidth: window.innerWidth,
            innerHeight: window.innerHeight,
            outerWidth: window.outerWidth,
            outerHeight: window.outerHeight
        });
        
        // 2. Host element (:host)
        const hostRect = this.getBoundingClientRect();
        const hostStyles = getComputedStyle(this);
        console.log('Host element (:host):', {
            rect: { width: hostRect.width, height: hostRect.height },
            computedHeight: hostStyles.height,
            overflow: hostStyles.overflow,
            overflowY: hostStyles.overflowY
        });
        
        // 2b. Check if height fix worked
        const heightFixWorking = hostRect.height <= window.innerHeight;
        console.log(`🔧 Height fix status: ${heightFixWorking ? '✅ WORKING' : '❌ FAILED'}`, {
            hostHeight: hostRect.height,
            windowHeight: window.innerHeight,
            difference: hostRect.height - window.innerHeight
        });
        
        // 3. Research container
        const container = this.shadowRoot?.querySelector('.research-container');
        if (container) {
            const containerRect = container.getBoundingClientRect();
            const containerStyles = getComputedStyle(container);
            console.log('Research container:', {
                rect: { width: containerRect.width, height: containerRect.height },
                computedHeight: containerStyles.height,
                overflow: containerStyles.overflow,
                overflowY: containerStyles.overflowY,
                scrollHeight: container.scrollHeight,
                clientHeight: container.clientHeight,
                scrollTop: container.scrollTop,
                canScroll: container.scrollHeight > container.clientHeight
            });
            
            // 4. Add scroll event listener for debugging
            container.addEventListener('scroll', (e) => {
                console.log('[ResearchView] Scroll event:', {
                    scrollTop: container.scrollTop,
                    scrollHeight: container.scrollHeight,
                    clientHeight: container.clientHeight,
                    remainingScroll: container.scrollHeight - container.clientHeight - container.scrollTop
                });
            });
            
            // 5. Test programmatic scroll
            console.log('Testing programmatic scroll...');
            const originalScrollTop = container.scrollTop;
            container.scrollTop = 50;
            setTimeout(() => {
                const newScrollTop = container.scrollTop;
                console.log('Programmatic scroll test:', {
                    original: originalScrollTop,
                    attempted: 50,
                    actual: newScrollTop,
                    scrollWorked: newScrollTop !== originalScrollTop
                });
                container.scrollTop = originalScrollTop; // Reset
            }, 100);
        } else {
            console.log('Research container not found!');
        }
        
        // 6. Live dashboard dimensions (the main content)
        const liveDashboard = this.shadowRoot?.querySelector('.live-dashboard');
        if (liveDashboard) {
            const dashboardRect = liveDashboard.getBoundingClientRect();
            console.log('Live dashboard:', {
                rect: { width: dashboardRect.width, height: dashboardRect.height },
                scrollHeight: liveDashboard.scrollHeight,
                clientHeight: liveDashboard.clientHeight
            });
        }
        
        // 7. All sections heights
        const sections = this.shadowRoot?.querySelectorAll('.section');
        let totalSectionsHeight = 0;
        if (sections) {
            sections.forEach((section, index) => {
                const rect = section.getBoundingClientRect();
                totalSectionsHeight += rect.height;
                console.log(`Section ${index}:`, {
                    class: section.className,
                    height: rect.height
                });
            });
            console.log('Total sections height:', totalSectionsHeight);
        }
        
        console.log('=== SCROLL DEBUG END ===\n');
    }

    _initializeShortcuts() {
        console.log('[ResearchView] Initializing shortcuts...');
        // Shortcut initialization code will go here
        // For now, just a placeholder
    }

    _startDetectionService() {
        console.log('[ResearchView] Starting detection service...');
        // Detection service startup code will go here  
        // For now, just a placeholder
    }

    connectedCallback() {
        super.connectedCallback();
        console.log('[ResearchView] Connected to DOM - setting up event listeners');
        
        if (window.api?.research) {
            // Existing listeners
            window.api.research.onSessionStarted(this._handleSessionStarted.bind(this));
            window.api.research.onSessionEnded(this._handleSessionEnded.bind(this));
            window.api.research.onAnalysisUpdate(this._handleAnalysisUpdate.bind(this));
            window.api.research.onInterviewStatusChanged(this._handleInterviewStatusChanged.bind(this));
            
            // Question Detection Listeners
            window.api.research.onQuestionDetected(this._handleQuestionDetected.bind(this));
            window.api.research.onCurrentQuestionChanged(this._handleCurrentQuestionChanged.bind(this));
            window.api.research.onAmbiguousQuestionDetected(this._handleAmbiguousQuestionDetected.bind(this));
            window.api.research.onOffScriptQuestionDetected(this._handleOffScriptQuestionDetected.bind(this));
            window.api.research.onQuestionDetectionUpdate(this._handleQuestionDetectionUpdate.bind(this));
        }
        
        // Set up keyboard shortcuts for manual override
        this.setupKeyboardShortcuts();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        
        if (window.api?.research) {
            // Remove existing listeners
            window.api.research.removeOnSessionStarted(this._handleSessionStarted);
            window.api.research.removeOnSessionEnded(this._handleSessionEnded);
            window.api.research.removeOnAnalysisUpdate(this._handleAnalysisUpdate);
            window.api.research.removeOnInterviewStatusChanged(this._handleInterviewStatusChanged);
            
            // Remove Question Detection Listeners
            window.api.research.removeOnQuestionDetected(this._handleQuestionDetected);
            window.api.research.removeOnCurrentQuestionChanged(this._handleCurrentQuestionChanged);
            window.api.research.removeOnAmbiguousQuestionDetected(this._handleAmbiguousQuestionDetected);
            window.api.research.removeOnOffScriptQuestionDetected(this._handleOffScriptQuestionDetected);
            window.api.research.removeOnQuestionDetectionUpdate(this._handleQuestionDetectionUpdate);
        }
        
        // Clean up keyboard listeners
        this.removeKeyboardShortcuts();
    }

    async loadQuestions() {
        if (!this.currentStudy) return;
        
        try {
            const questions = await window.api.research.getStudyQuestions(this.currentStudy.id);
            this.questions = questions;
        } catch (error) {
            console.error('Failed to load questions:', error);
        }
    }

    async endResearchSession() {
        try {
            await window.api.research.endSession();
            this.mode = 'analysis';
        } catch (error) {
            console.error('Failed to end research session:', error);
        }
    }

    _handleSessionStarted(event, data) {
        console.log('[ResearchView] Received session-started event with data:', {
            hasData: !!data,
            studyId: data?.studyId || 'No studyId',
            hasStudy: !!data?.study,
            studyTitle: data?.study?.title || 'No study title',
            studyHasQuestions: !!data?.study?.questions,
            studyQuestionCount: data?.study?.questions?.length || 0,
            questionsCount: data?.questionsCount || 0
        });
        
        // Extract study information from the session start data
        if (data && data.study) {
            // Use the study object directly from the event data
            console.log('[ResearchView] Loading study from session start:', data.study.title);
            this.currentStudy = data.study;
            console.log('[ResearchView] Set currentStudy:', {
                id: this.currentStudy.id,
                title: this.currentStudy.title,
                hasQuestions: !!this.currentStudy.questions,
                questionCount: this.currentStudy.questions?.length || 0
            });
            
            // Load questions for the study
            if (data.study.questions) {
                this.questions = data.study.questions;
                console.log('[ResearchView] Loaded questions for active session:', this.questions.length);
                console.log('[ResearchView] Calling requestUpdate after setting study and questions');
                this.requestUpdate();
            } else if (data.studyId && window.api && window.api.research) {
                console.log('[ResearchView] Study questions not included, loading asynchronously');
                // Fallback to async loading if questions not included
                window.api.research.getLocalStudyQuestions(data.studyId).then(questions => {
                    this.questions = questions || [];
                    console.log('[ResearchView] Loaded questions for active session (async):', this.questions.length);
                    this.requestUpdate();
                }).catch(error => {
                    console.error('[ResearchView] Failed to load questions for session:', error);
                });
            }
        } else if (data && data.studyId) {
            console.log('[ResearchView] No study object provided, falling back to async loading');
            // Fallback to the old async method if study object not provided
            if (window.api && window.api.research) {
                window.api.research.getLocalStudy(data.studyId).then(study => {
                    if (study) {
                        console.log('[ResearchView] Loading study from session start (async):', study.title);
                        this.currentStudy = study;
                        
                        // Load questions for the study
                        return window.api.research.getLocalStudyQuestions(data.studyId);
                    }
                    return [];
                }).then(questions => {
                    this.questions = questions || [];
                    console.log('[ResearchView] Loaded questions for active session (async fallback):', this.questions.length);
                    this.requestUpdate();
                }).catch(error => {
                    console.error('[ResearchView] Failed to load study for session:', error);
                });
            }
        } else {
            console.warn('[ResearchView] No study data or studyId provided in session-started event');
        }
        
        // Switch to live mode to show research interface
        this.mode = 'live';
        this.requestUpdate();
    }

    _handleSessionEnded(event, data) {
        console.log('[ResearchView] Research session ended:', data);
        this.mode = 'analysis';
        this.requestUpdate();
    }

    _handleAnalysisUpdate(event, data) {
        console.log('Research analysis update:', data);
        this.sessionStatus = data.status;
        this.suggestions = data.suggestions || [];
        this.currentQuestion = data.currentQuestion || null;
        this.nextQuestion = data.nextQuestion || null;
        this.followUpMetrics = data.followUpMetrics || this.followUpMetrics;
        this.requestUpdate(); // Force re-render to show updated data
    }

    _handleFollowUpExpired(event, data) {
        console.log('Follow-up question expired:', data);
        if (data.questionId && this.expiringQuestions) {
            this.expiringQuestions.add(data.questionId);
            this.requestUpdate();
            
            // Remove the question after animation completes
            setTimeout(() => {
                this.suggestions = this.suggestions.filter(s => s.id !== data.questionId);
                this.expiringQuestions.delete(data.questionId);
                this.requestUpdate();
            }, 500);
        }
    }

    _handleInterviewStatusChanged(event, data) {
        console.log('[ResearchView] Interview status changed:', data);
        // Handle interview status changes if needed
        this.requestUpdate();
    }

    // ==================== QUESTION DETECTION HANDLERS ====================

    _handleQuestionDetected(event, data) {
        console.log('[ResearchView] Question detected:', data);
        this.detectedQuestion = data;
        this.lastDetectionUpdate = data;
        this.requestUpdate();
    }

    _handleCurrentQuestionChanged(event, data) {
        console.log('[ResearchView] Current question changed:', data);
        
        const { questionId, question, detectionData } = data;
        
        if (question) {
            this.currentQuestion = {
                questionText: question.question_text,
                category: question.category || 'general',
                priority: question.priority || 'medium',
                status: 'in_progress',
                detectionConfidence: detectionData.score,
                detectionType: detectionData.type,
                currentAnswer: '', // Will be filled as participant responds
                completeness_score: 0
            };
            
            // Update session status
            if (this.sessionStatus.questionBreakdown[questionId]) {
                this.sessionStatus.questionBreakdown[questionId].status = 'in_progress';
            }
        }
        
        this.requestUpdate();
    }

    _handleAmbiguousQuestionDetected(event, data) {
        console.log('[ResearchView] Ambiguous question detected:', data);
        // Could show a toast or notification for manual clarification
        this.lastDetectionUpdate = { ...data, needsManualReview: true };
        this.requestUpdate();
    }

    _handleOffScriptQuestionDetected(event, data) {
        console.log('[ResearchView] Off-script question detected:', data);
        
        // Set as current question with off-script styling
        this.currentQuestion = {
            questionText: data.text + ' (off-script)',
            category: 'off-script',
            priority: 'medium',
            status: 'off_script',
            detectionConfidence: data.score,
            detectionType: 'off_script',
            currentAnswer: '',
            completeness_score: 0
        };
        
        this.lastDetectionUpdate = data;
        this.requestUpdate();
    }

    _handleQuestionDetectionUpdate(event, data) {
        console.log('[ResearchView] Question detection update:', data);
        this.lastDetectionUpdate = data;
        this.detectionConfidence = data.score || 0;
        this.requestUpdate();
    }

    // ==================== KEYBOARD SHORTCUTS ====================

    setupKeyboardShortcuts() {
        this.keyboardHandler = (e) => {
            // Alt + Up Arrow: Previous question override
            if (e.altKey && e.key === 'ArrowUp') {
                e.preventDefault();
                this.manualQuestionOverride('previous');
            }
            // Alt + Down Arrow: Next question override  
            else if (e.altKey && e.key === 'ArrowDown') {
                e.preventDefault();
                this.manualQuestionOverride('next');
            }
        };
        
        document.addEventListener('keydown', this.keyboardHandler);
    }

    removeKeyboardShortcuts() {
        if (this.keyboardHandler) {
            document.removeEventListener('keydown', this.keyboardHandler);
            this.keyboardHandler = null;
        }
    }

    async manualQuestionOverride(direction) {
        if (!this.questions || this.questions.length === 0) return;
        
        let targetQuestionId = null;
        
        if (direction === 'next') {
            // Find next unasked question
            const unasked = this.questions.filter(q => 
                !this.sessionStatus.questionBreakdown[q.id] || 
                this.sessionStatus.questionBreakdown[q.id].status === 'not_asked'
            );
            if (unasked.length > 0) {
                targetQuestionId = unasked[0].id;
            }
        } else if (direction === 'previous') {
            // Find previous question in sequence
            if (this.currentQuestion) {
                const currentIndex = this.questions.findIndex(q => q.text === this.currentQuestion.questionText);
                if (currentIndex > 0) {
                    targetQuestionId = this.questions[currentIndex - 1].id;
                }
            }
        }
        
        if (targetQuestionId && window.api?.research) {
            try {
                await window.api.research.manualQuestionOverride(targetQuestionId);
                console.log('[ResearchView] Manual override triggered:', targetQuestionId);
            } catch (error) {
                console.error('[ResearchView] Manual override failed:', error);
            }
        }
    }

    async _markFollowUpAsAsked(questionId) {
        try {
            if (window.api) {
                await window.api.research.markFollowUpAsked(questionId);
                console.log('[ResearchView] Marked follow-up question as asked:', questionId);
            }
        } catch (error) {
            console.error('[ResearchView] Failed to mark follow-up as asked:', error);
        }
    }

    render() {
        console.log('[ResearchView] Rendering with mode:', this.mode);
        
        return html`
            <div class="research-container">
                <div class="research-header">
                    <h2 class="research-title">
                        ${this.currentStudy ? this.currentStudy.title : 'UX Research Assistant'}
                    </h2>
                    <div class="research-mode ${this.mode}">${this.mode}</div>
                </div>

                ${this.mode === 'live' ? this.renderLiveDashboard() : ''}
                ${this.mode === 'analysis' ? this.renderAnalysisDashboard() : ''}
            </div>
        `;
    }

    renderLiveDashboard() {
        console.log('[ResearchView] Rendering Live Dashboard');
        // If no study is loaded yet, show a waiting state
        if (!this.currentStudy) {
            console.log('[ResearchView] No current study, showing waiting state');
            return html`
                <div class="section">
                    <h3 class="section-title">Waiting for Interview to Start</h3>
                    <div class="no-current-question">
                        Select a study from the header and click "Start Interview" to begin.
                    </div>
                </div>
            `;
        }

        if (!this.sessionStatus) {
            console.log('[ResearchView] Session status not available, showing loading state');
            return html`<div>Loading session...</div>`;
        }

        const allQuestions = Object.entries(this.sessionStatus.questionBreakdown || {});
        const pendingQuestions = allQuestions.filter(([id, q]) => q.status === 'not_asked');
        const askedQuestions = allQuestions.filter(([id, q]) => q.status !== 'not_asked');

        console.log('[ResearchView] Rendering Live Dashboard content:', {
            pendingQuestionsCount: pendingQuestions.length,
            askedQuestionsCount: askedQuestions.length,
            currentQuestion: !!this.currentQuestion,
            nextQuestion: !!this.nextQuestion
        });

        return html`
            <div class="live-dashboard">
                <!-- Suggested Follow-ups Section -->
                ${this.suggestions.length > 0 ? html`
                    <div class="section suggested-followups">
                        <h3 class="section-title">
                            💡 Suggested Follow-ups 
                            <span class="followup-stats">(${this.followUpMetrics.totalAsked}/${this.followUpMetrics.totalSuggested} asked)</span>
                        </h3>
                        <div class="followups-container">
                            ${this.suggestions.map((suggestion, index) => html`
                                <div class="followup-item ${this.expiringQuestions.has(suggestion.id) ? 'expiring' : ''}"
                                     @click="${() => this._markFollowUpAsAsked(suggestion.id)}"
                                     data-age="${suggestion.age}ms"
                                     style="animation-delay: ${this.expiringQuestions.has(suggestion.id) ? '0s' : (index * 0.1) + 's'}">
                                    <div class="followup-text">${suggestion.text}</div>
                                    <div class="followup-age">shown ${Math.round(suggestion.age / 1000)}s ago</div>
                                </div>
                            `)}
                        </div>
                    </div>
                ` : ''}

                <!-- Current Question Section -->
                <div class="section current-question ${this.currentQuestion?.status === 'off_script' ? 'off-script' : ''}">
                    <h3 class="section-title">🎯 Current Question</h3>
                    <div class="question-shortcuts-hint">⌥↑/↓ to override</div>
                    <div class="current-question-content">
                        ${this.currentQuestion ? html`
                            <div class="current-question-display">
                                <div class="question-text">${this.currentQuestion.questionText}</div>
                                
                                <div class="answer-section">
                                    <div class="answer-label">Answer:</div>
                                    <div class="answer-text">
                                        ${this.currentQuestion.currentAnswer || 'No answer yet...'}
                                    </div>
                                    <div class="completeness-bar">
                                        <div class="completeness-fill" 
                                             style="width: ${(this.currentQuestion.completeness_score || 0) * 100}%"></div>
                                    </div>
                                    <div class="completeness-label">
                                        ${Math.round((this.currentQuestion.completeness_score || 0) * 100)}% complete
                                    </div>
                                </div>
                            </div>
                        ` : html`
                            <div class="no-current-question">No active question detected</div>
                        `}
                    </div>
                </div>

                <!-- Pending Questions Section (Collapsible) -->
                <div class="section collapsible-section">
                    <h3 class="section-title collapsible" 
                        @click="${() => this.showPendingQuestions = !this.showPendingQuestions}">
                        <span class="collapse-icon ${this.showPendingQuestions ? 'expanded' : ''}">▶</span>
                        📋 Pending Questions (${pendingQuestions.length})
                    </h3>
                    <div class="collapsible-content ${this.showPendingQuestions ? 'expanded' : ''}">
                        ${pendingQuestions.map(([id, question]) => html`
                            <div class="question-item">
                                <div class="question-text">${question.text}</div>
                            </div>
                        `)}
                        ${pendingQuestions.length === 0 ? html`
                            <div class="empty-state">No pending questions</div>
                        ` : ''}
                    </div>
                </div>

                <!-- Questions Already Asked Section (Collapsible) -->
                <div class="section collapsible-section">
                    <h3 class="section-title collapsible" 
                        @click="${() => this.showAskedQuestions = !this.showAskedQuestions}">
                        <span class="collapse-icon ${this.showAskedQuestions ? 'expanded' : ''}">▶</span>
                        ✅ Questions Already Asked (${askedQuestions.length})
                    </h3>
                    <div class="collapsible-content ${this.showAskedQuestions ? 'expanded' : ''}">
                        ${askedQuestions.map(([id, question]) => html`
                            <div class="question-item">
                                <div class="question-status-indicator ${question.status}"></div>
                                <div class="question-content">
                                    <div class="question-text">
                                        ${question.text}
                                    </div>
                                    <div class="question-meta">
                                        <span class="question-category">${question.category}</span>
                                    </div>
                                </div>
                            </div>
                        `)}
                        ${askedQuestions.length === 0 ? html`
                            <div class="empty-state">No questions asked yet</div>
                        ` : ''}
                    </div>
                </div>

                <!-- Session Controls -->
                <div class="session-controls">
                    <div class="session-stats">
                        <span class="stat">${this.sessionStatus.questionsCompleted}/${this.sessionStatus.totalQuestions} completed</span>
                        <span class="stat">${this.sessionStatus.completionPercentage}% progress</span>
                    </div>
                    <button class="btn btn-danger" @click="${this.endResearchSession}">
                        End Research Session
                    </button>
                </div>
            </div>
        `;
    }

    renderAnalysisDashboard() {
        return html`
            <div class="analysis-dashboard">
                <h3>Session Analysis</h3>
                <p>Research session completed. Analysis features coming soon...</p>
                <p>To start a new session, select a study from the header and click "Start Interview".</p>
            </div>
        `;
    }

    // ==================== INTERNAL UTILITIES ====================

}

console.log('[ResearchView] Defining custom element research-view');
customElements.define('research-view', ResearchView);