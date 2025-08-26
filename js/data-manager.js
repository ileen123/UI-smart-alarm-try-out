/**
 * =============================================================================
 * DATA MANAGER - Handles data persistence across multiple pages
 * 
 * This module manages all data persistence for the medical dashboard application.
 * It handles:
 * - Patient information and session data
 * - Configuration data (organ mappings, thresholds, circle configs)
 * - LocalStorage as a fallback for JSON file access
 * - Data synchronization between pages
 * =============================================================================
 */

class DataManager {
    constructor() {
        this.configData = null;
        this.patientData = null;
        this.useLocalStorage = false; // Try JSON files first
        
        // Initialize data on construction
        this.init();
    }

    /**
     * Initialize the data manager
     */
    async init() {
        try {
            await this.loadConfigData();
            await this.loadPatientData();
        } catch (error) {
            console.warn('Failed to load JSON files, using localStorage fallback:', error);
            this.useLocalStorage = true;
            this.initializeLocalStorageDefaults();
        }
    }

    /**
     * Load configuration data from JSON file or localStorage
     */
    async loadConfigData() {
        if (this.useLocalStorage) {
            const stored = localStorage.getItem('medicalDashboard_config');
            if (stored) {
                this.configData = JSON.parse(stored);
            } else {
                this.configData = this.getDefaultConfig();
                localStorage.setItem('medicalDashboard_config', JSON.stringify(this.configData));
            }
        } else {
            try {
                const response = await fetch('./data/config.json');
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                this.configData = await response.json();
                console.log('Successfully loaded config.json');
            } catch (error) {
                console.warn('Failed to load config.json, falling back to localStorage:', error);
                this.useLocalStorage = true;
                // Recursively call this method to load from localStorage
                await this.loadConfigData();
            }
        }
    }

    /**
     * Load patient data - always start with fresh/empty selections
     */
    async loadPatientData() {
        // Always start with default (empty) patient data on page load
        this.patientData = this.getDefaultPatientData();
        
        // Clear any previous localStorage data to ensure fresh start
        localStorage.removeItem('medicalDashboard_patient');
        
        console.log('Started with fresh patient data - no previous selections');
    }

    /**
     * Save patient data to localStorage (JSON file writing not possible from client-side)
     */
    async savePatientData() {
        this.patientData.currentSession.lastUpdated = new Date().toISOString();
        
        // Always save to localStorage for persistence
        localStorage.setItem('medicalDashboard_patient', JSON.stringify(this.patientData));
        
        // For development: Log the JSON data to copy manually to patient-data.json if needed
        console.log('Patient data updated. To manually update patient-data.json file, copy this data:');
        console.log(JSON.stringify(this.patientData, null, 2));
    }

    /**
     * Initialize localStorage with default values
     */
    initializeLocalStorageDefaults() {
        if (!localStorage.getItem('medicalDashboard_config')) {
            localStorage.setItem('medicalDashboard_config', JSON.stringify(this.getDefaultConfig()));
        }
        if (!localStorage.getItem('medicalDashboard_patient')) {
            localStorage.setItem('medicalDashboard_patient', JSON.stringify(this.getDefaultPatientData()));
        }
        this.loadConfigData();
        this.loadPatientData();
    }

    // =============================================================================
    // GETTERS - Access specific data
    // =============================================================================

    /**
     * Get organ mappings for problems
     */
    getOrganMappings() {
        return this.configData?.organMappings || {};
    }

    /**
     * Get threshold data for specific conditions
     */
    getThresholds(condition = 'normal') {
        return this.configData?.thresholds?.[condition] || this.configData?.thresholds?.normal || {};
    }

    /**
     * Get circle configurations
     */
    getCircleConfigurations() {
        return this.configData?.circleConfigurations || {};
    }

    /**
     * Get current patient info
     */
    getPatientInfo() {
        return this.patientData?.patientInfo || {};
    }

    /**
     * Get current session data
     */
    getCurrentSession() {
        return this.patientData?.currentSession || {};
    }

    // =============================================================================
    // SETTERS - Update specific data
    // =============================================================================

    /**
     * Update selected problem
     */
    setSelectedProblem(problem) {
        if (this.patientData?.currentSession) {
            this.patientData.currentSession.selectedProblem = problem;
            this.savePatientData();
        }
    }

    /**
     * Update selected risk level
     */
    setSelectedRiskLevel(riskLevel) {
        if (this.patientData?.currentSession) {
            this.patientData.currentSession.selectedRiskLevel = riskLevel;
            this.savePatientData();
        }
    }

    /**
     * Update selected tags
     */
    setSelectedTags(tags) {
        if (this.patientData?.currentSession) {
            this.patientData.currentSession.selectedTags = [...tags];
            this.savePatientData();
        }
    }

    /**
     * Update organ settings
     */
    setOrganSettings(organName, settings) {
        if (this.patientData?.currentSession?.organSettings) {
            this.patientData.currentSession.organSettings[organName] = { ...settings };
            this.savePatientData();
        }
    }

