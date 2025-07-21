import { html, css, LitElement } from '../assets/lit-core-2.7.4.min.js';

export class ResearchView extends LitElement {
    static styles = css`
        :host {
            display: block;
            width: 100%;
            height: 100%;
            padding: 12px;
            background: rgba(255, 255, 255, 0.98);
            border-radius: 8px;
            color: var(--text-color);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        .research-container {
            display: flex;
            flex-direction: column;
            height: 100%;
            gap: 12px;
            overflow-y: auto;
            overflow-x: hidden;
        }

        .research-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 8px;
            padding-right: 16px;
            border-bottom: 1px solid #e0e0e0;
        }

        .research-title {
            font-size: 18px;
            font-weight: 600;
            color: #2d3748;
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

        .question-priority {
            padding: 2px 6px;
            border-radius: 4px;
        }

        .question-priority.high { background: #fed7d7; color: #c53030; }
        .question-priority.medium { background: #feebc8; color: #c05621; }
        .question-priority.low { background: #c6f6d5; color: #2f855a; }

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
            min-height: 100%;
            padding-bottom: 20px; /* Extra space at bottom for scrolling */
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
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 16px;
        }

        .section-title {
            margin: 0 0 12px 0;
            font-size: 16px;
            font-weight: 600;
            color: #2d3748;
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
            background: linear-gradient(135deg, #fff5f5, #fef5e7);
            border-color: #fed7d7;
        }

        .question-display {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .question-text {
            font-size: 16px;
            font-weight: 500;
            color: #2d3748;
            line-height: 1.4;
        }

        .answer-section {
            background: white;
            padding: 12px;
            border-radius: 6px;
            border: 1px solid #e2e8f0;
        }

        .answer-label {
            font-size: 12px;
            font-weight: 600;
            color: #4a5568;
            margin-bottom: 6px;
        }

        .answer-text {
            font-size: 14px;
            color: #2d3748;
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
            background: linear-gradient(135deg, #ebf8ff, #e6fffa);
            border-color: #bee3f8;
        }

        .next-question-display {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .next-question-text {
            font-size: 15px;
            font-weight: 500;
            color: #2d3748;
        }

        .next-question-reason {
            font-size: 12px;
            color: #4a5568;
            background: white;
            padding: 6px 10px;
            border-radius: 4px;
            border: 1px solid #e2e8f0;
            align-self: flex-start;
        }



        /* Question Items */
        .question-item {
            display: flex;
            align-items: flex-start;
            padding: 12px;
            background: #f7fafc;
            border: 1px solid #e2e8f0;
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

        .status-badge {
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 10px;
            text-transform: uppercase;
            font-weight: 600;
        }

        .status-badge.partial { background: #fbb6ce; color: #97266d; }
        .status-badge.complete { background: #9ae6b4; color: #2f855a; }
        .status-badge.needs-clarification { background: #fbd38d; color: #c05621; }

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
    `;

    static properties = {
        mode: { type: String }, // 'setup', 'live', 'analysis'
        currentStudy: { type: Object },
        questions: { type: Array },
        sessionStatus: { type: Object },
        suggestions: { type: Array },
        studies: { type: Array },
        showAddQuestion: { type: Boolean, state: true },
        showAllQuestions: { type: Boolean, state: true },
        currentQuestion: { type: Object }, // Current question being asked
        nextQuestion: { type: Object }, // Next question to ask
        showPendingQuestions: { type: Boolean, state: true },
        showAskedQuestions: { type: Boolean, state: true },
        followUpMetrics: { type: Object }, // Follow-up question analytics
        expiringQuestions: { type: Set, state: true } // Questions currently fading out
    };

    constructor() {
        super();
        this.mode = 'setup';
        this.currentStudy = null;
        this.questions = [];
        this.sessionStatus = null;
        this.suggestions = [];
        this.studies = [];
        this.showAddQuestion = false;
        this.showAllQuestions = false;
        this.currentQuestion = null;
        this.nextQuestion = null;
        this.showPendingQuestions = false;
        this.showAskedQuestions = false;
        this.followUpMetrics = { totalSuggested: 0, totalAsked: 0, responses: [] };
        this.expiringQuestions = new Set();
        
        // Auto-create fintech study for demo
        setTimeout(() => this._autoCreateFintechStudy(), 1000);
    }

