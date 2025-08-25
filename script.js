// Track selected options
let selectedProblem = null;
let selectedRiskLevel = null;
let selectedTags = [];
let organSettings = {
    circulatoir: { active: true, severity: 'mild' },
    respiratoir: { active: true, severity: 'strak' },
    neuro: { active: false, severity: 'los' },
    lever: { active: false, severity: 'los' },
    nieren: { active: false, severity: 'los' },
    overig: { active: true, severity: 'mild' }
};

// Initialize interactive elements
document.addEventListener('DOMContentLoaded', function() {
    initializeProblemButtons();
    initializeRiskButtons();
    initializeTagButtons();
    initializeOrganMonitoring();
    updateProgressBar();
    addHoverEffects();
});

// Problem selection functionality
function initializeProblemButtons() {
    const problemButtons = document.querySelectorAll('.section:first-of-type .btn');
    problemButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Remove selected class from all buttons in this group
            problemButtons.forEach(btn => btn.classList.remove('selected'));
            // Add selected class to clicked button
            this.classList.add('selected');
            selectedProblem = this.textContent;
            updateProgressBar();
        });
    });
}

// Risk level selection functionality
function initializeRiskButtons() {
    const riskButtons = document.querySelectorAll('.btn.risk-low, .btn.risk-med, .btn.risk-high');
    riskButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Remove selected class from all risk buttons
            riskButtons.forEach(btn => btn.classList.remove('selected'));
            // Add selected class to clicked button
            this.classList.add('selected');
            selectedRiskLevel = this.textContent;
            updateAlarmIndicator(this.textContent);
            updateProgressBar();
        });
    });
}

// Tag selection functionality
function initializeTagButtons() {
    const tagButtons = document.querySelectorAll('.tags-section .btn:not(.more-btn)');
    tagButtons.forEach(button => {
        button.addEventListener('click', function() {
            this.classList.toggle('selected');
            const tagText = this.textContent;
            
            if (this.classList.contains('selected')) {
                if (!selectedTags.includes(tagText)) {
                    selectedTags.push(tagText);
                }
            } else {
                selectedTags = selectedTags.filter(tag => tag !== tagText);
            }
        });
    });

    // More button functionality
    const moreBtn = document.querySelector('.more-btn');
    moreBtn.addEventListener('click', function() {
        alert('Meer opties worden binnenkort beschikbaar...');
    });
}

// Organ monitoring functionality
function initializeOrganMonitoring() {
    const monitorItems = document.querySelectorAll('.monitor-item');
    monitorItems.forEach((item, index) => {
        const organNames = ['circulatoir', 'respiratoir', 'neuro', 'lever', 'nieren', 'overig'];
        const organName = organNames[index];
        
        item.addEventListener('click', function() {
            toggleOrganMonitoring(organName, item);
        });
    });
}

function toggleOrganMonitoring(organName, element) {
    const circle = element.querySelector('.monitor-circle');
    const label = element.querySelector('.monitor-label');
    const status = element.querySelector('.monitor-status');
    
    if (organSettings[organName].active) {
        // Deactivate
        organSettings[organName].active = false;
        organSettings[organName].severity = 'los';
        circle.className = 'monitor-circle circle-inactive';
        label.classList.add('inactive-text');
        status.classList.add('inactive-text');
        status.textContent = 'los';
    } else {
        // Activate
        organSettings[organName].active = true;
        organSettings[organName].severity = 'mild';
        circle.className = 'monitor-circle circle-active';
        label.classList.remove('inactive-text');
        status.classList.remove('inactive-text');
        status.textContent = 'mild';
    }
    
    updateParameterCards();
}

function updateAlarmIndicator(riskLevel) {
    const alarmDiv = document.querySelector('.alarm-indicator');
    let alarmText = '';
    let bellCount = '';
    
    switch(riskLevel.toLowerCase()) {
        case 'laag':
            bellCount = '🔔';
            alarmText = 'langzamer een alarm';
            break;
        case 'mid':
            bellCount = '🔔 🔔';
            alarmText = 'normaal alarm tempo';
            break;
        case 'hoog':
            bellCount = '🔔 🔔 🔔';
            alarmText = 'sneller een alarm';
            break;
    }
    
    alarmDiv.innerHTML = `<div>${bellCount}</div><div>${alarmText}</div>`;
}

function updateParameterCards() {
    const valueCards = document.querySelectorAll('.value-card');
    const organNames = ['circulatoir', 'respiratoir', 'neuro', 'lever', 'nieren', 'overig'];
    
    valueCards.forEach((card, index) => {
        const organName = organNames[index];
        const labels = card.querySelectorAll('.value-label');
        const numbers = card.querySelectorAll('.value-number');
        
        if (organSettings[organName].active) {
            labels.forEach(label => label.classList.remove('inactive-text'));
            numbers.forEach(number => number.classList.remove('inactive-text'));
        } else {
            labels.forEach(label => label.classList.add('inactive-text'));
            numbers.forEach(number => number.classList.add('inactive-text'));
        }
    });
}

function updateProgressBar() {
    const stepNumbers = document.querySelectorAll('.step-number');
    let completedSteps = 1; // Always start with step 1
    
    if (selectedProblem) completedSteps = 2;
    if (selectedRiskLevel) completedSteps = 3;
    
    stepNumbers.forEach((step, index) => {
        if (index < completedSteps) {
            step.classList.remove('inactive');
            if (index === completedSteps - 1) {
                step.style.backgroundColor = '#007bff';
            }
        } else {
            step.classList.add('inactive');
        }
    });
}

// Navigation functions
function goBack() {
    if (confirm('Weet je zeker dat je terug wilt gaan? Alle wijzigingen gaan verloren.')) {
        // Reset all selections
        selectedProblem = null;
        selectedRiskLevel = null;
        selectedTags = [];
        
        // Reset UI
        document.querySelectorAll('.btn.selected').forEach(btn => btn.classList.remove('selected'));
        updateProgressBar();
        
        alert('Terug naar vorige stap...');
    }
}

function confirmSettings() {
    if (!selectedProblem || !selectedRiskLevel) {
        alert('Selecteer eerst een hoofdprobleem en risico niveau voordat je doorgaat.');
        return;
    }
    
    const summary = `
Overzicht instellingen:
- Hoofdprobleem: ${selectedProblem}
- Risico niveau: ${selectedRiskLevel}
- Additionele tags: ${selectedTags.length > 0 ? selectedTags.join(', ') : 'Geen'}
- Actieve monitoring: ${Object.keys(organSettings).filter(organ => organSettings[organ].active).join(', ')}
    `;
    
    if (confirm(summary + '\n\nWil je deze instellingen bevestigen?')) {
        alert('Instellingen opgeslagen! Patiënt monitoring is geactiveerd.');
        
        // Simulate moving to next step
        const lastStep = document.querySelector('.step:last-child .step-number');
        lastStep.classList.remove('inactive');
        lastStep.textContent = '✓';
        lastStep.style.backgroundColor = '#28a745';
    }
}

// Add hover effects for better UX
function addHoverEffects() {
    const buttons = document.querySelectorAll('.btn, .nav-btn');
    buttons.forEach(button => {
        button.addEventListener('mouseenter', function() {
            if (!this.classList.contains('selected')) {
                this.style.transform = 'scale(1.05)';
                this.style.transition = 'transform 0.2s ease';
            }
        });
        
        button.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1)';
        });
    });
}
