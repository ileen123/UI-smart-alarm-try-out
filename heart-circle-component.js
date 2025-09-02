class HeartCircleComponent {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.options = {
            size: options.size || 200,
            initialState: options.initialState || 'mid',
            interactive: options.interactive !== false, // default true
            ...options
        };
        
        // Get configurations from data manager if available, otherwise use defaults
        this.configurations = this.getConfigurations();
        
        this.init();
    }
    
    getConfigurations() {
        // Try to get configurations from SharedDataManager first
        if (window.sharedDataManager && window.sharedDataManager.getCircleConfigurations) {
            const configs = window.sharedDataManager.getCircleConfigurations();
            console.log('SharedDataManager circle configurations:', configs);
            if (configs && Object.keys(configs).length > 0) {
                console.log('Using SharedDataManager configurations');
                return configs;
            }
        }
        
        // Fallback: Try to get configurations from old data manager
        if (window.dataManager && window.dataManager.getCircleConfigurations) {
            const configs = window.dataManager.getCircleConfigurations();
            console.log('DataManager circle configurations:', configs);
            if (configs && Object.keys(configs).length > 0) {
                console.log('Using DataManager configurations');
                return configs;
            }
        }
        
        console.log('No data manager available, using fallback defaults');
        // Fallback to default configurations
        return {
            'low': {
                darkerBlueSize: 0.9, // ratio of total size
                darkerBlueOffset: 0.05,
                lightBlueSize: 0.8,
                lightBlueOffset: 0.1,
                whiteCenterSize: 0.3,
                whiteCenterOffset: 0.35
            },
            'mid': {
                darkerBlueSize: 0.8,
                darkerBlueOffset: 0.1,
                lightBlueSize: 0.6,
                lightBlueOffset: 0.2,
                whiteCenterSize: 0.3,
                whiteCenterOffset: 0.35
            },
            'high': {
                darkerBlueSize: 0.7,
                darkerBlueOffset: 0.15,
                lightBlueSize: 0.4,
                lightBlueOffset: 0.3,
                whiteCenterSize: 0.3,
                whiteCenterOffset: 0.35
            }
        };
    }
    
    init() {
        this.createHTML();
        this.applyCSS();
        if (this.options.interactive) {
            this.setupInteractions();
        }
        this.updateCircle(this.options.initialState);
    }
    
    createHTML() {
        const container = document.getElementById(this.containerId);
        if (!container) {
            console.error(`Container with id '${this.containerId}' not found`);
            return;
        }
        
        container.innerHTML = `
            <div class="heart-organ-circle" style="width: ${this.options.size}px; height: ${this.options.size}px;">
                <div class="heart-outer-border"></div>
                <div class="heart-darker-blue-ring"></div>
                <div class="heart-light-blue-circle"></div>
                <div class="heart-white-center">
                    <!-- SVG will be injected here -->
                </div>
            </div>
        `;
    }
    
    applyCSS() {
        if (!document.getElementById('heart-circle-styles')) {
            const style = document.createElement('style');
            style.id = 'heart-circle-styles';
            style.textContent = `
                .heart-organ-circle {
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto;
                    opacity: 0.3;
                    transition: opacity 0.5s ease-in-out;
                }
                
                .heart-outer-border {
                    position: absolute;
                    width: 100%;
                    height: 100%;
                    border-radius: 50%;
                    background: #0020CB;
                    top: 0;
                    left: 0;
                }
                
                .heart-darker-blue-ring {
                    position: absolute;
                    border-radius: 50%;
                    background: #1191FA;
                    transition: all 0.5s ease-in-out;
                }
                
                .heart-light-blue-circle {
                    position: absolute;
                    border-radius: 50%;
                    background: #C2E4FF;
                    transition: all 0.5s ease-in-out;
                }
                
                .heart-white-center {
                    position: absolute;
                    border-radius: 50%;
                    background: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10;
                    transition: all 0.5s ease-in-out;
                }
                
                .heart-icon {
                    width: 60%;
                    height: 60%;
                    object-fit: contain;
                    display: block;
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    setupInteractions() {
        const container = document.getElementById(this.containerId);
        container.addEventListener('click', () => {
            console.log('Circle clicked, no changes');
        });
        
        // Also add keyboard listener for 'r' key
        document.addEventListener('keydown', (event) => {
            if (event.key === 'r' || event.key === 'R') {
                this.promptForRiskLevel();
            }
        });
    }
    
    updateCircle(riskLevel) {
        const config = this.configurations[riskLevel.toLowerCase()];
        if (!config) {
            console.log('Invalid risk level. Use: low, mid, high');
            return;
        }
        
        const container = document.getElementById(this.containerId);
        const darkerBlueRing = container.querySelector('.heart-darker-blue-ring');
        const lightBlueCircle = container.querySelector('.heart-light-blue-circle');
        const whiteCenter = container.querySelector('.heart-white-center');
        
        const size = this.options.size;
        
        // Calculate sizes based on ratios
        const darkerBlueSize = size * config.darkerBlueSize;
        const darkerBlueOffset = size * config.darkerBlueOffset;
        const lightBlueSize = size * config.lightBlueSize;
        const lightBlueOffset = size * config.lightBlueOffset;
        const whiteCenterSize = size * config.whiteCenterSize;
        const whiteCenterOffset = size * config.whiteCenterOffset;
        
        // Apply styles
        darkerBlueRing.style.width = darkerBlueSize + 'px';
        darkerBlueRing.style.height = darkerBlueSize + 'px';
        darkerBlueRing.style.top = darkerBlueOffset + 'px';
        darkerBlueRing.style.left = darkerBlueOffset + 'px';
        
        lightBlueCircle.style.width = lightBlueSize + 'px';
        lightBlueCircle.style.height = lightBlueSize + 'px';
        lightBlueCircle.style.top = lightBlueOffset + 'px';
        lightBlueCircle.style.left = lightBlueOffset + 'px';
        
        whiteCenter.style.width = whiteCenterSize + 'px';
        whiteCenter.style.height = whiteCenterSize + 'px';
        whiteCenter.style.top = whiteCenterOffset + 'px';
        whiteCenter.style.left = whiteCenterOffset + 'px';
        
        this.currentState = riskLevel.toLowerCase();
        console.log(`Heart circle updated to ${riskLevel} risk level`);
    }
    
    promptForRiskLevel() {
        const riskLevel = prompt('Enter risk level (low, mid, high):');
        if (riskLevel) {
            this.updateCircle(riskLevel);
        }
    }
    
    // Public methods for external control
    setRiskLevel(level) {
        this.updateCircle(level);
    }
    
    getRiskLevel() {
        return this.currentState;
    }
}
