/**
 * =============================================================================
 * PATIENT MONITORING DASHBOARD - INTERACTIVE JAVASCRIPT
 * 
 * This file contains all the interactive functionality for the medical patient
 * monitoring dashboard. It handles:
 * - Form selections and validations
 * - Dynamic UI updates
 * - Progress tracking
 * - Organ monitoring controls
 * - User feedback and confirmations
 * =============================================================================
 */

// =============================================================================
// 1. GLOBAL STATE VARIABLES - Track User Selections
// =============================================================================

/**
 * Stores the selected main medical problem
 * @type {string|null} - The selected problem value from dropdown, or null if none selected
 */
let selectedProblem = null;

/**
 * Stores the selected patient risk level
 * @type {string|null} - 'Laag', 'Mid', 'Hoog', or null if none selected
 */
let selectedRiskLevel = null;

/**
 * Array of selected additional medical condition tags
 * @type {Array<string>} - Array of selected condition data attributes
 */
let selectedTags = [];

/**
 * Configuration object for each organ system monitoring
 * Each organ has 'active' (boolean) and 'severity' (string) properties
 * Now only includes the three essential organs
 * @type {Object}
 */
let organSettings = {
    circulatoir: { active: false, severity: 'los' },    // Heart/circulation monitoring (initially inactive)
    respiratoir: { active: false, severity: 'los' },   // Lung/breathing monitoring (initially inactive)
    overig: { active: false, severity: 'los' }         // Other/temperature monitoring (initially inactive)
};

/**
 * Parameter ranges for different medical conditions
 * Used to update target ranges based on selected conditions
 * @type {Object}
 */
const conditionParameters = {
    sepsis: {
        hr: '120 - 150',        // Higher heart rate for sepsis
        bp: '65 - 90',          // Adjusted blood pressure
        highlight: ['hr']       // Which parameters to highlight
    },
    diabetes: {
        temp: '36.0 - 38.5',    // Tighter temperature control
        highlight: ['temp']
    },
    pneumonie: {
        saturatie: '92 - 100',  // Higher oxygen saturation target
        af: '12 - 28',          // Adjusted respiratory rate
        highlight: ['saturatie', 'af']
    }
};

/**
 * Default parameter ranges when no conditions are selected
 * @type {Object}
 */
const defaultParameters = {
    hr: '70 - 110',
    bp: '65 - 85',
    saturatie: '90 - 100',
    af: '10 - 25',
    temp: '36.5 - 39'
};

// =============================================================================
// 2. INITIALIZATION - Set Up Interactive Elements When Page Loads
// =============================================================================

/**
 * Main initialization function - runs when the DOM is fully loaded
 * Sets up all interactive elements and event listeners
 */
document.addEventListener('DOMContentLoaded', function() {
    // Initialize all interactive components
    initializeProblemDropdown();    // Set up dropdown for main problem selection
    initializeRiskButtons();        // Set up risk level selection
    initializeTagButtons();         // Set up medical condition tags
    initializeOrganMonitoring();    // Set up organ monitoring circles
    updateProgressBar();           // Set initial progress state
    addHoverEffects();            // Add visual feedback for buttons
});

// =============================================================================
// 3. PROBLEM SELECTION - Main Medical Problem Dropdown Functionality
// =============================================================================

/**
 * Sets up change handler for main problem dropdown selection
 * Updates progress bar and activates organ monitoring when a problem is selected
 */
function initializeProblemDropdown() {
    const dropdown = document.getElementById('problemDropdown');
    
    if (dropdown) {
        dropdown.addEventListener('change', function() {
            // Store the selected problem value
            selectedProblem = this.value;
            
            console.log('Dropdown changed to:', selectedProblem); // Debug log
            
            // Update dropdown appearance based on selection
            if (selectedProblem) {
                dropdown.classList.add('selected');
                console.log('Added selected class to dropdown'); // Debug log
                activateAllOrgans();
            } else {
                dropdown.classList.remove('selected');
                console.log('Removed selected class from dropdown'); // Debug log
                deactivateAllOrgans();
            }
            
            // Update the progress bar to reflect completion
            updateProgressBar();
            
            // Update parameter ranges if this problem affects them
            updateParameterRanges();
        });
    } else {
        console.log('Problem dropdown not found!'); // Debug log
    }
}

