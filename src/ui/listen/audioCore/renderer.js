// renderer.js
const listenCapture = require('./listenCapture.js');
const params        = new URLSearchParams(window.location.search);
const currentView   = params.get('view') || 'unknown';
const isListenView  = currentView === 'listen';
const isResearchView = currentView === 'research';

console.log('[Renderer] Initializing for view:', currentView, 'URL:', window.location.href);


window.pickleGlass = {
    startCapture: listenCapture.startCapture,
    stopCapture: listenCapture.stopCapture,
    isLinux: listenCapture.isLinux,
    isMacOS: listenCapture.isMacOS,
    captureManualScreenshot: listenCapture.captureManualScreenshot,
    getCurrentScreenshot: listenCapture.getCurrentScreenshot,
};


console.log('[Renderer] Setting up onChangeListenCaptureState listener');

window.api.listenCapture.onChangeListenCaptureState((_event, { status }) => {
    // Allow capture in any view mode (including research mode)
    console.log(`[Renderer] 🎤 Capture state change: ${status} (view: ${currentView})`);
    
    if (status === "stop") {
        console.log('[Renderer] Session ended – stopping local capture');
        listenCapture.stopCapture();
    } else {
        console.log('[Renderer] Session initialized – starting local capture');
        listenCapture.startCapture();
    }
});
