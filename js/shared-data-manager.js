/**
 * Shared Data Manager for Smart Alarm System
 * Handles localStorage operations and data synchronization across HTML pages
 */

class SharedDataManager {
    constructor() {
        this.storageKeys = {
            PATIENT_PREFIX: 'patient_',
            BED_STATES: 'bedStates',
            CURRENT_PATIENT: 'currentPatient',
            CURRENT_BED: 'currentBed',
            SELECTED_RISK_LEVEL: 'selectedRiskLevel',
            BED_OVERVIEW_STATE: 'bedOverviewState',
            APP_DATA: 'smartAlarmAppData',
            MANUAL_OVERRIDE_PREFIX: 'manual_override_'
        };
        
        // Track recent messages to prevent duplicates
        this.recentMessages = new Map();
        this.messageDuplicateWindow = 50; // 50 milliseconds to prevent duplicates
        
        this.initializeAppData();
        this.initializeGlobalHRVariables();
        this.initializeGlobalParameterVariables();
        this.initializeWebSocketClient();
    }

    /**
     * Initialize WebSocket outbound communication
     */
    initializeWebSocketClient() {
        try {
            // Initialize WebSocket connection manager if available
            if (typeof window.webSocketManager !== 'undefined') {
                this.webSocketManager = window.webSocketManager;
                console.log('✅ WebSocket manager connected to SharedDataManager');
                
                // Ensure connection is active (reconnect if needed)
                if (!this.webSocketManager.isConnected()) {
                    console.log('🔄 WebSocket not connected, attempting to reconnect...');
                    this.webSocketManager.connect();
                } else {
                    console.log('✅ WebSocket already connected');
                }
            } else {
                console.log('⏳ WebSocket manager not yet available, will retry when initialization completes...');
                
                // Retry initialization after both DOM and scripts are ready
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', () => {
                        setTimeout(() => this.initializeWebSocketClient(), 200); // Longer delay for script execution
                    });
                } else {
                    // DOM is ready but WebSocket manager might still be initializing
                    setTimeout(() => this.initializeWebSocketClient(), 1000); // Even longer delay for late initialization
                }
            }
        } catch (error) {
            console.error('❌ Error initializing WebSocket client:', error);
        }
    }

    /**
     * Send WebSocket message if connection is available
     */
    sendWebSocketMessage(type, data, priority = 'normal') {
        try {
            // Create message fingerprint to detect duplicates
            const messageFingerprint = this.createMessageFingerprint(type, data);
            
            // Check if this message was recently sent
            if (this.isRecentDuplicate(messageFingerprint)) {
                console.log(`🚫 Duplicate message prevented: ${type} (fingerprint: ${messageFingerprint})`);
                return false;
            }
            
            if (this.webSocketManager) {
                // Track this message as sent
                this.trackSentMessage(messageFingerprint);
                return this.webSocketManager.sendMessage(type, data, priority);
            } else {
                console.warn('⚠️ WebSocket manager not available. Message not sent:', type);
                return false;
            }
        } catch (error) {
            console.error('❌ Error sending WebSocket message:', error);
            return false;
        }
    }
    
    /**
     * Create a fingerprint for a message to detect duplicates
     */
    createMessageFingerprint(type, data) {
        // Create a simplified fingerprint based on message type and key data
        let fingerprint = type;
        
        if (type === 'patient_selected' && data) {
            // For patient selection, use patient ID and bed number
            const patientId = data.patient?.id || data.id;
            const bedNumber = data.bedNumber;
            fingerprint += `_${patientId}_bed${bedNumber}`;
        } else if (type === 'patient_discharged' && data) {
            // For patient discharge, use patient ID and bed number
            fingerprint += `_${data.patientId}_bed${data.bedNumber}`;
        } else if (type === 'thresholds_risk_levels' && data) {
            // For thresholds, use patient ID, change type, and timestamp for uniqueness
            const changeType = data.changeType || 'unknown';
            const riskLevel = data.riskLevels?.circulatoir || 'unknown';
            const timestampHash = data.timestamp ? data.timestamp.slice(-8) : Date.now().toString().slice(-8);
            fingerprint += `_${data.patientId}_${changeType}_${riskLevel}_${timestampHash}`;
        }
        
        return fingerprint;
    }
    
    /**
     * Check if a message fingerprint was recently sent
     */
    isRecentDuplicate(fingerprint) {
        const now = Date.now();
        const lastSent = this.recentMessages.get(fingerprint);
        
        if (lastSent && (now - lastSent) < this.messageDuplicateWindow) {
            return true; // This is a recent duplicate
        }
        
        return false;
    }
    
    /**
     * Track a sent message to prevent duplicates
     */
    trackSentMessage(fingerprint) {
        const now = Date.now();
        this.recentMessages.set(fingerprint, now);
        
        // Clean up old entries (older than duplicate window)
        for (const [key, timestamp] of this.recentMessages.entries()) {
            if ((now - timestamp) > this.messageDuplicateWindow) {
                this.recentMessages.delete(key);
            }
        }
    }

    /**
     * Get WebSocket connection status
     */
    getWebSocketStatus() {
        try {
            if (this.webSocketManager) {
                return this.webSocketManager.getConnectionStatus();
            } else {
                return { connected: false, error: 'WebSocket manager not available' };
            }
        } catch (error) {
            console.error('❌ Error getting WebSocket status:', error);
            return { connected: false, error: error.message };
        }
    }

    /**
     * Get WebSocket connection status
     */
    getWebSocketStatus() {
        if (this.webSocketManager) {
            return this.webSocketManager.getConnectionStatuses();
        }
        return { error: 'WebSocket manager not available' };
    }

    /**
     * Unified Patient Assignment Method
     * Handles both data storage AND WebSocket messaging in one centralized call
     * This replaces scattered assignment logic across pages
     */
    assignPatientToBed(patientId, bedNumber, patientInfo = {}) {
        try {            
            // 1. Get current bed states
            const currentBedStates = this.getBedStates() || {};
            
            // 2. Create updated bed state
            const updatedBedStates = { ...currentBedStates };
            updatedBedStates[bedNumber] = {
                occupied: true,
                patientId: patientId,
                patientData: patientInfo,
                timestamp: new Date().toISOString(),
                riskLevel: patientInfo.riskLevel || 'mid', // Default risk level
                vpkCode: patientInfo.vpkCode || this.generateVPKCode()
            };
            
            // 3. Save bed states (this will automatically trigger WebSocket messaging through detectAndSendBedChanges)
            const success = this.saveBedStates(updatedBedStates);
            
            // 4. Save patient medical info if provided
            if (patientInfo.medicalInfo) {
                this.savePatientMedicalInfo(patientId, patientInfo.medicalInfo);
            }
            
            // 5. Update session data for current patient/bed
            this.saveSessionData({
                currentPatient: patientId,
                currentBed: bedNumber,
                selectedRiskLevel: patientInfo.riskLevel || 'mid',
                timestamp: new Date().toISOString()
            });
            
            if (success) {
                return {
                    success: true,
                    bedNumber: bedNumber,
                    patientId: patientId,
                    vpkCode: updatedBedStates[bedNumber].vpkCode,
                    riskLevel: updatedBedStates[bedNumber].riskLevel,
                    timestamp: updatedBedStates[bedNumber].timestamp
                };
            } else {
                console.error(`❌ Failed to assign patient ${patientId} to bed ${bedNumber}`);
                return {
                    success: false,
                    error: `Failed to save bed states for bed ${bedNumber}`
                };
            }
            
        } catch (error) {
            console.error('❌ Error in unified patient assignment:', error);
            return {
                success: false,
                error: error.message || 'Unknown error during patient assignment'
            };
        }
    }
    
    /**
     * Generate VPK code for patient assignment
     */
    generateVPKCode() {
        const vpkCodes = ['FG', 'AM', 'IB', 'GT'];
        return vpkCodes[Math.floor(Math.random() * vpkCodes.length)];
    }
    
    /**
     * Unified Patient Discharge Method
     * Handles patient discharge from bed with proper WebSocket messaging
     */
    dischargePatientFromBed(bedNumber, reason = 'manual_discharge') {
        try {
            // 1. Get current bed states
            const currentBedStates = this.getBedStates() || {};
            
            // Get patient ID from current bed state
            const currentBed = currentBedStates[bedNumber];
            if (!currentBed || !currentBed.occupied) {
                console.warn(`⚠️ Bed ${bedNumber} is not occupied or does not exist`);
                return {
                    success: false,
                    error: `Bed ${bedNumber} is not occupied`
                };
            }
            
            const patientId = currentBed.patientId;
            
            // 2. Create updated bed state
            const updatedBedStates = { ...currentBedStates };
            updatedBedStates[bedNumber] = {
                occupied: false,
                patientId: null,
                patientData: null,
                timestamp: new Date().toISOString(),
                riskLevel: null,
                vpkCode: null
            };
            
            // 3. Save bed states (this will automatically trigger WebSocket messaging)
            const success = this.saveBedStates(updatedBedStates);
            
            // 4. Clear session data if this was the current patient
            const sessionData = this.getSessionData();
            if (sessionData.currentPatient === patientId) {
                this.clearSessionData();
            }
            
            if (success) {
                return {
                    success: true,
                    bedNumber: bedNumber,
                    patientId: patientId,
                    reason: reason,
                    timestamp: new Date().toISOString()
                };
            } else {
                console.error(`❌ Failed to discharge patient ${patientId} from bed ${bedNumber}`);
                return {
                    success: false,
                    error: `Failed to save bed states for bed ${bedNumber}`
                };
            }
            
        } catch (error) {
            console.error('❌ Error in unified patient discharge:', error);
            return {
                success: false,
                error: error.message || 'Unknown error during patient discharge'
            };
        }
    }

    /**
     * Initialize global parameter variables - single source of truth for all target ranges
     * These variables are used consistently across all pages for displays and sliders
     * Now uses Matrix system exclusively - NO hardcoded defaults
     */
    initializeGlobalParameterVariables() {
        // Check if we have a selected problem to get Matrix-based defaults
        const currentProblem = localStorage.getItem(this.storageKeys.SELECTED_PROBLEM) || '';
        const currentRiskLevel = localStorage.getItem(this.storageKeys.SELECTED_RISK_LEVEL) || 'low';
        
        let matrixDefaults = {};
        if (currentProblem && currentProblem !== '' && currentProblem !== 'none') {
            matrixDefaults = this.getMatrixBasedBaseRanges(currentProblem, currentRiskLevel);
        } else {
            // Use respiratory-insufficientie as the safest general default from Matrix
            matrixDefaults = this.getMatrixBasedBaseRanges('respiratoire-insufficientie', 'low');
        }
        
        // Initialize with Matrix-based values if not already set
        if (typeof window.HR_MIN === 'undefined') window.HR_MIN = matrixDefaults.HR?.min || 70;
        if (typeof window.HR_MAX === 'undefined') window.HR_MAX = matrixDefaults.HR?.max || 100;
        if (typeof window.BP_MIN === 'undefined') window.BP_MIN = matrixDefaults.BP_Mean?.min || 60;
        if (typeof window.BP_MAX === 'undefined') window.BP_MAX = matrixDefaults.BP_Mean?.max || 90;
        if (typeof window.AF_MIN === 'undefined') window.AF_MIN = matrixDefaults.AF?.min || 12;
        if (typeof window.AF_MAX === 'undefined') window.AF_MAX = matrixDefaults.AF?.max || 20;
        if (typeof window.SAT_MIN === 'undefined') window.SAT_MIN = matrixDefaults.Saturatie?.min || 92;
        if (typeof window.SAT_MAX === 'undefined') window.SAT_MAX = matrixDefaults.Saturatie?.max || 100;
        if (typeof window.TEMP_MIN === 'undefined') window.TEMP_MIN = matrixDefaults.Temperature?.min || 36.0;
        if (typeof window.TEMP_MAX === 'undefined') window.TEMP_MAX = matrixDefaults.Temperature?.max || 38.5;

        // Load existing values from localStorage if available
        this.loadGlobalParameterVariables();
    }

    /**
     * Load global parameter variables from localStorage
     */
    loadGlobalParameterVariables() {
        const saved = localStorage.getItem('globalParameterVariables');
        if (saved) {
            try {
                const params = JSON.parse(saved);
                window.HR_MIN = params.HR_MIN || window.HR_MIN;
                window.HR_MAX = params.HR_MAX || window.HR_MAX;
                window.BP_MIN = params.BP_MIN || window.BP_MIN;
                window.BP_MAX = params.BP_MAX || window.BP_MAX;
                window.AF_MIN = params.AF_MIN || window.AF_MIN;
                window.AF_MAX = params.AF_MAX || window.AF_MAX;
                window.SAT_MIN = params.SAT_MIN || window.SAT_MIN;
                window.SAT_MAX = params.SAT_MAX || window.SAT_MAX;
                window.TEMP_MIN = params.TEMP_MIN || window.TEMP_MIN;
                window.TEMP_MAX = params.TEMP_MAX || window.TEMP_MAX;
            } catch (error) {
                console.warn('⚠️ Error loading global parameters:', error);
            }
        }
    }

    /**
     * Save global parameter variables to localStorage
     */
    saveGlobalParameterVariables() {
        const params = {
            HR_MIN: window.HR_MIN,
            HR_MAX: window.HR_MAX,
            BP_MIN: window.BP_MIN,
            BP_MAX: window.BP_MAX,
            AF_MIN: window.AF_MIN,
            AF_MAX: window.AF_MAX,
            SAT_MIN: window.SAT_MIN,
            SAT_MAX: window.SAT_MAX,
            TEMP_MIN: window.TEMP_MIN,
            TEMP_MAX: window.TEMP_MAX
        };
        localStorage.setItem('globalParameterVariables', JSON.stringify(params));
    }

    /**
     * Clear all manual adjustments for a specific patient (when switching patients or resetting)
     */
    clearPatientManualAdjustments(patientId) {
        if (!patientId) return;
        
        console.log(`🧹 CLEARING: All manual adjustments for patient ${patientId}`);
        
        // CRITICAL: Clear new manual override system
        this.clearManualOverrides(patientId, 'problem-change');
        
        // CRITICAL: Also clear customThresholds from medical info (old system)
        const medicalInfo = this.getPatientMedicalInfo(patientId);
        if (medicalInfo && medicalInfo.customThresholds) {
            console.log(`🧹 CLEARING: Found customThresholds in medical info to clear:`, medicalInfo.customThresholds);
            medicalInfo.customThresholds = {};
            medicalInfo.lastUpdated = new Date().toISOString();
            this.savePatientMedicalInfo(patientId, medicalInfo);
            console.log(`✅ CLEARING: Cleared customThresholds from medical info`);
        }
        
        // Clear all slider custom thresholds (legacy system)
        const parameterTypes = ['HR', 'BP_Mean', 'AF', 'Saturatie', 'Temperature'];
        parameterTypes.forEach(type => {
            localStorage.removeItem(`patient-${patientId}-${type}-custom-threshold`);
        });
        
        // Clear all global parameter manual overrides (legacy system)
        const globalParams = ['HR_MIN', 'HR_MAX', 'BP_MIN', 'BP_MAX', 'AF_MIN', 'AF_MAX', 'SAT_MIN', 'SAT_MAX', 'TEMP_MIN', 'TEMP_MAX'];
        globalParams.forEach(param => {
            localStorage.removeItem(`patient-${patientId}-${param}-manual`);
        });
        
        console.log(`✅ CLEARING: Completed manual adjustment clearing for patient ${patientId}`);
    }

    /**
     * Mark that user is manually changing main problem (should overwrite manual slider adjustments)
     */
    setUserChangingProblem(isChanging = true) {
        window.isUserChangingProblem = isChanging;
    }

    /**
     * Check if user is currently changing problem manually
     */
    isUserManuallyChangingProblem() {
        return window.isUserChangingProblem === true;
    }

    /**
     * Parameter Alarm Toggle Management
     * Controls whether alarms are active/inactive for each parameter (HR, BP, Saturatie, AF, Temperature)
     */
    
    /**
     * Set parameter alarm state (enabled/disabled)
     * @param {string} patientId - Patient ID
     * @param {string} parameter - Parameter name (HR, BP_Mean, Saturatie, AF, Temperature)
     * @param {boolean} isEnabled - Whether alarms are enabled for this parameter
     */
    setParameterAlarmEnabled(patientId, parameter, isEnabled) {
        const key = `patient-${patientId}-alarm-${parameter}`;
        localStorage.setItem(key, isEnabled.toString());
        
        // Trigger event for cross-page synchronization
        window.dispatchEvent(new CustomEvent('parameterAlarmToggled', {
            detail: { patientId, parameter, isEnabled }
        }));
    }

    /**
     * Get parameter alarm state (enabled/disabled)
     * @param {string} patientId - Patient ID  
     * @param {string} parameter - Parameter name (HR, BP_Mean, Saturatie, AF, Temperature)
     * @returns {boolean} - True if alarms are enabled (default: true)
     */
    getParameterAlarmEnabled(patientId, parameter) {
        const key = `patient-${patientId}-alarm-${parameter}`;
        const stored = localStorage.getItem(key);
        // Default to enabled (true) if not set
        return stored === null ? true : stored === 'true';
    }

    /**
     * Get all parameter alarm states for a patient
     * @param {string} patientId - Patient ID
     * @returns {Object} - Object with parameter names as keys and enabled state as values
     */
    getAllParameterAlarmStates(patientId) {
        const parameters = ['HR', 'BP_Mean', 'Saturatie', 'AF', 'Temperature'];
        const states = {};
        
        parameters.forEach(param => {
            states[param] = this.getParameterAlarmEnabled(patientId, param);
        });
        
        return states;
    }

    /**
     * Reset all parameter alarms to enabled for a patient
     * @param {string} patientId - Patient ID
     */
    resetParameterAlarms(patientId) {
        const parameters = ['HR', 'BP_Mean', 'Saturatie', 'AF', 'Temperature'];
        parameters.forEach(param => {
            this.setParameterAlarmEnabled(patientId, param, true);
        });
    }

    /**
     * Initialize the main app data structure if it doesn't exist
     */
    initializeAppData() {
        const existingData = this.getAppData();
        if (!existingData) {
            const initialData = {
                patients: {},
                beds: {},
                sessions: {},
                lastUpdated: new Date().toISOString(),
                version: '1.0'
            };
            this.saveAppData(initialData);
        }
        
        // Auto-initialize when script loads
        this.autoInitializeFromLegacyData();
    }

    /**
     * Auto-migrate legacy localStorage data to centralized system
     */
    autoInitializeFromLegacyData() {
        try {
            // Check if auto-initialization has already been completed
            const initFlag = localStorage.getItem('autoInitComplete');
            if (initFlag === 'true') {
                return;
            }
            
            // Migrate patient data - but limit the scan to avoid performance issues
            const maxScans = Math.min(localStorage.length, 50); // Limit to 50 items max
            for (let i = 0; i < maxScans; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(this.storageKeys.PATIENT_PREFIX) && key.endsWith('_medicalInfo')) {
                    const patientId = key.replace(this.storageKeys.PATIENT_PREFIX, '').replace('_medicalInfo', '');
                    const data = localStorage.getItem(key);
                    if (data) {
                        try {
                            const medicalInfo = JSON.parse(data);
                            this.savePatientMedicalInfo(patientId, medicalInfo);
                        } catch (error) {
                            console.error('❌ Error migrating patient data for:', patientId, error);
                        }
                    }
                }
            }
            
            // Migrate bed states
            const bedStates = localStorage.getItem(this.storageKeys.BED_STATES);
            if (bedStates) {
                try {
                    const beds = JSON.parse(bedStates);
                    this.saveBedStates(beds);
                } catch (error) {
                    console.error('❌ Error migrating bed states:', error);
                }
            }
            
            // Migrate session data
            const currentPatient = localStorage.getItem(this.storageKeys.CURRENT_PATIENT);
            const currentBed = localStorage.getItem(this.storageKeys.CURRENT_BED);
            const selectedRiskLevel = localStorage.getItem(this.storageKeys.SELECTED_RISK_LEVEL);
            
            if (currentPatient || currentBed || selectedRiskLevel) {
                this.saveSessionData({
                    currentPatient: currentPatient,
                    currentBed: currentBed,
                    selectedRiskLevel: selectedRiskLevel,
                    migrated: true,
                    timestamp: new Date().toISOString()
                });
            }
            
            // Set flag to prevent repeated auto-initialization
            localStorage.setItem('autoInitComplete', 'true');
        } catch (error) {
            console.error('❌ Error during auto-initialization:', error);
        }
    }

    /**
     * Get the main app data structure
     */
    getAppData() {
        try {
            const data = localStorage.getItem(this.storageKeys.APP_DATA);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Error getting app data:', error);
            return null;
        }
    }

    /**
     * Save the main app data structure
     */
    saveAppData(data) {
        try {
            data.lastUpdated = new Date().toISOString();
            localStorage.setItem(this.storageKeys.APP_DATA, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Error saving app data:', error);
            return false;
        }
    }

    /**
     * Save patient medical information
     */
    savePatientMedicalInfo(patientId, medicalInfo) {
        try {
            // Get current medical info to detect changes
            const currentMedicalInfo = this.getPatientMedicalInfo(patientId);
            const oldRiskLevel = currentMedicalInfo?.selectedRiskLevel;
            const newRiskLevel = medicalInfo?.selectedRiskLevel;
            const oldProblem = currentMedicalInfo?.selectedProblem;
            const newProblem = medicalInfo?.selectedProblem;
            
            // Save individual patient data (legacy compatibility)
            const patientKey = this.storageKeys.PATIENT_PREFIX + patientId + '_medicalInfo';
            localStorage.setItem(patientKey, JSON.stringify(medicalInfo));

            // Also save to centralized app data
            const appData = this.getAppData();
            if (appData) {
                if (!appData.patients[patientId]) {
                    appData.patients[patientId] = {};
                }
                appData.patients[patientId].medicalInfo = medicalInfo;
                appData.patients[patientId].lastUpdated = new Date().toISOString();
                this.saveAppData(appData);
            }

            // Send WebSocket message for any significant medical info change
            let shouldSendMessage = false;
            let changeDescription = [];

            // Check for risk level changes (including first-time setting)
            if (newRiskLevel && (!oldRiskLevel || oldRiskLevel !== newRiskLevel)) {
                shouldSendMessage = true;
                if (!oldRiskLevel) {
                    changeDescription.push(`Risk level set to: ${newRiskLevel}`);
                    console.log(`📊 Risk level set for patient ${patientId}: ${newRiskLevel}`);
                } else {
                    changeDescription.push(`Risk level changed: ${oldRiskLevel} → ${newRiskLevel}`);
                    console.log(`📊 Risk level changed for patient ${patientId}: ${oldRiskLevel} → ${newRiskLevel}`);
                }
            }

            // Check for medical condition changes (including first-time setting)
            if (newProblem && (!oldProblem || oldProblem !== newProblem)) {
                shouldSendMessage = true;
                if (!oldProblem) {
                    changeDescription.push(`Medical condition set to: ${newProblem}`);
                    console.log(`🏥 Medical condition set for patient ${patientId}: ${newProblem}`);
                } else {
                    changeDescription.push(`Medical condition changed: ${oldProblem} → ${newProblem}`);
                    console.log(`🏥 Medical condition changed for patient ${patientId}: ${oldProblem} → ${newProblem}`);
                }
            }

            // Check for threshold changes (custom thresholds updates)
            if (medicalInfo.customThresholds && 
                JSON.stringify(currentMedicalInfo?.customThresholds) !== JSON.stringify(medicalInfo.customThresholds)) {
                shouldSendMessage = true;
                changeDescription.push('Custom thresholds updated');
                console.log(`⚙️ Custom thresholds updated for patient ${patientId}`);
            }

            // Send full configuration message if any significant change detected
            if (shouldSendMessage) {
                console.log(`📤 Will send full configuration message for patient ${patientId} with changes:`, changeDescription);
                
                this.sendFullThresholdsRiskLevels(patientId);
                
                // Dispatch custom event for cross-page synchronization (bed overview updates)
                window.dispatchEvent(new CustomEvent('patientMedicalInfoChanged', {
                    detail: {
                        patientId: patientId,
                        oldRiskLevel: oldRiskLevel,
                        newRiskLevel: newRiskLevel,
                        oldProblem: oldProblem,
                        newProblem: newProblem,
                        changes: changeDescription
                    }
                }));
                console.log('🔄 Dispatched patientMedicalInfoChanged event for bed overview update');
            }

            console.log(`✅ Patient medical info saved for patient ${patientId}`);
            return true;
        } catch (error) {
            console.error('❌ Error saving patient medical info:', error);
            return false;
        }
    }

    /**
     * Collect complete current medical configuration for a patient
     * PRINCIPLE: Returns exactly what is currently displayed in the UI (sliders + risk level buttons)
     * This is the "display truth" that should be sent via websocket
     */
    collectCurrentMedicalConfiguration(patientId) {
        try {
            console.log(`📋 Collecting DISPLAY TRUTH medical configuration for patient ${patientId}`);
            
            const medicalInfo = this.getPatientMedicalInfo(patientId) || {};
            const bedStates = this.getBedStates() || {};
            
            // Find patient's bed number
            let bedNumber = null;
            for (const [bed, data] of Object.entries(bedStates)) {
                if (data.patientId === patientId) {
                    bedNumber = parseInt(bed);
                    break;
                }
            }
            
            // Get the current medical problem and risk level
            const medicalProblem = medicalInfo.selectedProblem || null;
            const selectedRiskLevel = medicalInfo.selectedRiskLevel || 'low';
            
            // Get CURRENT DISPLAY TRUTH: What's actually shown in the UI risk level buttons
            const actualHeartLevel = this.getHeartMonitoringLevel(patientId) || 'low';
            const actualLungLevel = this.getLungMonitoringLevel(patientId) || 'low';
            const actualTempLevel = this.getTempMonitoringLevel(patientId) || 'low';
            
            console.log(`📊 DISPLAY TRUTH - Risk levels currently shown in UI for patient ${patientId}:`);
            console.log(`  - Heart (Circulatoir): ${actualHeartLevel}`);
            console.log(`  - Lung (Respiratoire): ${actualLungLevel}`);
            console.log(`  - Temp (Temperature): ${actualTempLevel}`);
            
            // Map the stored monitoring levels to the WebSocket risk levels structure
            const riskLevels = {
                circulatoir: actualHeartLevel,
                respiratoire: actualLungLevel,
                temperature: actualTempLevel
            };
            
            // Get CURRENT DISPLAY TRUTH: What's actually shown in the slider values
            // Priority: Current Target Ranges (what sliders display) > Any fallback
            let thresholds = {
                HR: { min: 70, max: 100 },
                BP_Mean: { min: 60, max: 90 },
                AF: { min: 12, max: 20 },
                Saturatie: { min: 92, max: 100 },
                Temperature: { min: 36.0, max: 38.5 }
            }; // Safe defaults only if no display values exist
            
            // CRITICAL: Use the values that are CURRENTLY DISPLAYED in sliders (stored target ranges)
            const currentlyDisplayedRanges = this.getCurrentTargetRanges(patientId);
            console.log(`🔍 DISPLAY TRUTH - Threshold ranges currently shown in sliders for patient ${patientId}:`, currentlyDisplayedRanges);
            
            // MANUAL OVERRIDE DETECTION: Check which parameters have manual overrides
            const manualOverrides = this.getManualOverrides(patientId);
            const hasManualOverrides = Object.keys(manualOverrides).length > 0;
            let manualOverrideMetadata = null;
            
            if (hasManualOverrides) {
                console.log(`🔧 MANUAL OVERRIDE DETECTED - Including override metadata in WebSocket message:`, manualOverrides);
                manualOverrideMetadata = {
                    hasManualOverrides: true,
                    overriddenParameters: Object.keys(manualOverrides),
                    overrideDetails: Object.keys(manualOverrides).reduce((details, param) => {
                        const override = manualOverrides[param];
                        details[param] = {
                            source: override.source,
                            timestamp: override.timestamp,
                            range: override.range
                        };
                        return details;
                    }, {})
                };
                console.log(`🔧 MANUAL OVERRIDE METADATA:`, manualOverrideMetadata);
            } else {
                console.log(`ℹ️ No manual overrides detected for patient ${patientId}`);
                manualOverrideMetadata = { hasManualOverrides: false };
            }
            
            if (currentlyDisplayedRanges && Object.keys(currentlyDisplayedRanges).length > 0) {
                console.log(`📊 Using DISPLAY TRUTH target ranges (what user sees in sliders):`, currentlyDisplayedRanges);
                thresholds = {
                    HR: currentlyDisplayedRanges.HR || thresholds.HR,
                    BP_Mean: currentlyDisplayedRanges.BP_Mean || thresholds.BP_Mean,
                    AF: currentlyDisplayedRanges.AF || thresholds.AF,
                    Saturatie: currentlyDisplayedRanges.Saturatie || thresholds.Saturatie,
                    Temperature: currentlyDisplayedRanges.Temperature || thresholds.Temperature
                };
                console.log(`🔍 FINAL DISPLAY TRUTH thresholds object:`, thresholds);
                
                // Log which thresholds come from manual overrides
                if (hasManualOverrides) {
                    Object.keys(manualOverrides).forEach(param => {
                        if (thresholds[param]) {
                            console.log(`🔧 MANUAL OVERRIDE: ${param} threshold (${thresholds[param].min}-${thresholds[param].max}) comes from manual override`);
                        }
                    });
                }
            } else {
                // Only fallback to calculated values if NO display values exist
                console.log(`⚠️ No display values found - falling back to calculated values for patient ${patientId}`);
                if (medicalProblem && medicalProblem !== 'none') {
                    let matrixRanges = this.getMatrixBasedBaseRanges(medicalProblem, selectedRiskLevel);
                    
                    // ENHANCED: Check for active condition tags (pneumonie, sepsis) that might affect thresholds
                    if (matrixRanges && Object.keys(matrixRanges).length > 0) {
                        console.log(`📊 Base matrix-based ranges for ${medicalProblem}:`, matrixRanges);
                        
                        // Check for active condition states that might require threshold adjustments
                        const activeTags = [];
                        const sepsisCondition = this.getPatientConditionState('sepsis', patientId);
                        if (sepsisCondition && sepsisCondition.isActive) {
                            activeTags.push('sepsis');
                        }
                        const pneumonieCondition = this.getPatientConditionState('pneumonie', patientId);
                        if (pneumonieCondition && pneumonieCondition.isActive) {
                            activeTags.push('pneumonie');
                        }
                        
                        // Apply tag-based adjustments if any active conditions found
                        if (activeTags.length > 0) {
                            console.log(`🏷️ Active condition tags found for threshold calculation:`, activeTags);
                            const tagAdjustments = this.calculateTagBasedParameterAdjustments(
                                activeTags, 
                                matrixRanges, 
                                {}, // Empty organ states for threshold calculation
                                selectedRiskLevel
                            );
                            if (tagAdjustments && tagAdjustments.adjustedRanges) {
                                matrixRanges = tagAdjustments.adjustedRanges;
                                console.log(`📊 Tag-adjusted ranges for WebSocket:`, matrixRanges);
                            }
                        }
                        
                        thresholds = {
                            HR: matrixRanges.HR || thresholds.HR,
                            BP_Mean: matrixRanges.BP_Mean || thresholds.BP_Mean,
                            AF: matrixRanges.AF || thresholds.AF,
                            Saturatie: matrixRanges.Saturatie || thresholds.Saturatie,
                            Temperature: matrixRanges.Temperature || thresholds.Temperature
                        };
                        
                        console.log(`📊 Using fallback matrix + tag-adjusted ranges for patient ${patientId}:`, thresholds);
                    }
                }
            }
            
            console.log(`📊 FINAL DISPLAY TRUTH thresholds for patient ${patientId}:`, thresholds);
            
            const config = {
                patientId: patientId,
                bedNumber: bedNumber,
                medicalProblem: medicalProblem,
                riskLevels: riskLevels,
                thresholds: thresholds,
                displayTruthSource: currentlyDisplayedRanges ? 'slider_values' : 'calculated_fallback',
                manualOverrides: manualOverrideMetadata
            };
            
            console.log(`✅ DISPLAY TRUTH configuration being returned for patient ${patientId}:`);
            console.log(`   📋 Medical Problem: ${medicalProblem}`);
            console.log(`   🏥 Bed Number: ${bedNumber}`);
            console.log(`   📊 Risk Levels: circulatoir=${riskLevels.circulatoir}, respiratoire=${riskLevels.respiratoire}, temperature=${riskLevels.temperature}`);
            console.log(`   ⚙️ Thresholds:`, thresholds);
            console.log(`   🎯 Data Source: ${config.displayTruthSource}`);
            console.log(`   🔧 Manual Overrides:`, manualOverrideMetadata);
            
            return config;
        } catch (error) {
            console.error('❌ Error collecting display truth medical configuration:', error);
            return null;
        }
    }

    /**
     * Send complete thresholds_risk_levels message with DISPLAY TRUTH data
     * Sends exactly what the user sees in the UI (sliders + risk level buttons)
     */
    sendFullThresholdsRiskLevels(patientId) {
        console.log(`📤 Sending DISPLAY TRUTH thresholds_risk_levels for patient ${patientId}`);
        
        // Collect the current DISPLAY TRUTH configuration
        console.log(`🎯 Collecting DISPLAY TRUTH configuration for patient ${patientId}`);
        
        const currentConfig = this.collectCurrentMedicalConfiguration(patientId);
        
        console.log(`🎯 DISPLAY TRUTH configuration collected:`, currentConfig);
        console.log(`🎯 DISPLAY TRUTH thresholds:`, currentConfig?.thresholds);
        console.log(`🎯 DISPLAY TRUTH risk levels:`, currentConfig?.riskLevels);
        
        if (!currentConfig) {
            console.error('❌ Could not collect DISPLAY TRUTH configuration for patient:', patientId);
            return;
        }
        
        // Format thresholds with units
        const formattedThresholds = {};
        if (currentConfig.thresholds) {
            Object.keys(currentConfig.thresholds).forEach(param => {
                formattedThresholds[param] = {
                    min: currentConfig.thresholds[param].min,
                    max: currentConfig.thresholds[param].max,
                    unit: param === 'HR' ? 'bpm' : 
                          param === 'BP_Mean' ? 'mmHg' : 
                          param === 'AF' ? '/min' : 
                          param === 'Saturatie' ? '%' : 
                          param === 'Temperature' ? '°C' : ''
                };
            });
        }
        
        const messageData = {
            patientId: currentConfig.patientId,
            bedNumber: currentConfig.bedNumber,
            changeType: currentConfig.manualOverrides?.hasManualOverrides ? 'manual_override' : 'display_truth',
            medicalProblem: currentConfig.medicalProblem,
            riskLevels: currentConfig.riskLevels,
            thresholds: formattedThresholds,
            dataSource: currentConfig.displayTruthSource, // NEW: Indicates if from sliders or fallback
            manualOverrides: currentConfig.manualOverrides, // NEW: Manual override metadata
            timestamp: new Date().toISOString()
        };
        
        // Enhanced logging for manual overrides
        if (currentConfig.manualOverrides?.hasManualOverrides) {
            console.log(`� MANUAL OVERRIDE WebSocket: Sending manual override values for patient ${patientId}`);
            console.log(`🔧 Overridden parameters:`, currentConfig.manualOverrides.overriddenParameters);
            Object.keys(currentConfig.manualOverrides.overrideDetails).forEach(param => {
                const override = currentConfig.manualOverrides.overrideDetails[param];
                const threshold = currentConfig.thresholds[param];
                console.log(`🔧 ${param}: Manual override (${threshold?.min}-${threshold?.max}) from ${override.source} at ${override.timestamp}`);
            });
        } else {
            console.log(`📊 AUTOMATIC VALUES: Sending calculated/automatic threshold values for patient ${patientId}`);
        }
        
        console.log(`📤 Sending ${messageData.changeType} configuration (what user sees in UI):`, messageData);
        
        // Send the full configuration message
        this.sendWebSocketMessage('thresholds_risk_levels', messageData);
        
        console.log('✅ DISPLAY TRUTH thresholds_risk_levels message sent for patient:', patientId);
    }

    /**
     * Get patient medical information
     */
    getPatientMedicalInfo(patientId) {
        try {
            // Try centralized app data first
            const appData = this.getAppData();
            if (appData && appData.patients[patientId] && appData.patients[patientId].medicalInfo) {
                return appData.patients[patientId].medicalInfo;
            }

            // Fallback to legacy individual storage
            const patientKey = this.storageKeys.PATIENT_PREFIX + patientId + '_medicalInfo';
            const data = localStorage.getItem(patientKey);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('❌ Error getting patient medical info:', error);
            return null;
        }
    }

    /**
     * Save bed states
     */
    saveBedStates(bedStates) {
        try {
            // Get current bed states to detect changes
            const currentBedStates = this.getBedStates() || {};
            
            // Save individual bed states (legacy compatibility)
            localStorage.setItem(this.storageKeys.BED_STATES, JSON.stringify(bedStates));

            // Also save to centralized app data
            const appData = this.getAppData();
            if (appData) {
                appData.beds = bedStates;
                this.saveAppData(appData);
            }

            // Detect patient assignments/changes and send WebSocket messages
            this.detectAndSendBedChanges(currentBedStates, bedStates);

            return true;
        } catch (error) {
            console.error('❌ Error saving bed states:', error);
            return false;
        }
    }

    /**
     * Detect bed state changes and send appropriate WebSocket messages
     */
    detectAndSendBedChanges(oldBedStates, newBedStates) {
        try {
            for (const bedNumber in newBedStates) {
                const oldBed = oldBedStates[bedNumber] || {};
                const newBed = newBedStates[bedNumber];
                
                // Patient assigned to bed
                if (!oldBed.occupied && newBed.occupied && newBed.patientId) {
                    // Combine basic patient data and medical information
                    const basicPatientData = newBed.patientData || {};
                    const medicalInfo = this.getPatientMedicalInfo(newBed.patientId) || {};
                    
                    // Create comprehensive patient data for WebSocket message
                    const fullPatientData = {
                        id: newBed.patientId,
                        name: basicPatientData.name || `Patient ${newBed.patientId}`,
                        age: basicPatientData.age,
                        gender: basicPatientData.gender,
                        weight: basicPatientData.weight,
                        vpkCode: newBed.vpkCode,
                        riskLevel: newBed.riskLevel || 'mid',
                        // Include medical information if available
                        medicalInfo: medicalInfo,
                        // Include any additional patient characteristics
                        ...basicPatientData
                    };
                    
                    this.sendWebSocketMessage('patient_selected', {
                        patient: fullPatientData,
                        bedNumber: parseInt(bedNumber),
                        timestamp: new Date().toISOString(),
                        metadata: {
                            source: 'bed_overview',
                            action: 'patient_assignment'
                        }
                    });
                }
                
                // Patient discharged from bed
                if (oldBed.occupied && (!newBed.occupied || !newBed.patientId) && oldBed.patientId) {
                    this.sendWebSocketMessage('patient_discharged', {
                        patientId: oldBed.patientId,
                        bedNumber: parseInt(bedNumber),
                        reason: 'manual_discharge',
                        timestamp: new Date().toISOString(),
                        metadata: {
                            source: 'bed_overview',
                            action: 'patient_discharge'
                        }
                    });
                }
                
                // Patient transferred between beds
                if (oldBed.occupied && newBed.occupied && oldBed.patientId && newBed.patientId && 
                    oldBed.patientId !== newBed.patientId) {
                    // Send discharge for old patient
                    this.sendWebSocketMessage('patient_discharged', {
                        patientId: oldBed.patientId,
                        bedNumber: parseInt(bedNumber),
                        reason: 'patient_transfer',
                        timestamp: new Date().toISOString(),
                        metadata: {
                            source: 'bed_overview',
                            action: 'patient_transfer'
                        }
                    });
                    
                    // Send assignment for new patient
                    const basicPatientData = newBed.patientData || {};
                    const medicalInfo = this.getPatientMedicalInfo(newBed.patientId) || {};
                    
                    // Create comprehensive patient data for WebSocket message
                    const fullPatientData = {
                        id: newBed.patientId,
                        name: basicPatientData.name || `Patient ${newBed.patientId}`,
                        age: basicPatientData.age,
                        gender: basicPatientData.gender,
                        weight: basicPatientData.weight,
                        vpkCode: newBed.vpkCode,
                        riskLevel: newBed.riskLevel || 'mid',
                        // Include medical information if available
                        medicalInfo: medicalInfo,
                        // Include any additional patient characteristics
                        ...basicPatientData
                    };
                    
                    this.sendWebSocketMessage('patient_selected', {
                        patient: fullPatientData,
                        bedNumber: parseInt(bedNumber),
                        timestamp: new Date().toISOString(),
                        metadata: {
                            source: 'bed_overview',
                            action: 'patient_reassignment'
                        }
                    });
                }
            }
        } catch (error) {
            console.error('❌ Error detecting bed changes:', error);
        }
    }

    /**
     * Get bed states
     */
    getBedStates() {
        try {
            // Try centralized app data first
            const appData = this.getAppData();
            if (appData && appData.beds && Object.keys(appData.beds).length > 0) {
                return appData.beds;
            }

            // Fallback to legacy individual storage
            const data = localStorage.getItem(this.storageKeys.BED_STATES);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('❌ Error getting bed states:', error);
            return null;
        }
    }

    /**
     * Save session data (current patient, bed, risk level, etc.)
     */
    saveSessionData(sessionData) {
        try {
            // PATIENT SWITCH DETECTION: Check if patient is changing
            const previousPatient = localStorage.getItem(this.storageKeys.CURRENT_PATIENT);
            const newPatient = sessionData.currentPatient;
            
            if (previousPatient && newPatient && previousPatient !== newPatient) {
                console.log('👤 Patient switching detected:', previousPatient, '→', newPatient);
                // Clear manual adjustments for the previous patient
                this.clearPatientManualAdjustments(previousPatient);
                // Also clear manual adjustments for the new patient to start fresh
                this.clearPatientManualAdjustments(newPatient);
            }
            
            // Save individual session items (legacy compatibility)
            if (sessionData.currentPatient) {
                localStorage.setItem(this.storageKeys.CURRENT_PATIENT, sessionData.currentPatient);
            }
            if (sessionData.currentBed) {
                localStorage.setItem(this.storageKeys.CURRENT_BED, sessionData.currentBed);
            }
            if (sessionData.selectedRiskLevel) {
                localStorage.setItem(this.storageKeys.SELECTED_RISK_LEVEL, sessionData.selectedRiskLevel);
            }

            // Also save to centralized app data
            const appData = this.getAppData();
            if (appData) {
                appData.sessions.current = {
                    ...sessionData,
                    timestamp: new Date().toISOString()
                };
                this.saveAppData(appData);
            }

            return true;
        } catch (error) {
            console.error('❌ Error saving session data:', error);
            return false;
        }
    }

    /**
     * Get session data
     */
    getSessionData() {
        try {
            // Try centralized app data first
            const appData = this.getAppData();
            if (appData && appData.sessions && appData.sessions.current) {
                return appData.sessions.current;
            }

            // Fallback to legacy individual storage
            return {
                currentPatient: localStorage.getItem(this.storageKeys.CURRENT_PATIENT),
                currentBed: localStorage.getItem(this.storageKeys.CURRENT_BED),
                selectedRiskLevel: localStorage.getItem(this.storageKeys.SELECTED_RISK_LEVEL)
            };
        } catch (error) {
            console.error('❌ Error getting session data:', error);
            return {};
        }
    }

    /**
     * Clear session data
     */
    clearSessionData() {
        try {
            // Clear individual items (legacy compatibility)
            localStorage.removeItem(this.storageKeys.CURRENT_PATIENT);
            localStorage.removeItem(this.storageKeys.CURRENT_BED);
            localStorage.removeItem(this.storageKeys.SELECTED_RISK_LEVEL);

            // Clear from centralized app data
            const appData = this.getAppData();
            if (appData) {
                appData.sessions.current = null;
                this.saveAppData(appData);
            }

            return true;
        } catch (error) {
            console.error('❌ Error clearing session data:', error);
            return false;
        }
    }

    /**
     * Get all patients data
     */
    getAllPatients() {
        try {
            const appData = this.getAppData();
            if (appData && appData.patients) {
                return appData.patients;
            }

            // Fallback: scan localStorage for patient keys (limited for performance)
            const patients = {};
            const maxScans = Math.min(localStorage.length, 50); // Limit to 50 items max
            for (let i = 0; i < maxScans; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(this.storageKeys.PATIENT_PREFIX) && key.endsWith('_medicalInfo')) {
                    const patientId = key.replace(this.storageKeys.PATIENT_PREFIX, '').replace('_medicalInfo', '');
                    const data = localStorage.getItem(key);
                    if (data) {
                        patients[patientId] = {
                            medicalInfo: JSON.parse(data),
                            lastUpdated: new Date().toISOString()
                        };
                    }
                }
            }
            return patients;
        } catch (error) {
            console.error('❌ Error getting all patients:', error);
            return {};
        }
    }

    /**
     * Remove patient data
     */
    removePatient(patientId) {
        try {
            // Remove individual patient data (legacy compatibility)
            const patientMedicalKey = this.storageKeys.PATIENT_PREFIX + patientId + '_medicalInfo';
            const patientTargetRangesKey = this.storageKeys.PATIENT_PREFIX + patientId + '_targetRanges';
            const patientCirculatoirKey = this.storageKeys.PATIENT_PREFIX + patientId + '_circulatoirSettings';
            const patientHRBackupKey = this.storageKeys.PATIENT_PREFIX + patientId + '_hrBackup';
            
            localStorage.removeItem(patientMedicalKey);
            localStorage.removeItem(patientTargetRangesKey);
            localStorage.removeItem(patientCirculatoirKey);
            localStorage.removeItem(patientHRBackupKey);
            
            console.log('✅ Removed legacy patient keys:', {
                medical: patientMedicalKey,
                targetRanges: patientTargetRangesKey,
                circulatoir: patientCirculatoirKey,
                hrBackup: patientHRBackupKey
            });

            // Remove from centralized app data
            const appData = this.getAppData();
            if (appData && appData.patients[patientId]) {
                delete appData.patients[patientId];
                this.saveAppData(appData);
                console.log('✅ Removed patient from centralized app data');
            }
            
            // Clear any heart monitoring level data for this patient
            const heartLevelKey = `heartMonitoringLevel_${patientId}`;
            localStorage.removeItem(heartLevelKey);
            
            // Clear all parameter alarm states for this patient
            const parameters = ['HR', 'BP_Mean', 'Saturatie', 'AF', 'Temperature'];
            parameters.forEach(parameter => {
                const alarmKey = `patient-${patientId}-alarm-${parameter}`;
                localStorage.removeItem(alarmKey);
                console.log(`🔔 Removed alarm state for ${parameter}:`, alarmKey);
            });
            console.log('✅ Cleared all parameter alarm states for patient:', patientId);
            
            // Clear any session-specific data for this patient
            const sessionData = this.getSessionData();
            if (sessionData && sessionData.currentPatient === patientId) {
                this.clearSessionData();
                console.log('✅ Cleared session data for discharged patient');
            }

            console.log('✅ All patient data removed for:', patientId);
            return true;
        } catch (error) {
            console.error('❌ Error removing patient data:', error);
            return false;
        }
    }





    /**
     * Initialize data for index.html (patient setup page)
     */
    initializeIndexPage() {
        console.log('🏥 Initializing index page...');
        const sessionData = this.getSessionData();
        
        // If there's a current patient in session, load their data
        if (sessionData.currentPatient) {
            const medicalInfo = this.getPatientMedicalInfo(sessionData.currentPatient);
            console.log('📋 Found existing patient data for:', sessionData.currentPatient, medicalInfo);
            return {
                sessionData: sessionData,
                patientMedicalInfo: medicalInfo
            };
        }
        
        return { sessionData: sessionData };
    }

    /**
     * Initialize data for alarm-overview.html
     */
    initializeAlarmOverviewPage(patientId) {
        console.log('🚨 Initializing alarm overview page for patient:', patientId);
        
        // Get patient medical info
        const medicalInfo = this.getPatientMedicalInfo(patientId);
        const sessionData = this.getSessionData();
        
        return {
            sessionData: sessionData,
            patientMedicalInfo: medicalInfo
        };
    }

    /**
     * Initialize data for index.html
     */
    initializeBedOverviewPage() {
        console.log('🏥 Initializing bed overview page...');
        
        // Get bed states and all patient data
        const bedStates = this.getBedStates();
        const allPatients = this.getAllPatients();
        const sessionData = this.getSessionData();
        const availablePatients = this.getAvailablePatients();
        
        return {
            sessionData: sessionData,
            bedStates: bedStates || {},
            allPatients: allPatients,
            availablePatients: availablePatients
        };
    }

    /**
     * Get patient info by ID (from common patient data)
     */
    getPatientInfo(patientId) {
        const patients = {
            "1": { id: "1", name: "S. Groen", gender: "Vrouw", age: 16, weight: 55 },
            "2": { id: "2", name: "M. Demir", gender: "Man", age: 16, weight: 68 },
            "3": { id: "3", name: "A. De Bruijn", gender: "Man", age: 18, weight: 70 },
            "4": { id: "4", name: "B. Al Salah", gender: "Vrouw", age: 62, weight: 88 }
        };
        return patients[patientId] || null;
    }

    /**
     * Get all available patients
     */
    getAvailablePatients() {
        return [
            { id: "1", name: "S. Groen", gender: "Vrouw", age: 16, weight: 55 },
            { id: "2", name: "M. Demir", gender: "Man", age: 16, weight: 68 },
            { id: "3", name: "A. De Bruijn", gender: "Man", age: 18, weight: 70 },
            { id: "4", name: "B. Al Salah", gender: "Vrouw", age: 62, weight: 88 }
        ];
    }

    /**
     * Get hospital/bed configuration data
     */
    getHospitalData() {
        return {
            hospital: {
                name: "Academisch Ziekenhuis Utrecht",
                unit: "Intensive Care Unit",
                shift: "Nachtdienst"
            },
            beds: {
                total: 12,
                available: ["Bed 1", "Bed 2", "Bed 3", "Bed 4", "Bed 5", "Bed 6", 
                           "Bed 7", "Bed 8", "Bed 9", "Bed 10", "Bed 11", "Bed 12"]
            },
            patients: this.getAvailablePatients()
        };
    }

    /**
     * Get configuration data including circle configurations
     */
    getConfigData() {
        // Get current risk level for dynamic thresholds
        const currentRiskLevel = localStorage.getItem(this.storageKeys.SELECTED_RISK_LEVEL) || 'low';
        
        // Return the config data structure that matches config.json
        return {
            
            circleConfigurations: {
                "low": {
                    "darkerBlueSize": 0.9,
                    "darkerBlueOffset": 0.05,
                    "lightBlueSize": 0.8,
                    "lightBlueOffset": 0.1,
                    "whiteCenterSize": 0.3,
                    "whiteCenterOffset": 0.35
                },
                "mid": {
                    "darkerBlueSize": 0.8,
                    "darkerBlueOffset": 0.1,
                    "lightBlueSize": 0.6,
                    "lightBlueOffset": 0.2,
                    "whiteCenterSize": 0.3,
                    "whiteCenterOffset": 0.35
                },
                "high": {
                    "darkerBlueSize": 0.7,
                    "darkerBlueOffset": 0.15,
                    "lightBlueSize": 0.4,
                    "lightBlueOffset": 0.3,
                    "whiteCenterSize": 0.3,
                    "whiteCenterOffset": 0.35
                }
            },
            
            // Dynamic thresholds configuration - generated directly from Matrix system
            thresholds: this.getThresholdsConfiguration(currentRiskLevel)
        };
    }

    /**
     * Get Dynamic Thresholds Configuration
     * Generates thresholds configuration directly from the Matrix system
     * This eliminates duplicate data and ensures changes to the Matrix immediately take effect
     * @param {string} overallRiskLevel - Risk level for intensity scaling (default: 'low')
     * @returns {Object} - Dynamic thresholds configuration generated from Matrix
     */
    getThresholdsConfiguration(overallRiskLevel = 'low') {
        console.log(`📊 Generating dynamic thresholds configuration from Matrix (risk: ${overallRiskLevel})`);
        
        // Get base ranges from Matrix for each condition type
        const respiratoryRanges = this.getMatrixBasedBaseRanges('respiratoire-insufficientie', overallRiskLevel);
        const cardiacRanges = this.getMatrixBasedBaseRanges('hart-falen', overallRiskLevel);
        const sepsisRanges = this.getMatrixBasedBaseRanges('sepsis', overallRiskLevel);
        
        // Use respiratory ranges as "normal" baseline (most general condition)
        const normalRanges = respiratoryRanges;
        
        // Build dynamic configuration directly from Matrix
        const dynamicConfig = {
            normal: {
                circulatoir: {
                    HR: { min: normalRanges.HR?.min, max: normalRanges.HR?.max },
                    BP_Mean: { min: normalRanges.BP_Mean?.min, max: normalRanges.BP_Mean?.max }
                },
                respiratoire: {
                    AF: { min: normalRanges.AF?.min, max: normalRanges.AF?.max },
                    Saturatie: { min: normalRanges.Saturatie?.min, max: normalRanges.Saturatie?.max }
                },
                overige: {
                    Temperature: { min: normalRanges.Temperature?.min, max: normalRanges.Temperature?.max }
                }
            },
            conditions: {
                sepsis: {
                    circulatoir: {
                        HR: { min: sepsisRanges.HR?.min, max: sepsisRanges.HR?.max },
                        BP_Mean: { min: sepsisRanges.BP_Mean?.min, max: sepsisRanges.BP_Mean?.max }
                    }
                },
                pneumonie: {
                    respiratoire: {
                        // Pneumonia uses respiratory baseline from Matrix
                        AF: { min: respiratoryRanges.AF?.min, max: respiratoryRanges.AF?.max }
                    }
                }
            }
        };
        
        console.log(`✅ Dynamic thresholds generated from Matrix:`, dynamicConfig);
        console.log(`📋 Source Matrix ranges - Respiratory: HR(${normalRanges.HR?.min}-${normalRanges.HR?.max}), Sepsis: HR(${sepsisRanges.HR?.min}-${sepsisRanges.HR?.max})`);
        
        return dynamicConfig;
    }

    /**
     * Get circle configurations for organ components
     */
    getCircleConfigurations() {
        return this.getConfigData().circleConfigurations;
    }

    /**
     * Calculate organ states based on problem and risk level
     */
    calculateOrganStates(problem, riskLevel) {
        const config = this.getConfigData();
        const baseStates = config.organMappings.problems[problem] || { heart: 'mid', lung: 'mid', temp: 'mid' };
        const riskAdjustment = config.organMappings.riskAdjustments[riskLevel] || 0;
        
        const levels = ['low', 'mid', 'high'];
        const adjustLevel = (currentLevel) => {
            const currentIndex = levels.indexOf(currentLevel);
            const newIndex = Math.max(0, Math.min(2, currentIndex + riskAdjustment));
            return levels[newIndex];
        };

        return {
            heart: adjustLevel(baseStates.heart),
            lung: adjustLevel(baseStates.lung), 
            temp: adjustLevel(baseStates.temp)
        };
    }

    /**
     * Advanced Risk Management System
     * Explicit lookup table for all problem + risk level combinations
     * @param {string} problemValue - The medical problem ('respiratoire-insufficientie', 'hart-falen', 'sepsis', etc.)
     * @param {string} overallRiskLevel - The patient's overall risk level ('low', 'mid', 'high')
     * @returns {Object} - Calculated organ states and reasoning
     */
    calculateAdvancedOrganStates(problemValue, overallRiskLevel = 'low') {
        console.log(`🎯 Advanced Risk Calculation: Problem=${problemValue}, Overall Risk=${overallRiskLevel}`);
        
        // EXPLICIT LOOKUP TABLE - Define exact states for each combination
        const riskMatrix = {
            'respiratoire-insufficientie': {
                'low': {
                    heart: 'low',
                    lung: 'low',
                    temp: 'low',
                    reasoning: 'Respiratory problem with low risk - focus on lung monitoring only'
                },
                'mid': {
                    heart: 'low',
                    lung: 'mid', 
                    temp: 'low',
                    reasoning: 'Respiratory problem with medium risk - enhance cardiac monitoring as precaution'
                },
                'high': {
                    heart: 'mid',
                    lung: 'high',
                    temp: 'mid',
                    reasoning: 'Respiratory problem with high risk - intensive monitoring across systems'
                }
            },
            'hart-falen': {
                'low': {
                    heart: 'low',
                    lung: 'low',
                    temp: 'low',
                    reasoning: 'Heart failure with low risk - focus on cardiac monitoring only'
                },
                'mid': {
                    heart: 'mid',
                    lung: 'low',
                    temp: 'low',
                    reasoning: 'Heart failure with medium risk - monitor respiratory as secondary concern'
                },
                'high': {
                    heart: 'high',
                    lung: 'mid',
                    temp: 'mid',
                    reasoning: 'Heart failure with high risk - comprehensive monitoring due to systemic impact'
                }
            },
            'sepsis': {
                'low': {
                    heart: 'low',
                    lung: 'low',
                    temp: 'low',
                    reasoning: 'Sepsis with low risk - temperature priority with moderate systemic monitoring'
                },
                'mid': {
                    heart: 'mid',
                    lung: 'low',
                    temp: 'mid',
                    reasoning: 'Sepsis with medium risk - intensive cardiac and temperature monitoring'
                },
                'high': {
                    heart: 'high',
                    lung: 'mid', 
                    temp: 'high',
                    reasoning: 'Sepsis with high risk - maximum monitoring across all systems'
                }
            }
        };
        
        // Default states for unknown problems or no problem selected
        const defaultStates = {
            'low': { heart: 'low', lung: 'low', temp: 'low', reasoning: 'No specific problem - standard monitoring' },
            'mid': { heart: 'mid', lung: 'mid', temp: 'mid', reasoning: 'No specific problem - standard monitoring' },
            'high': { heart: 'high', lung: 'high', temp: 'high', reasoning: 'No specific problem but high risk - enhanced monitoring' }
        };
        
        // Get the exact combination or fall back to defaults
        const problemConfig = riskMatrix[problemValue];
        const config = problemConfig ? problemConfig[overallRiskLevel] : defaultStates[overallRiskLevel];
        
        if (!config) {
            console.warn(`⚠️ No configuration found for ${problemValue} + ${overallRiskLevel}, using safe defaults`);
            return {
                organStates: { heart: 'low', lung: 'low', temp: 'low' },
                reasoning: { approach: 'Safe defaults', details: 'Unknown configuration - using conservative monitoring' },
                riskLevel: overallRiskLevel
            };
        }
        
        const organStates = {
            heart: config.heart,
            lung: config.lung,
            temp: config.temp
        };
        
        const reasoning = {
            approach: `${problemValue} + ${overallRiskLevel} risk protocol`,
            details: config.reasoning
        };
        
        console.log(`✅ Explicit states for ${problemValue} + ${overallRiskLevel}:`, organStates);
        console.log(`📋 Reasoning:`, reasoning);
        
        return {
            organStates,
            reasoning,
            riskLevel: overallRiskLevel
        };
    }

    /**
     * Get Optimal Y-Axis Range for Parameter Sliders
     * Returns appropriate Y-axis bounds that encompass all possible values across different medical conditions
     * @param {string} parameter - Parameter name ('HR', 'BP_Mean', 'AF', 'Saturatie', 'Temperature')
     * @returns {Object} - Y-axis configuration with min, max, and step values
     */
    getOptimalYAxisRange(parameter) {
        // Define optimal Y-axis ranges based on medical knowledge and Matrix possibilities
        const yAxisRanges = {
            'HR': {
                min: 40,     // Updated y-axis range for HR slider
                max: 160,    // Updated y-axis range for HR slider
                step: 15     // Updated step size for HR slider
            },
            'BP_Mean': {
                min: 30,     // Updated y-axis range for BP slider
                max: 120,    // Updated y-axis range for BP slider
                step: 15     // Updated step size for BP slider
            },
            'AF': {
                min: 0,      // Keep AF slider as is
                max: 30,     // Keep AF slider as is
                step: 5      // Keep AF slider as is
            },
            'Saturatie': {
                min: 80,     // Accommodate severe hypoxemia
                max: 100,    // Normal maximum oxygen saturation
                step: 5      // Appropriate steps for oxygen saturation
            },
            'Temperature': {
                min: 35.0,   // Updated y-axis range for Temperature slider
                max: 40.0,   // Updated y-axis range for Temperature slider
                step: 0.5    // Updated step size for Temperature slider
            }
        };

        const range = yAxisRanges[parameter];
        if (!range) {
            console.warn(`⚠️ No Y-axis range defined for parameter: ${parameter}, using defaults`);
            return { min: 0, max: 100, step: 10 };
        }

        console.log(`📊 Optimal Y-axis range for ${parameter}:`, range);
        return range;
    }

    /**
     * Get Matrix-Based Base Ranges
     * Returns base parameter ranges from the matrix based on medical problem and risk level
     * This replaces hardcoded defaultRanges with proper matrix-derived values
     * @param {string} problemValue - The medical problem ('respiratoire-insufficientie', 'hart-falen', 'sepsis', etc.)
     * @param {string} overallRiskLevel - Risk level ('low', 'mid', 'high')
     * @returns {Object} - Base parameter ranges from the matrix, or empty object if invalid input
     */
    getMatrixBasedBaseRanges(problemValue, overallRiskLevel = 'low') {
        console.log(`📋 Getting matrix-based base ranges for: ${problemValue} + ${overallRiskLevel}`);
        console.log(`📋 Problem value details - Type: ${typeof problemValue}, Length: ${problemValue?.length}, Trimmed: "${problemValue?.trim()}"`);
        
        // If no medical problem selected, return default standard ranges for tag testing
        if (!problemValue || problemValue === '' || problemValue === 'none') {
            console.log('🚫 No medical problem specified - returning empty ranges (requires problem + risk level selection)');
            return {};
        }
        
        // Define target ranges for each problem based on the matrix
        // These ranges should ideally be further refined based on risk level in future iterations
        let baseRanges = {};
        
        // Normalize the problem value (trim whitespace, convert to lowercase for comparison)
        const normalizedProblem = problemValue.trim().toLowerCase();
        console.log(`📋 Normalized problem value for switch: "${normalizedProblem}"`);
        
        switch(normalizedProblem) {
            case 'respiratoire-insufficientie':
                baseRanges = {
                    HR: { min: 70, max: 100 },
                    BP_Mean: { min: 60, max: 90 },
                    AF: { min: 12, max: 20 },
                    Saturatie: { min: 92, max: 100 },
                    Temperature: { min: 36.0, max: 38.5 }
                };
                break;
                
            case 'hart-falen':
                baseRanges = {
                    HR: { min: 80, max: 120 },
                    BP_Mean: { min: 55, max: 75 },
                    AF: { min: 12, max: 18 },
                    Saturatie: { min: 92, max: 100 },
                    Temperature: { min: 36.0, max: 38.5 }
                };
                break;
                
            case 'sepsis':
                baseRanges = {
                    HR: { min: 70, max: 120 },
                    BP_Mean: { min: 50, max: 80 },
                    AF: { min: 12, max: 18 },
                    Saturatie: { min: 92, max: 100 },
                    Temperature: { min: 36.0, max: 38.5 }
                };
                break;
                
            default:
                // Unknown problem - return empty ranges to force proper selection
                console.error(`🚫 UNMATCHED PROBLEM VALUE: "${normalizedProblem}" (original: "${problemValue}")`);
                console.error(`🚫 Expected one of: 'respiratoire-insufficientie', 'hart-falen', 'sepsis'`);
                console.error(`🚫 Returning empty ranges to prevent errors`);
                return {};
        }
        
        console.log(`✅ Matrix-based base ranges for ${problemValue} + ${overallRiskLevel}:`, baseRanges);
        return baseRanges;
    }

    /**
     * Tag-Based Parameter Adjustment System - DELTA APPROACH
     * Delta-based adjustments that modify base parameters (determined by risk + problem combination)
     * @param {Array} activeTags - Array of active condition tags (['sepsis', 'pneumonie', etc.])
     * @param {Object} baseTargetRanges - Base target ranges to modify with deltas
     * @param {Object} baseOrganStates - Base organ monitoring levels to modify
     * @param {string} overallRiskLevel - Current overall risk level for intensity scaling
     * @returns {Object} - Modified target ranges, organ states, and reasoning
     */
    calculateTagBasedParameterAdjustments(activeTags = [], baseTargetRanges = {}, baseOrganStates = {}, overallRiskLevel = 'low') {
        console.log(`🏷️ Tag-Based DELTA Calculation: Tags=${JSON.stringify(activeTags)}, Risk=${overallRiskLevel}`);
        
        // TAG DELTA MATRIX - Define delta adjustments that modify base parameters
        const tagMatrix = {
            'sepsis': {
                description: 'Sepsis delta adjustments - affects circulatory system primarily',
                parameterDeltas: {
                    // BP_Mean affected significantly by sepsis (hypotension risk)
                    BP_Mean: {
                        low: { minDelta: -10, maxDelta: -10, reasoning: 'Sepsis - hypotension risk, lower BP monitoring range' },
                        mid: { minDelta: -10, maxDelta: -10, reasoning: 'Sepsis - moderate hypotension risk' },
                        high: { minDelta: -10, maxDelta: -10, reasoning: 'Sepsis - severe hypotension risk, significantly lower range' }
                    },
                    // HR affected (tachycardia compensation)  
                    HR: {
                        low: { minDelta: 0, maxDelta: 20, reasoning: 'Sepsis - mild tachycardia compensation' },
                        mid: { minDelta: 0, maxDelta: 20, reasoning: 'Sepsis - moderate tachycardia expected' },
                        high: { minDelta: 0, maxDelta: 20, reasoning: 'Sepsis - significant tachycardia monitoring' }
                    },
                    
                },
                // Monitoring level adjustments - increase circulatory monitoring by 1 level
                monitoringDeltas: {
                    heart: +1, // Increase circulatory monitoring level by 1 (low->mid, mid->high)
                    temp: +1,  // Increase temperature monitoring level by 1
                    reasoning: 'Sepsis requires enhanced circulatory monitoring due to hemodynamic instability'
                }
            },
            'pneumonie': {
                description: 'Pneumonia delta adjustments - affects respiratory system primarily',
                parameterDeltas: {
                    // AF significantly affected by pneumonia
                    AF: {
                        low: { minDelta: +0, maxDelta: +2, reasoning: 'Pneumonia - mild respiratory distress' },
                        mid: { minDelta: +0, maxDelta: +2, reasoning: 'Pneumonia - moderate respiratory compromise' },
                        high: { minDelta: +0, maxDelta: +2, reasoning: 'Pneumonia - severe respiratory distress' }
                    },
                    
                },
                // Monitoring level adjustments - increase respiratory monitoring by 1 level
                monitoringDeltas: {
                    lung: +1, // Increase respiratory monitoring level by 1 (low->mid, mid->high)
                    reasoning: 'Pneumonia requires enhanced respiratory monitoring due to pulmonary compromise'
                }
            }
        };
        
        // Start with base ranges and organ states
        let adjustedRanges = JSON.parse(JSON.stringify(baseTargetRanges));
        let adjustedOrganStates = JSON.parse(JSON.stringify(baseOrganStates));
        let appliedAdjustments = [];
        let reasoning = [];
        
        // Helper function to increase monitoring level by delta
        const adjustMonitoringLevel = (currentLevel, delta) => {
            const levels = ['low', 'mid', 'high'];
            const currentIndex = levels.indexOf(currentLevel);
            if (currentIndex === -1) return currentLevel; // Unknown level, return as-is
            
            const newIndex = Math.max(0, Math.min(levels.length - 1, currentIndex + delta));
            return levels[newIndex];
        };
        
        // Apply delta adjustments for each active tag
        activeTags.forEach(tag => {
            const tagConfig = tagMatrix[tag];
            if (!tagConfig) {
                console.warn(`⚠️ No delta adjustments defined for tag: ${tag}`);
                return;
            }
            
            console.log(`🏷️ Applying ${tag} delta adjustments for risk level: ${overallRiskLevel}`);
            
            // Apply parameter delta modifications for this tag
            if (tagConfig.parameterDeltas) {
                Object.entries(tagConfig.parameterDeltas).forEach(([parameter, riskLevels]) => {
                    console.log(`🔍 TAG DEBUG: Processing ${tag} → ${parameter}, available risk levels:`, Object.keys(riskLevels));
                    
                    const deltaConfig = riskLevels[overallRiskLevel];
                    console.log(`🔍 TAG DEBUG: Delta config for ${parameter} at risk ${overallRiskLevel}:`, deltaConfig);
                    
                    if (deltaConfig && adjustedRanges[parameter]) {
                        console.log(`🔍 TAG DEBUG: Current ${parameter} range before adjustment:`, adjustedRanges[parameter]);
                        
                        // Handle placeholder values - should not occur with proper matrix-based approach
                        let baseMin = adjustedRanges[parameter].min;
                        let baseMax = adjustedRanges[parameter].max;
                        
                        // If we have placeholder values ("-"), this indicates improper matrix usage
                        if (baseMin === '-' || baseMax === '-') {
                            console.warn(`⚠️ Placeholder values found for ${parameter} - this indicates missing problem + risk level selection. Tag adjustments require valid base ranges from matrix.`);
                            console.log(`❌ Skipping tag adjustment for ${parameter} - requires proper matrix-based base ranges`);
                            return; // Skip this parameter - matrix selection is required
                        }
                        
                        // Store original for comparison  
                        const original = { min: baseMin, max: baseMax };
                        
                        // Apply the delta adjustments
                        const newMin = original.min + deltaConfig.minDelta;
                        const newMax = original.max + deltaConfig.maxDelta;
                        
                        console.log(`🔍 TAG DEBUG: Applying ${tag} deltas to ${parameter}: ${original.min} + ${deltaConfig.minDelta} = ${newMin}, ${original.max} + ${deltaConfig.maxDelta} = ${newMax}`);
                        
                        adjustedRanges[parameter].min = newMin;
                        adjustedRanges[parameter].max = newMax;
                        
                        console.log(`🔍 TAG DEBUG: ${parameter} range after adjustment:`, adjustedRanges[parameter]);
                        
                        appliedAdjustments.push({
                            tag: tag,
                            parameter: parameter,
                            original: original,
                            deltas: { minDelta: deltaConfig.minDelta, maxDelta: deltaConfig.maxDelta },
                            adjusted: { min: newMin, max: newMax },
                            reasoning: deltaConfig.reasoning,
                            usedDefaults: (baseMin !== adjustedRanges[parameter].min || baseMax !== adjustedRanges[parameter].max)
                        });
                        
                        reasoning.push(`${parameter}: ${deltaConfig.reasoning} (${original.min}→${newMin}, ${original.max}→${newMax})`);
                        
                        console.log(`✅ ${tag} → ${parameter}: ${original.min}-${original.max} + (${deltaConfig.minDelta},${deltaConfig.maxDelta}) = ${newMin}-${newMax}`);
                    } else {
                        console.log(`🔍 TAG DEBUG: Skipping ${parameter} - deltaConfig:`, !!deltaConfig, 'adjustedRanges has parameter:', !!adjustedRanges[parameter]);
                        if (adjustedRanges[parameter]) {
                            console.log(`🔍 TAG DEBUG: ${parameter} range exists but no delta config:`, adjustedRanges[parameter]);
                        }
                    }
                });
            }
            
            // Apply monitoring level delta adjustments
            if (tagConfig.monitoringDeltas) {
                Object.entries(tagConfig.monitoringDeltas).forEach(([organ, delta]) => {
                    if (organ === 'reasoning') return; // Skip reasoning field
                    
                    if (adjustedOrganStates[organ] !== undefined) {
                        const originalLevel = adjustedOrganStates[organ];
                        const newLevel = adjustMonitoringLevel(originalLevel, delta);
                        
                        if (newLevel !== originalLevel) {
                            adjustedOrganStates[organ] = newLevel;
                            
                            appliedAdjustments.push({
                                tag: tag,
                                organ: organ,
                                originalLevel: originalLevel,
                                delta: delta,
                                newLevel: newLevel,
                                reasoning: tagConfig.monitoringDeltas.reasoning
                            });
                            
                            reasoning.push(`${organ} monitoring: ${originalLevel}→${newLevel} (${tagConfig.monitoringDeltas.reasoning})`);
                            
                            console.log(`✅ ${tag} → ${organ} monitoring: ${originalLevel} + ${delta} = ${newLevel}`);
                        } else {
                            console.log(`ℹ️ ${tag} → ${organ} monitoring: ${originalLevel} + ${delta} = ${newLevel} (no change - already at limit)`);
                        }
                    }
                });
            }
        });
        
        const summary = {
            approach: activeTags.length > 0 ? `Delta adjustments for: ${activeTags.join(', ')}` : 'No tag adjustments',
            details: reasoning.join('; '),
            tagsProcessed: activeTags,
            adjustmentsCount: appliedAdjustments.length
        };
        
        console.log(`✅ Tag delta adjustments applied:`, summary);
        
        return {
            adjustedRanges,
            adjustedOrganStates,
            appliedAdjustments,
            reasoning: summary,
            originalRanges: baseTargetRanges,
            originalOrganStates: baseOrganStates
        };
    }

    /**
     * Apply problem-specific monitoring levels and target ranges
     * This function is used by both setup.html and alarm-overview.html for consistency
     * @param {string} problemValue - The selected problem ('respiratoire-insufficientie', 'hart-falen', 'sepsis')
     * @param {Object} organComponents - The organ circle components from the page (optional)
     * @param {string} patientId - The current patient ID for saving target ranges (optional)
     * @param {string} overallRiskLevel - The patient's overall risk level ('low', 'mid', 'high') (optional)
     * @returns {Object} - Object containing organStates, targetRanges, and reasoning
     */
    applyProblemSpecificMonitoring(problemValue, organComponents = null, patientId = null, overallRiskLevel = null, shouldOverwriteManualAdjustments = true) {
        console.log('🎯 Applying problem-specific monitoring for:', problemValue, '- Should overwrite manual adjustments:', shouldOverwriteManualAdjustments);
        
        // Get current risk level from localStorage if not provided
        if (!overallRiskLevel) {
            overallRiskLevel = localStorage.getItem(this.storageKeys.SELECTED_RISK_LEVEL) || 'low';
        }
        
        // Use advanced risk calculation system
        const riskCalculation = this.calculateAdvancedOrganStates(problemValue, overallRiskLevel);
        let organStates = riskCalculation.organStates;
        let targetRanges = {};
        
        // Get target ranges from the matrix based on problem and risk level
        console.log('🎯 Getting matrix-based target ranges for problem:', problemValue);
        console.log('🎯 Problem value type:', typeof problemValue, 'length:', problemValue?.length, 'trimmed:', problemValue?.trim());
        
        if (!problemValue || problemValue === '' || problemValue === 'none') {
            // No main problem selected - return empty ranges to force matrix selection
            console.log('⚠️ No problem value provided - returning empty ranges (requires problem + risk selection)');
            targetRanges = {};
        } else {
            // Get base ranges from matrix
            const baseRanges = this.getMatrixBasedBaseRanges(problemValue, overallRiskLevel);
            
            console.log('🔍 DEBUG: baseRanges returned from matrix:', baseRanges);
            console.log('🔍 DEBUG: baseRanges is empty?', Object.keys(baseRanges).length === 0);
            
            // CRITICAL FIX: Check if baseRanges is empty (switch didn't match)
            if (!baseRanges || Object.keys(baseRanges).length === 0) {
                console.error('❌ CRITICAL: getMatrixBasedBaseRanges returned empty object for problem:', problemValue);
                console.error('❌ This means the switch statement did not match the problem value');
                console.error('❌ Returning empty targetRanges to prevent errors');
                targetRanges = {};
            } else {
                // Add units to the base ranges with defensive checks
                targetRanges = {
                    HR: baseRanges.HR ? { min: baseRanges.HR.min, max: baseRanges.HR.max, unit: 'bpm' } : { min: 70, max: 100, unit: 'bpm' },
                    BP_Systolic: baseRanges.BP_Mean ? { min: baseRanges.BP_Mean.min + 35, max: baseRanges.BP_Mean.max + 55, unit: 'mmHg' } : { min: 100, max: 140, unit: 'mmHg' },
                    BP_Diastolic: baseRanges.BP_Mean ? { min: baseRanges.BP_Mean.min, max: baseRanges.BP_Mean.max, unit: 'mmHg' } : { min: 60, max: 90, unit: 'mmHg' },
                    BP_Mean: baseRanges.BP_Mean ? { min: baseRanges.BP_Mean.min, max: baseRanges.BP_Mean.max, unit: 'mmHg' } : { min: 60, max: 90, unit: 'mmHg' },
                    AF: baseRanges.AF ? { min: baseRanges.AF.min, max: baseRanges.AF.max, unit: '/min' } : { min: 12, max: 20, unit: '/min' },
                    Saturatie: baseRanges.Saturatie ? { min: baseRanges.Saturatie.min, max: baseRanges.Saturatie.max, unit: '%' } : { min: 92, max: 100, unit: '%' },
                    Temperature: baseRanges.Temperature ? { min: baseRanges.Temperature.min, max: baseRanges.Temperature.max, unit: '°C' } : { min: 36.0, max: 38.5, unit: '°C' }
                };
                
                console.log('📊 Matrix-derived ranges for', problemValue, '+ risk', overallRiskLevel, '- HR:', targetRanges.HR.min + '-' + targetRanges.HR.max, 'AF:', targetRanges.AF.min + '-' + targetRanges.AF.max);
            }
        }
        
        console.log(`🎯 Using MATRIX states for ${problemValue} + ${overallRiskLevel}:`, organStates);
        
        // APPLY TAG-BASED PARAMETER ADJUSTMENTS
        // Get active condition tags from patient data
        const patientData = patientId ? this.getPatientMedicalInfo(patientId) : null;
        const activeTags = [];
        
        // Check for active condition tags
        if (patientData) {
            // Check for sepsis tag
            const sepsisCondition = this.getPatientConditionState('sepsis', patientId);
            if (sepsisCondition && sepsisCondition.isActive) {
                activeTags.push('sepsis');
            }
            
            // Check for pneumonie tag  
            const pneumonieCondition = this.getPatientConditionState('pneumonie', patientId);
            if (pneumonieCondition && pneumonieCondition.isActive) {
                activeTags.push('pneumonie');
            }
            
            console.log(`🏷️ Active condition tags found:`, activeTags);
        }
        
        // Apply tag-based parameter adjustments to target ranges AND organ states
        if (activeTags.length > 0) {
            const tagAdjustments = this.calculateTagBasedParameterAdjustments(activeTags, targetRanges, organStates, overallRiskLevel);
            targetRanges = tagAdjustments.adjustedRanges;
            organStates = tagAdjustments.adjustedOrganStates; // Use adjusted organ states from tags
            
            console.log(`🏷️ Target ranges AND organ states adjusted by tags:`, {
                originalProblem: problemValue,
                activeTags: activeTags,
                adjustmentsApplied: tagAdjustments.appliedAdjustments.length,
                reasoning: tagAdjustments.reasoning,
                originalOrganStates: tagAdjustments.originalOrganStates,
                adjustedOrganStates: organStates
            });
        } else {
            console.log(`🏷️ No active condition tags - using base target ranges and organ states`);
        }
        
        // Apply the states to organ components if provided
        if (organComponents) {
            console.log('🔧 Organ components received, applying states:', organStates);
            console.log('🔧 Should overwrite manual adjustments:', shouldOverwriteManualAdjustments);
            
            if (organComponents.heart) {
                const currentHeartLevel = this.getHeartMonitoringLevel(patientId);
                const hasExplicitHeartLevel = this.hasExplicitHeartMonitoringLevel(patientId);
                const shouldUpdateHeart = shouldOverwriteManualAdjustments || !hasExplicitHeartLevel;
                
                console.log('🔧 Heart - Current level:', currentHeartLevel, 'Has explicit level:', hasExplicitHeartLevel, 'Should update:', shouldUpdateHeart);
                
                if (shouldUpdateHeart) {
                    console.log('🔧 Setting heart level from', organComponents.heart.getRiskLevel?.(), 'to', organStates.heart);
                    organComponents.heart.setRiskLevel(organStates.heart);
                    console.log('✅ Applied heart level:', organStates.heart, '- New level:', organComponents.heart.getRiskLevel?.());
                } else {
                    console.log('⏭️ Skipping heart update - manual adjustment preserved:', currentHeartLevel);
                }
            } else {
                console.warn('❌ Heart component not found in organComponents');
            }
            
            if (organComponents.lung) {
                const currentLungLevel = this.getLungMonitoringLevel(patientId);
                const hasExplicitLungLevel = this.hasExplicitLungMonitoringLevel(patientId);
                const shouldUpdateLung = shouldOverwriteManualAdjustments || !hasExplicitLungLevel;
                
                console.log('🔧 Lung - Current level:', currentLungLevel, 'Has explicit level:', hasExplicitLungLevel, 'Should update:', shouldUpdateLung);
                
                if (shouldUpdateLung) {
                    console.log('🔧 Setting lung level from', organComponents.lung.getRiskLevel?.(), 'to', organStates.lung);
                    organComponents.lung.setRiskLevel(organStates.lung);
                    console.log('✅ Applied lung level:', organStates.lung, '- New level:', organComponents.lung.getRiskLevel?.());
                } else {
                    console.log('⏭️ Skipping lung update - manual adjustment preserved:', currentLungLevel);
                }
            } else {
                console.warn('❌ Lung component not found in organComponents');
            }
            
            if (organComponents.temp) {
                const currentTempLevel = this.getTempMonitoringLevel(patientId);
                const hasExplicitTempLevel = this.hasExplicitTempMonitoringLevel(patientId);
                const shouldUpdateTemp = shouldOverwriteManualAdjustments || !hasExplicitTempLevel;
                
                console.log('🔧 Temp - Current level:', currentTempLevel, 'Has explicit level:', hasExplicitTempLevel, 'Should update:', shouldUpdateTemp);
                
                if (shouldUpdateTemp) {
                    console.log('🔧 Setting temp level from', organComponents.temp.getRiskLevel?.(), 'to', organStates.temp);
                    organComponents.temp.setRiskLevel(organStates.temp);
                    console.log('✅ Applied temp level:', organStates.temp, '- New level:', organComponents.temp.getRiskLevel?.());
                } else {
                    console.log('⏭️ Skipping temp update - manual adjustment preserved:', currentTempLevel);
                }
            } else {
                console.warn('❌ Temp component not found in organComponents');
            }
        } else {
            console.log('ℹ️ No organ components provided - calculating states only (normal for alarm-overview page)');
        }
        
        // Save target ranges for the patient if patientId is provided
        if (patientId && targetRanges) {
            this.savePatientTargetRanges(patientId, targetRanges);
            console.log('✅ Saved target ranges for patient:', patientId);
            
            // UPDATE GLOBAL VARIABLES: Simple approach - update global variables directly
            if (shouldOverwriteManualAdjustments) {
                console.log('🔄 Updating global variables with problem-specific defaults (overwriting manual adjustments)');
                
                // CLEAR SAVED CUSTOM SETTINGS: When problem changes, clear all saved manual adjustments
                // so sliders will use the new global defaults instead of old localStorage settings
                if (patientId) {
                    console.log('🗑️ Clearing saved custom slider settings for patient:', patientId);
                    
                    // Use the centralized clearing function
                    this.clearPatientManualAdjustments(patientId);
                    
                    // ADDITIONAL CLEARING: Clear any other possible localStorage keys
                    const allKeys = Object.keys(localStorage);
                    const patientKeys = allKeys.filter(key => key.includes(`patient-${patientId}-`));
                    patientKeys.forEach(key => {
                        if (key.includes('threshold') || key.includes('manual') || key.includes('MIN') || key.includes('MAX')) {
                            console.log('🗑️ Removing additional key:', key);
                            localStorage.removeItem(key);
                        }
                    });
                }
                
                // Update global variables with problem defaults
                if (targetRanges.HR && targetRanges.HR.min !== '-') {
                    window.HR_MIN = targetRanges.HR.min;
                    window.HR_MAX = targetRanges.HR.max;
                }
                if (targetRanges.BP_Mean && targetRanges.BP_Mean.min !== '-') {
                    window.BP_MIN = targetRanges.BP_Mean.min;
                    window.BP_MAX = targetRanges.BP_Mean.max;
                }
                if (targetRanges.AF && targetRanges.AF.min !== '-') {
                    window.AF_MIN = targetRanges.AF.min;
                    window.AF_MAX = targetRanges.AF.max;
                }
                if (targetRanges.Saturatie && targetRanges.Saturatie.min !== '-') {
                    window.SAT_MIN = targetRanges.Saturatie.min;
                    window.SAT_MAX = targetRanges.Saturatie.max;
                }
                if (targetRanges.Temperature && targetRanges.Temperature.min !== '-') {
                    window.TEMP_MIN = targetRanges.Temperature.min;
                    window.TEMP_MAX = targetRanges.Temperature.max;
                }
                
                // Save to localStorage
                this.saveGlobalParameterVariables();
                console.log('📊 Global variables updated with main problem defaults');
                console.log('🗑️ Cleared saved custom settings - sliders will use new defaults');
            } else {
                console.log('🔒 Preserving existing manual adjustments - not overwriting global variables');
            }
        }
        
        // Store the applied states for other pages to access
        const appData = this.getAppData();
        if (appData) {
            appData.currentOrganStates = organStates;
            appData.currentTargetRanges = targetRanges;
            this.saveAppData(appData);
        }
        
        // CRITICAL FIX: Also save target ranges to patient-specific storage
        // This ensures WebSocket messages reflect actual calculated values instead of defaults
        if (patientId && targetRanges && Object.keys(targetRanges).length > 0) {
            this.setCurrentTargetRanges(patientId, targetRanges, 'main-problem-change');
            console.log(`📊 FIXED: Saved calculated target ranges to patient-specific storage for WebSocket messaging`);
            console.log(`   Patient: ${patientId}`);
            console.log(`   Problem: ${problemValue}`);
            console.log(`   Risk Level: ${overallRiskLevel}`);
            console.log(`   Ranges:`, targetRanges);
        }
        
        // Dispatch global parameters changed event to notify all pages
        if (shouldOverwriteManualAdjustments) {
            setTimeout(() => {
                console.log('🔄 About to dispatch globalParametersChanged event');
                console.log('📊 Current global variables after problem change:');
                console.log('   HR:', window.HR_MIN, '-', window.HR_MAX);
                console.log('   BP:', window.BP_MIN, '-', window.BP_MAX);
                console.log('   AF:', window.AF_MIN, '-', window.AF_MAX);
                console.log('   SAT:', window.SAT_MIN, '-', window.SAT_MAX);
                console.log('   TEMP:', window.TEMP_MIN, '-', window.TEMP_MAX);
                
                window.dispatchEvent(new CustomEvent('globalParametersChanged', {
                    detail: { 
                        source: 'problemChange',
                        problem: problemValue,
                        riskLevel: overallRiskLevel
                    }
                }));
                console.log('🔄 Dispatched globalParametersChanged event for problem change');
                
                // FORCE SLIDER REFRESH: Also try to update any currently loaded sliders
                // This handles cases where sliders are already loaded but not receiving events
                setTimeout(() => {
                    if (window.forceAllSlidersRefresh) {
                        console.log('🔄 Calling forceAllSlidersRefresh (respiratory)...');
                        window.forceAllSlidersRefresh();
                    }
                    if (window.forceTemperatureSliderRefresh) {
                        console.log('🔄 Calling forceTemperatureSliderRefresh (other)...');
                        window.forceTemperatureSliderRefresh();
                    }
                }, 50);
            }, 10);
        } else {
            console.log('⏸️ NOT dispatching globalParametersChanged - shouldOverwriteManualAdjustments is false');
        }
        
        // SYNC INDIVIDUAL MONITORING LEVELS: Update individual organ monitoring levels to match calculated states
        // BUT ONLY if we should overwrite manual adjustments OR no explicit level exists
        if (patientId && organStates) {
            console.log('🔄 Syncing individual monitoring levels with calculated organ states...');
            console.log('🔄 shouldOverwriteManualAdjustments:', shouldOverwriteManualAdjustments);
            
            // Update individual monitoring levels to match the calculated organ states
            // BUT respect manual adjustments
            if (organStates.heart) {
                const hasExplicitHeart = this.hasExplicitHeartMonitoringLevel(patientId);
                const shouldSyncHeart = shouldOverwriteManualAdjustments || !hasExplicitHeart;
                
                if (shouldSyncHeart) {
                    this.setHeartMonitoringLevel(patientId, organStates.heart);
                    console.log(`✅ Heart monitoring level synced to: ${organStates.heart}`);
                } else {
                    console.log(`⏭️ Skipping heart sync - manual adjustment preserved`);
                }
            }
            if (organStates.lung) {
                const hasExplicitLung = this.hasExplicitLungMonitoringLevel(patientId);
                const shouldSyncLung = shouldOverwriteManualAdjustments || !hasExplicitLung;
                
                if (shouldSyncLung) {
                    this.setLungMonitoringLevel(patientId, organStates.lung);
                    console.log(`✅ Lung monitoring level synced to: ${organStates.lung}`);
                } else {
                    console.log(`⏭️ Skipping lung sync - manual adjustment preserved`);
                }
            }
            if (organStates.temp) {
                const hasExplicitTemp = this.hasExplicitTempMonitoringLevel(patientId);
                const shouldSyncTemp = shouldOverwriteManualAdjustments || !hasExplicitTemp;
                
                if (shouldSyncTemp) {
                    this.setTempMonitoringLevel(patientId, organStates.temp);
                    console.log(`✅ Temp monitoring level synced to: ${organStates.temp}`);
                } else {
                    console.log(`⏭️ Skipping temp sync - manual adjustment preserved`);
                }
            }
            
            console.log('✅ Individual monitoring level sync completed (respecting manual adjustments)');
        }
        
        console.log('🎯 Problem-specific monitoring applied:', { organStates, targetRanges, reasoning: riskCalculation.reasoning });
        return { 
            organStates, 
            targetRanges, 
            reasoning: riskCalculation.reasoning,
            riskLevel: overallRiskLevel
        };
    }





    /**
     * Get Risk Management Overview
     * Provides a comprehensive overview of current risk settings and their impact
     * @param {string} problemValue - Current medical problem (optional)
     * @param {string} overallRiskLevel - Current overall risk level (optional)
     * @returns {Object} - Complete risk management overview
     */
    getRiskManagementOverview(problemValue = null, overallRiskLevel = null) {
        // Get current values from localStorage if not provided
        if (!problemValue) {
            const appData = this.getAppData();
            problemValue = appData?.currentProblem || 'none';
        }
        
        if (!overallRiskLevel) {
            overallRiskLevel = localStorage.getItem(this.storageKeys.SELECTED_RISK_LEVEL) || 'low';
        }
        
        // Get the advanced calculation
        const calculation = this.calculateAdvancedOrganStates(problemValue, overallRiskLevel);
        
        // Create human-readable summary
        const summary = {
            currentSettings: {
                medicalProblem: problemValue,
                overallRiskLevel: overallRiskLevel,
                timestamp: new Date().toLocaleString()
            },
            organMonitoring: {
                heart: {
                    level: calculation.organStates.heart,
                    description: this.getOrganLevelDescription('heart', calculation.organStates.heart)
                },
                lung: {
                    level: calculation.organStates.lung,
                    description: this.getOrganLevelDescription('lung', calculation.organStates.lung)
                },
                temperature: {
                    level: calculation.organStates.temp,
                    description: this.getOrganLevelDescription('temp', calculation.organStates.temp)
                }
            },
            riskReasoning: calculation.reasoning,
            recommendations: this.generateRiskRecommendations(calculation)
        };
        
        return summary;
    }
    
    /**
     * Generate human-readable descriptions for organ monitoring levels
     */
    getOrganLevelDescription(organ, level) {
        const descriptions = {
            heart: {
                low: 'Basic cardiac monitoring - standard parameters',
                mid: 'Enhanced cardiac monitoring - closer observation',
                high: 'Intensive cardiac monitoring - continuous attention'
            },
            lung: {
                low: 'Basic respiratory monitoring - standard parameters', 
                mid: 'Enhanced respiratory monitoring - closer observation',
                high: 'Intensive respiratory monitoring - continuous attention'
            },
            temp: {
                low: 'Basic temperature monitoring - routine checks',
                mid: 'Enhanced temperature monitoring - frequent checks', 
                high: 'Intensive temperature monitoring - continuous monitoring'
            }
        };
        
        return descriptions[organ]?.[level] || `${level} level monitoring`;
    }
    
    /**
     * Generate recommendations based on current risk calculation
     */
    generateRiskRecommendations(calculation) {
        const recommendations = [];
        
        // Problem-specific recommendations
        if (calculation.problemBaseline.primary === 'lung') {
            recommendations.push('Focus on respiratory parameters - this is the primary concern');
        }
        if (calculation.problemBaseline.primary === 'heart') {
            recommendations.push('Prioritize cardiovascular monitoring - this is the primary concern');
        }
        if (calculation.problemBaseline.primary === 'multi') {
            recommendations.push('Multi-system monitoring required - sepsis affects multiple organs');
        }
        
        // Risk level recommendations
        if (calculation.riskLevel === 'low') {
            recommendations.push('Standard monitoring protocol - focus on problem-specific parameters');
        } else if (calculation.riskLevel === 'mid') {
            recommendations.push('Enhanced monitoring - secondary systems require increased attention');
        } else if (calculation.riskLevel === 'high') {
            recommendations.push('Maximum monitoring protocol - all systems require intensive observation');
        }
        
        // Specific organ recommendations
        Object.entries(calculation.organStates).forEach(([organ, level]) => {
            if (level === 'high') {
                recommendations.push(`${organ.charAt(0).toUpperCase() + organ.slice(1)} requires intensive monitoring`);
            }
        });
        
        return recommendations;
    }
    
    /**
     * Update Overall Risk Level and Apply Changes
     * Updates the patient's overall risk level and immediately applies the new monitoring configuration
     * @param {string} newRiskLevel - New risk level ('low', 'mid', 'high')
     * @param {Object} organComponents - Page organ components (optional)
     * @param {string} patientId - Current patient ID (optional)
     * @returns {Object} - Updated monitoring configuration and impact summary
     */
    updateOverallRiskLevel(newRiskLevel, organComponents = null, patientId = null) {
        console.log(`🔄 Updating overall risk level from ${localStorage.getItem(this.storageKeys.SELECTED_RISK_LEVEL) || 'low'} to ${newRiskLevel}`);
        
        // Store the new risk level
        localStorage.setItem(this.storageKeys.SELECTED_RISK_LEVEL, newRiskLevel);
        
        // Get current problem
        const appData = this.getAppData();
        const currentProblem = appData?.currentProblem || 'none';
        
        // Apply the new monitoring configuration
        const updatedConfig = this.applyProblemSpecificMonitoring(
            currentProblem, 
            organComponents, 
            patientId, 
            newRiskLevel
        );
        
        // Get impact summary
        const overview = this.getRiskManagementOverview(currentProblem, newRiskLevel);
        
        console.log(`✅ Risk level updated successfully:`, overview);
        
        return {
            success: true,
            newConfiguration: updatedConfig,
            impactSummary: overview,
            changedFrom: localStorage.getItem(this.storageKeys.SELECTED_RISK_LEVEL),
            changedTo: newRiskLevel
        };
    }

    /**
     * Set organ settings (for compatibility with old dataManager)
     */
    setOrganSettings(organType, settings) {
        const appData = this.getAppData();
        if (!appData.organSettings) {
            appData.organSettings = {};
        }
        appData.organSettings[organType] = settings;
        this.saveAppData(appData);
        console.log(`Organ settings saved for ${organType}:`, settings);
    }

    /**
     * Get organ settings (for compatibility with old dataManager)
     */
    getOrganSettings() {
        const appData = this.getAppData();
        return appData.organSettings || {};
    }

    /**
     * Set heart monitoring level (loose, mid, tight)
     */
    setHeartMonitoringLevel(patientId, level) {
        const appData = this.getAppData();
        if (!appData.patients[patientId]) {
            appData.patients[patientId] = {};
        }
        if (!appData.patients[patientId].monitoring) {
            appData.patients[patientId].monitoring = {};
        }
        appData.patients[patientId].monitoring.heartLevel = level;
        this.saveAppData(appData);
        console.log(`Heart monitoring level set for patient ${patientId}:`, level);
        
        // Dispatch event for cross-page synchronization
        window.dispatchEvent(new CustomEvent('heartMonitoringLevelChanged', {
            detail: { patientId, level }
        }));
    }

    /**
     * Get heart monitoring level (returns 'mid' as default)
     */
    getHeartMonitoringLevel(patientId) {
        const appData = this.getAppData();
        const result = appData.patients?.[patientId]?.monitoring?.heartLevel || 'mid';
        console.log(`🔍 getHeartMonitoringLevel(${patientId}):`, result);
        console.log(`🔍 Full path check:`, {
            patients: !!appData.patients,
            patient: !!appData.patients?.[patientId], 
            monitoring: !!appData.patients?.[patientId]?.monitoring,
            heartLevel: appData.patients?.[patientId]?.monitoring?.heartLevel
        });
        return result;
    }

    /**
     * Check if heart monitoring level has been explicitly set (not just default)
     */
    hasExplicitHeartMonitoringLevel(patientId) {
        const appData = this.getAppData();
        const hasExplicitValue = appData.patients?.[patientId]?.monitoring?.heartLevel !== undefined;
        const actualValue = appData.patients?.[patientId]?.monitoring?.heartLevel;
        console.log(`🔍 hasExplicitHeartMonitoringLevel(${patientId}):`, {
            hasExplicitValue,
            actualValue,
            storageCheck: JSON.stringify(appData.patients?.[patientId]?.monitoring || {})
        });
        return hasExplicitValue;
    }

    /**
     * Set lung monitoring level (loose, mid, tight)
     */
    setLungMonitoringLevel(patientId, level) {
        const appData = this.getAppData();
        if (!appData.patients[patientId]) {
            appData.patients[patientId] = {};
        }
        if (!appData.patients[patientId].monitoring) {
            appData.patients[patientId].monitoring = {};
        }
        appData.patients[patientId].monitoring.lungLevel = level;
        this.saveAppData(appData);
        console.log(`Lung monitoring level set for patient ${patientId}:`, level);
        
        // Dispatch event for cross-page synchronization
        window.dispatchEvent(new CustomEvent('lungMonitoringLevelChanged', {
            detail: { patientId, level }
        }));
    }

    /**
     * Get lung monitoring level (returns 'mid' as default)
     */
    getLungMonitoringLevel(patientId) {
        const appData = this.getAppData();
        return appData.patients?.[patientId]?.monitoring?.lungLevel || 'mid';
    }

    /**
     * Check if lung monitoring level has been explicitly set (not just default)
     */
    hasExplicitLungMonitoringLevel(patientId) {
        const appData = this.getAppData();
        const hasExplicitValue = appData.patients?.[patientId]?.monitoring?.lungLevel !== undefined;
        const actualValue = appData.patients?.[patientId]?.monitoring?.lungLevel;
        console.log(`🔍 hasExplicitLungMonitoringLevel(${patientId}):`, {
            hasExplicitValue,
            actualValue,
            storageCheck: JSON.stringify(appData.patients?.[patientId]?.monitoring || {})
        });
        return hasExplicitValue;
    }

    /**
     * Set temp monitoring level (loose, mid, tight)
     */
    setTempMonitoringLevel(patientId, level) {
        const appData = this.getAppData();
        if (!appData.patients[patientId]) {
            appData.patients[patientId] = {};
        }
        if (!appData.patients[patientId].monitoring) {
            appData.patients[patientId].monitoring = {};
        }
        appData.patients[patientId].monitoring.tempLevel = level;
        this.saveAppData(appData);
        console.log(`Temp monitoring level set for patient ${patientId}:`, level);
        
        // Dispatch event for cross-page synchronization
        window.dispatchEvent(new CustomEvent('tempMonitoringLevelChanged', {
            detail: { patientId, level }
        }));
    }

    /**
     * Get temp monitoring level (returns 'mid' as default)
     */
    getTempMonitoringLevel(patientId) {
        const appData = this.getAppData();
        return appData.patients?.[patientId]?.monitoring?.tempLevel || 'mid';
    }

    /**
     * Check if temp monitoring level has been explicitly set (not just default)
     */
    hasExplicitTempMonitoringLevel(patientId) {
        const appData = this.getAppData();
        const hasExplicitValue = appData.patients?.[patientId]?.monitoring?.tempLevel !== undefined;
        const actualValue = appData.patients?.[patientId]?.monitoring?.tempLevel;
        console.log(`🔍 hasExplicitTempMonitoringLevel(${patientId}):`, {
            hasExplicitValue,
            actualValue,
            storageCheck: JSON.stringify(appData.patients?.[patientId]?.monitoring || {})
        });
        return hasExplicitValue;
    }

    /**
     * Get effective monitoring levels including tag-based adjustments
     * This is what alarm-overview should use to get the real monitoring levels
     */
    getEffectiveMonitoringLevels(patientId) {
        console.log(`🔍 Calculating effective monitoring levels for patient ${patientId}`);
        
        if (!patientId) {
            console.warn('❌ No patient ID provided for effective monitoring levels');
            return { heart: 'low', lung: 'low', temp: 'low' };
        }
        
        // Get current medical problem and risk level
        const medicalInfo = this.getPatientMedicalInfo(patientId);
        const selectedProblem = medicalInfo?.selectedProblem || 'none';
        const selectedRiskLevel = medicalInfo?.selectedRiskLevel || 'low';
        
        // Get base monitoring levels (matrix-based or manual)
        let baseHeartLevel = this.getHeartMonitoringLevel(patientId);
        let baseLungLevel = this.getLungMonitoringLevel(patientId);
        let baseTempLevel = this.getTempMonitoringLevel(patientId);
        
        // If no explicit manual levels, use matrix-based defaults
        if (!this.hasExplicitHeartMonitoringLevel(patientId) && selectedProblem !== 'none') {
            const matrixStates = this.calculateAdvancedOrganStates(selectedProblem, selectedRiskLevel);
            baseHeartLevel = matrixStates.organStates?.heart || baseHeartLevel;
        }
        if (!this.hasExplicitLungMonitoringLevel(patientId) && selectedProblem !== 'none') {
            const matrixStates = this.calculateAdvancedOrganStates(selectedProblem, selectedRiskLevel);
            baseLungLevel = matrixStates.organStates?.lung || baseLungLevel;
        }
        if (!this.hasExplicitTempMonitoringLevel(patientId) && selectedProblem !== 'none') {
            const matrixStates = this.calculateAdvancedOrganStates(selectedProblem, selectedRiskLevel);
            baseTempLevel = matrixStates.organStates?.temp || baseTempLevel;
        }
        
        const baseOrganStates = {
            heart: baseHeartLevel,
            lung: baseLungLevel,
            temp: baseTempLevel
        };
        
        console.log(`🎯 Base monitoring levels:`, baseOrganStates);
        
        // Get active condition tags
        const activeTags = [];
        const sepsisCondition = this.getPatientConditionState('sepsis', patientId);
        if (sepsisCondition && sepsisCondition.isActive) {
            activeTags.push('sepsis');
        }
        const pneumonieCondition = this.getPatientConditionState('pneumonie', patientId);
        if (pneumonieCondition && pneumonieCondition.isActive) {
            activeTags.push('pneumonie');
        }
        
        console.log(`🏷️ Active tags for monitoring adjustment:`, activeTags);
        
        // Apply tag-based monitoring level adjustments
        let effectiveOrganStates = baseOrganStates;
        if (activeTags.length > 0) {
            const tagAdjustments = this.calculateTagBasedParameterAdjustments(
                activeTags, 
                {}, // Don't need parameter ranges, just monitoring levels
                baseOrganStates, 
                selectedRiskLevel
            );
            effectiveOrganStates = tagAdjustments.adjustedOrganStates;
            
            console.log(`🏷️ Tag-adjusted monitoring levels:`, {
                originalLevels: baseOrganStates,
                adjustedLevels: effectiveOrganStates,
                activeTags: activeTags,
                adjustmentsApplied: tagAdjustments.appliedAdjustments
            });
        } else {
            console.log(`🏷️ No active tags - using base monitoring levels`);
        }
        
        return {
            heart: effectiveOrganStates.heart || 'low',
            lung: effectiveOrganStates.lung || 'low', 
            temp: effectiveOrganStates.temp || 'low'
        };
    }

    /**
     * Get effective heart monitoring level including tag-based adjustments
     */
    getEffectiveHeartMonitoringLevel(patientId) {
        const levels = this.getEffectiveMonitoringLevels(patientId);
        console.log(`🔍 Effective heart monitoring level for ${patientId}: ${levels.heart}`);
        return levels.heart;
    }

    /**
     * Get effective lung monitoring level including tag-based adjustments
     */
    getEffectiveLungMonitoringLevel(patientId) {
        const levels = this.getEffectiveMonitoringLevels(patientId);
        console.log(`🔍 Effective lung monitoring level for ${patientId}: ${levels.lung}`);
        return levels.lung;
    }

    /**
     * Get effective temp monitoring level including tag-based adjustments
     */
    getEffectiveTempMonitoringLevel(patientId) {
        const levels = this.getEffectiveMonitoringLevels(patientId);
        console.log(`🔍 Effective temp monitoring level for ${patientId}: ${levels.temp}`);
        return levels.temp;
    }

    /**
     * Update heart monitoring level globally across all components
     */
    updateGlobalHeartMonitoringLevel(patientId, level) {
        // Save the level
        this.setHeartMonitoringLevel(patientId, level);
        
        // Update all heart circle components if they exist
        if (window.organComponents?.heart) {
            window.organComponents.heart.setRiskLevel(level);
        }
        if (window.circulatoirHeartCircle) {
            window.circulatoirHeartCircle.setRiskLevel(level);
        }
        
        // Trigger custom event for any other listeners
        const event = new CustomEvent('heartMonitoringLevelChanged', {
            detail: { patientId, level }
        });
        document.dispatchEvent(event);
        
        console.log(`Global heart monitoring level updated for patient ${patientId}:`, level);
    }

    updateGlobalLungMonitoringLevel(patientId, level) {
        // Save the level
        this.setLungMonitoringLevel(patientId, level);
        
        // Update all lung circle components if they exist
        if (window.organComponents?.lung) {
            window.organComponents.lung.setRiskLevel(level);
        }
        if (window.respiratoryLungCircle) {
            window.respiratoryLungCircle.setRiskLevel(level);
        }
        
        // Trigger custom event for any other listeners
        const event = new CustomEvent('lungMonitoringLevelChanged', {
            detail: { patientId, level }
        });
        document.dispatchEvent(event);
        
        console.log(`Global lung monitoring level updated for patient ${patientId}:`, level);
    }

    updateGlobalTempMonitoringLevel(patientId, level) {
        // Save the level
        this.setTempMonitoringLevel(patientId, level);
        
        // Update all temp circle components if they exist
        if (window.organComponents?.temp) {
            window.organComponents.temp.setRiskLevel(level);
        }
        if (window.tempCircle) {
            window.tempCircle.setRiskLevel(level);
        }
        
        // Trigger custom event for any other listeners
        const event = new CustomEvent('tempMonitoringLevelChanged', {
            detail: { patientId, level }
        });
        document.dispatchEvent(event);
        
        console.log(`Global temp monitoring level updated for patient ${patientId}:`, level);
    }

    /**
     * Set organ system monitoring level
     * @param {string} patientId - Patient ID
     * @param {string} organSystem - Organ system (circulatoir, respiratoir, overig)
     * @param {string} monitoringLevel - Monitoring level (los, mid, tight)
     */
    setOrganMonitoringLevel(patientId, organSystem, monitoringLevel) {
        const key = `patient-${patientId}-monitoring-${organSystem}`;
        localStorage.setItem(key, monitoringLevel);
        
        // Trigger event for cross-page synchronization
        const event = new CustomEvent('organMonitoringLevelChanged', {
            detail: { patientId, organSystem, monitoringLevel }
        });
        window.dispatchEvent(event);
        
        console.log(`📊 Monitoring level for ${organSystem} (patient ${patientId}): ${monitoringLevel}`);
    }

    /**
     * Get organ system monitoring level
     * @param {string} patientId - Patient ID
     * @param {string} organSystem - Organ system (circulatoir, respiratoir, overig)
     * @returns {string} - Monitoring level (los, mid, tight)
     */
    getOrganMonitoringLevel(patientId, organSystem) {
        const key = `patient-${patientId}-monitoring-${organSystem}`;
        const level = localStorage.getItem(key);
        
        if (level) {
            console.log(`📊 Retrieved monitoring level for ${organSystem}: ${level}`);
            return level;
        }
        
        // Return default based on selected problem and organ system
        const medicalInfo = this.getPatientMedicalInfo(patientId);
        const selectedProblem = medicalInfo?.selectedProblem;
        
        // Default monitoring levels based on medical conditions
        if (selectedProblem === 'respiratoire-insufficientie' && organSystem === 'circulatoir') {
            console.log(`📊 Default monitoring level for circulatoir with respiratory insufficiency: los`);
            return 'los';
        } else if (selectedProblem === 'sepsis' && ['circulatoir', 'respiratoir'].includes(organSystem)) {
            console.log(`📊 Default monitoring level for ${organSystem} with sepsis: tight`);
            return 'tight';
        } else if (selectedProblem === 'respiratoire-insufficientie' && organSystem === 'respiratoir') {
            // Check for pneumonie tag to adjust respiratory monitoring
            const pneumonieCondition = this.getPatientConditionState('pneumonie', patientId);
            if (pneumonieCondition && pneumonieCondition.isActive) {
                console.log(`📊 Default monitoring level for respiratoir with respiratory insufficiency + pneumonie tag: tight`);
                return 'tight';
            } else {
                console.log(`📊 Default monitoring level for respiratoir with respiratory insufficiency: mid`);
                return 'mid';
            }
        }
        
        // Default fallback
        console.log(`📊 Default monitoring level for ${organSystem}: mid`);
        return 'mid';
    }

    /**
     * Get all organ monitoring levels for a patient
     * @param {string} patientId - Patient ID
     * @returns {Object} - Object with monitoring levels for each organ system
     */
    getAllOrganMonitoringLevels(patientId) {
        return {
            circulatoir: this.getOrganMonitoringLevel(patientId, 'circulatoir'),
            respiratoir: this.getOrganMonitoringLevel(patientId, 'respiratoir'),
            overig: this.getOrganMonitoringLevel(patientId, 'overig')
        };
    }

    /**
     * Apply Tag-Based Parameter Adjustments
     * Triggers when condition tags (sepsis, pneumonie) are activated/deactivated
     * @param {string} patientId - Patient ID
     * @param {string} tag - Condition tag ('sepsis', 'pneumonie')
     * @param {boolean} isActive - Whether the tag is being activated or deactivated
     */
    applyTagParameterAdjustments(patientId, tag, isActive) {
        console.log(`🏷️ Applying tag parameter adjustments: ${tag} = ${isActive ? 'ACTIVE' : 'INACTIVE'} for patient ${patientId}`);
        
        // SET FLAG: Mark that tag parameter changes are in progress to prevent immediate websocket triggers
        sessionStorage.setItem('tagParameterChangeInProgress', 'true');
        console.log('🚩 SET tagParameterChangeInProgress flag - preventing immediate websocket triggers');
        
        if (!patientId) {
            console.warn('❌ No patient ID provided for tag parameter adjustments');
            // Clear flag on early return
            sessionStorage.removeItem('tagParameterChangeInProgress');
            return;
        }
        
        // Get current medical problem and risk level
        const medicalInfo = this.getPatientMedicalInfo(patientId);
        const selectedProblem = medicalInfo?.selectedProblem || 'none';
        const selectedRiskLevel = medicalInfo?.selectedRiskLevel || 'low';
        
        console.log(`🎯 Current context - Problem: ${selectedProblem}, Risk: ${selectedRiskLevel}, Tag: ${tag}`);
        
        // Re-apply problem-specific monitoring with current tag states
        // This will automatically pick up the new tag state and adjust parameters
        const result = this.applyProblemSpecificMonitoring(
            selectedProblem,
            null, // No organ components - just update parameters
            patientId,
            selectedRiskLevel,
            false // Don't overwrite manual adjustments, just update base parameters
        );
        
        console.log(`✅ Tag-based parameter adjustment completed:`, {
            tag: tag,
            isActive: isActive,
            appliedRanges: result.targetRanges,
            appliedOrganStates: result.organStates,
            reasoning: result.reasoning
        });
        
        // CRITICAL: Save tag-adjusted ranges to patient-specific storage for WebSocket messaging
        if (result.targetRanges && Object.keys(result.targetRanges).length > 0) {
            this.setCurrentTargetRanges(patientId, result.targetRanges, 'tag-adjustment');
            console.log(`📊 Saved tag-adjusted ranges to patient storage for WebSocket messaging`);
        }
        
        // UPDATE GLOBAL VARIABLES: Apply delta-adjusted ranges to global variables
        // so that sliders reflect the tag-adjusted parameter values
        if (result.targetRanges) {
            if (result.targetRanges.HR && result.targetRanges.HR.min !== '-') {
                window.HR_MIN = result.targetRanges.HR.min;
                window.HR_MAX = result.targetRanges.HR.max;
            }
            if (result.targetRanges.BP_Mean && result.targetRanges.BP_Mean.min !== '-') {
                window.BP_MIN = result.targetRanges.BP_Mean.min;
                window.BP_MAX = result.targetRanges.BP_Mean.max;
            }
            if (result.targetRanges.AF && result.targetRanges.AF.min !== '-') {
                window.AF_MIN = result.targetRanges.AF.min;
                window.AF_MAX = result.targetRanges.AF.max;
            }
            if (result.targetRanges.Saturatie && result.targetRanges.Saturatie.min !== '-') {
                window.SAT_MIN = result.targetRanges.Saturatie.min;
                window.SAT_MAX = result.targetRanges.Saturatie.max;
            }
            if (result.targetRanges.Temperature && result.targetRanges.Temperature.min !== '-') {
                window.TEMP_MIN = result.targetRanges.Temperature.min;
                window.TEMP_MAX = result.targetRanges.Temperature.max;
            }
            
            // Save updated global variables
            this.saveGlobalParameterVariables();
            console.log('💾 Updated global variables with tag-adjusted ranges');
        }
        
        // Dispatch event to notify all pages about parameter AND monitoring level changes
        // TIMING FIX: Delay WebSocket message to ensure organ state changes are applied first
        setTimeout(() => {
            // CLEAR FLAG: Tag parameter changes are now complete
            sessionStorage.removeItem('tagParameterChangeInProgress');
            console.log('🚩 CLEARED tagParameterChangeInProgress flag - enabling immediate websocket triggers');
            
            // CRITICAL FIX: Send WebSocket message AFTER organ state changes complete
            // This ensures external systems receive tag-adjusted thresholds AND updated monitoring levels
            console.log(`📤 Sending WebSocket message for tag-based parameter change: ${tag} = ${isActive ? 'ACTIVE' : 'INACTIVE'} (delayed for consistency)`);
            this.sendFullThresholdsRiskLevels(patientId);
            
            window.dispatchEvent(new CustomEvent('tagParametersChanged', {
                detail: { 
                    source: 'tagChange',
                    tag: tag,
                    changedTags: [tag], // Include changed tags for UI synchronization
                    isActive: isActive,
                    patientId: patientId,
                    parameters: result.targetRanges,
                    organStates: result.organStates
                }
            }));
            console.log(`🔄 Dispatched tagParametersChanged event for ${tag} with parameters AND organ states`);
            
            // Also dispatch global parameters changed event to update sliders
            window.dispatchEvent(new CustomEvent('globalParametersChanged', {
                detail: { 
                    source: 'tagChange',
                    tag: tag,
                    isActive: isActive,
                    patientId: patientId
                }
            }));
            console.log(`🔄 Dispatched globalParametersChanged event for tag-based slider updates`);
        }, 500); // INCREASED DELAY: Ensure all organ state changes and UI updates complete before WebSocket message
        
        return result;
    }

    /**
     * Toggle Condition Tag and Apply Parameter Changes
     * UNIFIED TAG HANDLING: Single source of truth for all pages
     * @param {string} patientId - Patient ID
     * @param {string} tag - Condition tag ('sepsis', 'pneumonie')
     * @param {boolean} isActive - Whether to activate or deactivate the tag
     */
    toggleConditionTag(patientId, tag, isActive) {
        console.log(`🏷️ UNIFIED TAG HANDLING: Toggling condition tag: ${tag} = ${isActive ? 'ON' : 'OFF'} for patient ${patientId}`);
        
        // CRITICAL: Check current state to prevent double toggling/stacking
        const currentState = this.getPatientConditionState(tag, patientId);
        if (currentState && currentState.isActive === isActive) {
            console.log(`⚠️ UNIFIED TAG: Tag ${tag} already in state ${isActive}, skipping to prevent stacking`);
            return { skipped: true, reason: 'already_in_state', currentState: currentState };
        }
        
        // MANUAL OVERRIDE CLEARING: Clear any manual overrides (fragile system)
        this.clearManualOverrides(patientId, `tag-${tag}-${isActive ? 'activated' : 'deactivated'}`);
        
        // Update the condition state - single source of truth
        this.setPatientConditionState(tag, {
            isActive: isActive,
            timestamp: new Date().toISOString(),
            triggeredBy: 'unified_toggle',
            patientId: patientId
        });
        
        // CRITICAL: Invalidate cache since base data changed
        this.invalidateEffectiveValuesCache(patientId);
        
        // Apply parameter adjustments based on ALL current tags (not just this one)
        const result = this.applyUnifiedTagAdjustments(patientId);
        
        console.log(`✅ UNIFIED TAG: Condition tag ${tag} ${isActive ? 'activated' : 'deactivated'} with unified parameter adjustments`);
        
        // Broadcast unified tag state change event
        this.broadcastUnifiedTagStateChange(patientId, tag, isActive);
        
        return result;
    }

    /**
     * Apply Unified Tag Adjustments
     * Recalculates all parameters from scratch based on current tag states
     * Prevents stacking by always starting from matrix base values
     * @param {string} patientId - Patient ID
     */
    applyUnifiedTagAdjustments(patientId) {
        console.log(`🔄 UNIFIED TAG: Applying unified tag adjustments for patient ${patientId}`);
        
        if (!patientId) {
            console.warn('❌ UNIFIED TAG: No patient ID provided');
            return null;
        }
        
        // SET FLAG: Mark that tag parameter changes are in progress
        sessionStorage.setItem('tagParameterChangeInProgress', 'true');
        console.log('🚩 UNIFIED TAG: SET tagParameterChangeInProgress flag');
        
        // Get current medical context
        const medicalInfo = this.getPatientMedicalInfo(patientId);
        const selectedProblem = medicalInfo?.selectedProblem || 'none';
        const selectedRiskLevel = medicalInfo?.selectedRiskLevel || 'low';
        
        // Get ALL currently active tags
        const activeTags = this.getAllActiveTagsForPatient(patientId);
        console.log(`🏷️ UNIFIED TAG: Active tags for ${patientId}:`, activeTags);
        
        // Start from MATRIX BASE VALUES - never from current values to prevent stacking
        const matrixBaseValues = this.getMatrixBasedBaseRanges(selectedProblem, selectedRiskLevel);
        const matrixOrganStates = this.calculateAdvancedOrganStates(selectedProblem, selectedRiskLevel);
        
        console.log(`📊 UNIFIED TAG: Starting from matrix base:`, { 
            problem: selectedProblem, 
            riskLevel: selectedRiskLevel, 
            matrixValues: matrixBaseValues,
            matrixOrganStates: matrixOrganStates.organStates
        });
        
        // Apply ALL tag adjustments to base values
        let finalRanges = { ...matrixBaseValues };
        let finalOrganStates = { ...matrixOrganStates.organStates };
        
        if (activeTags.length > 0) {
            const tagAdjustments = this.calculateTagBasedParameterAdjustments(
                activeTags,
                matrixBaseValues,
                matrixOrganStates.organStates,
                selectedRiskLevel
            );
            
            finalRanges = tagAdjustments.adjustedRanges;
            finalOrganStates = tagAdjustments.adjustedOrganStates;
            
            console.log(`🏷️ UNIFIED TAG: Applied adjustments for tags [${activeTags.join(', ')}]:`, {
                originalRanges: matrixBaseValues,
                finalRanges: finalRanges,
                originalOrganStates: matrixOrganStates.organStates,
                finalOrganStates: finalOrganStates,
                appliedAdjustments: tagAdjustments.appliedAdjustments
            });
        } else {
            console.log(`🏷️ UNIFIED TAG: No active tags - using matrix base values`);
        }
        
        // Update stored monitoring levels
        this.setHeartMonitoringLevel(patientId, finalOrganStates.heart, 'unified_tag_adjustment');
        this.setLungMonitoringLevel(patientId, finalOrganStates.lung, 'unified_tag_adjustment');
        this.setTempMonitoringLevel(patientId, finalOrganStates.temp, 'unified_tag_adjustment');
        
        // Update parameter ranges
        this.setCurrentTargetRanges(patientId, finalRanges, 'unified-tag-adjustment');
        
        // Update global variables for sliders
        this.updateGlobalVariablesFromRanges(finalRanges);
        
        console.log('💾 UNIFIED TAG: All storage operations completed');
        
        // CRITICAL FIX: Ensure storage is fully committed before UI reads from it
        // Use setTimeout to allow storage operations to complete
        setTimeout(() => {
            console.log('📡 UNIFIED TAG: Broadcasting UI update event after storage completion');
            
            // IMMEDIATE: Broadcast UI update event to all pages AFTER storage is complete
            window.dispatchEvent(new CustomEvent('unifiedTagUIUpdateRequired', {
                detail: {
                    patientId: patientId,
                    activeTags: activeTags,
                    targetRanges: finalRanges,
                    organStates: finalOrganStates,
                    timestamp: new Date().toISOString()
                }
            }));
            console.log('📡 UNIFIED TAG: Broadcasted immediate UI update event');
        }, 10); // Small delay to ensure storage operations complete
        
        // Delayed websocket trigger - increased delay to account for UI update timing
        setTimeout(() => {
            if (this.webSocketManager) {
                this.sendUnifiedTagWebSocketMessage(patientId, activeTags, finalRanges, finalOrganStates);
            } else {
                console.warn('⚠️ WebSocket manager not available - unified tag websocket message not sent');
            }
            
            // Clear flag
            sessionStorage.removeItem('tagParameterChangeInProgress');
            console.log('🚩 UNIFIED TAG: CLEARED tagParameterChangeInProgress flag');
        }, 520); // Slightly longer delay to ensure UI updates complete first
        
        return {
            targetRanges: finalRanges,
            organStates: finalOrganStates,
            activeTags: activeTags,
            reasoning: 'unified-tag-adjustment'
        };
    }

    /**
     * Get All Active Tags for Patient
     * @param {string} patientId - Patient ID
     * @returns {Array} - Array of active tag names
     */
    getAllActiveTagsForPatient(patientId) {
        const activeTags = [];
        
        // Check sepsis
        const sepsisState = this.getPatientConditionState('sepsis', patientId);
        if (sepsisState && sepsisState.isActive) {
            activeTags.push('sepsis');
        }
        
        // Check pneumonie
        const pneumonieState = this.getPatientConditionState('pneumonie', patientId);
        if (pneumonieState && pneumonieState.isActive) {
            activeTags.push('pneumonie');
        }
        
        // Add more tags here as needed
        
        return activeTags;
    }

    /**
     * Update Global Variables from Ranges
     * @param {Object} ranges - Parameter ranges object
     */
    updateGlobalVariablesFromRanges(ranges) {
        if (ranges.HR && ranges.HR.min !== '-') {
            window.HR_MIN = ranges.HR.min;
            window.HR_MAX = ranges.HR.max;
        }
        if (ranges.BP_Mean && ranges.BP_Mean.min !== '-') {
            window.BP_MIN = ranges.BP_Mean.min;
            window.BP_MAX = ranges.BP_Mean.max;
        }
        if (ranges.AF && ranges.AF.min !== '-') {
            window.AF_MIN = ranges.AF.min;
            window.AF_MAX = ranges.AF.max;
        }
        if (ranges.Saturatie && ranges.Saturatie.min !== '-') {
            window.SAT_MIN = ranges.Saturatie.min;
            window.SAT_MAX = ranges.Saturatie.max;
        }
        if (ranges.Temperature && ranges.Temperature.min !== '-') {
            window.TEMP_MIN = ranges.Temperature.min;
            window.TEMP_MAX = ranges.Temperature.max;
        }
        
        console.log('🔄 UNIFIED TAG: Updated global variables for sliders');
    }

    /**
     * Send Unified Tag WebSocket Message
     * @param {string} patientId - Patient ID
     * @param {Array} activeTags - Array of active tag names
     * @param {Object} ranges - Final parameter ranges
     * @param {Object} organStates - Final organ states
     */
    sendUnifiedTagWebSocketMessage(patientId, activeTags, ranges, organStates) {
        const bedStates = this.getBedStates() || {};
        let bedNumber = null;
        
        for (const [bed, data] of Object.entries(bedStates)) {
            if (data.patientId === patientId) {
                bedNumber = parseInt(bed);
                break;
            }
        }
        
        // Format thresholds with units
        const formattedThresholds = {};
        if (ranges) {
            Object.keys(ranges).forEach(param => {
                formattedThresholds[param] = {
                    min: ranges[param].min,
                    max: ranges[param].max,
                    unit: param === 'HR' ? 'bpm' : 
                          param === 'BP_Mean' ? 'mmHg' : 
                          param === 'AF' ? '/min' : 
                          param === 'Saturatie' ? '%' : 
                          param === 'Temperature' ? '°C' : ''
                };
            });
        }
        
        const messageData = {
            patientId: patientId,
            bedNumber: bedNumber,
            changeType: 'unified_tag_adjustment',
            activeTags: activeTags,
            riskLevels: {
                circulatoir: organStates.heart || 'mid',
                respiratoire: organStates.lung || 'mid',
                temperature: organStates.temp || 'mid'
            },
            thresholds: formattedThresholds,
            dataSource: 'unified_tag_system',
            timestamp: new Date().toISOString()
        };
        
        this.sendWebSocketMessage('thresholds_risk_levels', messageData);
        console.log('🚀 UNIFIED TAG: WebSocket message sent:', messageData);
    }

    /**
     * Broadcast Unified Tag State Change Event
     * @param {string} patientId - Patient ID
     * @param {string} tag - Tag name
     * @param {boolean} isActive - Whether tag is active
     */
    broadcastUnifiedTagStateChange(patientId, tag, isActive) {
        // Dispatch event for UI synchronization across pages
        window.dispatchEvent(new CustomEvent('unifiedTagStateChanged', {
            detail: {
                patientId: patientId,
                tag: tag,
                isActive: isActive,
                allActiveTags: this.getAllActiveTagsForPatient(patientId),
                timestamp: new Date().toISOString()
            }
        }));
        
        console.log(`📡 UNIFIED TAG: Broadcasted state change for ${tag} = ${isActive}`);
    }

    /**
     * Get Current Tag States for Patient
     * Returns object with all tag states for UI synchronization
     * @param {string} patientId - Patient ID
     * @returns {Object} - Object with tag names as keys and boolean states as values
     */
    getCurrentTagStatesForPatient(patientId) {
        if (!patientId) return {};
        
        const tagStates = {};
        
        // Get sepsis state
        const sepsisState = this.getPatientConditionState('sepsis', patientId);
        tagStates.sepsis = sepsisState ? sepsisState.isActive : false;
        
        // Get pneumonie state
        const pneumonieState = this.getPatientConditionState('pneumonie', patientId);
        tagStates.pneumonie = pneumonieState ? pneumonieState.isActive : false;
        
        // Add more tags here as the system expands
        
        console.log(`🏷️ UNIFIED TAG: Current tag states for ${patientId}:`, tagStates);
        return tagStates;
    }

    /**
     * Sync UI Elements with Current Tag States
     * Helper method to update UI elements across all pages
     * @param {string} patientId - Patient ID
     */
    syncUIWithTagStates(patientId) {
        const tagStates = this.getCurrentTagStatesForPatient(patientId);
        
        // Dispatch unified event for all pages to sync their UI
        window.dispatchEvent(new CustomEvent('unifiedTagStateSyncRequired', {
            detail: {
                patientId: patientId,
                tagStates: tagStates,
                timestamp: new Date().toISOString()
            }
        }));
        
        console.log(`🔄 UNIFIED TAG: Dispatched UI sync event for patient ${patientId}`);
    }

    /**
     * Revert to Matrix-Based Parameter Ranges
     * When a tag is deselected, automatically revert back to the parameter ranges 
     * that match the main medical problem and overall risk level combination 
     * as defined in the risk matrix (without tag delta adjustments)
     * @param {string} patientId - Patient ID
     * @param {string} deselectedTag - The tag that was just deselected
     * @returns {Object} - Updated target ranges and organ states
     */
    revertToMatrixBasedRanges(patientId, deselectedTag) {
        console.log(`🔄 Reverting to matrix-based ranges after deselecting tag: ${deselectedTag} for patient: ${patientId}`);
        
        if (!patientId) {
            console.warn('❌ No patient ID provided for matrix reversion');
            return null;
        }
        
        // Get current medical problem and risk level
        const medicalInfo = this.getPatientMedicalInfo(patientId);
        const selectedProblem = medicalInfo?.selectedProblem || 'none';
        const selectedRiskLevel = medicalInfo?.selectedRiskLevel || 'low';
        
        console.log(`🎯 Matrix reversion context - Problem: ${selectedProblem}, Risk: ${selectedRiskLevel}`);
        
        // Get base ranges and organ states from the matrix (without tag adjustments)
        const baseResult = this.applyProblemSpecificMonitoring(
            selectedProblem,
            null, // No organ components - just calculate ranges
            null, // Don't save yet - we'll save the final result
            selectedRiskLevel,
            false // Don't overwrite manual adjustments during calculation
        );
        
        // Get remaining active tags (excluding the deselected one)
        const remainingActiveTags = [];
        const allTags = ['sepsis', 'pneumonie']; // Add more as needed
        
        allTags.forEach(tag => {
            if (tag !== deselectedTag) {
                const conditionState = this.getPatientConditionState(tag, patientId);
                if (conditionState && conditionState.isActive) {
                    remainingActiveTags.push(tag);
                }
            }
        });
        
        console.log(`🏷️ Remaining active tags after deselecting ${deselectedTag}:`, remainingActiveTags);
        
        // Apply delta adjustments for remaining active tags only
        let finalRanges = baseResult.targetRanges;
        let finalOrganStates = baseResult.organStates;
        
        if (remainingActiveTags.length > 0) {
            const tagAdjustments = this.calculateTagBasedParameterAdjustments(
                remainingActiveTags, 
                baseResult.targetRanges, 
                baseResult.organStates, 
                selectedRiskLevel
            );
            
            finalRanges = tagAdjustments.adjustedRanges;
            finalOrganStates = tagAdjustments.adjustedOrganStates;
            
            console.log(`🏷️ Applied remaining tag adjustments:`, {
                remainingTags: remainingActiveTags,
                adjustmentsApplied: tagAdjustments.appliedAdjustments.length,
                reasoning: tagAdjustments.reasoning
            });
        } else {
            console.log(`📋 No remaining tags - using pure matrix-based ranges for ${selectedProblem} + ${selectedRiskLevel}`);
        }
        
        // Save the reverted ranges
        this.setPatientTargetRanges(patientId, finalRanges);
        
        // Update global variables to reflect the reverted ranges
        if (finalRanges.HR && finalRanges.HR.min !== '-') {
            window.HR_MIN = finalRanges.HR.min;
            window.HR_MAX = finalRanges.HR.max;
        }
        if (finalRanges.BP_Mean && finalRanges.BP_Mean.min !== '-') {
            window.BP_MIN = finalRanges.BP_Mean.min;
            window.BP_MAX = finalRanges.BP_Mean.max;
        }
        if (finalRanges.AF && finalRanges.AF.min !== '-') {
            window.AF_MIN = finalRanges.AF.min;
            window.AF_MAX = finalRanges.AF.max;
        }
        if (finalRanges.Saturatie && finalRanges.Saturatie.min !== '-') {
            window.SAT_MIN = finalRanges.Saturatie.min;
            window.SAT_MAX = finalRanges.Saturatie.max;
        }
        if (finalRanges.Temperature && finalRanges.Temperature.min !== '-') {
            window.TEMP_MIN = finalRanges.Temperature.min;
            window.TEMP_MAX = finalRanges.Temperature.max;
        }
        
        // Save updated global variables
        this.saveGlobalParameterVariables();
        
        const result = {
            targetRanges: finalRanges,
            organStates: finalOrganStates,
            reasoning: {
                approach: `Matrix reversion after deselecting ${deselectedTag}`,
                baseProblem: selectedProblem,
                riskLevel: selectedRiskLevel,
                remainingTags: remainingActiveTags,
                details: `Reverted to ${selectedProblem} + ${selectedRiskLevel} base ranges with remaining tag adjustments`
            }
        };
        
        console.log(`✅ Matrix-based reversion completed:`, result);
        
        // Dispatch events to update UI
        setTimeout(() => {
            window.dispatchEvent(new CustomEvent('tagParametersChanged', {
                detail: { 
                    source: 'matrixReversion',
                    deselectedTag: deselectedTag,
                    changedTags: [deselectedTag], // Include changed tags for UI synchronization
                    patientId: patientId,
                    parameters: finalRanges,
                    organStates: finalOrganStates
                }
            }));
            
            window.dispatchEvent(new CustomEvent('globalParametersChanged', {
                detail: { 
                    source: 'matrixReversion',
                    deselectedTag: deselectedTag,
                    patientId: patientId
                }
            }));
            
            console.log(`🔄 Dispatched matrix reversion events for ${deselectedTag}`);
        }, 10);
        
        return result;
    }

    /**
     * Update circulatory monitoring level and sync across pages
     * @param {string} patientId - Patient ID  
     * @param {string} level - Monitoring level (los, mid, tight)
     */
    updateCirculatoirMonitoringLevel(patientId, level) {
        // Save the organ system monitoring level
        this.setOrganMonitoringLevel(patientId, 'circulatoir', level);
        
        // Map to heart circle level for visual consistency
        const heartLevelMapping = {
            'los': 'low',
            'mid': 'mid', 
            'tight': 'high'
        };
        
        const heartLevel = heartLevelMapping[level] || level;
        
        // Update heart circle components
        if (window.organComponents?.heart) {
            window.organComponents.heart.setRiskLevel(heartLevel);
        }
        if (window.circulatoirHeartCircle) {
            window.circulatoirHeartCircle.setRiskLevel(heartLevel);
        }
        
        // Also update the heart monitoring level for consistency
        this.setHeartMonitoringLevel(patientId, heartLevel);
        
        // Trigger events for both monitoring levels
        document.dispatchEvent(new CustomEvent('heartMonitoringLevelChanged', {
            detail: { patientId, level: heartLevel }
        }));
        
        console.log(`✅ Circulatoir monitoring level updated for patient ${patientId}: ${level} (heart: ${heartLevel})`);
    }

    /**
     * Get threshold data for specific conditions (compatibility with old dataManager)
     */
    getThresholds(condition = 'normal') {
        const config = this.getConfigData();
        return config?.thresholds?.[condition] || config?.thresholds?.normal || {};
    }

    /**
     * Get organ mappings (compatibility with old dataManager)
     */
    getOrganMappings() {
        const config = this.getConfigData();
        return config?.organMappings || {};
    }

    /**
     * Get thresholds by tags (for dynamic threshold updates)
     * Now uses Matrix system exclusively - NO hardcoded fallbacks
     */
    getThresholdsByTags(tags) {
        const config = this.getConfigData();
        
        // Add error handling for missing thresholds configuration
        if (!config || !config.thresholds || !config.thresholds.normal) {
            console.warn('⚠️ Missing thresholds configuration in getConfigData() - using Matrix system');
            
            // Use Matrix system instead of hardcoded values
            const currentRiskLevel = localStorage.getItem(this.storageKeys.SELECTED_RISK_LEVEL) || 'low';
            const currentProblem = localStorage.getItem(this.storageKeys.SELECTED_PROBLEM) || '';
            
            if (currentProblem && currentProblem !== '' && currentProblem !== 'none') {
                const matrixRanges = this.getMatrixBasedBaseRanges(currentProblem, currentRiskLevel);
                console.log('📊 Using Matrix ranges as fallback:', matrixRanges);
                
                return {
                    circulatoir: {
                        HR: { min: matrixRanges.HR?.min, max: matrixRanges.HR?.max },
                        BP_Mean: { min: matrixRanges.BP_Mean?.min, max: matrixRanges.BP_Mean?.max }
                    },
                    respiratoire: {
                        AF: { min: matrixRanges.AF?.min, max: matrixRanges.AF?.max },
                        Saturatie: { min: matrixRanges.Saturatie?.min, max: matrixRanges.Saturatie?.max }
                    },
                    overige: {
                        Temperature: { min: matrixRanges.Temperature?.min, max: matrixRanges.Temperature?.max }
                    }
                };
            } else {
                console.log('🚫 No problem selected - returning empty thresholds (requires Matrix selection)');
                return {};
            }
        }
        
        const normalThresholds = config.thresholds.normal;
        
        // Check for sepsis tag
        const hasSepsis = tags.some(tag => tag.toLowerCase().includes('sepsis'));
        
        // Check for pneumonie tag
        const hasPneumonie = tags.some(tag => tag.toLowerCase().includes('pneumonie'));
        
        // Apply tag-specific thresholds using Matrix delta system
        if (hasSepsis && config.thresholds.conditions?.sepsis) {
            const sepsisThresholds = config.thresholds.conditions.sepsis;
            const result = {
                ...normalThresholds,
                circulatoir: {
                    ...normalThresholds.circulatoir,
                    ...sepsisThresholds.circulatoir
                }
            };
            console.log('🦠 Applied sepsis-specific thresholds from Matrix');
            return result;
        }
        
        if (hasPneumonie && config.thresholds.conditions?.pneumonie) {
            const pneumonieThresholds = config.thresholds.conditions.pneumonie;
            const result = {
                ...normalThresholds,
                respiratoire: {
                    ...normalThresholds.respiratoire,
                    ...pneumonieThresholds.respiratoire
                }
            };
            console.log('🫁 Applied pneumonie-specific thresholds from Matrix');
            return result;
        }
        
        return normalThresholds;
    }

    // ===================================================================
    // CENTRALIZED TARGET RANGE MANAGEMENT
    // ===================================================================

    /**
     * Get current target ranges for a patient (centralized source of truth)
     * @param {string} patientId - Patient identifier
     * @returns {Object} - Current target ranges for all parameters
     */
    getCurrentTargetRanges(patientId) {
        console.log(`🔍 CACHE DEBUG: getCurrentTargetRanges called for patient ${patientId}`);
        
        const key = `${this.storageKeys.PATIENT_PREFIX}${patientId}_current_target_ranges`;
        const stored = localStorage.getItem(key);
        
        let baseRanges;
        if (stored) {
            baseRanges = JSON.parse(stored);
            console.log('📊 Retrieved current target ranges for patient:', patientId, baseRanges);
        } else {
            // If no current ranges exist, initialize with defaults
            baseRanges = this.getDefaultTargetRanges();
            this.setCurrentTargetRanges(patientId, baseRanges);
            console.log('📊 Initialized default target ranges for patient:', patientId, baseRanges);
        }
        
        // MANUAL OVERRIDE SYSTEM: Apply manual overrides with priority
        console.log(`🔍 CACHE DEBUG: About to check for manual overrides for patient ${patientId}`);
        const manualOverrides = this.getManualOverrides(patientId);
        console.log(`🔍 CACHE DEBUG: Found manual overrides:`, manualOverrides);
        
        const finalRanges = this.applyManualOverridesToRanges(patientId, baseRanges);
        console.log(`🔍 CACHE DEBUG: Final ranges after applying manual overrides:`, finalRanges);
        
        return finalRanges;
    }

    /**
     * Set current target ranges for a patient (centralized source of truth)
     * @param {string} patientId - Patient identifier
     * @param {Object} targetRanges - Target ranges object
     * @param {string} source - Source of the change ('main-problem-change', 'slider-adjustment', etc.)
     */
    setCurrentTargetRanges(patientId, targetRanges, source = 'unknown') {
        const key = `${this.storageKeys.PATIENT_PREFIX}${patientId}_current_target_ranges`;
        localStorage.setItem(key, JSON.stringify(targetRanges));
        
        console.log('📊 Updated current target ranges for patient:', patientId, 'Source:', source, targetRanges);
        
        // Fire event to notify all pages of the change (but only for valid sources)
        if (source === 'main-problem-change' || source === 'slider-adjustment') {
            this.fireTargetRangesChangedEvent(patientId, targetRanges, source);
        }
    }

    /**
     * Update specific parameter in current target ranges
     * @param {string} patientId - Patient identifier
     * @param {string} parameter - Parameter name (HR, BP_Mean, AF, Saturatie, Temperature)
     * @param {Object} range - New range {min, max, unit}
     * @param {string} source - Source of the change
     */
    updateCurrentTargetRange(patientId, parameter, range, source = 'slider-adjustment') {
        const currentRanges = this.getCurrentTargetRanges(patientId);
        currentRanges[parameter] = range;
        this.setCurrentTargetRanges(patientId, currentRanges, source);
        
        console.log(`📊 Updated ${parameter} range for patient ${patientId}: ${range.min}-${range.max} ${range.unit}`);
    }

    /**
     * Fire targetRangesChanged event to notify all pages
     * @param {string} patientId - Patient identifier
     * @param {Object} targetRanges - Target ranges object
     * @param {string} source - Source of the change
     */
    fireTargetRangesChangedEvent(patientId, targetRanges, source) {
        console.log('🚀 ABOUT TO FIRE targetRangesChanged event:', { patientId, source });
        const event = new CustomEvent('targetRangesChanged', {
            detail: { 
                patientId, 
                targetRanges,
                source,
                timestamp: Date.now()
            }
        });
        console.log('🚀 Event created, dispatching now...');
        window.dispatchEvent(event);
        console.log('� Event DISPATCHED successfully:', { patientId, source, targetRanges });
    }

    /**
     * Save patient-specific circulatoir settings
     */
    savePatientCirculatoirSettings(patientId, circulatoirSettings) {
        try {
            const settingsKey = `${this.storageKeys.PATIENT_PREFIX}${patientId}_circulatoirSettings`;
            localStorage.setItem(settingsKey, JSON.stringify(circulatoirSettings));
            
            // Also save to centralized app data
            const appData = this.getAppData();
            if (appData) {
                if (!appData.patients[patientId]) {
                    appData.patients[patientId] = {};
                }
                appData.patients[patientId].circulatoirSettings = circulatoirSettings;
                appData.patients[patientId].lastUpdated = new Date().toISOString();
                this.saveAppData(appData);
            }
            
            console.log('✅ Circulatoir settings saved for patient:', patientId, circulatoirSettings);
            return true;
        } catch (error) {
            console.error('❌ Error saving circulatoir settings:', error);
            return false;
        }
    }

    /**
     * Get patient-specific circulatoir settings
     */
    getPatientCirculatoirSettings(patientId) {
        try {
            // Try centralized app data first
            const appData = this.getAppData();
            if (appData && appData.patients[patientId] && appData.patients[patientId].circulatoirSettings) {
                return appData.patients[patientId].circulatoirSettings;
            }
            
            // Fallback to individual storage
            const settingsKey = `${this.storageKeys.PATIENT_PREFIX}${patientId}_circulatoirSettings`;
            const data = localStorage.getItem(settingsKey);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('❌ Error getting circulatoir settings:', error);
            return null;
        }
    }

    /**
     * Save patient-specific respiratory settings
     */
    savePatientRespiratorySettings(patientId, respiratorySettings) {
        try {
            const settingsKey = `${this.storageKeys.PATIENT_PREFIX}${patientId}_respiratorySettings`;
            localStorage.setItem(settingsKey, JSON.stringify(respiratorySettings));
            
            // Also save to centralized app data
            const appData = this.getAppData();
            if (appData) {
                if (!appData.patients[patientId]) {
                    appData.patients[patientId] = {};
                }
                appData.patients[patientId].respiratorySettings = respiratorySettings;
                appData.patients[patientId].lastUpdated = new Date().toISOString();
                this.saveAppData(appData);
            }
            
            console.log('✅ Respiratory settings saved for patient:', patientId, respiratorySettings);
            return true;
        } catch (error) {
            console.error('❌ Error saving respiratory settings:', error);
            return false;
        }
    }

    /**
     * Get patient-specific respiratory settings
     */
    getPatientRespiratorySettings(patientId) {
        try {
            // Try centralized app data first
            const appData = this.getAppData();
            if (appData && appData.patients[patientId] && appData.patients[patientId].respiratorySettings) {
                return appData.patients[patientId].respiratorySettings;
            }
            
            // Fallback to individual storage
            const settingsKey = `${this.storageKeys.PATIENT_PREFIX}${patientId}_respiratorySettings`;
            const data = localStorage.getItem(settingsKey);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('❌ Error getting respiratory settings:', error);
            return null;
        }
    }

    /**
     * Save patient-specific other (temperature) settings
     */
    savePatientOtherSettings(patientId, otherSettings) {
        try {
            const settingsKey = `${this.storageKeys.PATIENT_PREFIX}${patientId}_otherSettings`;
            localStorage.setItem(settingsKey, JSON.stringify(otherSettings));
            
            // Also save to centralized app data
            const appData = this.getAppData();
            if (appData) {
                if (!appData.patients[patientId]) {
                    appData.patients[patientId] = {};
                }
                appData.patients[patientId].otherSettings = otherSettings;
                appData.patients[patientId].lastUpdated = new Date().toISOString();
                this.saveAppData(appData);
            }
            
            console.log('✅ Other settings saved for patient:', patientId, otherSettings);
            return true;
        } catch (error) {
            console.error('❌ Error saving other settings:', error);
            return false;
        }
    }

    /**
     * Get patient-specific other (temperature) settings
     */
    getPatientOtherSettings(patientId) {
        try {
            // Try centralized app data first
            const appData = this.getAppData();
            if (appData && appData.patients[patientId] && appData.patients[patientId].otherSettings) {
                return appData.patients[patientId].otherSettings;
            }
            
            // Fallback to individual storage
            const settingsKey = `${this.storageKeys.PATIENT_PREFIX}${patientId}_otherSettings`;
            const data = localStorage.getItem(settingsKey);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('❌ Error getting other settings:', error);
            return null;
        }
    }

    /**
     * Save patient-specific vital parameter target ranges
     */
    savePatientTargetRanges(patientId, targetRanges) {
        try {
            console.log('💾 Saving target ranges for patient:', patientId, targetRanges);
            
            // Save to individual storage for backwards compatibility
            const rangesKey = `${this.storageKeys.PATIENT_PREFIX}${patientId}_targetRanges`;
            localStorage.setItem(rangesKey, JSON.stringify(targetRanges));
            
            // Also save to centralized app data
            const appData = this.getAppData();
            if (appData) {
                if (!appData.patients[patientId]) {
                    appData.patients[patientId] = {};
                }
                appData.patients[patientId].targetRanges = targetRanges;
                appData.patients[patientId].lastUpdated = new Date().toISOString();
                this.saveAppData(appData);
            }
            
            // NOTE: Old event system - now handled by centralized fireTargetRangesChangedEvent
            // This method is called by the centralized system, so no need to fire additional events
            console.log('💾 Target ranges saved to storage for patient:', patientId);
            console.log('✅ Target ranges saved for patient:', patientId, targetRanges);
            return true;
        } catch (error) {
            console.error('❌ Error saving target ranges:', error);
            return false;
        }
    }

    /**
     * Set patient-specific vital parameter target ranges (alias for savePatientTargetRanges)
     * This method is used by some components that expect a 'set' method instead of 'save'
     */
    setPatientTargetRanges(patientId, targetRanges) {
        console.log('🔄 setPatientTargetRanges called - delegating to savePatientTargetRanges');
        return this.savePatientTargetRanges(patientId, targetRanges);
    }

    /**
     * Get patient-specific vital parameter target ranges
     */
    getPatientTargetRanges(patientId) {
        try {
            // Try centralized app data first
            const appData = this.getAppData();
            if (appData && appData.patients[patientId] && appData.patients[patientId].targetRanges) {
                return appData.patients[patientId].targetRanges;
            }
            
            // Fallback to individual storage
            const rangesKey = `${this.storageKeys.PATIENT_PREFIX}${patientId}_targetRanges`;
            const data = localStorage.getItem(rangesKey);
            return data ? JSON.parse(data) : this.getDefaultTargetRanges();
        } catch (error) {
            console.error('❌ Error getting target ranges:', error);
            return this.getDefaultTargetRanges();
        }
    }

    /**
     * Get default target ranges based on matrix system
     * This method should NOT provide hardcoded defaults as all ranges must come from the matrix
     * based on selected medical problem + risk level combination
     */
    getDefaultTargetRanges() {
        console.log('⚠️ getDefaultTargetRanges called - this should only be used as fallback when no problem is selected');
        
        // Check if we have an active problem and risk level selected
        const problemValue = localStorage.getItem(this.storageKeys.SELECTED_PROBLEM) || '';
        const overallRiskLevel = localStorage.getItem(this.storageKeys.SELECTED_RISK_LEVEL) || 'low';
        
        if (problemValue && problemValue !== '' && problemValue !== 'none') {
            console.log('📋 Using matrix-based ranges for selected problem:', problemValue, '+ risk:', overallRiskLevel);
            return this.getMatrixBasedBaseRanges(problemValue, overallRiskLevel);
        }
        
        // No problem selected - return empty ranges to force proper matrix selection
        console.log('🚫 No medical problem selected - returning empty ranges (requires problem + risk level selection for proper monitoring)');
        return {};
    }

    /**
     * Update target ranges based on medical condition (e.g., sepsis)
     */
    updateTargetRangesForCondition(patientId, condition) {
        try {
            console.log('🎯 Updating target ranges for condition:', condition, 'patient:', patientId);
            
            let targetRanges = this.getDefaultTargetRanges();
            
            // DISABLED: Sepsis no longer modifies target ranges
            // All condition-specific adjustments have been removed
            console.log('🔍 Condition adjustments disabled:', condition);
            
            // Save the updated ranges
            this.savePatientTargetRanges(patientId, targetRanges);
            
            console.log('✅ Target ranges updated for condition:', condition, targetRanges);
            return targetRanges;
        } catch (error) {
            console.error('❌ Error updating target ranges for condition:', error);
            return this.getDefaultTargetRanges();
        }
    }

    /**
     * Emit global target ranges update event
     */
    updateGlobalTargetRanges(patientId, targetRanges, source = 'legacy') {
        this.savePatientTargetRanges(patientId, targetRanges);
        
        // Set a timestamp for manual changes (to prioritize over automatic updates)
        sessionStorage.setItem('manualTargetRangesChange', Date.now().toString());
        
        // Use centralized event firing system with proper source tracking
        console.log('⚠️ DEPRECATED: updateGlobalTargetRanges called - use centralized system instead');
        console.log('🌐 Legacy global target ranges updated for patient:', patientId, 'Source:', source);
        
        // Only fire event for valid sources to maintain compatibility with centralized system
        if (source === 'main-problem-change' || source === 'slider-adjustment' || source === 'legacy') {
            this.fireTargetRangesChangedEvent(patientId, targetRanges, source);
        }
    }

    /**
     * Initialize global HR variables with Matrix-based default values
     * NO hardcoded values - uses Matrix system exclusively
     */
    initializeGlobalHRVariables() {
        // Get Matrix-based defaults instead of hardcoded values
        const currentProblem = localStorage.getItem(this.storageKeys.SELECTED_PROBLEM) || '';
        const currentRiskLevel = localStorage.getItem(this.storageKeys.SELECTED_RISK_LEVEL) || 'low';
        
        let matrixDefaults = {};
        if (currentProblem && currentProblem !== '' && currentProblem !== 'none') {
            matrixDefaults = this.getMatrixBasedBaseRanges(currentProblem, currentRiskLevel);
        } else {
            // Use respiratory-insufficientie as safe Matrix default
            matrixDefaults = this.getMatrixBasedBaseRanges('respiratoire-insufficientie', 'low');
        }
        
        if (!window.HR_low) {
            window.HR_low = matrixDefaults.HR?.min || 70; // Matrix-based default
        }
        if (!window.HR_high) {
            window.HR_high = matrixDefaults.HR?.max || 100; // Matrix-based default
        }
        console.log('🔧 Initialized global HR variables from Matrix:', window.HR_low, '-', window.HR_high);
    }

    /**
     * Save current HR values as backup before applying sepsis ranges
     * Now uses Matrix-based fallbacks instead of hardcoded values
     */
    saveHRBackup(patientId) {
        // Get current target ranges to backup both HR and BP
        const targetRanges = this.getPatientTargetRanges(patientId) || this.getDefaultTargetRanges();
        
        // Get Matrix-based fallbacks if targetRanges are empty
        const currentProblem = localStorage.getItem(this.storageKeys.SELECTED_PROBLEM) || '';
        const currentRiskLevel = localStorage.getItem(this.storageKeys.SELECTED_RISK_LEVEL) || 'low';
        
        let matrixFallbacks = {};
        if (currentProblem && currentProblem !== '' && currentProblem !== 'none') {
            matrixFallbacks = this.getMatrixBasedBaseRanges(currentProblem, currentRiskLevel);
        } else {
            matrixFallbacks = this.getMatrixBasedBaseRanges('respiratoire-insufficientie', 'low');
        }
        
        const backupData = {
            HR_low: targetRanges.HR?.min || window.HR_low || matrixFallbacks.HR?.min,
            HR_high: targetRanges.HR?.max || window.HR_high || matrixFallbacks.HR?.max,
            BP_low: targetRanges.BP_Mean?.min || matrixFallbacks.BP_Mean?.min,
            BP_high: targetRanges.BP_Mean?.max || matrixFallbacks.BP_Mean?.max,
            timestamp: new Date().toISOString()
        };
        
        const backupKey = `${this.storageKeys.PATIENT_PREFIX}${patientId}_hrBackup`;
        
        // Only save backup if it doesn't already exist (don't overwrite with sepsis values)
        const existingBackup = localStorage.getItem(backupKey);
        if (!existingBackup) {
            localStorage.setItem(backupKey, JSON.stringify(backupData));
            console.log('💾 HR backup saved for patient:', patientId, backupData);
        } else {
            console.log('ℹ️ HR backup already exists for patient:', patientId, '- not overwriting');
        }
        
        return backupData;
    }

    /**
     * Get HR backup values for restoration
     */
    getHRBackup(patientId) {
        try {
            const backupKey = `${this.storageKeys.PATIENT_PREFIX}${patientId}_hrBackup`;
            const data = localStorage.getItem(backupKey);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('❌ Error getting HR backup:', error);
            return null;
        }
    }

    /**
     * Clear HR backup (useful for testing or when patient state is reset)
     */
    clearHRBackup(patientId) {
        const backupKey = `${this.storageKeys.PATIENT_PREFIX}${patientId}_hrBackup`;
        localStorage.removeItem(backupKey);
        console.log('🗑️ Cleared HR backup for patient:', patientId);
    }

    /**
     * Apply sepsis HR ranges (90-130) and notify all pages
     * DISABLED: Now only maintains visual state, no range changes
     */
    applySepsisHRRanges(patientId) {
        // Keep the sepsis condition state for button appearance
        this.setPatientConditionState('sepsis', {
            patientId: patientId,
            isActive: true,
            timestamp: Date.now(),
            source: 'sepsis-selection'
        });
        
        console.log('🦠 Sepsis selected - visual state updated, but ranges unchanged');
        // No longer modifies target ranges or dispatches events
    }

    /**
     * Restore previous HR ranges when sepsis is deselected
     * DISABLED: Now only maintains visual state, no range changes
     */
    restorePreviousHRRanges(patientId) {
        // Keep the sepsis condition state for button appearance
        this.setPatientConditionState('sepsis', {
            patientId: patientId,
            isActive: false,
            timestamp: Date.now(),
            source: 'sepsis-deselection'
        });
        
        console.log('🔙 Sepsis deselected - visual state updated, but ranges unchanged');
        // No longer modifies target ranges or dispatches events
    }

    /**
     * Handle sepsis tag selection/deselection
     * DISABLED: Now only maintains visual state, no range changes
     */
    handleSepsisTagChange(patientId, isSelected) {
        if (isSelected) {
            this.applySepsisHRRanges(patientId);
        } else {
            this.restorePreviousHRRanges(patientId);
        }
        // Both methods now only handle visual state, not actual range changes
    }

    /**
     * Apply pneumonie-specific AF ranges (10-30 instead of 10-25)
     * DISABLED: Now only maintains visual state, no range changes
     */
    applyPneumonieAFRanges(patientId) {
        // Keep the pneumonie condition state for button appearance
        this.setPatientConditionState('pneumonie', {
            patientId: patientId,
            isActive: true,
            timestamp: Date.now(),
            source: 'pneumonie-selection'
        });
        
        console.log('🫁 Pneumonie selected - visual state updated, but AF ranges unchanged');
        // No longer modifies target ranges or dispatches events
    }

    /**
     * Restore previous AF ranges when pneumonie is deselected
     * DISABLED: Now only maintains visual state, no range changes
     */
    restorePreviousAFRanges(patientId) {
        // Keep the pneumonie condition state for button appearance
        this.setPatientConditionState('pneumonie', {
            patientId: patientId,
            isActive: false,
            timestamp: Date.now(),
            source: 'pneumonie-deselection'
        });
        
        console.log('🫁 Pneumonie deselected - visual state updated, but AF ranges unchanged');
        // No longer modifies target ranges or dispatches events
    }

    /**
     * Ensure patient has clean initial state for new setup
     * @param {string} patientId - Patient identifier
     * @param {boolean} forceClean - Force clean initialization even if data exists
     */
    ensureCleanPatientState(patientId, forceClean = false) {
        console.log(`🔍 Checking patient state for: ${patientId}`);
        
        const conditionsKey = `${this.storageKeys.PATIENT_PREFIX}${patientId}_conditions`;
        const existingConditions = localStorage.getItem(conditionsKey);
        
        // If no existing conditions or force clean requested, initialize clean states
        if (!existingConditions || forceClean) {
            console.log(`🧹 No existing conditions found or force clean requested for ${patientId}`);
            this.initializeCleanConditionStates(patientId);
            
            // Also ensure target ranges start with normal defaults
            const targetRangesKey = `${this.storageKeys.PATIENT_PREFIX}${patientId}_targetRanges`;
            const existingRanges = localStorage.getItem(targetRangesKey);
            if (!existingRanges || forceClean) {
                const cleanRanges = this.getDefaultTargetRanges();
                localStorage.setItem(targetRangesKey, JSON.stringify(cleanRanges));
                console.log(`✅ Clean target ranges initialized for ${patientId}:`, cleanRanges);
            }
        } else {
            console.log(`✅ Existing condition states found for ${patientId}`);
        }
    }

    /**
     * Initialize clean condition states for a new patient
     * @param {string} patientId - Patient identifier
     */
    initializeCleanConditionStates(patientId) {
        console.log(`🧹 Initializing clean condition states for new patient: ${patientId}`);
        
        const conditionsKey = `${this.storageKeys.PATIENT_PREFIX}${patientId}_conditions`;
        const cleanConditions = {
            sepsis: {
                isActive: false,
                timestamp: Date.now(),
                source: 'initialization'
            },
            pneumonie: {
                isActive: false,
                timestamp: Date.now(),
                source: 'initialization'
            }
        };
        
        localStorage.setItem(conditionsKey, JSON.stringify(cleanConditions));
        console.log(`✅ Clean condition states initialized for patient ${patientId}`);
        return cleanConditions;
    }

    /**
     * Set patient condition state (e.g., pneumonie, sepsis)
     * @param {string} condition - Condition name (pneumonie, sepsis, etc.)
     * @param {Object} stateObj - State object with isActive, patientId, timestamp, source
     */
    setPatientConditionState(condition, stateObj) {
        try {
            const { isActive, patientId, timestamp, source } = stateObj;
            console.log(`🏥 Setting ${condition} state for patient ${patientId}: ${isActive}`);
            
            const conditionsKey = `${this.storageKeys.PATIENT_PREFIX}${patientId}_conditions`;
            let conditions = JSON.parse(localStorage.getItem(conditionsKey)) || {};
            
            // Check if this is already the current state to prevent recursion
            const currentState = conditions[condition];
            if (currentState && currentState.isActive === isActive) {
                console.log(`ℹ️ ${condition} state already ${isActive}, skipping to prevent recursion`);
                return true;
            }
            
            conditions[condition] = {
                isActive: isActive,
                timestamp: timestamp,
                source: source
            };
            localStorage.setItem(conditionsKey, JSON.stringify(conditions));
            
            // Handle sepsis-specific slider updates (but only if called from external source)
            if (condition === 'sepsis' && source !== 'internal') {
                if (isActive) {
                    this.applySepsisHRRanges(patientId);
                } else {
                    this.restorePreviousHRRanges(patientId);
                }
            }
            
            // Handle pneumonie-specific breathing frequency (AF) updates (but only if called from external source)
            if (condition === 'pneumonie' && source !== 'internal') {
                if (isActive) {
                    this.applyPneumonieAFRanges(patientId);
                } else {
                    this.restorePreviousAFRanges(patientId);
                }
            }
            
            // Dispatch event for cross-page synchronization
            window.dispatchEvent(new CustomEvent('patientConditionStateChanged', {
                detail: {
                    condition: condition,
                    state: {
                        isActive: isActive,
                        patientId: patientId,
                        timestamp: timestamp,
                        source: source
                    }
                }
            }));
            
            console.log(`✅ ${condition} state saved and event dispatched`);
            return true;
        } catch (error) {
            console.error(`❌ Error setting ${condition} state:`, error);
            return false;
        }
    }

    /**
     * Get patient condition state
     * @param {string} condition - Condition name (pneumonie, sepsis, etc.)
     * @param {string} patientId - Patient identifier (optional, uses current if not provided)
     * @returns {Object|null} - Condition state object or null if not found
     */
    getPatientConditionState(condition, patientId = null) {
        try {
            // Use current patient if not specified
            const targetPatientId = patientId || this.getCurrentPatientId();
            if (!targetPatientId) return null;
            
            const conditionsKey = `${this.storageKeys.PATIENT_PREFIX}${targetPatientId}_conditions`;
            const conditions = JSON.parse(localStorage.getItem(conditionsKey)) || {};
            
            // Return the condition state if it exists, otherwise return default inactive state
            return conditions[condition] || {
                isActive: false,
                timestamp: Date.now(),
                source: 'default'
            };
        } catch (error) {
            console.error(`❌ Error getting ${condition} state:`, error);
            return {
                isActive: false,
                timestamp: Date.now(),
                source: 'error-fallback'
            };
        }
    }

    /**
     * Get current patient ID from URL or storage
     * @returns {string|null} - Current patient ID or null
     */
    getCurrentPatientId() {
        // Try to get from URL parameters first
        const urlParams = new URLSearchParams(window.location.search);
        const patientId = urlParams.get('patient');
        if (patientId) return patientId;
        
        // Fallback to localStorage if available
        return localStorage.getItem('currentPatientId') || null;
    }

    /**
     * Get all condition states for a patient
     * @param {string} patientId - Patient identifier (optional, uses current if not provided)
     * @returns {Object} - Object with condition names as keys and state objects as values
     */
    getPatientConditions(patientId = null) {
        try {
            const targetPatientId = patientId || this.getCurrentPatientId();
            if (!targetPatientId) return {};
            
            const conditionsKey = `${this.storageKeys.PATIENT_PREFIX}${targetPatientId}_conditions`;
            return JSON.parse(localStorage.getItem(conditionsKey)) || {};
        } catch (error) {
            console.error(`❌ Error getting patient conditions:`, error);
            return {};
        }
    }

    /**
     * Highlight an element with automatic fade-out after 1.5 seconds
     * @param {string|HTMLElement} element - Element ID or element reference
     * @param {string} highlightClass - CSS class to add (default: 'highlight')
     * @param {number} duration - Duration in milliseconds before fade-out (default: 1500)
     */
    highlightElement(element, highlightClass = 'highlight', duration = 1500) {
        try {
            // Get element reference
            const el = typeof element === 'string' ? document.getElementById(element) : element;
            if (!el) {
                console.warn('⚠️ Element not found for highlighting:', element);
                return;
            }

            // Remove any existing highlight classes and reset styles
            el.classList.remove(highlightClass, 'fade-out');
            el.style.backgroundColor = '';
            el.style.color = '';
            el.style.padding = '';
            el.style.border = '';
            el.style.borderRadius = '';

            // Add highlight class
            el.classList.add(highlightClass);
            console.log('✨ Applied highlight to:', el.id || el.className);

            // Set timeout to fade out
            setTimeout(() => {
                if (el && el.classList.contains(highlightClass)) {
                    // Add fade-out class for smooth transition
                    el.classList.add('fade-out');
                    
                    // Remove all highlight classes after transition
                    setTimeout(() => {
                        el.classList.remove(highlightClass, 'fade-out');
                        console.log('🎯 Highlight faded out for:', el.id || el.className);
                    }, 300); // Allow time for CSS transition
                }
            }, duration);

        } catch (error) {
            console.error('❌ Error highlighting element:', error);
        }
    }

    /**
     * Highlight multiple elements with the same settings
     * @param {Array<string|HTMLElement>} elements - Array of element IDs or element references
     * @param {string} highlightClass - CSS class to add (default: 'highlight')
     * @param {number} duration - Duration in milliseconds before fade-out (default: 1500)
     */
    highlightElements(elements, highlightClass = 'highlight', duration = 1500) {
        elements.forEach(element => {
            this.highlightElement(element, highlightClass, duration);
        });
    }

    /**
     * Debug localStorage content - useful for troubleshooting
     */
    debugLocalStorage() {
        console.log('🔍 === DEBUG localStorage CONTENT ===');
        console.log('📊 Total localStorage keys:', localStorage.length);
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key);
            
            try {
                const parsed = JSON.parse(value);
                console.log(`🔑 ${key}:`, parsed);
            } catch (e) {
                console.log(`🔑 ${key}:`, value);
            }
        }
        
        console.log('🔍 === END DEBUG localStorage ===');
        
        // Also log centralized app data
        const appData = this.getAppData();
        if (appData) {
            console.log('📱 === CENTRALIZED APP DATA ===');
            console.log('📊 Patients:', Object.keys(appData.patients || {}));
            console.log('🏥 Beds:', Object.keys(appData.beds || {}));
            console.log('💾 Sessions:', appData.sessions);
            console.log('📱 === END CENTRALIZED APP DATA ===');
        }
    }

    /**
     * SINGLE SOURCE OF TRUTH: Get Current Effective Values
     * This is the ONE method all pages should use to get calculated values
     * Prevents stacking by always starting from base data + current context
     * Includes smart caching to prevent redundant calculations during initialization
     * @param {string} patientId - Patient ID
     * @param {Object} options - Options: { useCache: boolean, forceRefresh: boolean }
     * @returns {Object} - Complete effective values: { parameterRanges, monitoringLevels, activeTags, timestamp }
     */
    getCurrentEffectiveValues(patientId, options = {}) {
        const { useCache = true, forceRefresh = false } = options;
        
        console.log(`🎯 SINGLE SOURCE: Getting effective values for patient ${patientId} (useCache: ${useCache}, forceRefresh: ${forceRefresh})`);
        
        // Initialize cache if not exists
        if (!this.effectiveValuesCache) {
            this.effectiveValuesCache = {};
        }
        
        const cacheKey = `patient_${patientId}`;
        
        // Check cache validity (prevent redundant calculations during initialization)
        if (useCache && !forceRefresh && this.effectiveValuesCache[cacheKey]) {
            const cached = this.effectiveValuesCache[cacheKey];
            const timeDiff = Date.now() - new Date(cached.timestamp).getTime();
            
            if (timeDiff < 2000) { // Cache valid for 2 seconds
                console.log(`⚡ SINGLE SOURCE: Using cached values (${timeDiff}ms ago) for ${patientId}`);
                return cached.values;
            } else {
                console.log(`🔄 SINGLE SOURCE: Cache expired (${timeDiff}ms), recalculating for ${patientId}`);
                delete this.effectiveValuesCache[cacheKey];
            }
        }
        
        console.log(`🔄 SINGLE SOURCE: Performing fresh calculation for ${patientId}`);
        
        // === STEP 1: GET IMMUTABLE BASE DATA ===
        const medicalInfo = this.getPatientMedicalInfo(patientId);
        const selectedProblem = medicalInfo?.selectedProblem || 'none';
        const selectedRiskLevel = medicalInfo?.selectedRiskLevel || 'low';
        
        console.log(`📋 SINGLE SOURCE: Base medical context - Problem: ${selectedProblem}, Risk: ${selectedRiskLevel}`);
        
        // Get pure matrix base values (never adjusted)
        const matrixBaseRanges = this.getMatrixBasedBaseRanges(selectedProblem, selectedRiskLevel);
        const matrixOrganStates = this.calculateAdvancedOrganStates(selectedProblem, selectedRiskLevel);
        
        // Get base monitoring levels (user-set or default)
        const baseMonitoringLevels = {
            heart: this.getHeartMonitoringLevel(patientId) || 'mid',
            lung: this.getLungMonitoringLevel(patientId) || 'mid', 
            temp: this.getTempMonitoringLevel(patientId) || 'mid'
        };
        
        console.log(`📊 SINGLE SOURCE: Base values - Ranges:`, matrixBaseRanges);
        console.log(`📊 SINGLE SOURCE: Base monitoring levels:`, baseMonitoringLevels);
        
        // === STEP 2: GET CURRENT DYNAMIC STATE ===
        const activeTags = this.getAllActiveTagsForPatient(patientId);
        console.log(`🏷️ SINGLE SOURCE: Active tags:`, activeTags);
        
        // === STEP 3: CALCULATE ADJUSTMENTS (NEVER STORED AS BASE) ===
        let finalRanges = { ...matrixBaseRanges };
        let finalMonitoringLevels = { ...baseMonitoringLevels };
        
        if (activeTags.length > 0) {
            // Apply tag-based parameter adjustments (includes both parameter ranges AND monitoring levels)
            const parameterAdjustments = this.calculateTagBasedParameterAdjustments(
                activeTags,
                matrixBaseRanges,
                matrixOrganStates.organStates,
                selectedRiskLevel
            );
            
            // NOTE: Monitoring level adjustments are already included in parameterAdjustments
            // No need for separate calculateTagBasedMonitoringAdjustments call to avoid duplication
            
            finalRanges = parameterAdjustments.adjustedRanges;
            finalMonitoringLevels = parameterAdjustments.adjustedOrganStates; // Use organ states from parameter adjustments
            
            console.log(`🏷️ SINGLE SOURCE: Tag adjustments applied:`, {
                parameterChanges: parameterAdjustments.appliedAdjustments?.length || 0,
                organStateChanges: parameterAdjustments.adjustedOrganStates,
                finalRanges: finalRanges,
                finalMonitoringLevels: finalMonitoringLevels
            });
        } else {
            console.log(`📊 SINGLE SOURCE: No active tags - using base values only`);
        }
        
        // === STEP 4: APPLY MANUAL OVERRIDES (HIGHEST PRIORITY) ===
        const manualOverrides = this.getManualOverrides(patientId);
        if (Object.keys(manualOverrides).length > 0) {
            console.log(`🔧 SINGLE SOURCE: Applying manual overrides:`, manualOverrides);
            
            Object.keys(manualOverrides).forEach(parameter => {
                if (finalRanges[parameter] && manualOverrides[parameter].range) {
                    const originalRange = { ...finalRanges[parameter] };
                    finalRanges[parameter] = { ...manualOverrides[parameter].range };
                    console.log(`🔧 Manual override applied: ${parameter} = ${originalRange.min}-${originalRange.max} → ${finalRanges[parameter].min}-${finalRanges[parameter].max}`);
                }
            });
        } else {
            console.log(`📊 SINGLE SOURCE: No manual overrides for patient ${patientId}`);
        }
        
        // === STEP 5: CREATE RESULT PACKAGE ===
        const result = {
            parameterRanges: finalRanges,
            monitoringLevels: finalMonitoringLevels,
            activeTags: activeTags,
            manualOverrides: manualOverrides,
            baseContext: {
                problem: selectedProblem,
                riskLevel: selectedRiskLevel,
                matrixBase: matrixBaseRanges,
                baseMonitoringLevels: baseMonitoringLevels
            },
            timestamp: new Date().toISOString()
        };
        
        // === STEP 6: CACHE RESULT ===
        this.effectiveValuesCache[cacheKey] = {
            values: result,
            timestamp: result.timestamp
        };
        
        console.log(`✅ SINGLE SOURCE: Fresh calculation completed for ${patientId}`);
        console.log(`📦 SINGLE SOURCE: Result package:`, {
            parameterCount: Object.keys(result.parameterRanges).length,
            monitoringLevels: result.monitoringLevels,
            activeTagCount: result.activeTags.length
        });
        
        return result;
    }

    /**
     * Invalidate Effective Values Cache
     * Call this when base data changes (tags, medical info, explicit monitoring levels)
     * @param {string} patientId - Patient ID to invalidate, or null for all patients
     */
    invalidateEffectiveValuesCache(patientId = null) {
        if (!this.effectiveValuesCache) return;
        
        if (patientId) {
            const cacheKey = `patient_${patientId}`;
            delete this.effectiveValuesCache[cacheKey];
            console.log(`🗑️ SINGLE SOURCE: Cache invalidated for patient ${patientId}`);
        } else {
            this.effectiveValuesCache = {};
            console.log(`🗑️ SINGLE SOURCE: All cache invalidated`);
        }
    }

    /**
     * Calculate Tag-Based Monitoring Adjustments
     * 
     * ⚠️ DEPRECATED: This function is no longer used to avoid duplication.
     * Monitoring level adjustments are now handled directly in calculateTagBasedParameterAdjustments()
     * 
     * Separate method for monitoring level adjustments (similar to parameter adjustments)
     * @param {Array} activeTags - Array of active condition tags
     * @param {Object} baseMonitoringLevels - Base monitoring levels
     * @param {string} riskLevel - Current risk level
     * @returns {Object} - Adjusted monitoring levels
     */
    calculateTagBasedMonitoringAdjustments(activeTags, baseMonitoringLevels, riskLevel) {
        console.log(`🏷️ MONITORING ADJUST: Calculating monitoring adjustments for tags:`, activeTags);
        
        let adjustedLevels = { ...baseMonitoringLevels };
        const appliedAdjustments = [];
        
        // Apply monitoring level deltas for each active tag
        activeTags.forEach(tag => {
            const tagDeltas = this.getTagMonitoringDeltas(tag, riskLevel);
            
            if (tagDeltas) {
                Object.keys(tagDeltas).forEach(organ => {
                    const delta = tagDeltas[organ];
                    const currentLevel = adjustedLevels[organ];
                    const newLevel = this.adjustMonitoringLevel(currentLevel, delta);
                    
                    if (newLevel !== currentLevel) {
                        adjustedLevels[organ] = newLevel;
                        appliedAdjustments.push({
                            tag: tag,
                            organ: organ,
                            change: `${currentLevel} → ${newLevel}`,
                            delta: delta
                        });
                        console.log(`✅ MONITORING ADJUST: ${tag} → ${organ}: ${currentLevel} + ${delta} = ${newLevel}`);
                    }
                });
            }
        });
        
        return {
            adjustedLevels: adjustedLevels,
            appliedAdjustments: appliedAdjustments,
            baseValues: baseMonitoringLevels
        };
    }

    /**
     * Get Tag Monitoring Deltas
     * Returns monitoring level adjustments for a specific tag
     * @param {string} tag - Condition tag
     * @param {string} riskLevel - Risk level context
     * @returns {Object} - Monitoring deltas by organ
     */
    getTagMonitoringDeltas(tag, riskLevel) {
        // Same logic as existing tag delta calculation but for monitoring levels
        const monitoringDeltas = {
            sepsis: {
                low: { heart: 1, temp: 1 },
                mid: { heart: 1, temp: 1 },
                high: { heart: 2, temp: 1 }
            },
            pneumonie: {
                low: { lung: 1, temp: 1 },
                mid: { lung: 1, temp: 1 },  
                high: { lung: 2, temp: 1 }
            }
        };
        
        return monitoringDeltas[tag]?.[riskLevel] || null;
    }

    /**
     * Manual Override System
     * Implements fragile overrides that persist until user makes systematic changes
     */
    
    /**
     * Set manual override for a specific parameter
     * @param {string} patientId - Patient identifier
     * @param {string} parameter - Parameter name (HR, BP_Mean, AF, Saturatie, Temperature)
     * @param {Object} range - Manual range {min, max, unit}
     * @param {string} source - Source of manual change ('slider', 'input')
     */
    setManualOverride(patientId, parameter, range, source = 'manual') {
        console.log(`🔧 MANUAL OVERRIDE: Setting ${parameter} override for patient ${patientId}:`, range);
        
        const overrideKey = `${this.storageKeys.MANUAL_OVERRIDE_PREFIX}${patientId}`;
        let overrides = {};
        
        try {
            const existing = localStorage.getItem(overrideKey);
            if (existing) {
                overrides = JSON.parse(existing);
            }
        } catch (error) {
            console.warn('❌ Error parsing existing manual overrides:', error);
            overrides = {};
        }
        
        // Store the manual override with metadata
        overrides[parameter] = {
            range: range,
            source: source,
            timestamp: new Date().toISOString(),
            isManual: true
        };
        
        // Save to localStorage
        localStorage.setItem(overrideKey, JSON.stringify(overrides));
        
        console.log(`✅ MANUAL OVERRIDE: Stored ${parameter} manual override for patient ${patientId}`);
        
        // Invalidate cache to ensure fresh calculations include manual overrides
        this.invalidateEffectiveValuesCache(patientId);
        console.log(`🗑️ MANUAL OVERRIDE: Cache invalidated for patient ${patientId}`);
        
        // Fire event for cross-page synchronization
        this.fireManualOverrideChangedEvent(patientId, parameter, range, 'set');
    }
    
    /**
     * Get manual overrides for a patient
     * @param {string} patientId - Patient identifier
     * @returns {Object} - Manual overrides object
     */
    getManualOverrides(patientId) {
        const overrideKey = `${this.storageKeys.MANUAL_OVERRIDE_PREFIX}${patientId}`;
        console.log(`🔍 CACHE DEBUG: getManualOverrides called for key: ${overrideKey}`);
        
        try {
            const stored = localStorage.getItem(overrideKey);
            console.log(`🔍 CACHE DEBUG: localStorage.getItem returned:`, stored);
            if (stored) {
                const parsed = JSON.parse(stored);
                console.log(`🔍 CACHE DEBUG: Parsed manual overrides:`, parsed);
                return parsed;
            }
        } catch (error) {
            console.warn('❌ Error parsing manual overrides:', error);
        }
        
        console.log(`🔍 CACHE DEBUG: No manual overrides found, returning empty object`);
        return {};
    }
    
    /**
     * Check if a patient has any manual overrides
     * @param {string} patientId - Patient identifier
     * @returns {boolean} - True if manual overrides exist
     */
    hasManualOverrides(patientId) {
        const overrides = this.getManualOverrides(patientId);
        return Object.keys(overrides).length > 0;
    }
    
    /**
     * Clear all manual overrides for a patient (fragile system)
     * Called when user makes systematic changes (tags, risk levels, problem selection)
     * @param {string} patientId - Patient identifier
     * @param {string} trigger - What triggered the clearing ('tag', 'risk-level', 'problem')
     */
    clearManualOverrides(patientId, trigger = 'systematic-change') {
        console.log(`🧹 MANUAL OVERRIDE: Clearing all manual overrides for patient ${patientId} (trigger: ${trigger})`);
        
        const overrideKey = `${this.storageKeys.MANUAL_OVERRIDE_PREFIX}${patientId}`;
        const existingOverrides = this.getManualOverrides(patientId);
        
        console.log(`🔍 MANUAL OVERRIDE: Existing overrides before clearing:`, existingOverrides);
        console.log(`🔍 MANUAL OVERRIDE: Storage key to clear: ${overrideKey}`);
        
        // CRITICAL: Also clear the old customThresholds system that sliders read from
        const medicalInfo = this.getPatientMedicalInfo(patientId);
        if (medicalInfo && medicalInfo.customThresholds) {
            console.log(`🔍 MANUAL OVERRIDE: Found customThresholds to clear:`, medicalInfo.customThresholds);
            medicalInfo.customThresholds = {};
            medicalInfo.lastUpdated = new Date().toISOString();
            this.savePatientMedicalInfo(patientId, medicalInfo);
            console.log(`✅ MANUAL OVERRIDE: Cleared customThresholds from medical info`);
        }
        
        if (Object.keys(existingOverrides).length === 0 && (!medicalInfo?.customThresholds || Object.keys(medicalInfo.customThresholds).length === 0)) {
            console.log('ℹ️ MANUAL OVERRIDE: No manual overrides to clear');
            return;
        }
        
        // Remove from localStorage (new system)
        localStorage.removeItem(overrideKey);
        
        // Verify removal
        const afterClear = localStorage.getItem(overrideKey);
        console.log(`🔍 MANUAL OVERRIDE: After clearing, storage contains:`, afterClear);
        
        // Invalidate cache to ensure fresh calculations don't use old overrides
        this.invalidateEffectiveValuesCache(patientId);
        console.log(`🗑️ MANUAL OVERRIDE: Cache invalidated for patient ${patientId}`);
        
        console.log(`✅ MANUAL OVERRIDE: Cleared all manual overrides for patient ${patientId} due to: ${trigger}`);
        
        // Fire event for cross-page synchronization
        this.fireManualOverrideChangedEvent(patientId, null, null, 'cleared', trigger);
    }
    
    /**
     * Apply manual overrides to target ranges (priority system)
     * Manual overrides take precedence over automatic/matrix values
     * @param {string} patientId - Patient identifier
     * @param {Object} baseRanges - Base target ranges from matrix/calculations
     * @returns {Object} - Target ranges with manual overrides applied
     */
    applyManualOverridesToRanges(patientId, baseRanges) {
        const manualOverrides = this.getManualOverrides(patientId);
        
        if (Object.keys(manualOverrides).length === 0) {
            return baseRanges; // No overrides, return base ranges
        }
        
        console.log(`🔧 MANUAL OVERRIDE: Applying manual overrides to base ranges for patient ${patientId}`);
        
        const finalRanges = { ...baseRanges };
        
        // Apply each manual override
        Object.keys(manualOverrides).forEach(parameter => {
            const override = manualOverrides[parameter];
            if (override.isManual && override.range) {
                finalRanges[parameter] = { ...override.range };
                console.log(`  → ${parameter}: Manual override applied (${override.range.min}-${override.range.max} ${override.range.unit})`);
            }
        });
        
        console.log(`✅ MANUAL OVERRIDE: Final ranges with overrides applied:`, finalRanges);
        return finalRanges;
    }
    
    /**
     * Fire manual override changed event for cross-page sync
     * @param {string} patientId - Patient identifier
     * @param {string} parameter - Parameter name (null for clear all)
     * @param {Object} range - Range data (null for clear)
     * @param {string} action - Action type ('set', 'cleared')
     * @param {string} trigger - What triggered the change
     */
    fireManualOverrideChangedEvent(patientId, parameter, range, action, trigger = null) {
        const event = new CustomEvent('manualOverrideChanged', {
            detail: {
                patientId,
                parameter,
                range,
                action,
                trigger,
                timestamp: Date.now()
            }
        });
        window.dispatchEvent(event);
        console.log(`🚀 MANUAL OVERRIDE: Fired ${action} event for ${parameter || 'all parameters'}`);
    }

    /**
     * Adjust Monitoring Level
     * Apply delta to monitoring level (low/mid/high)
     * @param {string} currentLevel - Current monitoring level
     * @param {number} delta - Delta to apply
     * @returns {string} - New monitoring level
     */
    adjustMonitoringLevel(currentLevel, delta) {
        const levels = ['low', 'mid', 'high'];
        const currentIndex = levels.indexOf(currentLevel);
        
        if (currentIndex === -1) return currentLevel;
        
        const newIndex = Math.max(0, Math.min(levels.length - 1, currentIndex + delta));
        return levels[newIndex];
    }
}

// Initialize SharedDataManager when DOM is ready
function initializeSharedDataManager() {
    console.log('🚀 Initializing SharedDataManager with DOM ready...');
    
    // Create global instance
    window.sharedDataManager = new SharedDataManager();
    
    console.log('✅ Global SharedDataManager initialized');
}

// Check if DOM is ready and initialize accordingly
if (document.readyState === 'loading') {
    // DOM is still loading, wait for it
    document.addEventListener('DOMContentLoaded', initializeSharedDataManager);
} else {
    // DOM is already ready, initialize immediately
    initializeSharedDataManager();
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SharedDataManager;
}
