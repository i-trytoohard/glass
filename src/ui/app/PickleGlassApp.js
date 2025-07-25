import { html, css, LitElement } from '../assets/lit-core-2.7.4.min.js';
import { SettingsView } from '../settings/SettingsView.js';
import { ListenView } from '../listen/ListenView.js';
import { AskView } from '../ask/AskView.js';
import { ShortcutSettingsView } from '../settings/ShortCutSettingsView.js';
import { ResearchView } from '../research/ResearchView.js';

import '../listen/audioCore/renderer.js';

console.log('[PickleGlassApp] Module loading - PickleGlassApp.js file being imported');

export class PickleGlassApp extends LitElement {
    static styles = css`
        :host {
            display: block;
            width: 100%;
            height: 100%;
            color: var(--text-color);
            background: transparent;
            border-radius: 7px;
        }

        listen-view {
            display: block;
            width: 100%;
            height: 100%;
        }

        ask-view, settings-view, research-view, history-view, help-view, setup-view {
            display: block;
            width: 100%;
            height: 100%;
        }

    `;

    static properties = {
        currentView: { type: String },
        statusText: { type: String },
        startTime: { type: Number },
        currentResponseIndex: { type: Number },
        isMainViewVisible: { type: Boolean },
        selectedProfile: { type: String },
        selectedLanguage: { type: String },
        selectedScreenshotInterval: { type: String },
        selectedImageQuality: { type: String },
        isClickThrough: { type: Boolean, state: true },
        layoutMode: { type: String },
        _viewInstances: { type: Object, state: true },
        _isClickThrough: { state: true },
        structuredData: { type: Object }, 
    };

    constructor() {
        super();
        const urlParams = new URLSearchParams(window.location.search);
        this.currentView = urlParams.get('view') || 'listen';
        this.currentResponseIndex = -1;
        
        console.log('[PickleGlassApp] Initialized with view:', this.currentView, 'URL:', window.location.href);
        this.selectedProfile = localStorage.getItem('selectedProfile') || 'interview';
        
        // Language format migration for legacy users
        let lang = localStorage.getItem('selectedLanguage') || 'en';
        if (lang.includes('-')) {
            const newLang = lang.split('-')[0];
            console.warn(`[Migration] Correcting language format from "${lang}" to "${newLang}".`);
            localStorage.setItem('selectedLanguage', newLang);
            lang = newLang;
        }
        this.selectedLanguage = lang;

        this.selectedScreenshotInterval = localStorage.getItem('selectedScreenshotInterval') || '5';
        this.selectedImageQuality = localStorage.getItem('selectedImageQuality') || 'medium';
        this._isClickThrough = false;
    }

    connectedCallback() {
        super.connectedCallback();
        console.log('[PickleGlassApp] Connected to DOM');
        
        // Listen for URL changes (popstate) and manual navigation
        this._updateViewFromURL();
        
        // Set up periodic check for URL changes (since loadURL doesn't trigger popstate)
        this._urlCheckInterval = setInterval(() => {
            this._updateViewFromURL();
        }, 100);
        
        if (window.api) {
            window.api.pickleGlassApp.onClickThroughToggled((_, isEnabled) => {
                this._isClickThrough = isEnabled;
            });
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._urlCheckInterval) {
            clearInterval(this._urlCheckInterval);
        }
        if (window.api) {
            window.api.pickleGlassApp.removeAllClickThroughListeners();
        }
    }

    updated(changedProperties) {
        if (changedProperties.has('currentView')) {
            const viewContainer = this.shadowRoot?.querySelector('.view-container');
            if (viewContainer) {
                viewContainer.classList.add('entering');
                requestAnimationFrame(() => {
                    viewContainer.classList.remove('entering');
                });
            }
        }

        // Only update localStorage when these specific properties change
        if (changedProperties.has('selectedProfile')) {
            localStorage.setItem('selectedProfile', this.selectedProfile);
        }
        if (changedProperties.has('selectedLanguage')) {
            localStorage.setItem('selectedLanguage', this.selectedLanguage);
        }
        if (changedProperties.has('selectedScreenshotInterval')) {
            localStorage.setItem('selectedScreenshotInterval', this.selectedScreenshotInterval);
        }
        if (changedProperties.has('selectedImageQuality')) {
            localStorage.setItem('selectedImageQuality', this.selectedImageQuality);
        }
        if (changedProperties.has('layoutMode')) {
            this.updateLayoutMode();
        }
    }

    async handleClose() {
        if (window.api) {
            await window.api.common.quitApplication();
        }
    }

    _updateViewFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const newView = urlParams.get('view') || 'listen';
        
        if (newView !== this.currentView) {
            console.log('[PickleGlassApp] URL changed - updating view from', this.currentView, 'to', newView);
            this.currentView = newView;
            this.requestUpdate();
        }
    }


    render() {
        console.log('[PickleGlassApp] Rendering with currentView:', this.currentView);
        switch (this.currentView) {
            case 'listen':
                console.log('[PickleGlassApp] Rendering listen-view');
                return html`<listen-view
                    .currentResponseIndex=${this.currentResponseIndex}
                    .selectedProfile=${this.selectedProfile}
                    .structuredData=${this.structuredData}
                    @response-index-changed=${e => (this.currentResponseIndex = e.detail.index)}
                ></listen-view>`;
            case 'ask':
                console.log('[PickleGlassApp] Rendering ask-view');
                return html`<ask-view></ask-view>`;
            case 'settings':
                console.log('[PickleGlassApp] Rendering settings-view');
                return html`<settings-view
                    .selectedProfile=${this.selectedProfile}
                    .selectedLanguage=${this.selectedLanguage}
                    .onProfileChange=${profile => (this.selectedProfile = profile)}
                    .onLanguageChange=${lang => (this.selectedLanguage = lang)}
                ></settings-view>`;
            case 'shortcut-settings':
                console.log('[PickleGlassApp] Rendering shortcut-settings-view');
                return html`<shortcut-settings-view></shortcut-settings-view>`;
            case 'research':
                console.log('[PickleGlassApp] Rendering research-view');
                return html`<research-view></research-view>`;
            case 'history':
                console.log('[PickleGlassApp] Rendering history-view');
                return html`<history-view></history-view>`;
            case 'help':
                console.log('[PickleGlassApp] Rendering help-view');
                return html`<help-view></help-view>`;
            case 'setup':
                console.log('[PickleGlassApp] Rendering setup-view');
                return html`<setup-view></setup-view>`;
            default:
                console.log('[PickleGlassApp] Unknown view:', this.currentView);
                return html`<div>Unknown view: ${this.currentView}</div>`;
        }
    }
}

console.log('[PickleGlassApp] Defining custom element pickle-glass-app');
customElements.define('pickle-glass-app', PickleGlassApp);