/**
 * Activates all organ monitoring systems
 * Called when a main problem is selected
 */
function activateAllOrgans() {
    // Activate all organs
    Object.keys(organSettings).forEach(organ => {
        organSettings[organ].active = true;
        organSettings[organ].severity = 'mild';
    });
    
    // Update the visual appearance
    updateOrganVisuals();
}

/**
 * Deactivates all organ monitoring systems
 * Called when no problem is selected
 */
function deactivateAllOrgans() {
    // Deactivate all organs
    Object.keys(organSettings).forEach(organ => {
        organSettings[organ].active = false;
        organSettings[organ].severity = 'los';
    });
    
    // Update the visual appearance
    updateOrganVisuals();
}

/**
 * Updates the visual appearance of all organ monitoring circles
 * Based on current organSettings state
 */
function updateOrganVisuals() {
    const monitorItems = document.querySelectorAll('.monitor-item');
    const organNames = ['circulatoir', 'respiratoir', 'overig'];
    
    monitorItems.forEach((item, index) => {
        const organName = organNames[index];
        const circle = item.querySelector('.monitor-circle');
        const label = item.querySelector('.monitor-label');
        const status = item.querySelector('.monitor-status');
        
        if (organSettings[organName].active) {
            // Activate visual state
            circle.className = 'monitor-circle circle-active';
            label.classList.remove('inactive-text');
            status.classList.remove('inactive-text');
            status.textContent = organSettings[organName].severity;
        } else {
            // Deactivate visual state
            circle.className = 'monitor-circle circle-inactive';
            label.classList.add('inactive-text');
            status.classList.add('inactive-text');
            status.textContent = 'los';
        }
    });
    
    // Update parameter cards as well
    updateParameterCards();
}

// =============================================================================
// 4. RISK LEVEL SELECTION - Patient Risk Assessment
// =============================================================================

/**
 * Sets up click handlers for risk level buttons (Laag/Mid/Hoog)
 * Updates alarm indicators based on selected risk level
 */
function initializeRiskButtons() {
    // Find all risk level buttons by their CSS classes
    const riskButtons = document.querySelectorAll('.btn.risk-low, .btn.risk-med, .btn.risk-high');
    
    // Add click event to each risk button
    riskButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Remove 'selected' class from all risk buttons (deselect all)
            riskButtons.forEach(btn => btn.classList.remove('selected'));
            
            // Add 'selected' class to the clicked button
            this.classList.add('selected');
            
            // Store the selected risk level
            selectedRiskLevel = this.textContent;
            
            // Update the alarm indicator to match risk level
            updateAlarmIndicator(this.textContent);
            
            // Update progress bar
            updateProgressBar();
        });
    });
}

// =============================================================================
// 5. MEDICAL CONDITION TAGS - Additional Patient Information
// =============================================================================

/**
 * Sets up toggle functionality for medical condition tags
 * Allows multiple tags to be selected simultaneously and updates parameters
 */
function initializeTagButtons() {
    // Find all tag buttons with data-condition attributes
    const tagButtons = document.querySelectorAll('.tag-btn[data-condition]');
    
    // Add toggle functionality to each tag button
    tagButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Toggle the 'selected' class (add if not present, remove if present)
            this.classList.toggle('selected');
            
            const conditionData = this.getAttribute('data-condition');
            
            // Update the selectedTags array
            if (this.classList.contains('selected')) {
                // Add condition to array if not already present
                if (!selectedTags.includes(conditionData)) {
                    selectedTags.push(conditionData);
                }
            } else {
                // Remove condition from array
                selectedTags = selectedTags.filter(tag => tag !== conditionData);
            }
            
            // Update parameter ranges based on selected conditions
            updateParameterRanges();
        });
    });

    // Set up the "More options" button
    const moreBtn = document.querySelector('.more-btn');
    if (moreBtn) {
        moreBtn.addEventListener('click', function() {
            // Show placeholder message for future functionality
            alert('Meer opties worden binnenkort beschikbaar...');
        });
    }
}

