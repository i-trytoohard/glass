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

        /* Suggested Follow-ups - Glassomorphic Style */
        .suggested-followups {
            background: rgba(0, 0, 0, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            position: relative;
            overflow: hidden;
        }

        .suggested-followups::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.1);
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
            border-radius: 12px;
            z-index: -1;
        }

        .suggested-followups::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            border-radius: 12px;
            padding: 1px;
            background: linear-gradient(169deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.05) 50%, rgba(255, 255, 255, 0.15) 100%);
            -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
            -webkit-mask-composite: destination-out;
            mask-composite: exclude;
            pointer-events: none;
        }

        .followups-container {
            display: flex;
            flex-direction: column;
            gap: 6px;
            padding: 4px;
        }

        .followup-item {
            padding: 8px 12px;
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 8px;
            color: rgba(255, 255, 255, 0.9);
            cursor: pointer;
            transition: all 0.15s ease;
            opacity: 0;
            transform: translateY(10px);
            animation: fadeIn 0.25s ease-out forwards;
            position: relative;
        }

        .followup-item:hover {
            background: rgba(255, 255, 255, 0.15);
            border-color: rgba(255, 255, 255, 0.2);
            transform: translateY(-1px);
        }

        .followup-item.expiring {
            animation: fadeOut 0.25s ease-out forwards; /* Reduced from 0.5s for faster removal */
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
            font-size: 13px;
            line-height: 1.4;
            margin-bottom: 3px;
            color: rgba(255, 255, 255, 0.95);
            font-weight: 400;
        }

        .followup-age {
            font-size: 10px;
            color: rgba(255, 255, 255, 0.5);
            opacity: 0.8;
        }

        .followup-stats {
            font-size: 11px;
            color: rgba(255, 255, 255, 0.6);
            font-weight: 400;
            margin-left: 6px;
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

        .answer-content {
            font-size: 14px;
            color: #e0e0e0;
            margin-bottom: 8px;
            min-height: 20px;
        }

        .insights-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .insight-item {
            display: flex;
            align-items: flex-start;
            gap: 8px;
            padding: 4px 0;
        }

        .insight-bullet {
            color: #4299e1;
            font-weight: bold;
            margin-top: 2px;
            flex-shrink: 0;
        }

        .insight-text {
            flex: 1;
            color: #e0e0e0;
            line-height: 1.4;
        }

        .raw-answer {
            color: #a0a0a0;
            font-style: italic;
            white-space: pre-wrap;
            word-wrap: break-word;
        }

        .raw-answer.expanded {
            margin-top: 8px;
            padding: 8px;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 4px;
            border-left: 2px solid #4299e1;
            font-style: normal;
            color: #c0c0c0;
        }

        .raw-answer-toggle {
            margin-top: 8px;
            font-size: 12px;
            color: #4299e1;
            cursor: pointer;
            user-select: none;
            transition: color 0.2s ease;
        }

        .raw-answer-toggle:hover {
            color: #63b3ed;
        }

        .no-current-question {
            color: #718096;
            font-style: italic;
            text-align: center;
            padding: 20px;
        }

        /* Pending Questions */
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

        /* ────────────────[ GLASS BYPASS ]─────────────── */
        :host-context(body.has-glass) .research-container,
        :host-context(body.has-glass) .suggested-followups,
        :host-context(body.has-glass) .followup-item,
        :host-context(body.has-glass) .section {
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
            filter: none !important;
            backdrop-filter: none !important;
            border-radius: 0 !important;
        }

        :host-context(body.has-glass) .research-container::before,
        :host-context(body.has-glass) .suggested-followups::before,
        :host-context(body.has-glass) .suggested-followups::after {
            display: none !important;
        }

        :host-context(body.has-glass) .followup-item:hover {
            background: transparent !important;
            transform: none !important;
        }

        :host-context(body.has-glass) * {
            animation: none !important;
            transition: none !important;
            transform: none !important;
        }

    `;

    static properties = {
        mode: { type: String, state: true },
        currentStudy: { type: Object, state: true },
        sessionStatus: { type: Object, state: true },
        questions: { type: Array, state: true },
        currentQuestion: { type: Object, state: true },
        showPendingQuestions: { type: Boolean, state: true },
        showAskedQuestions: { type: Boolean, state: true },
        showRawAnswer: { type: Boolean, state: true },
        
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
        this.showPendingQuestions = true;
        this.showAskedQuestions = false;
        this.showRawAnswer = false;
        
        // Question Detection
        this.detectedQuestion = null;
        this.questionDetectionActive = false;
        this.detectionConfidence = 0;
        this.lastDetectionUpdate = null;
        
        // Initialize suggestions array to prevent undefined errors
        this.suggestions = [];
        this.followUpMetrics = {
            totalAsked: 0,
            totalSuggested: 0
        };
        
        // Initialize expiring questions set
        this.expiringQuestions = new Set();
        
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
        
        // Debug: Check if audio capture is available
        console.log('[ResearchView] Audio capture available:', !!window.pickleGlass?.startCapture);
        console.log('[ResearchView] Listen capture API available:', !!window.api?.listenCapture);
        console.log('[ResearchView] Current URL:', window.location.href);
        
        // Send a ping to main process so we know frontend loaded
        if (window.api?.research?.ping) {
            window.api.research.ping('ResearchView connected and ready');
        }
        
        if (window.api?.research) {
            // Existing listeners
            window.api.research.onSessionStarted(this._handleSessionStarted.bind(this));
            window.api.research.onSessionEnded(this._handleSessionEnded.bind(this));
            window.api.research.onAnalysisUpdate(this._handleAnalysisUpdate.bind(this));
            window.api.research.onInterviewStatusChanged(this._handleInterviewStatusChanged.bind(this));
            
            // Question Detection Listeners
            window.api.research.onQuestionDetected(this._handleQuestionDetected.bind(this));
            window.api.research.onAmbiguousQuestionDetected(this._handleAmbiguousQuestionDetected.bind(this));
            window.api.research.onOffScriptQuestionDetected(this._handleOffScriptQuestionDetected.bind(this));
            window.api.research.onQuestionDetectionUpdate(this._handleQuestionDetectionUpdate.bind(this));
        }
        
        // Listen for audio capture state changes
        if (window.api?.listenCapture?.onChangeListenCaptureState) {
            window.api.listenCapture.onChangeListenCaptureState((event, data) => {
                console.log('[ResearchView] Audio capture state change received:', data);
            });
        } else {
            console.warn('[ResearchView] onChangeListenCaptureState not available');
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
            // Don't switch to analysis mode - let the window hide instead
            // this.mode = 'analysis';
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
        
        // Send ping to main process so we know this event was received
        if (window.api?.research?.ping) {
            window.api.research.ping(`Session started event received: ${data?.studyTitle || data?.study?.title || 'unknown'} (${data?.questionsCount || 0} questions)`);
        }
        
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
        // Don't switch to analysis mode - let the window hide instead
        // this.mode = 'analysis';
        this.requestUpdate();
    }

    _handleAnalysisUpdate(event, data) {
        console.log('Research analysis update received:', data.suggestions?.length || 0, 'suggestions');
        
        // COMPREHENSIVE DATA DEBUGGING - Let's see exactly what we're getting
        console.log('🔍 FULL DATA DEBUG - Complete data object received:', JSON.stringify(data, null, 2));
        
        // Debug current question data extensively
        console.log('🎯 Current Question Debug:', {
            hasCurrentQuestion: !!data.currentQuestion,
            currentQuestionType: typeof data.currentQuestion,
            currentQuestionKeys: data.currentQuestion ? Object.keys(data.currentQuestion) : null,
            questionText: data.currentQuestion?.questionText,
            questionId: data.currentQuestion?.questionId,
            fullCurrentQuestion: data.currentQuestion
        });
        
        // Debug insights data
        if (data.currentQuestion?.keyInsights) {
            console.log('🔍 UI INSIGHTS DEBUG - Received insights:', {
                type: typeof data.currentQuestion.keyInsights,
                isArray: Array.isArray(data.currentQuestion.keyInsights),
                length: data.currentQuestion.keyInsights.length,
                fullInsights: data.currentQuestion.keyInsights,
                first3: Array.isArray(data.currentQuestion.keyInsights) ? 
                    data.currentQuestion.keyInsights.slice(0, 3) : 
                    String(data.currentQuestion.keyInsights).slice(0, 50)
            });
            
            // Test quality filter on each insight
            console.log('🔍 QUALITY FILTER TEST:');
            data.currentQuestion.keyInsights.forEach((insight, index) => {
                const passes = this._isQualityInsight(insight);
                console.log(`  Insight ${index + 1}: ${passes ? 'PASS' : 'FAIL'} - "${insight}"`);
            });
        } else {
            console.log('🔍 UI INSIGHTS DEBUG - No insights in current question data');
        }
        
        // Track insights changes specifically
        const oldInsights = this.currentQuestion?.keyInsights || [];
        const newInsights = data.currentQuestion?.keyInsights || [];
        const insightsChanged = JSON.stringify(oldInsights) !== JSON.stringify(newInsights);
        
        console.log('🔍 UI INSIGHTS CHANGE DETECTION:', {
            insightsChanged,
            oldInsightsCount: oldInsights.length,
            newInsightsCount: newInsights.length,
            oldInsights: oldInsights,
            newInsights: newInsights
        });
        
        // Send ping to main process so we know this event was received
        if (window.api?.research?.ping) {
            window.api.research.ping(`Analysis update received: ${data.suggestions?.length || 0} suggestions, current question: ${data.currentQuestion?.questionText || 'none'}`);
        }
        
        // Check if anything actually changed before forcing a re-render
        const suggestionsChanged = JSON.stringify(this.suggestions) !== JSON.stringify(data.suggestions || []);
        const statusChanged = this.sessionStatus !== data.status;
        const questionChanged = JSON.stringify(this.currentQuestion) !== JSON.stringify(data.currentQuestion);
        
        console.log('🎯 Current Question Change Detection:', {
            questionChanged,
            insightsChanged,
            suggestionsChanged,
            statusChanged,
            oldQuestion: this.currentQuestion?.questionText,
            newQuestion: data.currentQuestion?.questionText,
            willUpdate: suggestionsChanged || statusChanged || questionChanged || insightsChanged
        });
        
        // Reset raw answer expansion if question changed
        if (questionChanged) {
            this.showRawAnswer = false;
        }
        
        this.sessionStatus = data.status;
        this.suggestions = data.suggestions || [];
        this.currentQuestion = data.currentQuestion || null;
        this.followUpMetrics = data.followUpMetrics || this.followUpMetrics;
        
        console.log('🎯 After setting currentQuestion:', {
            hasCurrentQuestion: !!this.currentQuestion,
            questionText: this.currentQuestion?.questionText,
            questionId: this.currentQuestion?.questionId,
            hasKeyInsights: !!this.currentQuestion?.keyInsights,
            keyInsightsLength: this.currentQuestion?.keyInsights?.length || 0
        });
        
        // FORCE UPDATE: Always re-render when analysis-update is received 
        // The change detection is failing to detect insights properly
        console.log('🎯 FORCE UPDATE: Always triggering requestUpdate for analysis-update events');
        this.requestUpdate();
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

    // REMOVED: _handleCurrentQuestionChanged method
    // This was overwriting complete current question data (answer + insights) from analysis-update events
    // The analysis-update event handler now provides all current question data

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

    // ==================== UI INTERACTION HANDLERS ====================

    _handlePendingQuestionsToggle(e) {
        // Prevent event bubbling and ensure click is processed
        e.preventDefault();
        e.stopPropagation();
        
        // Use requestAnimationFrame to ensure the click happens after any pending renders
        requestAnimationFrame(() => {
            this.showPendingQuestions = !this.showPendingQuestions;
            console.log('Pending questions toggled:', this.showPendingQuestions);
            this.requestUpdate();
        });
    }

    _handleAskedQuestionsToggle(e) {
        // Prevent event bubbling and ensure click is processed
        e.preventDefault();
        e.stopPropagation();
        
        // Use requestAnimationFrame to ensure the click happens after any pending renders
        requestAnimationFrame(() => {
            this.showAskedQuestions = !this.showAskedQuestions;
            console.log('Asked questions toggled:', this.showAskedQuestions);
            this.requestUpdate();
        });
    }

    _toggleRawAnswer() {
        this.showRawAnswer = !this.showRawAnswer;
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
        console.log('🔥 RENDER CALLED - renderLiveDashboard executing', {
            hasCurrentQuestion: !!this.currentQuestion,
            currentQuestionKeys: this.currentQuestion ? Object.keys(this.currentQuestion) : null,
            keyInsightsLength: this.currentQuestion?.keyInsights?.length || 0
        });
        
        if (!this.sessionStatus) {
            console.log('[ResearchView] Session status not available, showing loading state');
            return html`<div>Loading session...</div>`;
        }

        const allQuestions = Object.entries(this.sessionStatus.questionBreakdown || {});
        const pendingQuestions = allQuestions.filter(([id, q]) => {
            // Exclude questions that are not_asked AND not the current question
            if (q.status !== 'not_asked') return false;
            
            // If we have a current question, exclude it from pending
            if (this.currentQuestion && this.currentQuestion.questionText) {
                return q.text !== this.currentQuestion.questionText;
            }
            
            return true;
        });
        const askedQuestions = allQuestions.filter(([id, q]) => q.status !== 'not_asked');

        console.log('[ResearchView] Rendering Live Dashboard:', {
            pendingQuestionsCount: pendingQuestions.length,
            askedQuestionsCount: askedQuestions.length,
            currentQuestion: !!this.currentQuestion,
            suggestionsCount: this.suggestions.length
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
                                     style="animation-delay: ${this.expiringQuestions.has(suggestion.id) ? '0s' : (index * 0.05) + 's'}">
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
                                    <div class="answer-label">Key Insights:</div>
                                    <div class="answer-content">
                                        ${(() => {
                                            // RENDER DEBUG - Let's see what happens during rendering
                                            console.log('🎨 RENDER DEBUG - Starting insights rendering:', {
                                                hasCurrentQuestion: !!this.currentQuestion,
                                                hasKeyInsights: !!this.currentQuestion?.keyInsights,
                                                keyInsightsType: typeof this.currentQuestion?.keyInsights,
                                                keyInsightsIsArray: Array.isArray(this.currentQuestion?.keyInsights),
                                                keyInsightsLength: this.currentQuestion?.keyInsights?.length || 0,
                                                rawKeyInsights: this.currentQuestion?.keyInsights
                                            });
                                            
                                            // Filter out low-quality insights  
                                            const qualityInsights = this.currentQuestion.keyInsights
                                                ?.filter(insight => {
                                                    const passes = this._isQualityInsight(insight);
                                                    console.log(`🎨 RENDER QUALITY TEST: "${insight}" -> ${passes ? 'PASS' : 'FAIL'}`);
                                                    return passes;
                                                })
                                                ?.slice(0, 10) || []; // Limit to max 10 insights
                                            
                                            console.log('🎨 RENDER DEBUG - After quality filtering:', {
                                                originalCount: this.currentQuestion?.keyInsights?.length || 0,
                                                qualityCount: qualityInsights.length,
                                                qualityInsights: qualityInsights
                                            });
                                            
                                            // Only show insights section if we have meaningful insights
                                            if (qualityInsights.length > 0) {
                                                console.log('🎨 RENDER DEBUG - Rendering insights section with', qualityInsights.length, 'insights');
                                                return html`
                                                    <div class="insights-list">
                                                        ${qualityInsights.map(insight => html`
                                                            <div class="insight-item">
                                                                <span class="insight-bullet">●</span>
                                                                <span class="insight-text">${insight}</span>
                                                            </div>
                                                        `)}
                                                    </div>
                                                    ${this.currentQuestion.currentAnswer && this.currentQuestion.currentAnswer.length > 50 ? html`
                                                        <div class="raw-answer-toggle" @click="${() => this._toggleRawAnswer()}">
                                                            ${this.showRawAnswer ? '▼ Hide full answer' : '▶ Show full answer'}
                                                        </div>
                                                        ${this.showRawAnswer ? html`
                                                            <div class="raw-answer expanded">
                                                                ${this.currentQuestion.currentAnswer}
                                                            </div>
                                                        ` : ''}
                                                    ` : ''}
                                                `;
                                            } else {
                                                console.log('🎨 RENDER DEBUG - No quality insights, showing raw answer fallback');
                                                return html`
                                                    <div class="raw-answer">
                                                        ${this.currentQuestion.currentAnswer || 'No answer yet...'}
                                                    </div>
                                                `;
                                            }
                                        })()}
                                    </div>
                                </div>
                            </div>
                        ` : html`
                            <div class="no-current-question">No active question detected</div>`}
                    </div>
                </div>

                <!-- Pending Questions Section (Collapsible) -->
                <div class="section collapsible-section">
                    <h3 class="section-title collapsible" 
                        @click="${this._handlePendingQuestionsToggle}">
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
                        @click="${this._handleAskedQuestionsToggle}">
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

    _isQualityInsight(insight) {
        if (!insight || typeof insight !== 'string') return false;
        
        const trimmed = insight.trim();
        if (trimmed.length < 10) return false; // Too short
        
        // Filter out "no information" type insights (same as backend)
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
}

console.log('[ResearchView] Defining custom element research-view');
customElements.define('research-view', ResearchView);