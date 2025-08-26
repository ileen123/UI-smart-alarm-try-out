
// Function to update circle based on risk level
function updateCircle(riskLevel) {
    const outerBorder = document.querySelector('.outer-border');
    const darkerBlueRing = document.querySelector('.darker-blue-ring');
    const lightBlueCircle = document.querySelector('.light-blue-circle');
    const whiteCenter = document.querySelector('.white-center');
    
    // Define bandwidth configurations for each risk level
    const configurations = {
        'low': {
            // Thin bands for low risk
            darkerBlueSize: 180,
            darkerBlueOffset: 10,
            lightBlueSize: 160,
            lightBlueOffset: 20,
            whiteCenterSize: 60,
            whiteCenterOffset: 70
        },
        'mid': {
            // Medium bands for medium risk
            darkerBlueSize: 160,
            darkerBlueOffset: 20,
            lightBlueSize: 120,
            lightBlueOffset: 40,
            whiteCenterSize: 60,
            whiteCenterOffset: 70
        },
        'high': {
            // Thick bands for high risk
            darkerBlueSize: 140,
            darkerBlueOffset: 30,
            lightBlueSize: 80,
            lightBlueOffset: 60,
            whiteCenterSize: 60,
            whiteCenterOffset: 70
        }
    };
    
    const config = configurations[riskLevel.toLowerCase()];
    
    if (config) {
        // Update darker blue ring
        darkerBlueRing.style.width = config.darkerBlueSize + 'px';
        darkerBlueRing.style.height = config.darkerBlueSize + 'px';
        darkerBlueRing.style.top = config.darkerBlueOffset + 'px';
        darkerBlueRing.style.left = config.darkerBlueOffset + 'px';
        
        // Update light blue circle
        lightBlueCircle.style.width = config.lightBlueSize + 'px';
        lightBlueCircle.style.height = config.lightBlueSize + 'px';
        lightBlueCircle.style.top = config.lightBlueOffset + 'px';
        lightBlueCircle.style.left = config.lightBlueOffset + 'px';
        
        // White center stays the same size but needs repositioning
        whiteCenter.style.width = config.whiteCenterSize + 'px';
        whiteCenter.style.height = config.whiteCenterSize + 'px';
        whiteCenter.style.top = config.whiteCenterOffset + 'px';
        whiteCenter.style.left = config.whiteCenterOffset + 'px';
        
        console.log(`Circle updated to ${riskLevel} risk level`);
    } else {
        console.log('Invalid input. Please enter "low", "mid", or "high"');
    }
}

// Simulate terminal input using browser prompt
function getRiskLevelInput() {
    const riskLevel = prompt('Enter risk level (low, mid, high):');
    if (riskLevel) {
        updateCircle(riskLevel);
    }
}

// Auto-prompt for input when page loads
window.addEventListener('load', function() {
    console.log('ICU Heart System loaded. Click anywhere to change risk level.');
    console.log('Valid inputs: "low", "mid", "high"');
    
    // Add click listener to trigger input
    document.body.addEventListener('click', getRiskLevelInput);
    
    // Auto-prompt after 2 seconds
    setTimeout(getRiskLevelInput, 2000);
});

// Also allow keyboard input (press 'r' for risk level input)
document.addEventListener('keydown', function(event) {
    if (event.key === 'r' || event.key === 'R') {
        getRiskLevelInput();
    }
});

console.log('Dynamic heart system monitoring circle loaded');