    connectedCallback() {
        super.connectedCallback();
        
        console.log('[ResearchView] Connected to DOM');
        
        // Add event listeners only if window.api exists
        if (window.api) {
            try {
                // Listen for research events
                window.api.research.onSessionStarted(this._handleSessionStarted.bind(this));
                window.api.research.onSessionEnded(this._handleSessionEnded.bind(this));
                window.api.research.onAnalysisUpdate(this._handleAnalysisUpdate.bind(this));
                window.api.research.onFollowUpExpired(this._handleFollowUpExpired.bind(this));
                console.log('[ResearchView] Event listeners added');
            } catch (error) {
                console.error('[ResearchView] Failed to add event listeners:', error);
            }
        } else {
            console.warn('[ResearchView] window.api not available, running in demo mode');
        }
        
        // Load studies with error handling
        this.loadStudies().catch(error => {
            console.error('[ResearchView] Failed to load studies:', error);
        });
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (window.api) {
            window.api.research.removeOnSessionStarted(this._handleSessionStarted.bind(this));
            window.api.research.removeOnSessionEnded(this._handleSessionEnded.bind(this));
            window.api.research.removeOnAnalysisUpdate(this._handleAnalysisUpdate.bind(this));
        }
    }

    async loadStudies() {
        try {
            if (!window.api) {
                console.log('[ResearchView] API not available, using demo data');
                this.studies = []; // Empty array for now
                return;
            }
            
            const studies = await window.api.research.getAllStudies();
            this.studies = studies || [];
            console.log('[ResearchView] Loaded studies:', this.studies.length);
        } catch (error) {
            console.error('[ResearchView] Failed to load studies:', error);
            this.studies = []; // Fallback to empty array
        }
    }