// =============================================================================
// 6. ORGAN MONITORING - Interactive Circular Progress Indicators
// =============================================================================

/**
 * Sets up click handlers for organ monitoring circles
 * Allows toggling monitoring on/off for each organ system
 */
function initializeOrganMonitoring() {
    // Find all monitor items (organ circles)
    const monitorItems = document.querySelectorAll('.monitor-item');
    
    // Array mapping positions to organ names (must match organSettings keys)
    const organNames = ['circulatoir', 'respiratoir', 'overig'];
    
    // Add click handler to each organ monitoring item
    monitorItems.forEach((item, index) => {
        const organName = organNames[index];
        
        item.addEventListener('click', function() {
            // Toggle the monitoring state for this organ
            toggleOrganMonitoring(organName, item);
        });
    });
}

/**
 * Toggles monitoring state for a specific organ system
 * Updates visual appearance and parameter cards accordingly
 * 
 * @param {string} organName - The key name of the organ in organSettings
 * @param {HTMLElement} element - The DOM element for this organ monitor
 */
function toggleOrganMonitoring(organName, element) {
    // Find the visual elements within this monitor item
    const circle = element.querySelector('.monitor-circle');
    const label = element.querySelector('.monitor-label');
    const status = element.querySelector('.monitor-status');
    
    // Check current state and toggle
    if (organSettings[organName].active) {
        // Currently active - deactivate monitoring
        organSettings[organName].active = false;
        organSettings[organName].severity = 'los';
        
        // Update visual appearance to inactive state
        circle.className = 'monitor-circle circle-inactive';
        label.classList.add('inactive-text');
        status.classList.add('inactive-text');
        status.textContent = 'los';
    } else {
        // Currently inactive - activate monitoring
        organSettings[organName].active = true;
        organSettings[organName].severity = 'mild';
        
        // Update visual appearance to active state
        circle.className = 'monitor-circle circle-active';
        label.classList.remove('inactive-text');
        status.classList.remove('inactive-text');
        status.textContent = 'mild';
    }
    
    // Update the parameter value cards to match organ states
    updateParameterCards();
}

// =============================================================================
// 7. DYNAMIC UI UPDATES - Visual Feedback Functions
// =============================================================================

/**
 * Updates the alarm indicator based on selected risk level
 * Changes number of bell icons and descriptive text
 * 
 * @param {string} riskLevel - The selected risk level ('Laag', 'Mid', or 'Hoog')
 */
function updateAlarmIndicator(riskLevel) {
    const alarmDiv = document.querySelector('.alarm-indicator');
    let alarmText = '';
    let bellCount = '';
    
    // Set alarm display based on risk level
    switch(riskLevel.toLowerCase()) {
        case 'laag':
            bellCount = '🔔';                    // 1 bell for low risk
            alarmText = 'langzamer een alarm';   // Slower alarm
            break;
        case 'mid':
            bellCount = '🔔 🔔';                 // 2 bells for medium risk
            alarmText = 'normaal alarm tempo';   // Normal alarm speed
            break;
        case 'hoog':
            bellCount = '🔔 🔔 🔔';              // 3 bells for high risk
            alarmText = 'sneller een alarm';     // Faster alarm
            break;
    }
    
    // Update the alarm indicator HTML
    alarmDiv.innerHTML = `<div>${bellCount}</div><div>${alarmText}</div>`;
}

/**
 * Updates parameter value cards to reflect active/inactive organ monitoring
 * Grays out cards for inactive organs, normal styling for active organs
 */
