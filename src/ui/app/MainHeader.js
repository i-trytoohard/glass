import { html, css, LitElement } from '../assets/lit-core-2.7.4.min.js';

export class MainHeader extends LitElement {
    static properties = {
        isTogglingSession: { type: Boolean, state: true },
        shortcuts: { type: Object, state: true },
        // Research-specific properties
        selectedStudy: { type: Object, state: true },
        availableStudies: { type: Array, state: true },
        interviewStatus: { type: String, state: true }, // 'idle', 'active', 'paused'
        interviewStartTime: { type: Number, state: true },
        interviewDuration: { type: Number, state: true },
        showStudySelector: { type: Boolean, state: true },
    };

    static styles = css`
        :host {
            display: flex;
            transition: transform 0.2s cubic-bezier(0.23, 1, 0.32, 1), opacity 0.2s ease-out;
        }

        :host(.hiding) {
            animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.6, 1) forwards;
        }

        :host(.showing) {
            animation: slideDown 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        :host(.sliding-in) {
            animation: fadeIn 0.2s ease-out forwards;
        }

        :host(.hidden) {
            opacity: 0;
            transform: translateY(-150%) scale(0.85);
            pointer-events: none;
        }

        @keyframes slideUp {
            0% { opacity: 1; transform: translateY(0px) scale(1); }
            100% { opacity: 0; transform: translateY(-150%) scale(0.85); }
        }

        @keyframes slideDown {
            0% { opacity: 0; transform: translateY(-150%) scale(0.85); }
            100% { opacity: 1; transform: translateY(0px) scale(1); }
        }

        @keyframes fadeIn {
            0% { opacity: 0; transform: scale(0.9); }
            100% { opacity: 1; transform: scale(1); }
        }

        * {
            font-family: 'Helvetica Neue', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            cursor: default;
            user-select: none;
        }

        .header {
            -webkit-app-region: drag;
            width: max-content;
            height: 47px;
            padding: 2px 10px 2px 13px;
            background: transparent;
            overflow: visible; /* Changed from hidden to visible to allow dropdown to show */
            border-radius: 9000px;
            /* backdrop-filter: blur(1px); */
            justify-content: space-between;
            align-items: center;
            display: inline-flex;
            box-sizing: border-box;
            position: relative;
            gap: 16px; /* Add gap between header elements */
        }

        .header::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.6);
            border-radius: 9000px;
            z-index: -1;
        }

        .header::after {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            border-radius: 9000px;
            padding: 1px;
            background: linear-gradient(169deg, rgba(255, 255, 255, 0.17) 0%, rgba(255, 255, 255, 0.08) 50%, rgba(255, 255, 255, 0.17) 100%); 
            -webkit-mask:
                linear-gradient(#fff 0 0) content-box,
                linear-gradient(#fff 0 0);
            -webkit-mask-composite: destination-out;
            mask-composite: exclude;
            pointer-events: none;
        }

        .listen-button {
            -webkit-app-region: no-drag;
            height: 26px;
            padding: 0 15px;
            background: transparent;
            border-radius: 9000px;
            justify-content: center;
            align-items: center;
            gap: 6px;
            display: flex;
            border: none;
            cursor: pointer; /* Ensure pointer cursor for all listen buttons */
            position: relative;
            min-width: 130px;
            white-space: nowrap;
        }

        .listen-button.start-interview {
            min-width: 120px;
        }

        .listen-button:disabled {
            cursor: default;
            opacity: 0.8;
        }

        .listen-button:hover {
            cursor: pointer; /* Ensure pointer cursor on hover */
        }

        .listen-button.active::before {
            background: rgba(215, 0, 0, 0.5);
        }

        .listen-button.active:hover::before {
            background: rgba(255, 20, 20, 0.6);
        }

        .listen-button.done {
            background-color: rgba(255, 255, 255, 0.6);
            transition: background-color 0.15s ease;
        }

        .listen-button.done .action-text-content {
            color: black;
        }
        
        .listen-button.done .listen-icon svg rect,
        .listen-button.done .listen-icon svg path {
            fill: black;
        }

        .listen-button.done:hover {
            background-color: #f0f0f0;
        }

        .listen-button::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(255, 255, 255, 0.14);
            border-radius: 9000px;
            z-index: -1;
            transition: background 0.15s ease;
        }

        .listen-button::after {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            border-radius: 9000px;
            padding: 1px;
            background: linear-gradient(169deg, rgba(255, 255, 255, 0.17) 0%, rgba(255, 255, 255, 0.08) 50%, rgba(255, 255, 255, 0.17) 100%);
            -webkit-mask:
                linear-gradient(#fff 0 0) content-box,
                linear-gradient(#fff 0 0);
            -webkit-mask-composite: destination-out;
            mask-composite: exclude;
            pointer-events: none;
        }

        .listen-button.done::after {
            display: none;
        }

        /* ==================== RESEARCH INTERFACE STYLES ==================== */
        
        .study-selector {
            position: relative;
            display: flex;
            align-items: center;
            z-index: 1000;
            cursor: pointer; /* Add pointer cursor for the study selector */
        }

        .study-button {
            -webkit-app-region: no-drag;
            height: 26px;
            padding: 0 13px;
            background: transparent;
            border-radius: 9000px;
            justify-content: center;
            align-items: center;
            gap: 6px;
            display: flex;
            border: none;
            cursor: pointer;
            position: relative;
            min-width: 120px;
        }

        .study-button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }

        .study-button:hover {
            cursor: pointer; /* Ensure pointer cursor on hover */
        }

        .dropdown-arrow {
            color: rgba(255, 255, 255, 0.7);
            font-size: 10px;
            margin-left: 8px;
            transition: transform 0.2s ease;
            cursor: pointer; /* Add pointer cursor to dropdown arrow */
        }

        .dropdown-arrow.open {
            transform: rotate(180deg); /* Rotate arrow when dropdown is open */
        }

        .interview-controls {
            display: flex;
            align-items: center;
            gap: 12px;
            min-width: 140px;
        }

        .timer-display {
            color: white;
            font-size: 12px;
            font-weight: 600;
            font-family: 'SF Mono', Monaco, monospace;
            padding: 0 8px;
            min-width: 50px;
            text-align: center;
        }

        .timer-display::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(255, 255, 255, 0.14);
            border-radius: 9000px;
            z-index: -1;
        }

        .timer-text {
            color: white;
            font-size: 12px;
            font-weight: 600;
            font-family: 'SF Mono', Monaco, monospace;
        }

        .control-button {
            -webkit-app-region: no-drag;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            border: none;
            cursor: pointer !important;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(255, 255, 255, 0.1);
            transition: background 0.15s ease;
        }

        .control-button:hover {
            background: rgba(255, 255, 255, 0.2);
            cursor: pointer !important;
        }

        .control-button.pause {
            background: rgba(255, 193, 7, 0.2);
        }

        .control-button.pause:hover {
            background: rgba(255, 193, 7, 0.3);
            cursor: pointer !important;
        }

        .control-button.stop {
            background: rgba(220, 53, 69, 0.2);
        }

        .control-button.stop:hover {
            background: rgba(220, 53, 69, 0.3);
            cursor: pointer !important;
        }

        .interview-status {
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .status-indicator {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: #28a745;
        }

        .status-indicator.paused {
            background: #ffc107;
        }

        .loading-dots {
            display: flex;
            align-items: center;
            gap: 5px;
        }

        .loading-dots span {
            width: 6px;
            height: 6px;
            background-color: white;
            border-radius: 50%;
            animation: pulse 1.4s infinite ease-in-out both;
        }
        .loading-dots span:nth-of-type(1) {
            animation-delay: -0.32s;
        }
        .loading-dots span:nth-of-type(2) {
            animation-delay: -0.16s;
        }
        @keyframes pulse {
            0%, 80%, 100% {
                opacity: 0.2;
            }
            40% {
                opacity: 1.0;
            }
        }

        .header-actions {
            -webkit-app-region: no-drag;
            height: 26px;
            box-sizing: border-box;
            justify-content: flex-start;
            align-items: center;
            gap: 9px;
            display: flex;
            padding: 0 8px;
            border-radius: 6px;
            transition: background 0.15s ease;
            cursor: pointer; /* Add pointer cursor for Show/Hide button */
        }

        .header-actions:hover {
            background: rgba(255, 255, 255, 0.1);
            cursor: pointer; /* Ensure pointer cursor on hover */
        }

        .ask-action {
            margin-left: 4px;
        }

        .action-text {
            padding-bottom: 1px;
            justify-content: center;
            align-items: center;
            gap: 10px;
            display: flex;
        }

        .action-text-content {
            color: white;
            font-size: 12px;
            font-family: 'Helvetica Neue', sans-serif;
            font-weight: 500; /* Medium */
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 200px; /* Limit width for study names */
        }

        .icon-container {
            justify-content: flex-start;
            align-items: center;
            gap: 4px;
            display: flex;
        }

        .icon-container.ask-icons svg,
        .icon-container.showhide-icons svg {
            width: 12px;
            height: 12px;
        }

        .listen-icon svg {
            width: 12px;
            height: 11px;
            position: relative;
            top: 1px;
        }

        .icon-box {
            color: white;
            font-size: 12px;
            font-family: 'Helvetica Neue', sans-serif;
            font-weight: 500;
            background-color: rgba(255, 255, 255, 0.1);
            border-radius: 13%;
            width: 18px;
            height: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .settings-button {
            -webkit-app-region: no-drag;
            padding: 5px;
            border-radius: 50%;
            background: transparent;
            transition: background 0.15s ease;
            color: white;
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .settings-button:hover {
            background: rgba(255, 255, 255, 0.1);
        }

        .settings-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 3px;
        }

        .settings-icon svg {
            width: 16px;
            height: 16px;
        }
        /* ────────────────[ GLASS BYPASS ]─────────────── */
        :host-context(body.has-glass) .header,
        :host-context(body.has-glass) .listen-button,
        :host-context(body.has-glass) .header-actions,
        :host-context(body.has-glass) .settings-button {
            background: transparent !important;
            filter: none !important;
            box-shadow: none !important;
            backdrop-filter: none !important;
        }
        :host-context(body.has-glass) .icon-box {
            background: transparent !important;
            border: none !important;
        }

        :host-context(body.has-glass) .header::before,
        :host-context(body.has-glass) .header::after,
        :host-context(body.has-glass) .listen-button::before,
        :host-context(body.has-glass) .listen-button::after {
            display: none !important;
        }

        :host-context(body.has-glass) .header-actions:hover,
        :host-context(body.has-glass) .settings-button:hover,
        :host-context(body.has-glass) .listen-button:hover::before {
            background: transparent !important;
        }
        :host-context(body.has-glass) * {
            animation: none !important;
            transition: none !important;
            transform: none !important;
            filter: none !important;
            backdrop-filter: none !important;
            box-shadow: none !important;
        }

        :host-context(body.has-glass) .header,
        :host-context(body.has-glass) .listen-button,
        :host-context(body.has-glass) .header-actions,
        :host-context(body.has-glass) .settings-button,
        :host-context(body.has-glass) .icon-box {
            border-radius: 0 !important;
        }
        :host-context(body.has-glass) {
            animation: none !important;
            transition: none !important;
            transform: none !important;
            will-change: auto !important;
        }

        .control-button,
        .control-button:hover,
        .control-button:active,
        .control-button:focus {
            cursor: pointer !important;
        }

        .control-button * {
            cursor: pointer !important;
            pointer-events: none;
        }
        `;

