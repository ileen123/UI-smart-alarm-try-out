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
     * Debug: List all localStorage keys and values (limited for performance)
     */
    debugLocalStorage() {
        console.log('🔍 DEBUG: All localStorage data:');
        console.log('📊 App Data:', this.getAppData());
        console.log('👥 All Patients:', this.getAllPatients());
        console.log('🏥 Bed States:', this.getBedStates());
        console.log('📝 Session Data:', this.getSessionData());
        
        console.log('\n📋 Raw localStorage keys (limited to first 20 for performance):');
        const maxItems = Math.min(localStorage.length, 20);
        for (let i = 0; i < maxItems; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key);
            // Truncate long values for readability
            const displayValue = value && value.length > 100 ? value.substring(0, 100) + '...' : value;
            console.log(`  - ${key}:`, displayValue);
        }
        if (localStorage.length > 20) {
            console.log(`  ... and ${localStorage.length - 20} more items`);
        }
    }

    /**
     * Export all data for backup
     */
    exportData() {
        try {
            const exportData = {
                appData: this.getAppData(),
                timestamp: new Date().toISOString(),
                version: '1.0'
            };
            return JSON.stringify(exportData, null, 2);
        } catch (error) {
            console.error('❌ Error exporting data:', error);
            return null;
        }
    }

    /**
     * Import data from backup
     */
    importData(importString) {
        try {
            const importData = JSON.parse(importString);
            if (importData.appData) {
                this.saveAppData(importData.appData);
                console.log('✅ Data imported successfully');
                return true;
            }
            return false;
        } catch (error) {
            console.error('❌ Error importing data:', error);
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
     * Initialize data for bed-overview.html
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
            organMappings: {
                problems: {
                    "respiratoire-insufficientie": {
                        "heart": "mid",
                        "lung": "high", 
                        "temp": "low"
                    },
                    "hart-falen": {
                        "heart": "high",
                        "lung": "mid",
                        "temp": "low"
                    },
                    "sepsis": {
                        "heart": "high",
                        "lung": "high",
                        "temp": "high"
                    },
                    "neurologische-aandoening": {
                        "heart": "mid",
                        "lung": "mid",
                        "temp": "mid"
                    },
                    "nierinsuffcientie": {
                        "heart": "mid",
                        "lung": "low",
                        "temp": "mid"
                    },
                    "leverfalen": {
                        "heart": "mid",
                        "lung": "low",
                        "temp": "mid"
                    }
                },
                riskAdjustments: {
                    "low": -1,
                    "mid": 0,
                    "high": 1
                }
            },
            thresholds: {
                normal: {
                    circulatoir: { 
                        HR: { min: 70, max: 110, unit: "bpm" }, 
                        BP_Mean: { min: 65, max: 85, unit: "mmHg" } 
                    },
                    respiratoir: { 
                        Saturatie: { min: 90, max: 100, unit: "%" }, 
                        AF: { min: 10, max: 25, unit: "/min" } 
                    },
                    overig: { 
                        Temp: { min: 36.5, max: 39, unit: "°C" } 
                    }
                },
                conditions: {
                    sepsis: {
                        circulatoir: { 
                            HR: { min: 90, max: 130, unit: "bpm" }, 
                            BP_Mean: { min: 45, max: 65, unit: "mmHg" } 
                        }
                    }
                }
            },
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
        return appData.patients?.[patientId]?.monitoring?.heartLevel || 'mid';
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
            
            // Emit event for cross-page synchronization
            const event = new CustomEvent('targetRangesChanged', {
                detail: { patientId, targetRanges }
            });
            window.dispatchEvent(event);
            
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
        
        // Fallback defaults
        return {
            HR: { min: 60, max: 100, unit: 'bpm' },
            BP_Mean: { min: 65, max: 85, unit: 'mmHg' }
        };
    }

    /**
     * Update target ranges based on medical condition (e.g., sepsis)
     */
    updateTargetRangesForCondition(patientId, condition) {
        try {
            console.log('🎯 Updating target ranges for condition:', condition, 'patient:', patientId);
            
            let targetRanges = this.getDefaultTargetRanges();
            
            // Apply condition-specific adjustments
            if (condition === 'sepsis') {
                const sepsisThresholds = this.getThresholds('conditions')?.sepsis;
                if (sepsisThresholds && sepsisThresholds.circulatoir) {
                    // Update HR ranges for sepsis
                    if (sepsisThresholds.circulatoir.HR) {
                        targetRanges.HR = {
                            min: sepsisThresholds.circulatoir.HR.min,
                            max: sepsisThresholds.circulatoir.HR.max,
                            unit: sepsisThresholds.circulatoir.HR.unit || 'bpm'
                        };
                    }
                    
                    // Update BP ranges for sepsis
                    if (sepsisThresholds.circulatoir.BP_Mean) {
                        targetRanges.BP_Mean = {
                            min: sepsisThresholds.circulatoir.BP_Mean.min,
                            max: sepsisThresholds.circulatoir.BP_Mean.max,
                            unit: sepsisThresholds.circulatoir.BP_Mean.unit || 'mmHg'
                        };
                    }
                }
            }
            
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
    updateGlobalTargetRanges(patientId, targetRanges) {
        this.savePatientTargetRanges(patientId, targetRanges);
        
        // Set a timestamp for manual changes (to prioritize over automatic updates)
        sessionStorage.setItem('manualTargetRangesChange', Date.now().toString());
        
        // Dispatch event to notify all pages of target range changes
        window.dispatchEvent(new CustomEvent('targetRangesChanged', {
            detail: {
                patientId: patientId,
                targetRanges: targetRanges
            }
        }));
        
        console.log('🌐 Global target ranges updated for patient:', patientId);
        console.log('📡 Dispatched targetRangesChanged event');
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
     */
    applySepsisHRRanges(patientId) {
        // Save current values as backup
        this.saveHRBackup(patientId);
        
        // Set sepsis values
        window.HR_low = 90;
        window.HR_high = 130;
        
        // Save to target ranges for consistency and apply sepsis BP ranges
        const targetRanges = this.getPatientTargetRanges(patientId) || this.getDefaultTargetRanges();
        
        // Apply sepsis HR ranges
        targetRanges.HR = {
            min: 90,
            max: 130,
            unit: 'bpm'
        };
        
        // Apply sepsis BP ranges (45-65)
        targetRanges.BP_Mean = {
            min: 45,
            max: 65,
            unit: 'mmHg'
        };
        
        this.savePatientTargetRanges(patientId, targetRanges);
        
        // Emit event to update all pages
        const event = new CustomEvent('hrRangesChanged', {
            detail: { 
                patientId, 
                HR_low: window.HR_low, 
                HR_high: window.HR_high,
                BP_low: 45,
                BP_high: 65,
                source: 'sepsis' 
            }
        });
        window.dispatchEvent(event);
        
        console.log('🦠 Applied sepsis HR ranges:', window.HR_low, '-', window.HR_high);
        console.log('🦠 Applied sepsis BP ranges: 45 - 65 mmHg');
    }

    /**
     * Restore previous HR ranges when sepsis is deselected
     */
    restorePreviousHRRanges(patientId) {
        const backup = this.getHRBackup(patientId);
        
        if (backup) {
            window.HR_low = backup.HR_low;
            window.HR_high = backup.HR_high;
            
            // Update target ranges with backed up values
            const targetRanges = this.getPatientTargetRanges(patientId) || this.getDefaultTargetRanges();
            targetRanges.HR = {
                min: backup.HR_low,
                max: backup.HR_high,
                unit: 'bpm'
            };
            
            // Restore backed up BP ranges instead of hardcoded values
            targetRanges.BP_Mean = {
                min: backup.BP_low || 65,
                max: backup.BP_high || 85,
                unit: 'mmHg'
            };
            
            this.savePatientTargetRanges(patientId, targetRanges);
            
            // Clear the backup after successful restore
            const backupKey = `${this.storageKeys.PATIENT_PREFIX}${patientId}_hrBackup`;
            localStorage.removeItem(backupKey);
            
            console.log('🔙 Restored previous HR ranges:', window.HR_low, '-', window.HR_high);
            console.log('🔙 Restored previous BP ranges:', backup.BP_low || 65, '-', backup.BP_high || 85, 'mmHg');
        } else {
            // Fallback to default normal ranges
            const normalThresholds = this.getThresholds('normal');
            if (normalThresholds && normalThresholds.circulatoir.HR) {
                window.HR_low = normalThresholds.circulatoir.HR.min;
                window.HR_high = normalThresholds.circulatoir.HR.max;
                
                // Update target ranges
                const targetRanges = this.getPatientTargetRanges(patientId) || this.getDefaultTargetRanges();
                targetRanges.HR = {
                    min: window.HR_low,
                    max: window.HR_high,
                    unit: 'bpm'
                };
                
                // Restore default BP ranges
                targetRanges.BP_Mean = {
                    min: 65,
                    max: 85,
                    unit: 'mmHg'
                };
                
                this.savePatientTargetRanges(patientId, targetRanges);
                
                console.log('🔙 Restored default HR ranges:', window.HR_low, '-', window.HR_high);
                console.log('🔙 Restored default BP ranges: 65 - 85 mmHg');
            }
        }
        
        // Emit event to update all pages
        const event = new CustomEvent('hrRangesChanged', {
            detail: { 
                patientId, 
                HR_low: window.HR_low, 
                HR_high: window.HR_high,
                BP_low: 65,
                BP_high: 85,
                source: 'restore' 
            }
        });
        window.dispatchEvent(event);
    }

    /**
     * Handle sepsis tag selection/deselection
     */
    handleSepsisTagChange(patientId, isSelected) {
        if (isSelected) {
            this.applySepsisHRRanges(patientId);
        } else {
            this.restorePreviousHRRanges(patientId);
        }
    }

    /**
     * Apply pneumonie-specific AF ranges (10-30 instead of 10-25)
     */
    applyPneumonieAFRanges(patientId) {
        // Save current AF ranges for restoration later
        const targetRanges = this.getPatientTargetRanges(patientId) || this.getDefaultTargetRanges();
        
        // Backup current AF ranges if not already backed up
        const afBackupKey = `${this.storageKeys.PATIENT_PREFIX}${patientId}_af_backup`;
        if (!localStorage.getItem(afBackupKey)) {
            const currentAF = targetRanges.AF || { min: 10, max: 25, unit: '/min' };
            localStorage.setItem(afBackupKey, JSON.stringify(currentAF));
            console.log('💾 Backed up current AF ranges:', currentAF);
        }
        
        // Apply pneumonie-specific AF ranges
        targetRanges.AF = {
            min: 10,
            max: 30,
            unit: '/min'
        };
        
        this.savePatientTargetRanges(patientId, targetRanges);
        
        console.log('🫁 Applied pneumonie AF ranges: 10 - 30 /min');
        
        // Emit event to update all pages
        const event = new CustomEvent('afRangesChanged', {
            detail: { 
                patientId, 
                AF_min: 10, 
                AF_max: 30,
                source: 'pneumonie' 
            }
        });
        window.dispatchEvent(event);
    }

    /**
     * Restore previous AF ranges when pneumonie is deselected
     */
    restorePreviousAFRanges(patientId) {
        const afBackupKey = `${this.storageKeys.PATIENT_PREFIX}${patientId}_af_backup`;
        const backup = JSON.parse(localStorage.getItem(afBackupKey));
        
        if (backup) {
            // Update target ranges
            const targetRanges = this.getPatientTargetRanges(patientId) || this.getDefaultTargetRanges();
            targetRanges.AF = {
                min: backup.min,
                max: backup.max,
                unit: backup.unit || '/min'
            };
            
            this.savePatientTargetRanges(patientId, targetRanges);
            
            console.log('🔙 Restored previous AF ranges:', backup.min, '-', backup.max, backup.unit);
        } else {
            // Fallback to default AF ranges
            const targetRanges = this.getPatientTargetRanges(patientId) || this.getDefaultTargetRanges();
            targetRanges.AF = {
                min: 10,
                max: 25,
                unit: '/min'
            };
            
            this.savePatientTargetRanges(patientId, targetRanges);
            
            console.log('🔙 Restored default AF ranges: 10 - 25 /min');
        }
        
        // Emit event to update all pages
        const event = new CustomEvent('afRangesChanged', {
            detail: { 
                patientId, 
                AF_min: 10, 
                AF_max: 25,
                source: 'restore' 
            }
        });
        window.dispatchEvent(event);
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
