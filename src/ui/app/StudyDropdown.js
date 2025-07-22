import { html, css, LitElement } from '../assets/lit-core-2.7.4.min.js';

export class StudyDropdown extends LitElement {
    static properties = {
        studies: { type: Array, state: true },
    };

    static styles = css`
        :host {
            display: block;
            font-family: 'Helvetica Neue', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            cursor: default;
            user-select: none;
        }

        .dropdown-container {
            background: rgba(0, 0, 0, 0.95);
            border-radius: 8px;
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.3);
            max-height: 250px;
            overflow-y: auto;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
            min-width: 300px;
            max-width: 400px;
        }

        .study-option {
            padding: 8px 12px;
            cursor: pointer;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            transition: background 0.15s ease;
            min-width: 0; /* Allow text to shrink */
        }

        .study-option:hover {
            background: rgba(255, 255, 255, 0.1);
        }

        .study-option:last-child {
            border-bottom: none;
        }

        .study-title {
            color: white;
            font-size: 12px;
            font-weight: 500;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 100%;
        }

        .study-description {
            color: rgba(255, 255, 255, 0.7);
            font-size: 10px;
            margin-top: 2px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 100%;
        }

        .study-meta {
            color: rgba(255, 255, 255, 0.5);
            font-size: 10px;
            margin-top: 2px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 100%;
        }

        /* ────────────────[ GLASS BYPASS ]─────────────── */
        :host-context(body.has-glass) .dropdown-container {
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
            backdrop-filter: none !important;
        }
        
        :host-context(body.has-glass) .study-option:hover {
            background: transparent !important;
        }
    `;

    constructor() {
        super();
        this.studies = [];
    }

    connectedCallback() {
        super.connectedCallback();
        console.log('[StudyDropdown] Connected to DOM');
        
        // Listen for studies updates from main process
        if (window.api && window.electronAPI) {
            window.electronAPI.ipcRenderer.on('update-studies', (event, studies) => {
                console.log('[StudyDropdown] Received studies update:', studies.length);
                this.studies = studies;
                this.requestUpdate();
            });
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        
        // Clean up event listeners
        if (window.api && window.electronAPI) {
            window.electronAPI.ipcRenderer.removeAllListeners('update-studies');
        }
    }

    _handleStudyClick(study) {
        console.log('[StudyDropdown] Study clicked:', study.title);
        // Send study selection back to main process
        if (window.api?.studyDropdown) {
            window.api.studyDropdown.selectStudy(study);
        }
    }

    render() {
        console.log('[StudyDropdown] Rendering with studies:', this.studies.length);
        
        return html`
            <div class="dropdown-container">
                ${this.studies.length === 0 ? html`
                    <div class="study-option">
                        <div class="study-title">No studies available</div>
                        <div class="study-description">Check your local repository</div>
                    </div>
                ` : this.studies.map(study => html`
                    <div class="study-option" @click=${() => this._handleStudyClick(study)}>
                        <div class="study-title">${study.title}</div>
                        <div class="study-description">${study.description || 'No description'}</div>
                        <div class="study-meta">${study.questions?.length || 0} questions</div>
                    </div>
                `)}
            </div>
        `;
    }
}

customElements.define('study-dropdown', StudyDropdown); 