    async createStudy(studyData) {
        try {
            console.log('[ResearchView] Calling API to create study:', studyData);
            const study = await window.api.research.createStudy(studyData);
            console.log('[ResearchView] Study created successfully:', study);
            this.currentStudy = study;
            this.mode = 'setup';
            await this.loadQuestions();
            // Force a re-render to update the UI
            this.requestUpdate();
        } catch (error) {
            console.error('[ResearchView] Failed to create study:', error);
        }
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

    async addQuestion(questionData) {
        if (!this.currentStudy) return;
        
        try {
            await window.api.research.addQuestion(this.currentStudy.id, questionData);
            await this.loadQuestions();
            this.showAddQuestion = false;
        } catch (error) {
            console.error('Failed to add question:', error);
        }
    }

    async startResearchSession(participantData) {
        if (!this.currentStudy) return;
        
        try {
            const result = await window.api.research.startSession(this.currentStudy.id, participantData);
            this.sessionStatus = result.status;
            this.mode = 'live';
        } catch (error) {
            console.error('Failed to start research session:', error);
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
        console.log('Research session started:', data);
        this.mode = 'live';
    }

    _handleSessionEnded(event, data) {
        console.log('Research session ended:', data);
        this.mode = 'analysis';
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
        console.log('Follow-up questions expired:', data.expiredQuestions);
        // Add expired questions to the expiring set for fade animation
        data.expiredQuestions.forEach(question => {
            this.expiringQuestions.add(question.id);
        });
        
        // Remove from expiring set after animation duration
        setTimeout(() => {
            data.expiredQuestions.forEach(question => {
                this.expiringQuestions.delete(question.id);
            });
            this.requestUpdate();
        }, 500); // 500ms for fade animation (questions expire after 10s)
        
        this.requestUpdate();
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



    async _autoCreateFintechStudy() {
        try {
            // Check if we already have a study
            if (this.currentStudy) return;
            
            console.log('[ResearchView] Auto-creating fintech study...');
            
            const fintechStudy = {
                title: "What features do you expect from a fintech app?",
                description: "UX research study to understand user expectations and preferences for fintech applications",
                research_type: "user_interview",
                methodology: "semi_structured",
                participant_profile: "Age 18-30",
                goals: "Understand user expectations, identify pain points, and discover desired features for fintech apps"
            };

            // Create the study
            await this.createStudy(fintechStudy);

            // Add predefined questions
            const fintechQuestions = [
                {
                    question_text: "Can you describe your current experience with using fintech apps in general?",
                    category: "experience",
                    priority: "high",
                    is_required: true
                },
                {
                    question_text: "What are the most important tasks you want to accomplish using a fintech app?",
                    category: "needs",
                    priority: "high",
                    is_required: true
                },
                {
                    question_text: "Can you tell me about a time when a fintech app exceeded your expectations? What features stood out to you?",
                    category: "positive_experience",
                    priority: "medium",
                    is_required: false
                },
                {
                    question_text: "What are some frustrations or challenges you've encountered while using fintech apps?",
                    category: "pain_points",
                    priority: "high",
                    is_required: true
                },
                {
                    question_text: "How do you usually decide which fintech app to use? What factors influence your decision?",
                    category: "decision_making",
                    priority: "medium",
                    is_required: false
                },
                {
                    question_text: "Can you imagine an ideal fintech app that perfectly meets your needs? What features would it include?",
                    category: "ideal_features",
                    priority: "high",
                    is_required: true
                },
                {
                    question_text: "How do you prioritize different features in a fintech app? For example, security, ease of use, or variety of services?",
                    category: "prioritization",
                    priority: "medium",
                    is_required: false
                },
                {
                    question_text: "If you could improve one feature in the fintech apps you currently use, what would it be and why?",
                    category: "improvement",
                    priority: "medium",
                    is_required: false
                },
                {
                    question_text: "How do you feel about the security measures in fintech apps? Are there any specific features you expect in this area?",
                    category: "security",
                    priority: "high",
                    is_required: true
                }
            ];

            // Add all questions
            for (let i = 0; i < fintechQuestions.length; i++) {
                const questionData = { ...fintechQuestions[i], order_index: i };
                await this.addQuestion(questionData);
            }

            console.log('[ResearchView] Fintech study created with', fintechQuestions.length, 'questions');
            
            // Auto-start the research session for demo purposes
            console.log('[ResearchView] Auto-starting research session for demo...');
            await this._startSession();
            
        } catch (error) {
            console.error('[ResearchView] Failed to auto-create fintech study:', error);
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



                ${this.mode === 'setup' ? this.renderSetupWizard() : ''}
                ${this.mode === 'live' ? this.renderLiveDashboard() : ''}
                ${this.mode === 'analysis' ? this.renderAnalysisDashboard() : ''}
            </div>
        `;
    }

    renderSetupWizard() {
        return html`
            <div class="setup-wizard">
                ${!this.currentStudy ? this.renderStudyCreation() : ''}
                ${this.currentStudy ? this.renderQuestionSetup() : ''}
            </div>
        `;
    }

    renderStudyCreation() {
        return html`
            <div class="wizard-section">
                <h3>Create Research Study</h3>
                <form @submit="${this._handleStudySubmit}">
                    <div class="form-group">
                        <label for="study-title">Study Title</label>
                        <input type="text" id="study-title" name="title" required 
                               placeholder="e.g., Mobile Banking App Usability Study">
                    </div>
                    
                    <div class="form-group">
                        <label for="study-description">Description</label>
                        <textarea id="study-description" name="description"
                                  placeholder="Brief description of the study objectives and scope"></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label for="research-type">Research Type</label>
                        <select id="research-type" name="research_type">
                            <option value="user_interview">User Interview</option>
                            <option value="usability_test">Usability Test</option>
                            <option value="focus_group">Focus Group</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="methodology">Methodology</label>
                        <select id="methodology" name="methodology">
                            <option value="semi_structured">Semi-structured</option>
                            <option value="structured">Structured</option>
                            <option value="unstructured">Unstructured</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="participant-profile">Participant Profile</label>
                        <textarea id="participant-profile" name="participant_profile"
                                  placeholder="Target user demographics, experience level, etc."></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label for="goals">Study Goals</label>
                        <textarea id="goals" name="goals"
                                  placeholder="Key research questions and objectives"></textarea>
                    </div>
                    
                    <button type="submit" class="btn btn-primary">Create Study</button>
                </form>
            </div>
        `;
    }

    renderQuestionSetup() {
        return html`
            <div class="wizard-section">
                <h3>Interview Questions (${this.questions.length})</h3>
                
                <div class="questions-list">
                    ${this.questions.map((question, index) => html`
                        <div class="question-item">
                            <div class="question-content">
                                <div class="question-text">${question.question_text}</div>
                                <div class="question-meta">
                                    <span class="question-category">${question.category}</span>
                                    <span class="question-priority ${question.priority}">${question.priority}</span>
                                    ${question.is_required ? html`<span class="question-priority high">required</span>` : ''}
                                </div>
                            </div>
                            <div class="question-actions">
                                <button class="btn btn-secondary btn-small" 
                                        @click="${() => this._editQuestion(question)}">Edit</button>
                                <button class="btn btn-danger btn-small"
                                        @click="${() => this._deleteQuestion(question.id)}">Delete</button>
                            </div>
                        </div>
                    `)}
                </div>

                ${this.showAddQuestion ? this.renderAddQuestionForm() : html`
                    <button class="btn btn-secondary" @click="${() => this.showAddQuestion = true}">
                        Add Question
                    </button>
                `}

                <div style="display: flex; gap: 12px; margin-top: 20px;">
                    <button class="btn btn-primary" 
                            @click="${this._startSession}"
                            ?disabled="${this.questions.length === 0}">
                        Start Research Session
                    </button>
                </div>
            </div>
        `;
    }

    renderAddQuestionForm() {
        return html`
            <div class="add-question-form">
                <form @submit="${this._handleQuestionSubmit}">
                    <div class="form-group">
                        <label for="question-text">Question</label>
                        <textarea id="question-text" name="question_text" required
                                  placeholder="What is your primary goal when using this feature?"></textarea>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
                        <div class="form-group">
                            <label for="question-category">Category</label>
                            <select id="question-category" name="category">
                                <option value="background">Background</option>
                                <option value="behavior">Behavior</option>
                                <option value="attitude">Attitude</option>
                                <option value="demographic">Demographic</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label for="question-priority">Priority</label>
                            <select id="question-priority" name="priority">
                                <option value="high">High</option>
                                <option value="medium">Medium</option>
                                <option value="low">Low</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label for="question-required">
                                <input type="checkbox" id="question-required" name="is_required"> Required
                            </label>
                        </div>
                    </div>
                    
                    <div style="display: flex; gap: 12px;">
                        <button type="submit" class="btn btn-primary">Add Question</button>
                        <button type="button" class="btn btn-secondary"
                                @click="${() => this.showAddQuestion = false}">Cancel</button>
                    </div>
                </form>
            </div>
        `;
    }

    renderLiveDashboard() {
        if (!this.sessionStatus) return html`<div>Loading session...</div>`;

        const allQuestions = Object.entries(this.sessionStatus.questionBreakdown || {});
        const pendingQuestions = allQuestions.filter(([id, q]) => q.status === 'not_asked');
        const askedQuestions = allQuestions.filter(([id, q]) => q.status !== 'not_asked');

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

                <!-- Current Question Being Asked Section -->
                <div class="section current-question">
                    <h3 class="section-title">🎯 Current Question Being Asked</h3>
                    <div class="current-question-content">
                        ${this.currentQuestion ? html`
                            <div class="question-display">
                                <div class="question-text">${this.currentQuestion.questionText}</div>
                                <div class="answer-section">
                                    <div class="answer-label">Current Answer:</div>
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

                <!-- Next Question to Ask Section -->
                <div class="section next-question">
                    <h3 class="section-title">⏭️ Next Question to Ask</h3>
                    <div class="next-question-content">
                        ${this.nextQuestion ? html`
                            <div class="next-question-display">
                                <div class="next-question-text">${this.nextQuestion.questionText}</div>
                                ${this.nextQuestion.reason !== 'next in sequence' ? html`
                                    <div class="next-question-reason">Reason: ${this.nextQuestion.reason}</div>
                                ` : ''}
                            </div>
                        ` : html`
                            <div class="no-next-question">All questions addressed</div>
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
                                <div class="question-meta">
                                    <span class="question-category">${question.category}</span>
                                    <span class="question-priority ${question.priority}">${question.priority}</span>
                                </div>
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
                                    <div class="question-text">${question.text}</div>
                                    <div class="question-meta">
                                        <span class="question-category">${question.category}</span>
                                        <span class="question-priority ${question.priority}">${question.priority}</span>
                                        <span class="status-badge ${question.status}">${question.status}</span>
                                        ${question.follow_up_needed ? html`
                                            <span class="question-priority high">needs follow-up</span>
                                        ` : ''}
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
                <button class="btn btn-primary" @click="${() => this.mode = 'setup'}">
                    Start New Session
                </button>
            </div>
        `;
    }



    _handleStudySubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const studyData = Object.fromEntries(formData.entries());
        console.log('[ResearchView] Creating study with data:', studyData);
        this.createStudy(studyData);
    }

    _handleQuestionSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const questionData = Object.fromEntries(formData.entries());
        questionData.is_required = formData.has('is_required');
        questionData.order_index = this.questions.length;
        this.addQuestion(questionData);
    }

    async _deleteQuestion(questionId) {
        if (confirm('Are you sure you want to delete this question?')) {
            try {
                await window.api.research.deleteQuestion(questionId);
                await this.loadQuestions();
            } catch (error) {
                console.error('Failed to delete question:', error);
            }
        }
    }

    async _startSession() {
        const participantId = `participant_${Date.now()}`;
        console.log('[ResearchView] Starting session with participant ID:', participantId);
        await this.startResearchSession({ participant_id: participantId });
    }
} 