    /**
     * Update progress step
     */
    setProgressStep(step) {
        if (this.patientData?.currentSession) {
            this.patientData.currentSession.progressStep = step;
            this.savePatientData();
        }
    }

    // =============================================================================
    // BUSINESS LOGIC - Complex operations
    // =============================================================================

    /**
     * Calculate organ states based on problem and risk level
     */
    calculateOrganStates(problem, riskLevel) {
        const mappings = this.getOrganMappings();
        const baseStates = mappings.problems?.[problem] || { heart: 'mid', lung: 'mid', temp: 'mid' };
        const riskAdjustment = mappings.riskAdjustments?.[riskLevel] || 0;
        
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
     * Get threshold values for specific tags/conditions
     */
        getThresholdsByTags(tags) {
        const normalThresholds = this.getThresholds('normal');
        let mergedThresholds = JSON.parse(JSON.stringify(normalThresholds));
        
        tags.forEach(tag => {
            const condition = tag.toLowerCase().replace(/[^a-z]/g, '');
            
            // Look for condition in the conditions object
            const conditionThresholds = this.configData?.thresholds?.conditions?.[condition];
            
            if (conditionThresholds && Object.keys(conditionThresholds).length > 0) {
                Object.keys(conditionThresholds).forEach(category => {
                    if (!mergedThresholds[category]) {
                        mergedThresholds[category] = {};
                    }
                    Object.assign(mergedThresholds[category], conditionThresholds[category]);
                });
            }
        });
        
        return mergedThresholds;
    }

    /**
     * Reset session data
     */
    resetSession() {
        if (this.patientData?.currentSession) {
            this.patientData.currentSession = {
                selectedProblem: "",
                selectedRiskLevel: "",
                selectedTags: [],
                organSettings: {
                    circulatoir: { active: false, severity: "los", riskLevel: "mid" },
                    respiratoir: { active: false, severity: "los", riskLevel: "mid" },
                    overig: { active: false, severity: "los", riskLevel: "mid" }
                },
                progressStep: 1,
                lastUpdated: new Date().toISOString()
            };
            this.savePatientData();
        }
    }

    // =============================================================================
    // DEFAULT DATA STRUCTURES
    // =============================================================================

    getDefaultConfig() {
        return {
            organMappings: {
                problems: {
                    "respiratoire-insufficientie": { heart: "mid", lung: "high", temp: "low" },
                    "hart-falen": { heart: "high", lung: "mid", temp: "low" },
                    "sepsis": { heart: "high", lung: "high", temp: "high" },
                    "neurologische-aandoening": { heart: "mid", lung: "mid", temp: "mid" },
                    "nierinsuffcientie": { heart: "mid", lung: "low", temp: "mid" },
                    "leverfalen": { heart: "mid", lung: "low", temp: "mid" }
                },
                riskAdjustments: { low: -1, mid: 0, high: 1 }
            },
            thresholds: {
                normal: {
                    circulatoir: { HR: { min: 70, max: 110, unit: "bpm" }, BP_Mean: { min: 65, max: 85, unit: "mmHg" } },
                    respiratoir: { Saturatie: { min: 90, max: 100, unit: "%" }, AF: { min: 10, max: 25, unit: "/min" } },
                    overig: { Temp: { min: 36.5, max: 39, unit: "°C" } }
                },
                conditions: {
                    sepsis: {
                        circulatoir: { HR: { min: 90, max: 130, unit: "bpm" }, BP_Mean: { min: 60, max: 80, unit: "mmHg" } }
                    }
                }
            },
            circleConfigurations: {
                low: { darkerBlueSize: 0.9, darkerBlueOffset: 0.05, lightBlueSize: 0.8, lightBlueOffset: 0.1, whiteCenterSize: 0.3, whiteCenterOffset: 0.35 },
                mid: { darkerBlueSize: 0.8, darkerBlueOffset: 0.1, lightBlueSize: 0.6, lightBlueOffset: 0.2, whiteCenterSize: 0.3, whiteCenterOffset: 0.35 },
                high: { darkerBlueSize: 0.7, darkerBlueOffset: 0.15, lightBlueSize: 0.4, lightBlueOffset: 0.3, whiteCenterSize: 0.3, whiteCenterOffset: 0.35 }
            }
        };
    }

    getDefaultPatientData() {
        return {
            patientInfo: { id: "34567", name: "S. Groen", gender: "Vrouw", age: 16, weight: 55, lastUpdated: null },
            currentSession: {
                selectedProblem: "", selectedRiskLevel: "", selectedTags: [],
                organSettings: {
                    circulatoir: { active: false, severity: "los", riskLevel: "mid" },
                    respiratoir: { active: false, severity: "los", riskLevel: "mid" },
                    overig: { active: false, severity: "los", riskLevel: "mid" }
                },
                progressStep: 1, lastUpdated: null
            }
        };
    }
}

// Create global instance
window.dataManager = new DataManager();
