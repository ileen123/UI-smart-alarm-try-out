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
            APP_DATA: 'smartAlarmAppData'
        };
        
        this.initializeAppData();
        this.initializeGlobalHRVariables();
        this.initializeGlobalParameterVariables();
    }

    /**
     * Initialize global parameter variables - single source of truth for all target ranges
     * These variables are used consistently across all pages for displays and sliders
     */
    initializeGlobalParameterVariables() {
        // Initialize with default values if not already set
        if (typeof window.HR_MIN === 'undefined') window.HR_MIN = 70;
        if (typeof window.HR_MAX === 'undefined') window.HR_MAX = 110;
        if (typeof window.BP_MIN === 'undefined') window.BP_MIN = 65;
        if (typeof window.BP_MAX === 'undefined') window.BP_MAX = 85;
        if (typeof window.AF_MIN === 'undefined') window.AF_MIN = 12;
        if (typeof window.AF_MAX === 'undefined') window.AF_MAX = 18;
        if (typeof window.SAT_MIN === 'undefined') window.SAT_MIN = 92;
        if (typeof window.SAT_MAX === 'undefined') window.SAT_MAX = 100;
        if (typeof window.TEMP_MIN === 'undefined') window.TEMP_MIN = 36.0;
        if (typeof window.TEMP_MAX === 'undefined') window.TEMP_MAX = 38.5;

        // Load existing values from localStorage if available
        this.loadGlobalParameterVariables();

        console.log('🌐 Global parameter variables initialized:');
        console.log(`  HR: ${window.HR_MIN}-${window.HR_MAX} bpm`);
        console.log(`  BP: ${window.BP_MIN}-${window.BP_MAX} mmHg`);
        console.log(`  AF: ${window.AF_MIN}-${window.AF_MAX} /min`);
        console.log(`  Saturatie: ${window.SAT_MIN}-${window.SAT_MAX}%`);
        console.log(`  Temperature: ${window.TEMP_MIN}-${window.TEMP_MAX}°C`);
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
                console.log('📥 Loaded global parameter variables from localStorage');
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
        console.log('💾 Saved global parameter variables to localStorage');
    }

    /**
     * Clear all manual adjustments for a specific patient (when switching patients or resetting)
     */
    clearPatientManualAdjustments(patientId) {
        if (!patientId) return;
        
        console.log('🗑️ Clearing ALL manual adjustments for patient:', patientId);
        
        // Clear all slider custom thresholds
        const parameterTypes = ['HR', 'BP_Mean', 'AF', 'Saturatie', 'Temperature'];
        parameterTypes.forEach(type => {
            localStorage.removeItem(`patient-${patientId}-${type}-custom-threshold`);
        });
        
        // Clear all global parameter manual overrides
        const globalParams = ['HR_MIN', 'HR_MAX', 'BP_MIN', 'BP_MAX', 'AF_MIN', 'AF_MAX', 'SAT_MIN', 'SAT_MAX', 'TEMP_MIN', 'TEMP_MAX'];
        globalParams.forEach(param => {
            localStorage.removeItem(`patient-${patientId}-${param}-manual`);
        });
        
        console.log('✅ All manual adjustments cleared for patient:', patientId);
    }

    /**
     * Mark that user is manually changing main problem (should overwrite manual slider adjustments)
     */
    setUserChangingProblem(isChanging = true) {
        window.isUserChangingProblem = isChanging;
        console.log(`🎯 User changing problem flag set to: ${isChanging}`);
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
        
        console.log(`🔔 Parameter alarm ${parameter} for patient ${patientId}:`, isEnabled ? 'ENABLED' : 'DISABLED');
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
        console.log('🔄 Reset all parameter alarms to ENABLED for patient:', patientId);
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
                console.log('ℹ️ Auto-initialization already completed, skipping...');
                return;
            }
            
            console.log('🔄 Auto-initializing from legacy localStorage data...');
            
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
                            console.log('✅ Migrated patient data:', patientId);
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
                    console.log('✅ Migrated bed states');
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
                console.log('✅ Migrated session data');
            }
            
            // Set flag to prevent repeated auto-initialization
            localStorage.setItem('autoInitComplete', 'true');
            console.log('✅ Auto-initialization complete');
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

            console.log('✅ Patient medical info saved for:', patientId, medicalInfo);
            return true;
        } catch (error) {
            console.error('❌ Error saving patient medical info:', error);
            return false;
        }
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
            // Save individual bed states (legacy compatibility)
            localStorage.setItem(this.storageKeys.BED_STATES, JSON.stringify(bedStates));

            // Also save to centralized app data
            const appData = this.getAppData();
            if (appData) {
                appData.beds = bedStates;
                this.saveAppData(appData);
            }

            console.log('✅ Bed states saved:', bedStates);
            return true;
        } catch (error) {
            console.error('❌ Error saving bed states:', error);
            return false;
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

            console.log('✅ Session data saved:', sessionData);
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

            console.log('✅ Session data cleared');
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
            console.log('🗑️ Removing all data for patient:', patientId);
            
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
            "2": { id: "2", name: "M. Bunnik", gender: "Vrouw", age: 44, weight: 70 },
            "3": { id: "3", name: "H. Demir", gender: "Man", age: 35, weight: 81 },
            "4": { id: "4", name: "B. Al Salah", gender: "Man", age: 65, weight: 73 }
        };
        return patients[patientId] || null;
    }

    /**
     * Get all available patients
     */
    getAvailablePatients() {
        return [
            { id: "1", name: "S. Groen", gender: "Vrouw", age: 16, weight: 55 },
            { id: "2", name: "M. Bunnik", gender: "Vrouw", age: 44, weight: 70 },
            { id: "3", name: "H. Demir", gender: "Man", age: 35, weight: 81 },
            { id: "4", name: "B. Al Salah", gender: "Man", age: 65, weight: 73 }
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
            
            // Add thresholds configuration for slider components
            thresholds: {
                normal: {
                    circulatoir: {
                        HR: { min: 60, max: 100 },
                        BP_Mean: { min: 65, max: 85 }
                    },
                    respiratoire: {
                        AF: { min: 12, max: 20 },
                        Saturatie: { min: 92, max: 100 }
                    },
                    overige: {
                        Temperature: { min: 36.0, max: 38.5 }
                    }
                },
                conditions: {
                    sepsis: {
                        circulatoir: {
                            HR: { min: 90, max: 130 },
                            BP_Mean: { min: 50, max: 70 }
                        }
                    },
                    pneumonie: {
                        respiratoire: {
                            AF: { min: 10, max: 30 }
                        }
                    }
                }
            }
        };
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
     * Tag-Based Parameter Adjustment System
     * Explicit lookup table for individual parameter modifications based on condition tags
     * @param {Array} activeTags - Array of active condition tags (['sepsis', 'pneumonie', etc.])
     * @param {Object} baseTargetRanges - Base target ranges to modify
     * @param {string} overallRiskLevel - Current overall risk level for intensity scaling
     * @returns {Object} - Modified target ranges and reasoning
     */
    calculateTagBasedParameterAdjustments(activeTags = [], baseTargetRanges = {}, overallRiskLevel = 'low') {
        console.log(`🏷️ Tag-Based Parameter Calculation: Tags=${JSON.stringify(activeTags)}, Risk=${overallRiskLevel}`);
        
        // TAG PARAMETER MATRIX - Define exact parameter modifications for each tag
        const tagMatrix = {
            'sepsis': {
                description: 'Sepsis-specific parameter adjustments',
                parameters: {
                    HR: {
                        low: { min: 70, max: 110, reasoning: 'Sepsis - mild tachycardia expected' },
                        mid: { min: 80, max: 120, reasoning: 'Sepsis - moderate tachycardia monitoring' },
                        high: { min: 90, max: 130, reasoning: 'Sepsis - intensive cardiac monitoring for severe tachycardia' }
                    },
                    BP_Mean: {
                        low: { min: 60, max: 80, reasoning: 'Sepsis - mild hypotension risk' },
                        mid: { min: 55, max: 75, reasoning: 'Sepsis - moderate hypotension monitoring' },
                        high: { min: 50, max: 70, reasoning: 'Sepsis - severe hypotension risk, intensive monitoring' }
                    },
                    Temperature: {
                        low: { min: 35.5, max: 39.0, reasoning: 'Sepsis - fever/hypothermia monitoring' },
                        mid: { min: 35.0, max: 39.5, reasoning: 'Sepsis - enhanced temperature range for complications' },
                        high: { min: 34.5, max: 40.0, reasoning: 'Sepsis - extreme temperature variations possible' }
                    },
                    AF: {
                        low: { min: 14, max: 22, reasoning: 'Sepsis - mild respiratory compensation' },
                        mid: { min: 16, max: 25, reasoning: 'Sepsis - moderate respiratory changes' },
                        high: { min: 18, max: 30, reasoning: 'Sepsis - severe respiratory compensation' }
                    }
                }
            },
            'pneumonie': {
                description: 'Pneumonia-specific parameter adjustments',
                parameters: {
                    AF: {
                        low: { min: 14, max: 22, reasoning: 'Pneumonia - mild respiratory distress' },
                        mid: { min: 16, max: 26, reasoning: 'Pneumonia - moderate respiratory compromise' },
                        high: { min: 18, max: 30, reasoning: 'Pneumonia - severe respiratory distress' }
                    },
                    Saturatie: {
                        low: { min: 90, max: 100, reasoning: 'Pneumonia - mild oxygenation compromise' },
                        mid: { min: 88, max: 100, reasoning: 'Pneumonia - moderate oxygenation monitoring' },
                        high: { min: 85, max: 100, reasoning: 'Pneumonia - severe oxygenation compromise possible' }
                    },
                    HR: {
                        low: { min: 70, max: 110, reasoning: 'Pneumonia - compensatory mild tachycardia' },
                        mid: { min: 75, max: 115, reasoning: 'Pneumonia - moderate cardiac compensation' },
                        high: { min: 80, max: 120, reasoning: 'Pneumonia - significant cardiac compensation' }
                    },
                    Temperature: {
                        low: { min: 36.0, max: 39.0, reasoning: 'Pneumonia - fever monitoring' },
                        mid: { min: 35.5, max: 39.5, reasoning: 'Pneumonia - enhanced fever range' },
                        high: { min: 35.0, max: 40.0, reasoning: 'Pneumonia - extreme fever/hypothermia risk' }
                    }
                }
            }
        };
        
        // Start with base ranges
        let adjustedRanges = JSON.parse(JSON.stringify(baseTargetRanges));
        let appliedAdjustments = [];
        let reasoning = [];
        
        // Apply adjustments for each active tag
        activeTags.forEach(tag => {
            const tagConfig = tagMatrix[tag];
            if (!tagConfig) {
                console.warn(`⚠️ No parameter adjustments defined for tag: ${tag}`);
                return;
            }
            
            console.log(`🏷️ Applying ${tag} adjustments for risk level: ${overallRiskLevel}`);
            
            // Apply parameter modifications for this tag
            Object.entries(tagConfig.parameters).forEach(([parameter, riskLevels]) => {
                const adjustment = riskLevels[overallRiskLevel];
                if (adjustment && adjustedRanges[parameter]) {
                    // Store original for comparison
                    const original = { ...adjustedRanges[parameter] };
                    
                    // Apply the tag-specific adjustment
                    adjustedRanges[parameter].min = adjustment.min;
                    adjustedRanges[parameter].max = adjustment.max;
                    
                    appliedAdjustments.push({
                        tag: tag,
                        parameter: parameter,
                        original: original,
                        adjusted: { ...adjustedRanges[parameter] },
                        reasoning: adjustment.reasoning
                    });
                    
                    reasoning.push(`${parameter}: ${adjustment.reasoning}`);
                    
                    console.log(`✅ ${tag} → ${parameter}: ${original.min}-${original.max} → ${adjustment.min}-${adjustment.max}`);
                }
            });
        });
        
        const summary = {
            approach: activeTags.length > 0 ? `Tag-based adjustments for: ${activeTags.join(', ')}` : 'No tag adjustments',
            details: reasoning.join('; '),
            tagsProcessed: activeTags,
            adjustmentsCount: appliedAdjustments.length
        };
        
        console.log(`✅ Tag adjustments applied:`, summary);
        
        return {
            adjustedRanges,
            appliedAdjustments,
            reasoning: summary,
            originalRanges: baseTargetRanges
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
        
        // Define target ranges for each problem (organ states now come from the matrix!)
        console.log('🎯 Setting target ranges for problem:', problemValue);
        switch(problemValue) {
            case 'respiratoire-insufficientie':
                targetRanges = {
                    HR: { min: 70, max: 100, unit: 'bpm' },
                    BP_Systolic: { min: 100, max: 140, unit: 'mmHg' },
                    BP_Diastolic: { min: 60, max: 90, unit: 'mmHg' },
                    BP_Mean: { min: 60, max: 90, unit: 'mmHg' },
                    AF: { min: 12, max: 20, unit: '/min' },
                    Saturatie: { min: 92, max: 100, unit: '%' },
                    Temperature: { min: 36.0, max: 38.5, unit: '°C' }
                };
                console.log('📊 Respiratoire-insufficiëntie ranges - HR:', targetRanges.HR.min + '-' + targetRanges.HR.max, 'AF:', targetRanges.AF.min + '-' + targetRanges.AF.max);
                break;
                
            case 'hart-falen':
                targetRanges = {
                    HR: { min: 80, max: 120, unit: 'bpm' },
                    BP_Systolic: { min: 90, max: 130, unit: 'mmHg' },
                    BP_Diastolic: { min: 50, max: 80, unit: 'mmHg' },
                    BP_Mean: { min: 55, max: 75, unit: 'mmHg' },
                    AF: { min: 12, max: 18, unit: '/min' },
                    Saturatie: { min: 92, max: 100, unit: '%' },
                    Temperature: { min: 36.0, max: 38.5, unit: '°C' }
                };
                console.log('📊 Hart-falen ranges - HR:', targetRanges.HR.min + '-' + targetRanges.HR.max, 'AF:', targetRanges.AF.min + '-' + targetRanges.AF.max);
                break;
                
            case 'sepsis':
                targetRanges = {
                    HR: { min: 70, max: 120, unit: 'bpm' },
                    BP_Systolic: { min: 90, max: 140, unit: 'mmHg' },
                    BP_Diastolic: { min: 60, max: 90, unit: 'mmHg' },
                    BP_Mean: { min: 50, max: 80, unit: 'mmHg' },
                    AF: { min: 12, max: 18, unit: '/min' },
                    Saturatie: { min: 92, max: 100, unit: '%' },
                    Temperature: { min: 36.0, max: 38.5, unit: '°C' }
                };
                console.log('📊 Sepsis ranges - HR:', targetRanges.HR.min + '-' + targetRanges.HR.max, 'AF:', targetRanges.AF.min + '-' + targetRanges.AF.max);
                break;
                
            default:
                // No main problem selected - show placeholder values
                targetRanges = {
                    HR: { min: '-', max: '-', unit: 'bpm' },
                    BP_Systolic: { min: '-', max: '-', unit: 'mmHg' },
                    BP_Diastolic: { min: '-', max: '-', unit: 'mmHg' },
                    BP_Mean: { min: '-', max: '-', unit: 'mmHg' },
                    AF: { min: '-', max: '-', unit: '/min' },
                    Saturatie: { min: '-', max: '-', unit: '%' },
                    Temperature: { min: 36.0, max: 38.5, unit: '°C' }
                };
                break;
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
        
        // Apply tag-based parameter adjustments to target ranges
        if (activeTags.length > 0) {
            const tagAdjustments = this.calculateTagBasedParameterAdjustments(activeTags, targetRanges, overallRiskLevel);
            targetRanges = tagAdjustments.adjustedRanges;
            
            console.log(`🏷️ Target ranges adjusted by tags:`, {
                originalProblem: problemValue,
                activeTags: activeTags,
                adjustmentsApplied: tagAdjustments.appliedAdjustments.length,
                reasoning: tagAdjustments.reasoning
            });
        } else {
            console.log(`🏷️ No active condition tags - using base target ranges`);
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
        } else if (selectedProblem === 'pneumonie' && organSystem === 'respiratoir') {
            console.log(`📊 Default monitoring level for respiratoir with pneumonia: mid`);
            return 'mid';
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
     */
    getThresholdsByTags(tags) {
        const config = this.getConfigData();
        
        // Add error handling for missing thresholds configuration
        if (!config || !config.thresholds || !config.thresholds.normal) {
            console.warn('⚠️ Missing thresholds configuration in getConfigData()');
            // Return default thresholds if configuration is missing
            return {
                circulatoir: {
                    HR: { min: 60, max: 100 },
                    BP_Mean: { min: 65, max: 85 }
                },
                respiratoire: {
                    AF: { min: 12, max: 20 },
                    Saturatie: { min: 92, max: 100 }
                },
                overige: {
                    Temperature: { min: 36.0, max: 38.5 }
                }
            };
        }
        
        const normalThresholds = config.thresholds.normal;
        
        // Check for sepsis tag
        const hasSepsis = tags.some(tag => tag.toLowerCase().includes('sepsis'));
        
        if (hasSepsis && config.thresholds.conditions?.sepsis) {
            const sepsisThresholds = config.thresholds.conditions.sepsis;
            return {
                ...normalThresholds,
                circulatoir: {
                    ...normalThresholds.circulatoir,
                    ...sepsisThresholds.circulatoir
                }
            };
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
        const key = `${this.storageKeys.PATIENT_PREFIX}${patientId}_current_target_ranges`;
        const stored = localStorage.getItem(key);
        
        if (stored) {
            const ranges = JSON.parse(stored);
            console.log('📊 Retrieved current target ranges for patient:', patientId, ranges);
            return ranges;
        }
        
        // If no current ranges exist, initialize with defaults
        const defaultRanges = this.getDefaultTargetRanges();
        this.setCurrentTargetRanges(patientId, defaultRanges);
        console.log('📊 Initialized default target ranges for patient:', patientId, defaultRanges);
        return defaultRanges;
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
     * Get default target ranges based on normal conditions
     */
    getDefaultTargetRanges() {
        const normalThresholds = this.getThresholds('normal');
        if (normalThresholds && normalThresholds.circulatoir) {
            return {
                HR: {
                    min: normalThresholds.circulatoir.HR?.min || 60,
                    max: normalThresholds.circulatoir.HR?.max || 100,
                    unit: normalThresholds.circulatoir.HR?.unit || 'bpm'
                },
                BP_Mean: {
                    min: normalThresholds.circulatoir.BP_Mean?.min || 65,
                    max: normalThresholds.circulatoir.BP_Mean?.max || 85,
                    unit: normalThresholds.circulatoir.BP_Mean?.unit || 'mmHg'
                }
            };
        }
        
        // Fallback defaults - complete parameter set
        return {
            HR: { min: 60, max: 100, unit: ' bpm' },
            BP_Mean: { min: 65, max: 85, unit: ' mmHg' },
            AF: { min: 12, max: 18, unit: ' /min' },
            Saturatie: { min: 92, max: 100, unit: ' %' },
            Temperature: { min: 36.0, max: 38.5, unit: ' °C' }
        };
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
     * Initialize global HR variables with default values
     */
    initializeGlobalHRVariables() {
        if (!window.HR_low) {
            window.HR_low = 70; // Default low HR
        }
        if (!window.HR_high) {
            window.HR_high = 110; // Default high HR
        }
        console.log('🔧 Initialized global HR variables:', window.HR_low, '-', window.HR_high);
    }

    /**
     * Save current HR values as backup before applying sepsis ranges
     */
    saveHRBackup(patientId) {
        // Get current target ranges to backup both HR and BP
        const targetRanges = this.getPatientTargetRanges(patientId) || this.getDefaultTargetRanges();
        
        const backupData = {
            HR_low: targetRanges.HR?.min || window.HR_low || 70,
            HR_high: targetRanges.HR?.max || window.HR_high || 110,
            BP_low: targetRanges.BP_Mean?.min || 65,
            BP_high: targetRanges.BP_Mean?.max || 85,
            timestamp: new Date().toISOString()
        };
        
        const backupKey = `${this.storageKeys.PATIENT_PREFIX}${patientId}_hrBackup`;
        
        // Only save backup if it doesn't already exist (don't overwrite with sepsis values)
        const existingBackup = localStorage.getItem(backupKey);
        if (!existingBackup) {
            localStorage.setItem(backupKey, JSON.stringify(backupData));
            console.log('💾 Saved HR/BP backup for patient:', patientId, backupData);
        } else {
            console.log('ℹ️ HR/BP backup already exists, not overwriting:', JSON.parse(existingBackup));
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
}

// Create global instance
window.sharedDataManager = new SharedDataManager();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SharedDataManager;
}
