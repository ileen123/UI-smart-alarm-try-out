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
            console.log('🔄 Auto-initializing from legacy localStorage data...');
            
            // Migrate patient data
            for (let i = 0; i < localStorage.length; i++) {
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

            // Fallback: scan localStorage for patient keys
            const patients = {};
            for (let i = 0; i < localStorage.length; i++) {
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
            const patientKey = this.storageKeys.PATIENT_PREFIX + patientId + '_medicalInfo';
            localStorage.removeItem(patientKey);

            // Remove from centralized app data
            const appData = this.getAppData();
            if (appData && appData.patients[patientId]) {
                delete appData.patients[patientId];
                this.saveAppData(appData);
            }

            console.log('✅ Patient data removed for:', patientId);
            return true;
        } catch (error) {
            console.error('❌ Error removing patient data:', error);
            return false;
        }
    }

    /**
     * Debug: List all localStorage keys and values
     */
    debugLocalStorage() {
        console.log('🔍 DEBUG: All localStorage data:');
        console.log('📊 App Data:', this.getAppData());
        console.log('👥 All Patients:', this.getAllPatients());
        console.log('🏥 Bed States:', this.getBedStates());
        console.log('📝 Session Data:', this.getSessionData());
        
        console.log('\n📋 Raw localStorage keys:');
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key);
            console.log(`  - ${key}:`, value);
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
                            BP_Mean: { min: 60, max: 80, unit: "mmHg" } 
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
}

// Create global instance
window.sharedDataManager = new SharedDataManager();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SharedDataManager;
}
