// src/bridge/featureBridge.js
const { ipcMain, app, BrowserWindow } = require('electron');
const internalBridge = require('./internalBridge');
const settingsService = require('../features/settings/settingsService');
const authService = require('../features/common/services/authService');
const whisperService = require('../features/common/services/whisperService');
const ollamaService = require('../features/common/services/ollamaService');
const modelStateService = require('../features/common/services/modelStateService');
const shortcutsService = require('../features/shortcuts/shortcutsService');
const presetRepository = require('../features/common/repositories/preset');
const localAIManager = require('../features/common/services/localAIManager');
const askService = require('../features/ask/askService');
const listenService = require('../features/listen/listenService');
const permissionService = require('../features/common/services/permissionService');
const encryptionService = require('../features/common/services/encryptionService');
const researchService = require('../features/research/researchService');
const windowManager = require('../window/windowManager');

module.exports = {
  // Renderer로부터의 요청을 수신하고 서비스로 전달
  initialize() {
    // Main Header Actions
    ipcMain.handle('main-header:toggle-all-windows-visibility', async () => {
      return await shortcutsService.toggleAllWindowsVisibility();
    });
    ipcMain.handle('main-header:show-settings-window', async () => {
      return windowManager.showSettingsWindow();
    });
    ipcMain.handle('main-header:hide-settings-window', async () => {
      return windowManager.hideSettingsWindow();
    });

    // Settings Service
    ipcMain.handle('settings:getPresets', async () => await settingsService.getPresets());
    ipcMain.handle('settings:get-auto-update', async () => await settingsService.getAutoUpdateSetting());
    ipcMain.handle('settings:set-auto-update', async (event, isEnabled) => await settingsService.setAutoUpdateSetting(isEnabled));  
    ipcMain.handle('settings:get-model-settings', async () => await settingsService.getModelSettings());
    ipcMain.handle('settings:clear-api-key', async (e, { provider }) => await settingsService.clearApiKey(provider));
    ipcMain.handle('settings:set-selected-model', async (e, { type, modelId }) => await settingsService.setSelectedModel(type, modelId));    

    ipcMain.handle('settings:get-ollama-status', async () => await settingsService.getOllamaStatus());
    ipcMain.handle('settings:ensure-ollama-ready', async () => await settingsService.ensureOllamaReady());
    ipcMain.handle('settings:shutdown-ollama', async () => await settingsService.shutdownOllama());

    // Shortcuts
    ipcMain.handle('settings:getCurrentShortcuts', async () => await shortcutsService.loadKeybinds());
    ipcMain.handle('shortcut:getDefaultShortcuts', async () => await shortcutsService.handleRestoreDefaults());
    ipcMain.handle('shortcut:closeShortcutSettingsWindow', async () => await shortcutsService.closeShortcutSettingsWindow());
    ipcMain.handle('shortcut:openShortcutSettingsWindow', async () => await shortcutsService.openShortcutSettingsWindow());
    ipcMain.handle('shortcut:saveShortcuts', async (event, newKeybinds) => await shortcutsService.handleSaveShortcuts(newKeybinds));
    ipcMain.handle('shortcut:toggleAllWindowsVisibility', async () => await shortcutsService.toggleAllWindowsVisibility());

    // Permissions
    ipcMain.handle('check-system-permissions', async () => await permissionService.checkSystemPermissions());
    ipcMain.handle('request-microphone-permission', async () => await permissionService.requestMicrophonePermission());
    ipcMain.handle('open-system-preferences', async (event, section) => await permissionService.openSystemPreferences(section));
    ipcMain.handle('mark-keychain-completed', async () => await permissionService.markKeychainCompleted());
    ipcMain.handle('check-keychain-completed', async () => await permissionService.checkKeychainCompleted());
    ipcMain.handle('initialize-encryption-key', async () => {
        const userId = authService.getCurrentUserId();
        await encryptionService.initializeKey(userId);
        return { success: true };
    });

    // User/Auth
    ipcMain.handle('get-current-user', () => authService.getCurrentUser());
    ipcMain.handle('start-firebase-auth', async () => await authService.startFirebaseAuthFlow());
    ipcMain.handle('firebase-logout', async () => await authService.signOut());

    // App
    ipcMain.handle('quit-application', () => app.quit());

    // Whisper
    ipcMain.handle('whisper:download-model', async (event, modelId) => await whisperService.handleDownloadModel(modelId));
    ipcMain.handle('whisper:get-installed-models', async () => await whisperService.handleGetInstalledModels());
       
    // General
    ipcMain.handle('get-preset-templates', () => presetRepository.getPresetTemplates());
    ipcMain.handle('get-web-url', () => process.env.pickleglass_WEB_URL || 'http://localhost:3000');

    // Ollama
    ipcMain.handle('ollama:get-status', async () => await ollamaService.handleGetStatus());
    ipcMain.handle('ollama:install', async () => await ollamaService.handleInstall());
    ipcMain.handle('ollama:start-service', async () => await ollamaService.handleStartService());
    ipcMain.handle('ollama:ensure-ready', async () => await ollamaService.handleEnsureReady());
    ipcMain.handle('ollama:get-models', async () => await ollamaService.handleGetModels());
    ipcMain.handle('ollama:get-model-suggestions', async () => await ollamaService.handleGetModelSuggestions());
    ipcMain.handle('ollama:pull-model', async (event, modelName) => await ollamaService.handlePullModel(modelName));
    ipcMain.handle('ollama:is-model-installed', async (event, modelName) => await ollamaService.handleIsModelInstalled(modelName));
    ipcMain.handle('ollama:warm-up-model', async (event, modelName) => await ollamaService.handleWarmUpModel(modelName));
    ipcMain.handle('ollama:auto-warm-up', async () => await ollamaService.handleAutoWarmUp());
    ipcMain.handle('ollama:get-warm-up-status', async () => await ollamaService.handleGetWarmUpStatus());
    ipcMain.handle('ollama:shutdown', async (event, force = false) => await ollamaService.handleShutdown(force));

    // Ask
    ipcMain.handle('ask:sendQuestionFromAsk', async (event, userPrompt) => await askService.sendMessage(userPrompt));
    ipcMain.handle('ask:sendQuestionFromSummary', async (event, userPrompt) => await askService.sendMessage(userPrompt));
    ipcMain.handle('ask:toggleAskButton', async () => await askService.toggleAskButton());
    ipcMain.handle('ask:closeAskWindow',  async () => await askService.closeAskWindow());
    
    // Listen
    ipcMain.handle('listen:sendMicAudio', async (event, { data, mimeType }) => await listenService.handleSendMicAudioContent(data, mimeType));
    ipcMain.handle('listen:sendSystemAudio', async (event, { data, mimeType }) => {
        const result = await listenService.sttService.sendSystemAudioContent(data, mimeType);
        if(result.success) {
            listenService.sendToRenderer('system-audio-data', { data });
        }
        return result;
    });
    ipcMain.handle('listen:startMacosSystemAudio', async () => await listenService.handleStartMacosAudio());
    ipcMain.handle('listen:stopMacosSystemAudio', async () => await listenService.handleStopMacosAudio());
    ipcMain.handle('update-google-search-setting', async (event, enabled) => await listenService.handleUpdateGoogleSearchSetting(enabled));
    ipcMain.handle('listen:isSessionActive', async () => await listenService.isSessionActive());
    ipcMain.handle('listen:changeSession', async (event, listenButtonText) => {
      console.log('[FeatureBridge] listen:changeSession from mainheader', listenButtonText);
      try {
        await listenService.handleListenRequest(listenButtonText);
        return { success: true };
      } catch (error) {
        console.error('[FeatureBridge] listen:changeSession failed', error.message);
        return { success: false, error: error.message };
      }
    });

    // ModelStateService
    ipcMain.handle('model:validate-key', async (e, { provider, key }) => await modelStateService.handleValidateKey(provider, key));
    ipcMain.handle('model:get-all-keys', async () => await modelStateService.getAllApiKeys());
    ipcMain.handle('model:set-api-key', async (e, { provider, key }) => await modelStateService.setApiKey(provider, key));
    ipcMain.handle('model:remove-api-key', async (e, provider) => await modelStateService.handleRemoveApiKey(provider));
    ipcMain.handle('model:get-selected-models', async () => await modelStateService.getSelectedModels());
    ipcMain.handle('model:set-selected-model', async (e, { type, modelId }) => await modelStateService.handleSetSelectedModel(type, modelId));
    ipcMain.handle('model:get-available-models', async (e, { type }) => await modelStateService.getAvailableModels(type));
    ipcMain.handle('model:are-providers-configured', async () => await modelStateService.areProvidersConfigured());
    ipcMain.handle('model:get-provider-config', () => modelStateService.getProviderConfig());
    ipcMain.handle('model:re-initialize-state', async () => await modelStateService.initialize());

    // Research Service
    ipcMain.handle('research:create-study', async (event, studyData) => await researchService.createStudy(studyData));
    ipcMain.handle('research:get-all-studies', async () => await researchService.getAllStudies());
    ipcMain.handle('research:get-study', async (event, studyId) => await researchService.getStudy(studyId));
    ipcMain.handle('research:update-study', async (event, { studyId, updateData }) => await researchService.updateStudy(studyId, updateData));
    ipcMain.handle('research:delete-study', async (event, studyId) => await researchService.deleteStudy(studyId));
    
    ipcMain.handle('research:add-question', async (event, { studyId, questionData }) => await researchService.addQuestion(studyId, questionData));
    ipcMain.handle('research:get-study-questions', async (event, studyId) => await researchService.getStudyQuestions(studyId));
    ipcMain.handle('research:update-question', async (event, { questionId, updateData }) => await researchService.updateQuestion(questionId, updateData));
    ipcMain.handle('research:delete-question', async (event, questionId) => await researchService.deleteQuestion(questionId));
    
    ipcMain.handle('research:start-session', async (event, { studyId, participantData }) => await researchService.startResearchSession(studyId, participantData));
    ipcMain.handle('research:end-session', async () => await researchService.endResearchSession());
    ipcMain.handle('research:get-session-status', async () => researchService.getSessionStatus());
    ipcMain.handle('research:get-session-report', async (event, sessionId) => await researchService.getSessionReport(sessionId));
    
    // Follow-up Question Management
    ipcMain.handle('research:mark-followup-asked', async (event, { questionId, response }) => {
        return researchService.markFollowUpQuestionAsked(questionId, response);
    });
    ipcMain.handle('research:get-followup-metrics', async () => {
        return researchService.followUpQuestionMetrics;
    });

    // NEW: Screen Recording Management
    const screenRecordingService = require('../features/research/screenRecordingService');
    
    ipcMain.handle('research:saveScreenRecording', async (event, { sessionId, recordingData, mimeType, size }) => {
        try {
            console.log(`[FeatureBridge] Saving screen recording for session ${sessionId}, size: ${size} bytes`);
            const buffer = Buffer.from(recordingData);
            const result = await screenRecordingService.saveRecording(buffer);
            return result;
        } catch (error) {
            console.error('[FeatureBridge] Failed to save screen recording:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('research:reportRecordingError', async (event, { error, sessionId }) => {
        console.error(`[FeatureBridge] Screen recording error for session ${sessionId}:`, error);
        // Could emit event to research service for error handling
        researchService.emit('screen-recording-error', { error, sessionId });
        return { success: true };
    });

    ipcMain.handle('research:getRecordings', async () => {
        try {
            const recordings = await screenRecordingService.getRecordings();
            return { success: true, recordings };
        } catch (error) {
            console.error('[FeatureBridge] Failed to get recordings:', error);
            return { success: false, error: error.message, recordings: [] };
        }
    });

    ipcMain.handle('research:deleteRecording', async (event, filename) => {
        try {
            const result = await screenRecordingService.deleteRecording(filename);
            return result;
        } catch (error) {
            console.error('[FeatureBridge] Failed to delete recording:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('research:openRecordingsDirectory', async () => {
        try {
            const result = await screenRecordingService.openRecordingsDirectory();
            return result;
        } catch (error) {
            console.error('[FeatureBridge] Failed to open recordings directory:', error);
            return { success: false, error: error.message };
        }
    });

    // Research navigation handler
    ipcMain.handle('research:navigate-to-research', async () => {
        // Request navigation with toggle logic handled by window manager
        internalBridge.emit('window:requestNavigation', { view: 'toggle-research' });
    });

    // Study dropdown handlers
    ipcMain.handle('main-header:show-study-dropdown', async (event, { show, studies = [] }) => {
        console.log('[FeatureBridge] Show study dropdown:', show, 'with', studies.length, 'studies');
        
        if (show) {
            // Send studies to the dropdown window
            const dropdownWin = BrowserWindow.getAllWindows().find(win => 
                win.webContents.getURL().includes('study-dropdown.html')
            );
            
            if (dropdownWin && !dropdownWin.isDestroyed()) {
                dropdownWin.webContents.send('update-studies', studies);
            }
        }
        
        // Show/hide the dropdown window
        internalBridge.emit('window:requestVisibility', { 
            name: 'study-dropdown', 
            visible: show 
        });
    });

    ipcMain.handle('study-dropdown:select-study', async (event, study) => {
        console.log('[FeatureBridge] Study selected from dropdown:', study.title);
        
        // Send study selection to the main header window
        const headerWin = BrowserWindow.getAllWindows().find(win => 
            win.webContents.getURL().includes('header.html')
        );
        
        if (headerWin && !headerWin.isDestroyed()) {
            headerWin.webContents.send('study-selected', study);
        }
        
        // Hide the dropdown after selection
        internalBridge.emit('window:requestVisibility', { 
            name: 'study-dropdown', 
            visible: false 
        });
    });

    // LocalAIManager 이벤트를 모든 윈도우에 브로드캐스트
    localAIManager.on('install-progress', (service, data) => {
      const event = { service, ...data };
      BrowserWindow.getAllWindows().forEach(win => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('localai:install-progress', event);
        }
      });
    });
    localAIManager.on('installation-complete', (service) => {
      BrowserWindow.getAllWindows().forEach(win => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('localai:installation-complete', { service });
        }
      });
    });
    localAIManager.on('error', (error) => {
      BrowserWindow.getAllWindows().forEach(win => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('localai:error-occurred', error);
        }
      });
    });
    // Handle error-occurred events from LocalAIManager's error handling
    localAIManager.on('error-occurred', (error) => {
      BrowserWindow.getAllWindows().forEach(win => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('localai:error-occurred', error);
        }
      });
    });
    localAIManager.on('model-ready', (data) => {
      BrowserWindow.getAllWindows().forEach(win => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('localai:model-ready', data);
        }
      });
    });
    localAIManager.on('state-changed', (service, state) => {
      const event = { service, ...state };
      BrowserWindow.getAllWindows().forEach(win => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('localai:service-status-changed', event);
        }
      });
    });

    // 주기적 상태 동기화 시작
    localAIManager.startPeriodicSync();

    // ResearchService 이벤트를 모든 윈도우에 브로드캐스트
    researchService.on('session-started', (data) => {
      console.log('[FeatureBridge] Broadcasting session-started event to all windows:', {
        studyId: data.studyId,
        studyTitle: data.study?.title || 'No study',
        hasStudy: !!data.study,
        windowCount: BrowserWindow.getAllWindows().length
      });
      
      BrowserWindow.getAllWindows().forEach((win, index) => {
        if (win && !win.isDestroyed()) {
          console.log(`[FeatureBridge] Sending session-started to window ${index}:`, win.getTitle() || 'Untitled');
          win.webContents.send('research:session-started', data);
        }
      });
    });
    researchService.on('session-ended', (data) => {
      BrowserWindow.getAllWindows().forEach(win => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('research:session-ended', data);
        }
      });
    });
    researchService.on('analysis-update', (data) => {
      BrowserWindow.getAllWindows().forEach(win => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('research:analysis-update', data);
        }
      });
    });
    researchService.on('followup-questions-expired', (data) => {
      BrowserWindow.getAllWindows().forEach(win => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('research:followup-expired', data);
        }
      });
    });

    // Question detection events
    researchService.on('question-detected', (data) => {
        console.log('[FeatureBridge] Broadcasting question-detected event:', data);
        BrowserWindow.getAllWindows().forEach((win) => {
            if (win && !win.isDestroyed()) {
                win.webContents.send('research:question-detected', data);
            }
        });
    });

    researchService.on('current-question-changed', (data) => {
        console.log('[FeatureBridge] Broadcasting current-question-changed event:', data);
        BrowserWindow.getAllWindows().forEach((win) => {
            if (win && !win.isDestroyed()) {
                win.webContents.send('research:current-question-changed', data);
            }
        });
    });

    researchService.on('ambiguous-question-detected', (data) => {
        console.log('[FeatureBridge] Broadcasting ambiguous-question-detected event:', data);
        BrowserWindow.getAllWindows().forEach((win) => {
            if (win && !win.isDestroyed()) {
                win.webContents.send('research:ambiguous-question-detected', data);
            }
        });
    });

    researchService.on('off-script-question-detected', (data) => {
        console.log('[FeatureBridge] Broadcasting off-script-question-detected event:', data);
        BrowserWindow.getAllWindows().forEach((win) => {
            if (win && !win.isDestroyed()) {
                win.webContents.send('research:off-script-question-detected', data);
            }
        });
    });

    researchService.on('question-detection-update', (data) => {
        console.log('[FeatureBridge] Broadcasting question-detection-update event:', data);
        BrowserWindow.getAllWindows().forEach((win) => {
            if (win && !win.isDestroyed()) {
                win.webContents.send('research:question-detection-update', data);
            }
        });
    });

    // NEW: Screen Recording Events
    researchService.on('screen-recording-started', (data) => {
        console.log('[FeatureBridge] Broadcasting screen-recording-started event:', data);
        BrowserWindow.getAllWindows().forEach((win) => {
            if (win && !win.isDestroyed()) {
                win.webContents.send('research:screen-recording-started', data);
            }
        });
    });

    researchService.on('screen-recording-stopped', (data) => {
        console.log('[FeatureBridge] Broadcasting screen-recording-stopped event:', data);
        BrowserWindow.getAllWindows().forEach((win) => {
            if (win && !win.isDestroyed()) {
                win.webContents.send('research:screen-recording-stopped', data);
            }
        });
    });

    researchService.on('screen-recording-error', (data) => {
        console.log('[FeatureBridge] Broadcasting screen-recording-error event:', data);
        BrowserWindow.getAllWindows().forEach((win) => {
            if (win && !win.isDestroyed()) {
                win.webContents.send('research:screen-recording-error', data);
            }
        });
    });

    // NEW: Internal bridge handlers for screen recording
    internalBridge.on('research:startScreenRecording', (data) => {
        console.log('[FeatureBridge] Forwarding research:startScreenRecording to renderers:', data);
        BrowserWindow.getAllWindows().forEach((win) => {
            if (win && !win.isDestroyed()) {
                win.webContents.send('research:startScreenRecording', data);
            }
        });
    });

    internalBridge.on('research:stopScreenRecording', () => {
        console.log('[FeatureBridge] Forwarding research:stopScreenRecording to renderers');
        BrowserWindow.getAllWindows().forEach((win) => {
            if (win && !win.isDestroyed()) {
                win.webContents.send('research:stopScreenRecording');
            }
        });
    });

    // ModelStateService 이벤트를 모든 윈도우에 브로드캐스트
    modelStateService.on('state-updated', (state) => {
      BrowserWindow.getAllWindows().forEach(win => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('model-state:updated', state);
        }
      });
    });
    modelStateService.on('settings-updated', () => {
      BrowserWindow.getAllWindows().forEach(win => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('settings-updated');
        }
      });
    });
    modelStateService.on('force-show-apikey-header', () => {
      BrowserWindow.getAllWindows().forEach(win => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('force-show-apikey-header');
        }
      });
    });

    // LocalAI 통합 핸들러 추가
    ipcMain.handle('localai:install', async (event, { service, options }) => {
      return await localAIManager.installService(service, options);
    });
    ipcMain.handle('localai:get-status', async (event, service) => {
      return await localAIManager.getServiceStatus(service);
    });
    ipcMain.handle('localai:start-service', async (event, service) => {
      return await localAIManager.startService(service);
    });
    ipcMain.handle('localai:stop-service', async (event, service) => {
      return await localAIManager.stopService(service);
    });
    ipcMain.handle('localai:install-model', async (event, { service, modelId, options }) => {
      return await localAIManager.installModel(service, modelId, options);
    });
    ipcMain.handle('localai:get-installed-models', async (event, service) => {
      return await localAIManager.getInstalledModels(service);
    });
    ipcMain.handle('localai:run-diagnostics', async (event, service) => {
      return await localAIManager.runDiagnostics(service);
    });
    ipcMain.handle('localai:repair-service', async (event, service) => {
      return await localAIManager.repairService(service);
    });
    
    // 에러 처리 핸들러
    ipcMain.handle('localai:handle-error', async (event, { service, errorType, details }) => {
      return await localAIManager.handleError(service, errorType, details);
    });
    
    // 전체 상태 조회
    ipcMain.handle('localai:get-all-states', async (event) => {
      return await localAIManager.getAllServiceStates();
    });

    // Research Service
    ipcMain.handle('research:getAvailableStudies', async () => {
      try {
        return await researchService.getStudies();
      } catch (error) {
        console.error('[FeatureBridge] research:getAvailableStudies failed', error.message);
        return [];
      }
    });

    ipcMain.handle('research:getLocalStudy', async (event, studyId) => {
      try {
        return await researchService.getLocalStudy(studyId);
      } catch (error) {
        console.error('[FeatureBridge] research:getLocalStudy failed', error.message);
        return null;
      }
    });

    ipcMain.handle('research:getLocalStudyQuestions', async (event, studyId) => {
      try {
        return await researchService.getLocalStudyQuestions(studyId);
      } catch (error) {
        console.error('[FeatureBridge] research:getLocalStudyQuestions failed', error.message);
        return [];
      }
    });

    ipcMain.handle('research:startResearchSession', async (event, studyId) => {
      try {
        console.log('[FeatureBridge] Starting research session for study:', studyId);
        await researchService.startResearchSession(studyId);
        
        // Emit status change event
        BrowserWindow.getAllWindows().forEach(window => {
          window.webContents.send('research:interview-status-changed', { 
            success: true, 
            status: 'started', 
            studyId 
          });
        });
        
        return { success: true };
      } catch (error) {
        console.error('[FeatureBridge] research:startResearchSession failed', error.message);
        
        // Emit failure event
        BrowserWindow.getAllWindows().forEach(window => {
          window.webContents.send('research:interview-status-changed', { 
            success: false, 
            error: error.message 
          });
        });
        
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('research:pauseResearchSession', async () => {
      try {
        console.log('[FeatureBridge] Pausing research session');
        await researchService.pauseResearchSession();
        
        // Emit status change event
        BrowserWindow.getAllWindows().forEach(window => {
          window.webContents.send('research:interview-status-changed', { 
            success: true, 
            status: 'paused' 
          });
        });
        
        return { success: true };
      } catch (error) {
        console.error('[FeatureBridge] research:pauseResearchSession failed', error.message);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('research:resumeResearchSession', async () => {
      try {
        console.log('[FeatureBridge] Resuming research session');
        await researchService.resumeResearchSession();
        
        // Emit status change event
        BrowserWindow.getAllWindows().forEach(window => {
          window.webContents.send('research:interview-status-changed', { 
            success: true, 
            status: 'resumed' 
          });
        });
        
        return { success: true };
      } catch (error) {
        console.error('[FeatureBridge] research:resumeResearchSession failed', error.message);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('research:endResearchSession', async () => {
      try {
        console.log('[FeatureBridge] Ending research session');
        await researchService.endResearchSession();
        
        // Emit status change event
        BrowserWindow.getAllWindows().forEach(window => {
          window.webContents.send('research:interview-status-changed', { 
            success: true, 
            status: 'ended' 
          });
        });
        
        return { success: true };
      } catch (error) {
        console.error('[FeatureBridge] research:endResearchSession failed', error.message);
        return { success: false, error: error.message };
      }
    });

    // Question detection IPC handlers
    ipcMain.handle('research:processTranscript', async (event, transcript, speaker) => {
        try {
            await researchService.processTranscript(transcript, speaker);
            return { success: true };
        } catch (error) {
            console.error('[FeatureBridge] Error processing transcript:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('research:manualQuestionOverride', async (event, questionId) => {
        try {
            researchService.manualQuestionOverride(questionId);
            return { success: true };
        } catch (error) {
            console.error('[FeatureBridge] Error in manual question override:', error);
            return { success: false, error: error.message };
        }
    });

    // Stop research session
    ipcMain.handle('research:stopResearchSession', async (event) => {
        try {
            const result = await researchService.stopResearchSession();
            return { success: true, stopped: result };
        } catch (error) {
            console.error('[FeatureBridge] Error stopping research session:', error);
            return { success: false, error: error.message };
        }
    });

    console.log('[FeatureBridge] Initialized with all feature handlers.');
  },

  // Renderer로 상태를 전송
  sendAskProgress(win, progress) {
    win.webContents.send('feature:ask:progress', progress);
  },
};