function updateParameterCards() {
    const valueCards = document.querySelectorAll('.value-card');
    const organNames = ['circulatoir', 'respiratoir', 'overig'];
    
    // Update each card based on corresponding organ state
    valueCards.forEach((card, index) => {
        const organName = organNames[index];
        const labels = card.querySelectorAll('.value-label');
        const numbers = card.querySelectorAll('.value-number');
        
        if (organSettings[organName].active) {
            // Organ is active - remove inactive styling
            labels.forEach(label => label.classList.remove('inactive-text'));
            numbers.forEach(number => number.classList.remove('inactive-text'));
        } else {
            // Organ is inactive - add gray styling
            labels.forEach(label => label.classList.add('inactive-text'));
            numbers.forEach(number => number.classList.add('inactive-text'));
        }
    });
}

/**
 * Updates parameter ranges based on selected medical conditions
 * Highlights changed parameters with animation
 */
function updateParameterRanges() {
    // Map parameter names to their DOM elements (updated for 3 organs)
    const parameterMap = {
        hr: { card: 0, index: 1 },          // Heart rate - first card, second value
        bp: { card: 0, index: 3 },          // Blood pressure - first card, fourth value
        saturatie: { card: 1, index: 1 },   // Oxygen saturation - second card, second value
        af: { card: 1, index: 3 },          // Respiratory rate - second card, fourth value
        temp: { card: 2, index: 1 }         // Temperature - third card, second value
    };
    
    const valueCards = document.querySelectorAll('.value-card');
    
    // Start with default parameters
    let currentParameters = { ...defaultParameters };
    let parametersToHighlight = [];
    
    // Apply condition-specific parameters
    selectedTags.forEach(condition => {
        if (conditionParameters[condition]) {
            const conditionParams = conditionParameters[condition];
            
            // Update parameters for this condition
            Object.keys(conditionParams).forEach(param => {
                if (param !== 'highlight' && conditionParams[param]) {
                    currentParameters[param] = conditionParams[param];
                }
            });
            
            // Add parameters to highlight list
            if (conditionParams.highlight) {
                parametersToHighlight.push(...conditionParams.highlight);
            }
        }
    });
    
    // Update the DOM with new parameter values
    Object.keys(parameterMap).forEach(param => {
        const mapping = parameterMap[param];
        const card = valueCards[mapping.card];
        
        if (card) {
            const valueNumbers = card.querySelectorAll('.value-number');
            const targetElement = valueNumbers[mapping.index];
            
            if (targetElement && currentParameters[param]) {
                const oldValue = targetElement.textContent;
                const newValue = currentParameters[param];
                
                // Only update if value actually changed
                if (oldValue !== newValue) {
                    targetElement.textContent = newValue;
                    
                    // Add highlight if this parameter should be highlighted
                    if (parametersToHighlight.includes(param)) {
                        highlightParameter(targetElement);
                    }
                }
            }
        }
    });
}

/**
 * Adds highlight animation to a parameter element
 * Removes highlight after animation completes
 * 
 * @param {HTMLElement} element - The parameter element to highlight
 */
function highlightParameter(element) {
    // Remove existing highlight class
    element.classList.remove('highlight');
    
    // Force reflow to ensure class removal takes effect
    element.offsetHeight;
    
    // Add highlight class to trigger animation
    element.classList.add('highlight');
    
    // Remove highlight class after animation completes
    setTimeout(() => {
        element.classList.remove('highlight');
    }, 2000); // 2 seconds to match CSS animation duration
}

/**
 * Updates the progress bar to show completion status
 * Highlights completed steps based on user selections
 */