    constructor() {
        super();
        this.selectedStudy = null;
        this.availableStudies = [];
        this.interviewStatus = 'idle';
        this.interviewStartTime = 0;
        this.interviewDuration = 0;
        this.showStudySelector = false;
        this.timerInterval = null;
        
        // Original UI state
        this.isVisible = true;
        this.isAnimating = false;
        this.hasSlidIn = false;
        this.wasJustDragged = false;
        this.dragState = null;
        this.animationEndTimer = null;
    }

    _getListenButtonText(status) {
        switch (status) {
            case 'beforeSession': return 'Listen';
            case 'inSession'   : return 'Stop';
            case 'afterSession': return 'Done';
            default            : return 'Listen';
        }
    }

    // ==================== TIMER MANAGEMENT ====================
    
    startTimer() {
        this.interviewStartTime = Date.now();
        this.interviewDuration = 0;
        this.timerInterval = setInterval(() => {
            if (this.interviewStatus === 'active') {
                this.interviewDuration = Date.now() - this.interviewStartTime;
                this.requestUpdate();
            }
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        this.interviewDuration = 0;
        this.interviewStartTime = 0;
        }

    formatTime(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    // ==================== EVENT HANDLERS ====================
    
    async _handleStudySelection(e) {
        e.preventDefault();
        e.stopPropagation();
        
        console.log('[MainHeader] Study selection clicked, current state:', {
            interviewStatus: this.interviewStatus,
            showStudySelector: this.showStudySelector,
            availableStudies: this.availableStudies.length
        });
        
        if (this.interviewStatus === 'active' || this.interviewStatus === 'paused') {
            console.log('[MainHeader] Interview is active, not showing dropdown');
            return;
        }
        
        const newShowState = !this.showStudySelector;
        this.showStudySelector = newShowState;
        
        // Show/hide the study dropdown window via IPC
        if (window.api?.mainHeader) {
            window.api.mainHeader.showStudyDropdown(newShowState, this.availableStudies);
        }
        
        console.log('[MainHeader] Toggled dropdown to:', this.showStudySelector);
        this.requestUpdate();
    }

    async _selectStudy(study) {
        console.log('[MainHeader] Study selected:', study.title);
        this.selectedStudy = study;
        this.showStudySelector = false;
        
        // Hide the dropdown window
        if (window.api?.mainHeader) {
            window.api.mainHeader.showStudyDropdown(false);
        }
        
        this.requestUpdate();
    }

    async _handleDocumentClick(e) {
        // Close dropdown if clicking outside and it's open
        if (this.showStudySelector && !e.composedPath().includes(this)) {
            console.log('[MainHeader] Closing dropdown due to outside click');
            this.showStudySelector = false;
            
            // Hide the dropdown window
            if (window.api?.mainHeader) {
                window.api.mainHeader.showStudyDropdown(false);
            }
            
            this.requestUpdate();
        }
    }

    async _handleStartInterview() {
        if (!this.selectedStudy || this.isTogglingSession) return;
        
        console.log('[MainHeader] Starting interview with study:', {
            studyId: this.selectedStudy.id,
            studyTitle: this.selectedStudy.title,
            hasQuestions: !!this.selectedStudy.questions,
            questionCount: this.selectedStudy.questions?.length || 0
        });
        
        this.isTogglingSession = true;
        try {
            // Close dropdown and resize window if open
            if (this.showStudySelector) {
                this.showStudySelector = false;
                // Hide the dropdown window
                if (window.api?.mainHeader) {
                    window.api.mainHeader.showStudyDropdown(false);
                }
            }
            
            // Navigate to research view first so it's ready to receive events
            console.log('[MainHeader] Navigating to research view first');
            await window.api.mainHeader.sendResearchButtonClick();
            console.log('[MainHeader] Navigation to research view completed');
            
            // Give the research view a moment to load and set up event listeners
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Now start the research session (ResearchView is ready to receive events)
            console.log('[MainHeader] Calling research.startResearchSession with studyId:', this.selectedStudy.id);
            await window.api.research.startResearchSession(this.selectedStudy.id);
            console.log('[MainHeader] Research session started successfully');
            
            this.interviewStatus = 'active';
            this.startTimer();
            
        } catch (error) {
            console.error('[MainHeader] Failed to start interview:', error);
        } finally {
            this.isTogglingSession = false;
            this.requestUpdate();
        }
    }

    async _handlePauseInterview() {
        try {
            if (this.interviewStatus === 'paused') {
                await window.api.research.resumeResearchSession();
                this.interviewStatus = 'active';
                } else {
                await window.api.research.pauseResearchSession();
                this.interviewStatus = 'paused';
            }
            this.requestUpdate();
        } catch (error) {
            console.error('[MainHeader] Failed to pause/resume interview:', error);
        }
    }

    async _handleStopInterview() {
        if (this.isTogglingSession) return;
        
        this.isTogglingSession = true;
        try {
            await window.api.research.stopResearchSession();
            this.interviewStatus = 'idle';
            this.stopTimer();
            
            console.log('[MainHeader] Interview stopped - staying in research view for analysis');
            // Note: We stay in research view so user can see the analysis results
            
        } catch (error) {
            console.error('[MainHeader] Failed to stop interview:', error);
        } finally {
            this.isTogglingSession = false;
            this.requestUpdate();
        }
    }

    _handleToggleAllWindowsVisibility() {
        if (this.wasJustDragged) return;
        if (window.api) {
            window.api.mainHeader.sendToggleAllWindowsVisibility();
        }
    }

    // ==================== ORIGINAL DRAG/ANIMATION HANDLERS ====================
    
    handleMouseDown(e) {
        if (e.button !== 0) return;
        
        this.dragState = {
            startX: e.clientX,
            startY: e.clientY,
            moved: false
        };
        
        window.addEventListener('mousemove', this.handleMouseMove, { capture: true });
        window.addEventListener('mouseup', this.handleMouseUp, { capture: true });
        }

    handleMouseMove(e) {
        if (!this.dragState) return;

        const deltaX = Math.abs(e.clientX - this.dragState.startX);
        const deltaY = Math.abs(e.clientY - this.dragState.startY);
        
        if (deltaX > 3 || deltaY > 3) {
            this.dragState.moved = true;
        }
    }

    handleMouseUp(e) {
        if (!this.dragState) return;

        this.wasJustDragged = this.dragState.moved;
        
        window.removeEventListener('mousemove', this.handleMouseMove, { capture: true });
        window.removeEventListener('mouseup', this.handleMouseUp, { capture: true });
        
        this.dragState = null;
        
        if (this.wasJustDragged) {
            setTimeout(() => {
                this.wasJustDragged = false;
            }, 100);
        }
    }

    handleAnimationEnd(e) {
        if (e.target !== this) return;

        this.isAnimating = false;
        
        if (this.classList.contains('hiding')) {
            this.classList.remove('hiding');
            this.classList.add('hidden');
            this.isVisible = false;
        } else if (this.classList.contains('showing')) {
            this.classList.remove('showing');
            this.isVisible = true;
        }
        
        if (this.animationEndTimer) {
            clearTimeout(this.animationEndTimer);
            this.animationEndTimer = null;
        }
    }

    renderShortcut(accelerator) {
        if (!accelerator) return html``;

        const keyMap = {
            'Cmd': '⌘', 'Command': '⌘',
            'Ctrl': '⌃', 'Control': '⌃',
            'Alt': '⌥', 'Option': '⌥',
            'Shift': '⇧',
            'Enter': '↵',
            'Backspace': '⌫',
            'Delete': '⌦',
            'Tab': '⇥',
            'Escape': '⎋',
            'Up': '↑', 'Down': '↓', 'Left': '←', 'Right': '→',
            '\\': html`<svg viewBox="0 0 6 12" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:6px; height:12px;"><path d="M1.5 1.3L5.1 10.6" stroke="white" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
        };

        const keys = accelerator.split('+');
        return html`${keys.map(key => html`
            <div class="icon-box">${keyMap[key] || key}</div>
        `)}`;
    }

    showSettingsWindow(element) {
        if (this.wasJustDragged) return;
        if (window.api) {
            window.api.mainHeader.showSettingsWindow();
        }
    }

    hideSettingsWindow() {
        if (window.api) {
            window.api.mainHeader.hideSettingsWindow();
        }
    }

    // ==================== LIFECYCLE METHODS ====================
    
    connectedCallback() {
        super.connectedCallback();
        this.addEventListener('animationend', this.handleAnimationEnd);
        document.addEventListener('click', this._handleDocumentClick.bind(this));

        if (window.api) {
            this._shortcutListener = (event, keybinds) => {
                console.log('[MainHeader] Received updated shortcuts:', keybinds);
                this.shortcuts = keybinds;
            };
            
            // Set up event listeners
            window.api.mainHeader?.onShortcutsUpdated?.(this._shortcutListener);
            
            // Listen for study selection from dropdown window
            if (window.electronAPI) {
                window.electronAPI.ipcRenderer.on('study-selected', (event, study) => {
                    console.log('[MainHeader] Received study selection from dropdown:', study.title);
                    this._selectStudy(study);
                });
            }
            
            // Load available studies
            this.loadAvailableStudies();
        }

        // Set up mouse listeners for drag functionality
        this.handleAnimationEnd = this.handleAnimationEnd.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.removeEventListener('animationend', this.handleAnimationEnd);
        document.removeEventListener('click', this._handleDocumentClick.bind(this));
        
        // Clean up shortcuts listener
        if (window.api?.mainHeader?.removeOnShortcutsUpdated && this._shortcutListener) {
            window.api.mainHeader.removeOnShortcutsUpdated(this._shortcutListener);
        }
        
        // Clean up study selection listener
        if (window.electronAPI) {
            window.electronAPI.ipcRenderer.removeAllListeners('study-selected');
        }
        
        // Clean up timers
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        
        if (this.animationEndTimer) {
            clearTimeout(this.animationEndTimer);
            this.animationEndTimer = null;
        }
    }

    async loadAvailableStudies() {
        try {
            if (window.api && window.api.research) {
                console.log('[MainHeader] Loading available studies...');
                this.availableStudies = await window.api.research.getAvailableStudies();
                console.log('[MainHeader] Loaded studies:', this.availableStudies.length);
                
                // Auto-select first study if none selected
                if (!this.selectedStudy && this.availableStudies.length > 0) {
                    this.selectedStudy = this.availableStudies[0];
                    console.log('[MainHeader] Auto-selected study:', this.selectedStudy.title);
                }
                
                this.requestUpdate();
            }
        } catch (error) {
            console.error('[MainHeader] Failed to load studies:', error);
            this.availableStudies = [];
        }
    }

    // ==================== RENDER METHOD ====================

    render() {
        const isInterviewActive = this.interviewStatus === 'active' || this.interviewStatus === 'paused';
        const canStartInterview = this.selectedStudy && !isInterviewActive;

        console.log('[MainHeader] Rendering with state:', {
            showStudySelector: this.showStudySelector,
        isInterviewActive,
            availableStudiesCount: this.availableStudies.length
        });

        return html`
            <div class="header" @mousedown=${this.handleMouseDown}>
                <!-- Study Selection / Display -->
                <div class="study-selector">
                <button 
                        class="listen-button"
                        @click=${this._handleStudySelection}
                        ?disabled=${isInterviewActive}
                    >
                        <div class="action-text">
                            <div class="action-text-content">
                                ${this.selectedStudy 
                                    ? this.selectedStudy.title
                                    : 'Select Study'}
                            </div>
                        </div>
                        ${!isInterviewActive ? html`<div class="dropdown-arrow ${this.showStudySelector ? 'open' : ''}">▼</div>` : ''}
                    </button>
                </div>

                <!-- Interview Controls -->
                ${!isInterviewActive ? html`
                    <!-- Start Interview Button -->
                    <button 
                        class="listen-button start-interview ${canStartInterview ? '' : 'disabled'}"
                        @click=${this._handleStartInterview}
                        ?disabled=${!canStartInterview || this.isTogglingSession}
                    >
                        ${this.isTogglingSession ? html`
                            <div class="loading-dots">
                                <span></span><span></span><span></span>
                            </div>
                        ` : html`
                            <div class="action-text">
                                <div class="action-text-content">Start Interview</div>
                            </div>
                        `}
                    </button>
                ` : html`
                    <!-- Timer and Control Buttons -->
                    <div class="interview-controls">
                        <div class="timer-display">${this.formatTime(this.interviewDuration)}</div>
                        
                        <button 
                            class="control-button pause"
                            @click=${this._handlePauseInterview}
                            title="${this.interviewStatus === 'paused' ? 'Resume' : 'Pause'}"
                        >
                            ${this.interviewStatus === 'paused' ? html`
                                <svg width="8" height="10" viewBox="0 0 8 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M0 0L8 5L0 10V0Z" fill="#ffc107"/>
                                        </svg>
                            ` : html`
                                <svg width="8" height="10" viewBox="0 0 8 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <rect x="1" y="0" width="2" height="10" fill="#ffc107"/>
                                    <rect x="5" y="0" width="2" height="10" fill="#ffc107"/>
                                        </svg>
                        `}
                </button>

                        <button 
                            class="control-button stop"
                            @click=${this._handleStopInterview}
                            ?disabled=${this.isTogglingSession}
                            title="Stop Interview"
                        >
                            <svg width="8" height="8" viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect x="0" y="0" width="8" height="8" fill="#dc3545"/>
                            </svg>
                        </button>
                    </div>
                `}

                <!-- Show/Hide Button -->
                <div class="header-actions" @click=${this._handleToggleAllWindowsVisibility}>
                    <div class="action-text">
                        <div class="action-text-content">Show/Hide</div>
                    </div>
                    <div class="icon-container">
                        ${this.renderShortcut(this.shortcuts.toggleVisibility)}
                    </div>
                </div>

                <!-- Settings Button -->
                <button 
                    class="settings-button"
                    @mouseenter=${(e) => this.showSettingsWindow(e.currentTarget)}
                    @mouseleave=${() => this.hideSettingsWindow()}
                >
                    <div class="settings-icon">
                        <svg width="16" height="17" viewBox="0 0 16 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M8.0013 3.16406C7.82449 3.16406 7.65492 3.2343 7.5299 3.35932C7.40487 3.48435 7.33464 3.65392 7.33464 3.83073C7.33464 4.00754 7.40487 4.17711 7.5299 4.30213C7.65492 4.42716 7.82449 4.4974 8.0013 4.4974C8.17811 4.4974 8.34768 4.42716 8.47271 4.30213C8.59773 4.17711 8.66797 4.00754 8.66797 3.83073C8.66797 3.65392 8.59773 3.48435 8.47271 3.35932C8.34768 3.2343 8.17811 3.16406 8.0013 3.16406ZM8.0013 7.83073C7.82449 7.83073 7.65492 7.90097 7.5299 8.02599C7.40487 8.15102 7.33464 8.32058 7.33464 8.4974C7.33464 8.67421 7.40487 8.84378 7.5299 8.9688C7.65492 9.09382 7.82449 9.16406 8.0013 9.16406C8.17811 9.16406 8.34768 9.09382 8.47271 8.9688C8.59773 8.84378 8.66797 8.67421 8.66797 8.4974C8.66797 8.32058 8.59773 8.15102 8.47271 8.02599C8.34768 7.90097 8.17811 7.83073 8.0013 7.83073ZM8.0013 12.4974C7.82449 12.4974 7.65492 12.5676 7.5299 12.6927C7.40487 12.8177 7.33464 12.9873 7.33464 13.1641C7.33464 13.3409 7.40487 13.5104 7.5299 13.6355C7.65492 13.7605 7.82449 13.8307 8.0013 13.8307C8.17811 13.8307 8.34768 13.7605 8.47271 13.6355C8.59773 13.5104 8.66797 13.3409 8.66797 13.1641C8.66797 12.9873 8.59773 12.8177 8.47271 12.6927C8.34768 12.5676 8.17811 12.4974 8.0013 12.4974Z" fill="white" stroke="white" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </div>
                </button>
            </div>
        `;
    }
}

customElements.define('main-header', MainHeader);
