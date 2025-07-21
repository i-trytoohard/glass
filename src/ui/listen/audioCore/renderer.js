// renderer.js
const listenCapture = require('./listenCapture.js');
const params        = new URLSearchParams(window.location.search);
const isListenView  = params.get('view') === 'listen';


window.pickleGlass = {
    startCapture: listenCapture.startCapture,
    stopCapture: listenCapture.stopCapture,
    isLinux: listenCapture.isLinux,
    isMacOS: listenCapture.isMacOS,
    captureManualScreenshot: listenCapture.captureManualScreenshot,
    getCurrentScreenshot: listenCapture.getCurrentScreenshot,
};


window.api.renderer.onChangeListenCaptureState((_event, { status }) => {
    // Allow capture in any view mode (including research mode)
    console.log(`[Renderer] Capture state change: ${status} (view: ${params.get('view') || 'unknown'})`);
    
    if (status === "stop") {
        console.log('[Renderer] Session ended – stopping local capture');
        listenCapture.stopCapture();
    } else {
        console.log('[Renderer] Session initialized – starting local capture');
        listenCapture.startCapture();
    }
});