function updateProgressBar() {
    const stepNumbers = document.querySelectorAll('.step-number');
    let completedSteps = 1; // Always start with step 1 completed
    
    // Determine how many steps are completed based on user input
    if (selectedProblem) completedSteps = 2;    // Step 2: Problem selected
    if (selectedRiskLevel) completedSteps = 3;  // Step 3: Risk level selected
    
    // Update visual state of each step indicator
    stepNumbers.forEach((step, index) => {
        if (index < completedSteps) {
            // This step is completed
            step.classList.remove('inactive');
            step.classList.add('completed');
            if (index === completedSteps - 1) {
                // This is the current active step
                step.style.backgroundColor = '#007bff';
            }
        } else if (index === 3 && completedSteps >= 2) {
            // Special case: Show colored checkmark when steps 1 and 2 are done
            step.classList.remove('inactive');
            step.classList.add('checkmark-ready');
            step.style.backgroundColor = '#28a745'; // Green checkmark
        } else {
            // This step is not yet reached
            step.classList.add('inactive');
            step.classList.remove('completed', 'checkmark-ready');
        }
    });
}

// =============================================================================
// 8. NAVIGATION FUNCTIONS - Back and Confirm Actions
// =============================================================================

/**
 * Handles the "Back" button click
 * Confirms with user before resetting all selections
 */
function goBack() {
    // Ask user to confirm before losing data
    if (confirm('Weet je zeker dat je terug wilt gaan? Alle wijzigingen gaan verloren.')) {
        // Reset all global state variables
        selectedProblem = null;
        selectedRiskLevel = null;
        selectedTags = [];
        
        // Reset visual state - remove all selected classes
        document.querySelectorAll('.btn.selected').forEach(btn => btn.classList.remove('selected'));
        
        // Reset progress bar to initial state
        updateProgressBar();
        
        // Show confirmation message
        alert('Terug naar vorige stap...');
    }
}

/**
 * Handles the "Confirm" button click
 * Validates required selections and shows summary before saving
 */
function confirmSettings() {
    // Validate that required fields are completed
    if (!selectedProblem || !selectedRiskLevel) {
        alert('Selecteer eerst een hoofdprobleem en risico niveau voordat je doorgaat.');
        return;
    }
    
    // Get the display name for the selected problem
    const dropdown = document.getElementById('problemDropdown');
    const selectedProblemText = dropdown ? dropdown.options[dropdown.selectedIndex].text : selectedProblem;
    
    // Generate summary of all user selections
    const summary = `
Overzicht instellingen:
- Hoofdprobleem: ${selectedProblemText}
- Risico niveau: ${selectedRiskLevel}
- Additionele tags: ${selectedTags.length > 0 ? selectedTags.join(', ') : 'Geen'}
- Actieve monitoring: ${Object.keys(organSettings).filter(organ => organSettings[organ].active).join(', ')}
    `;
    
    // Show summary and ask for final confirmation
    if (confirm(summary + '\n\nWil je deze instellingen bevestigen?')) {
        // User confirmed - simulate successful save
        alert('Instellingen opgeslagen! Patiënt monitoring is geactiveerd.');
        
        // Update progress bar to show completion
        const lastStep = document.querySelector('.step:last-child .step-number');
        lastStep.classList.remove('inactive');
        lastStep.textContent = '✓';              // Show checkmark
        lastStep.style.backgroundColor = '#28a745'; // Green background for success
    }
}

// =============================================================================
// 9. USER EXPERIENCE ENHANCEMENTS - Visual Feedback
// =============================================================================

/**
 * Adds hover effects to all interactive buttons
 * Provides visual feedback when user hovers over clickable elements
 */
function addHoverEffects() {
    const buttons = document.querySelectorAll('.btn, .nav-btn');
    
    buttons.forEach(button => {
        // Mouse enter - scale up slightly if not already selected
        button.addEventListener('mouseenter', function() {
            if (!this.classList.contains('selected')) {
                this.style.transform = 'scale(1.05)';        // 5% larger
                this.style.transition = 'transform 0.2s ease'; // Smooth animation
            }
        });
        
        // Mouse leave - return to normal size
        button.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1)'; // Return to normal size
        });
    });
}
