class HeartCircleComponent {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.options = {
            size: options.size || 200,
            initialState: options.initialState || 'mid',
            interactive: options.interactive !== false, // default true
            ...options
        };
        
        this.configurations = {
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
        
        this.init();
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
                    <svg class="heart-icon" viewBox="0 0 22 26" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M13.22 10.3743C12.0679 12.132 10.9163 15.0615 10.9163 19.1628M13.22 10.3743C12.0681 12.132 11.4922 14.4756 6.30842 14.4756M13.22 10.3743C14.6766 8.39884 16.9516 6.83964 19.3552 6.3986C20.0557 6.27006 20.6011 5.62288 20.4841 4.90863L20.2921 3.73684C20.1996 3.17181 19.7182 2.75127 19.159 2.81881C16.3987 3.15222 12.9705 4.8327 10.9162 7.44486C10.9162 6.27307 10.9162 2.75769 10.3402 1M5.73245 6.85896C5.15648 5.10127 4.00454 3.92948 2.27663 3.92948M1.70071 15.6441C2.85258 20.9171 7.26892 25 10.3401 25C13.4113 25 17.6365 20.9175 18.9799 15.6441C20.3232 10.3707 16.1 6.85563 13.2201 10.371C13.2201 8.61732 11.4922 6.85906 8.03639 6.85906C4.58057 6.85906 0.548838 10.371 1.70071 15.6441Z" stroke="black" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
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
            this.promptForRiskLevel();
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
