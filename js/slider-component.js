// ICU Alarm Configuration - Modular Slider Component
// This file contains the VitalParameterSlider and PatientConfigurationHelper classes
// that can be integrated into any dashboard application.

class VitalParameterSlider {
    constructor(container, config) {
        this.container = container;
        this.config = {
            parameter: config.parameter || 'HR',
            name: config.name || 'Heart Rate',
            unit: config.unit || 'bpm',
            // Target range configuration
            targetRange: {
                min: config.targetRange?.min || 75,
                max: config.targetRange?.max || 100
            },
            // Y-axis configuration
            yAxis: {
                min: config.yAxis?.min || 40,
                max: config.yAxis?.max || 140,
                step: config.yAxis?.step || 20
            },
            // Monitoring level (loose, mid, tight)
            monitoringLevel: config.monitoringLevel || 'mid',
            // Patient info
            patientId: config.patientId,
            patientName: config.patientName,
            // Callbacks
            onChange: config.onChange || (() => {})
        };
        
        this.currentMin = this.config.targetRange.min;
        this.currentMax = this.config.targetRange.max;
        this.originalMin = this.config.targetRange.min;
        this.originalMax = this.config.targetRange.max;
        this.hasManualAdjustments = false;
        this.isDragging = false;
        this.currentHandle = null;
        this.scale = this.calculateScale();
        this.callbacks = [];
        
        this.render();
        this.attachEventListeners();
        this.updateButtonState();
        
        // Load existing settings from SharedDataManager after initial render
        setTimeout(() => {
            this.loadExistingSettings();
            this.initializeAlarmToggle();
        }, 100);
    }

    calculateScale() {
        // Use configurable y-axis range
        return {
            min: this.config.yAxis.min,
            max: this.config.yAxis.max,
            get range() { return this.max - this.min; }
        };
    }

    /**
     * Round value to appropriate step size based on parameter type
     */
    roundToStep(value) {
        if (this.config.parameter === 'Temperature') {
            // Round to nearest 0.5 for temperature
            return Math.round(value * 2) / 2;
        }
        // Default rounding to nearest integer
        return Math.round(value);
    }

    /**
     * Get minimum step between min and max values
     */
    getMinimumStep() {
        if (this.config.parameter === 'Temperature') {
            return 0.5; // Minimum 0.5°C difference
        }
        return 1; // Default minimum difference of 1
    }

    /**
     * Format value for display based on parameter type
     */
    formatValue(value) {
        if (this.config.parameter === 'Temperature') {
            // Show one decimal place for temperature
            return (Math.round(value * 2) / 2).toFixed(1);
        }
        // Default integer display
        return Math.round(value).toString();
    }

    valueToPixel(value) {
        const chartHeight = 270; // Chart area height (300 - 30 for x-axis)
        const percentage = (this.scale.max - value) / this.scale.range;
        return percentage * chartHeight;
    }

    pixelToValue(pixel) {
        const chartHeight = 270;
        const percentage = pixel / chartHeight;
        return this.scale.max - (percentage * this.scale.range);
    }

    render() {
        const sliderHTML = `
            <div class="vital-slider" data-vital="${this.config.parameter}">
                <div class="slider-title-container">
                    <div class="slider-title">${this.config.name}</div>
                    <label class="alarm-toggle detailed-page-toggle">
                        <input type="checkbox" id="alarm-toggle-${this.config.parameter.toLowerCase()}" data-parameter="${this.config.parameter}">
                        <span class="slider"></span>
                    </label>
                </div>
                <div class="value-display"></div>

                <div class="chart-container">
                    <div class="chart-background"></div>
                    <div class="sliding-values-outside">
                        <div class="sliding-value-outside max-value">${this.currentMax}</div>
                        <div class="sliding-value-outside min-value">${this.currentMin}</div>
                    </div>
                    <div class="chart-frame">
                        <svg class="graph-areas" width="100%" height="100%">
                            <defs>
                                <clipPath id="chart-clip">
                                    <rect x="0" y="0" width="100%" height="100%"/>
                                </clipPath>
                            </defs>
                            <g clip-path="url(#chart-clip)">
                                <g class="upper-areas"></g>
                                <g class="lower-areas"></g>
                            </g>
                        </svg>
                    </div>
                    <div class="target-range-overlay"></div>
                    <div class="range-handle upper" data-handle="max"></div>
                    <div class="range-handle lower" data-handle="min"></div>
                    <div class="y-axis"></div>
                    <div class="x-axis"></div>
                </div>

                <div class="unit-label">Seconds</div>
                <button class="save-button">Opslaan</button>
            </div>
        `;

        this.container.innerHTML = sliderHTML;
        this.updateSliderPosition();
        this.generateAxes();
        
        // Initialize button state (should be outlined initially since no manual adjustments)
        this.updateButtonState();
    }

    generateAxes() {
        this.generateYAxis();
        this.generateXAxis();
        this.generateGraphLines();
    }

    generateGraphLines() {
        const svg = this.container.querySelector('.graph-areas');
        const chartContainer = this.container.querySelector('.chart-container');
        const chartWidth = chartContainer.offsetWidth - 40;
        const chartHeight = 270;
        
        console.log(`generateGraphLines called for ${this.config.parameter}, loading ${this.config.monitoringLevel} SVG...`);
        console.log(`📏 Container dimensions: ${chartContainer.offsetWidth}px total, ${chartWidth}px chart area, ${chartHeight}px height`);
        
        // Use embedded SVG for all monitoring levels to avoid CORS issues
        this.createEmbeddedSVGForLevel(svg, chartWidth, chartHeight, this.config.monitoringLevel);
    }

    createEmbeddedSVG(svg, width, height) {
        // Clear existing filled areas
        const upperAreas = svg.querySelector('.upper-areas');
        const lowerAreas = svg.querySelector('.lower-areas');
        upperAreas.innerHTML = '';
        lowerAreas.innerHTML = '';
        
        // Create the SVG elements for upper areas (from Tight.svg)
        const upperSvgElements = [
            { type: 'rect', attrs: { width: '100%', height: '100%', fill: '#ECEC3E' } },
            { type: 'path', attrs: { d: 'M437 6.32426V131C355.986 117.7 142.332 93.6902 120.777 103.379C99.2214 113.068 78.3022 106.649 57.1498 70.4704L19 0L437 6.32426Z', fill: '#F0973E' } },
            { type: 'path', attrs: { d: 'M437 0.5V73C361.607 65.5886 162.776 52.209 142.716 57.6082C122.656 63.0074 103.188 59.4301 83.503 39.2698L48 0.5H437Z', fill: '#EB4921' } },
            { type: 'path', attrs: { d: 'M437 150.927V155H218.625H0.250488L0 0H4.5L12.7647 46.6505C15.5591 69.3794 31.7151 98.5862 45.2979 119.767C54.8349 126.31 63.7986 137.655 64.8242 147.802C65.8498 157.949 437 150.927 437 150.927Z', fill: '#00C877' } }
        ];
        
        // Create the SVG elements for lower areas (from Tight_down.svg)
        const lowerSvgElements = [
            { type: 'rect', attrs: { width: '100%', height: '100%', fill: '#ECEC3E' } },
            { type: 'path', attrs: { d: 'M437 148.676V24C355.986 37.3 142.332 61.3098 120.777 51.6209C99.2214 41.9319 78.3022 48.3515 57.1498 84.5296L19 155L437 148.676Z', fill: '#F0973E' } },
            { type: 'path', attrs: { d: 'M437 154.5V82C361.607 89.4114 162.776 102.791 142.716 97.3918C122.656 91.9926 103.188 95.5699 83.503 115.73L48 154.5H437Z', fill: '#EB4921' } },
            { type: 'path', attrs: { d: 'M437 4.07329V0H218.625H0.250488L0 155H4.5L12.7647 108.35C15.5591 85.6206 31.7151 56.4138 45.2979 35.2325C54.8349 28.6905 63.7986 17.3452 64.8242 7.19804C65.8498 -2.94916 437 4.07329 437 4.07329Z', fill: '#00C877' } }
        ];
        
        // Add elements to upper areas
        upperSvgElements.forEach(elem => {
            const element = document.createElementNS('http://www.w3.org/2000/svg', elem.type);
            Object.entries(elem.attrs).forEach(([key, value]) => {
                element.setAttribute(key, value);
            });
            upperAreas.appendChild(element);
        });
        
        // Add elements to lower areas
        lowerSvgElements.forEach(elem => {
            const element = document.createElementNS('http://www.w3.org/2000/svg', elem.type);
            Object.entries(elem.attrs).forEach(([key, value]) => {
                element.setAttribute(key, value);
            });
            lowerAreas.appendChild(element);
        });
        
        // Set the viewBox to match the original SVG
        svg.setAttribute('viewBox', '0 0 437 270');
        svg.setAttribute('preserveAspectRatio', 'none');
        
        console.log('Embedded SVG created with upper and lower areas');
        
        // Position the SVGs immediately after creation
        this.updateGraphPosition();
    }

    createEmbeddedSVGForLevel(svg, width, height, level) {
        // Clear existing filled areas
        const upperAreas = svg.querySelector('.upper-areas');
        const lowerAreas = svg.querySelector('.lower-areas');
        upperAreas.innerHTML = '';
        lowerAreas.innerHTML = '';
        
        // Try to load parameter-specific external SVGs first
        this.loadParameterSpecificSVG(svg, level, upperAreas, lowerAreas);
    }

    setAppropriateViewBox(svg, upperLoaded, lowerLoaded) {
        if (!svg) return;
        
        // For parameters with 400px wide external SVGs, adjust viewBox
        if ((this.config.parameter === 'Saturatie' && lowerLoaded) || 
            (this.config.parameter === 'AF' && upperLoaded) ||
            (this.config.parameter === 'Temperature' && upperLoaded) ||
            (this.config.parameter === 'BP_Mean' && lowerLoaded)) {
            console.log(`📐 Setting viewBox for ${this.config.parameter} external SVG (400px): 0 0 400 270`);
            svg.setAttribute('viewBox', '0 0 400 270');
        } else {
            // Use standard viewBox for other parameters or embedded SVGs
            console.log(`📐 Setting standard viewBox (437px): 0 0 437 270`);
            svg.setAttribute('viewBox', '0 0 437 270');
        }
        svg.setAttribute('preserveAspectRatio', 'none');
        
        // Position the SVGs immediately after viewBox is set
        this.updateGraphPosition();
    }

    async loadParameterSpecificSVG(svg, level, upperAreas, lowerAreas) {
        try {
            // Define which parameters have external SVGs available
            const externalSvgConfig = {
                HR: {
                    upper: true,  // HR has external upper SVGs
                    lower: false  // HR uses embedded lower SVGs (for now)
                },
                BP_Mean: {
                    upper: false, // BP uses embedded upper SVGs (for now)
                    lower: true   // BP has external lower SVGs (BP-tight-down.svg, etc.)
                },
                Saturatie: {
                    upper: false, // Saturatie uses embedded upper SVGs (for now)
                    lower: true   // Saturatie has external lower SVGs (Sat-tight-down.svg, etc.)
                },
                AF: {
                    upper: true,  // AF has external upper SVGs (AF-tight.svg, etc.)
                    lower: false  // AF uses embedded lower SVGs (for now)
                },
                Temperature: {
                    upper: true,  // Temperature has external upper SVGs (Temp-tight.svg, etc.)
                    lower: false  // Temperature uses embedded lower SVGs (for now)
                }
            };

            const paramConfig = externalSvgConfig[this.config.parameter];
            let upperLoaded = false;
            let lowerLoaded = false;

            // Load external upper SVG if available
            if (paramConfig && paramConfig.upper) {
                upperLoaded = await this.loadExternalSVGArea(upperAreas, 'upper', level);
            }

            // Load external lower SVG if available
            if (paramConfig && paramConfig.lower) {
                lowerLoaded = await this.loadExternalSVGArea(lowerAreas, 'lower', level);
            }

            // Call embedded fallback if no external SVGs were loaded
            if (!upperLoaded && !lowerLoaded) {
                this.loadEmbeddedSVGFallback(upperAreas, lowerAreas, level, false, false);
            } else {
                // If we have mixed external/embedded, call fallback to fill in missing pieces
                this.loadEmbeddedSVGFallback(upperAreas, lowerAreas, level, upperLoaded, lowerLoaded);
            }
            
            // Set appropriate viewBox based on which external SVGs were loaded
            this.setAppropriateViewBox(svg, upperLoaded, lowerLoaded);

        } catch (error) {
            console.warn(`Error loading external SVGs for ${this.config.parameter}:`, error);
            // Fallback to embedded SVGs
            this.loadEmbeddedSVGFallback(upperAreas, lowerAreas, level, false, false);
        }
    }

    async loadExternalSVGArea(targetArea, areaType, level) {
        try {
            // Construct filename based on parameter type
            let filename;
            if (this.config.parameter === 'Saturatie' && areaType === 'lower') {
                // Saturation lower SVGs: Sat-tight-down.svg, Sat-mid-down.svg, Sat-loose-down.svg
                filename = `Sat-${level.toLowerCase()}-down.svg`;
            } else if (this.config.parameter === 'AF' && areaType === 'upper') {
                // AF upper SVGs: AF-tight.svg, AF-mid.svg, AF-loose.svg
                filename = `AF-${level.toLowerCase()}.svg`;
            } else if (this.config.parameter === 'Temperature' && areaType === 'upper') {
                // Temperature upper SVGs: Temp-tight.svg, Temp-mid.svg, Temp-loose.svg
                filename = `Temp-${level.toLowerCase()}.svg`;
            } else if (this.config.parameter === 'BP_Mean' && areaType === 'lower') {
                // BP lower SVGs: BP-tight-down.svg, BP-mid-down.svg, BP-loose-down.svg
                filename = `BP-${level.toLowerCase()}-down.svg`;
            } else {
                // Standard format: HR-tight, HR-mid, HR-loose for upper
                // Future: HR-tight-down, HR-mid-down, HR-loose-down for lower
                const suffix = areaType === 'lower' ? '-down' : '';
                filename = `${this.config.parameter}-${level.toLowerCase()}${suffix}.svg`;
            }
            const svgPath = `./svg's/${filename}`;
            
            console.log(`Loading external SVG: ${svgPath} for ${this.config.parameter} ${areaType}`);

            const response = await fetch(svgPath);
            if (!response.ok) {
                console.log(`External SVG not found: ${svgPath}, using embedded fallback`);
                return false;
            }

            const svgText = await response.text();
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
            const svgElement = svgDoc.querySelector('svg');

            if (svgElement) {
                // Copy all child elements from external SVG to target area
                while (svgElement.firstChild) {
                    const child = svgElement.firstChild;
                    targetArea.appendChild(child);
                }
                
                // Don't apply scaling here - let the parent SVG's viewBox handle it
                console.log(`✅ Successfully loaded external ${areaType} SVG for ${this.config.parameter}`);
                return true;
            } else {
                console.warn(`Invalid SVG content in ${svgPath}`);
                return false;
            }

        } catch (error) {
            console.warn(`Failed to load external SVG for ${this.config.parameter} ${areaType}:`, error);
            return false;
        }
    }

    loadEmbeddedSVGFallback(upperAreas, lowerAreas, level, upperLoaded, lowerLoaded) {
        const svg = upperAreas.closest('svg');
        
        // Define correct SVG content for each monitoring level (copied from actual SVG files)
        const svgDefinitions = {
            tight: {
                upper: [
                    { type: 'rect', attrs: { width: '100%', height: '100%', fill: '#ECEC3E' } },
                    { type: 'path', attrs: { d: 'M437 6.32426V131C355.986 117.7 142.332 93.6902 120.777 103.379C99.2214 113.068 78.3022 106.649 57.1498 70.4704L19 0L437 6.32426Z', fill: '#F0973E' } },
                    { type: 'path', attrs: { d: 'M437 0.5V73C361.607 65.5886 162.776 52.209 142.716 57.6082C122.656 63.0074 103.188 59.4301 83.503 39.2698L48 0.5H437Z', fill: '#EB4921' } },
                    { type: 'path', attrs: { d: 'M437 150.927V155H218.625H0.250488L0 0H4.5L12.7647 46.6505C15.5591 69.3794 31.7151 98.5862 45.2979 119.767C54.8349 126.31 63.7986 137.655 64.8242 147.802C65.8498 157.949 437 150.927 437 150.927Z', fill: '#00C877' } }
                ],
                lower: [
                    { type: 'rect', attrs: { width: '100%', height: '100%', fill: '#ECEC3E' } },
                    { type: 'path', attrs: { d: 'M437 148.676V24C355.986 37.3 142.332 61.3098 120.777 51.621C99.2214 41.932 78.3022 48.351 57.1498 84.5296L19 155L437 148.676Z', fill: '#F0973E' } },
                    { type: 'path', attrs: { d: 'M437 154.5V82C361.607 89.4114 162.776 102.791 142.716 97.3918C122.656 91.9926 103.188 95.5699 83.503 115.73L48 154.5H437Z', fill: '#EB4921' } },
                    { type: 'path', attrs: { d: 'M437 4.07251V0H218.625H0.250488L0 155H4.5L12.7647 108.349C15.5591 85.6206 31.7151 56.4138 45.2979 35.233C54.8349 28.69 63.7986 17.345 64.8242 7.19775C65.8498 -2.94946 437 4.07251 437 4.07251Z', fill: '#00C877' } }
                ]
            },
            mid: {
                upper: [
                    { type: 'rect', attrs: { width: '437', height: '155', fill: '#ECEC3E' } },
                    { type: 'path', attrs: { d: 'M437 0V90C355.986 79.5685 219.055 61.5423 197.5 69.1416C175.945 76.7409 141.929 70.0922 120.777 41.7167L91 0H437Z', fill: '#F0973E' } },
                    { type: 'path', attrs: { d: 'M437 3.8147e-06V48C361.607 40.5104 241.06 27.3865 221 32.8426C200.94 38.2987 165.685 35.531 146 15.1581L124 3.8147e-06H437Z', fill: '#EB4921' } },
                    { type: 'path', attrs: { d: 'M437 149.173V155H218.625H0.25043L0 0H27.5C71.6495 92.0372 77 115.5 122.5 134.5C168 153.5 332.925 145.395 437 149.173Z', fill: '#00C877' } }
                ],
                lower: [
                    { type: 'rect', attrs: { width: '437', height: '155', fill: '#ECEC3E', transform: 'matrix(1 0 0 -1 0 155)' } },
                    { type: 'path', attrs: { d: 'M437 155V65C355.986 75.4315 219.055 93.4577 197.5 85.8584C175.945 78.2591 141.929 84.9078 120.777 113.283L91 155H437Z', fill: '#F0973E' } },
                    { type: 'path', attrs: { d: 'M437 155V107C361.607 114.49 241.06 127.613 221 122.157C200.94 116.701 165.685 119.469 146 139.842L124 155H437Z', fill: '#EB4921' } },
                    { type: 'path', attrs: { d: 'M437 5.82707V0H218.625H0.25043L0 155H27.5C71.6495 62.9628 77 39.5 122.5 20.5C168 1.5 332.925 9.60458 437 5.82707Z', fill: '#00C877' } }
                ]
            },
            loose: {
                upper: [
                    { type: 'rect', attrs: { width: '437', height: '155', fill: '#ECEC3E' } },
                    { type: 'path', attrs: { d: 'M437 149.173V155H218.625H0.25043L0 0H84C166.5 114.5 273 149.173 296 149.173H437Z', fill: '#00C877' } },
                    { type: 'path', attrs: { d: 'M437 -0.000205994V89C334.5 80.188 162.5 31.5001 110.5 -0.000175476L437 -0.000205994Z', fill: '#F0973E' } },
                    { type: 'path', attrs: { d: 'M437 0V37.4603C318.098 40.3962 254.491 31.8303 146 0H437Z', fill: '#EB4921' } }
                ],
                lower: [
                    { type: 'rect', attrs: { width: '437', height: '155', fill: '#ECEC3E', transform: 'matrix(1 0 0 -1 0 155)' } },
                    { type: 'path', attrs: { d: 'M437 5.82707V0H218.625H0.25043L0 155H84C166.5 40.5 273 5.82707 296 5.82707H437Z', fill: '#00C877' } },
                    { type: 'path', attrs: { d: 'M437 155V66C334.5 74.812 162.5 123.5 110.5 155L437 155Z', fill: '#F0973E' } },
                    { type: 'path', attrs: { d: 'M437 155V117.54C318.098 114.604 254.491 123.17 146 155H437Z', fill: '#EB4921' } }
                ]
            }
        };
        
        let levelData = svgDefinitions[level.toLowerCase()];
        if (!levelData) {
            console.warn(`Unknown monitoring level: ${level}, using tight as fallback`);
            levelData = svgDefinitions.tight;
        }
        
        // Only create upper areas if not already loaded externally
        if (!upperLoaded) {
            levelData.upper.forEach(elementData => {
                const element = document.createElementNS('http://www.w3.org/2000/svg', elementData.type);
                Object.entries(elementData.attrs).forEach(([key, value]) => {
                    element.setAttribute(key, value);
                });
                upperAreas.appendChild(element);
            });
            console.log(`📄 Created embedded upper SVG for ${level} level`);
        } else {
            console.log(`⚡ Skipped upper SVG creation - external SVG already loaded for ${level}`);
        }
        
        // Only create lower areas if not already loaded externally
        if (!lowerLoaded) {
            levelData.lower.forEach(elementData => {
                const element = document.createElementNS('http://www.w3.org/2000/svg', elementData.type);
                Object.entries(elementData.attrs).forEach(([key, value]) => {
                    element.setAttribute(key, value);
                });
                lowerAreas.appendChild(element);
            });
            console.log(`📄 Created embedded lower SVG for ${level} level`);
        } else {
            console.log(`⚡ Skipped lower SVG creation - external SVG already loaded for ${level}`);
        }
        
        // Set the viewBox to match the original SVG - this will automatically scale content
        if (svg) {
            // For Saturation external SVGs that are 400px wide, we need to adjust the viewBox
            if (this.config.parameter === 'Saturatie' && lowerLoaded) {
                // Use a viewBox that matches the external SVG dimensions (400px wide)
                svg.setAttribute('viewBox', '0 0 400 270');
            } else {
                // Use standard viewBox for other parameters
                svg.setAttribute('viewBox', '0 0 437 270');
            }
            svg.setAttribute('preserveAspectRatio', 'none');
        }
        
        console.log(`✅ SVG fallback completed for ${level} level (upper: ${upperLoaded ? 'external' : 'embedded'}, lower: ${lowerLoaded ? 'external' : 'embedded'})`);
        
        // Position the SVGs immediately after creation
        this.updateGraphPosition();
    }

    async loadExternalSVG(svg, width, height) {
        try {
            // Determine SVG file names based on monitoring level
            const level = this.config.monitoringLevel.charAt(0).toUpperCase() + this.config.monitoringLevel.slice(1);
            const upperSvgFile = `./svg's/${level}.svg`;
            const lowerSvgFile = `./svg's/${level}_down.svg`;
            
            console.log(`Loading SVG files: ${upperSvgFile} and ${lowerSvgFile}`);
            
            // Load both SVG files
            const [upperResponse, lowerResponse] = await Promise.all([
                fetch(upperSvgFile),
                fetch(lowerSvgFile)
            ]);
            
            const [upperSvgText, lowerSvgText] = await Promise.all([
                upperResponse.text(),
                lowerResponse.text()
            ]);
            
            // Parse the SVGs
            const parser = new DOMParser();
            const upperSvgDoc = parser.parseFromString(upperSvgText, 'image/svg+xml');
            const lowerSvgDoc = parser.parseFromString(lowerSvgText, 'image/svg+xml');
            const upperExternalSVG = upperSvgDoc.documentElement;
            const lowerExternalSVG = lowerSvgDoc.documentElement;
            
            // Clear existing filled areas
            const upperAreas = svg.querySelector('.upper-areas');
            const lowerAreas = svg.querySelector('.lower-areas');
            upperAreas.innerHTML = '';
            lowerAreas.innerHTML = '';
            
            // Extract paths from the upper SVG and clone them
            const upperPaths = upperExternalSVG.querySelectorAll('path, rect');
            upperPaths.forEach(path => {
                const clonedPath = path.cloneNode(true);
                upperAreas.appendChild(clonedPath);
            });
            
            // Extract paths from the lower SVG and clone them
            const lowerPaths = lowerExternalSVG.querySelectorAll('path, rect');
            lowerPaths.forEach(path => {
                const clonedPath = path.cloneNode(true);
                lowerAreas.appendChild(clonedPath);
            });
            
            // Scale the SVG groups to match the embedded SVG coordinate system
            // External SVGs are 437x155, we need them to fit in 437x270 space
            const scaleY = 270 / 155; // Scale factor to match embedded SVG height
            upperAreas.setAttribute('transform', `scale(1, ${scaleY})`);
            lowerAreas.setAttribute('transform', `scale(1, ${scaleY})`);
            
            // Use the same viewBox as embedded SVG for consistency
            svg.setAttribute('viewBox', '0 0 437 270');
            svg.setAttribute('preserveAspectRatio', 'none');
            
            console.log(`SVG loaded successfully: ${upperPaths.length} upper paths, ${lowerPaths.length} lower paths`);
            
            // Position the SVGs immediately after creation
            this.updateGraphPosition();
            
        } catch (error) {
            console.error(`Error loading ${this.config.monitoringLevel} SVG files:`, error);
            // Fallback to embedded method if SVG files fail to load
            this.createEmbeddedSVG(svg, width, height);
        }
    }

    updateGraphPosition() {
        const svg = this.container.querySelector('.graph-areas');
        const chartContainer = this.container.querySelector('.chart-container');
        const chartHeight = 270;
        
        // Upper area: attach to upper dashed line (top handle)
        const upperPos = this.valueToPixel(this.currentMax);
        // Lower area: attach to lower dashed line (bottom handle)
        const lowerPos = this.valueToPixel(this.currentMin);
        
        // Move upper-areas group: position so the bottom of the SVG (green area) aligns with the upper dashed line
        const upperAreas = svg.querySelector('.upper-areas');
        if (upperAreas && upperAreas.firstChild) {
            // Check if we're using external SVGs for upper areas
            const isExternalUpperSVG = (this.config.parameter === 'HR') || (this.config.parameter === 'AF') || (this.config.parameter === 'Temperature');
            
            if (isExternalUpperSVG) {
                // External SVGs: HR has height 286, AF has height 262, Temperature has height 260
                // Position so bottom aligns with upper dashed line, add 1 extra pixel for perfect alignment without gaps
                let svgHeight;
                if (this.config.parameter === 'HR') {
                    svgHeight = 286;
                } else if (this.config.parameter === 'AF') {
                    svgHeight = 262;
                } else if (this.config.parameter === 'Temperature') {
                    svgHeight = 260;
                }
                upperAreas.setAttribute('transform', `translate(0,${upperPos - svgHeight - 1})`);
            } else {
                // Embedded SVGs have height 155, position with slight adjustment to eliminate gap
                // Subtract 1 extra pixel to ensure perfect alignment
                upperAreas.setAttribute('transform', `translate(0,${upperPos - 155 - 1})`);
            }
        }
        
        // Move lower-areas group: attach the TOP of the SVG to the lower dashed line (so it extends downward)
        const lowerAreas = svg.querySelector('.lower-areas');
        if (lowerAreas && lowerAreas.firstChild) {
            // Check if we're using external SVGs for lower areas (Saturatie and BP_Mean parameters)
            const isExternalLowerSVG = this.config.parameter === 'Saturatie' || this.config.parameter === 'BP_Mean';
            
            if (isExternalLowerSVG) {
                // External lower SVGs (Saturatie, BP): scale and position appropriately
                lowerAreas.setAttribute('transform', `translate(0,${lowerPos})`);
            } else {
                // Embedded SVGs: use original positioning
                lowerAreas.setAttribute('transform', `translate(0,${lowerPos})`);
            }
        }
        
        // Both areas are clipped by the chart-frame, so they extend outward from their respective dashed lines
    }

    generateYAxis() {
        const yAxis = this.container.querySelector('.y-axis');
        yAxis.innerHTML = ''; // Clear existing labels
        
        // Use configurable y-axis parameters
        const { min, max, step } = this.config.yAxis;
        
        for (let value = min; value <= max; value += step) {
            const label = document.createElement('div');
            label.className = 'y-axis-label';
            label.style.top = `${this.valueToPixel(value)}px`;
            label.textContent = value;
            
            yAxis.appendChild(label);
        }
    }

    generateXAxis() {
        const xAxis = this.container.querySelector('.x-axis');
        xAxis.innerHTML = ''; // Clear existing labels
        
        // Create x-axis labels for seconds (0, 10, 20, 30, 40, 50, 60)
        const timePoints = [0, 10, 20, 30, 40, 50, 60];
        const chartContainer = this.container.querySelector('.chart-container');
        const chartWidth = chartContainer.offsetWidth - 40; // Subtract y-axis width
        
        timePoints.forEach(seconds => {
            const label = document.createElement('div');
            label.className = 'x-axis-label';
            
            if (seconds === 60) {
                // Position "60" at the right edge
                label.style.left = `${chartWidth}px`;
            } else {
                // Distribute other labels evenly across the available space
                label.style.left = `${(seconds / 60) * (chartWidth - 10)}px`;
            }
            
            label.textContent = seconds;
            xAxis.appendChild(label);
        });
        
        // Store the 30-second position for slider alignment (middle of 0-60 timeline)
        this.thirtySecondPosition = (30 / 60) * (chartWidth - 10);
    }

    updateSliderPosition() {
        const targetRangeOverlay = this.container.querySelector('.target-range-overlay');
        const upperHandle = this.container.querySelector('.range-handle.upper');
        const lowerHandle = this.container.querySelector('.range-handle.lower');
        const maxValueElement = this.container.querySelector('.sliding-value-outside.max-value');
        const minValueElement = this.container.querySelector('.sliding-value-outside.min-value');
        
        const upperPos = this.valueToPixel(this.currentMax);
        const lowerPos = this.valueToPixel(this.currentMin);
        
        // Calculate 30-second position (middle of 0-60 timeline)
        const chartContainer = this.container.querySelector('.chart-container');
        const chartWidth = chartContainer.offsetWidth - 40; // Account for right margin only
        // The colored rectangle starts at 0 (after padding), so 30s is in the center of the chart area
        const thirtySecondPos = (30 / 60) * chartWidth + 0; // 0 is the left edge of the colored area
        
        // Update handle positions - align with 30 seconds
        upperHandle.style.top = `${upperPos}px`;
        upperHandle.style.left = `${thirtySecondPos}px`;
        lowerHandle.style.top = `${lowerPos}px`;
        lowerHandle.style.left = `${thirtySecondPos}px`;
        
        // Update target range overlay
        targetRangeOverlay.style.top = `${upperPos}px`;
        targetRangeOverlay.style.height = `${lowerPos - upperPos}px`;
        
        // Update sliding values position and content
        maxValueElement.style.top = `${upperPos}px`;
        maxValueElement.textContent = this.formatValue(this.currentMax);
        minValueElement.style.top = `${lowerPos}px`;
        minValueElement.textContent = this.formatValue(this.currentMin);
        
        // Update graph lines position
        this.updateGraphPosition();
    }

    attachEventListeners() {
        const handles = this.container.querySelectorAll('.range-handle');
        const saveButton = this.container.querySelector('.save-button');
        
        handles.forEach(handle => {
            handle.addEventListener('mousedown', (e) => this.startDrag(e, handle));
            handle.addEventListener('touchstart', (e) => this.startDrag(e, handle));
        });

        document.addEventListener('mousemove', (e) => this.onDrag(e));
        document.addEventListener('mouseup', () => this.stopDrag());
        document.addEventListener('touchmove', (e) => this.onDrag(e));
        document.addEventListener('touchend', () => this.stopDrag());

        saveButton.addEventListener('click', () => this.saveChanges());
    }

    startDrag(event, handle) {
        event.preventDefault();
        this.isDragging = true;
        this.currentHandle = handle;
        handle.style.cursor = 'grabbing';
        
        // Add visual feedback - shadow removed
        // this.container.querySelector('.vital-slider').style.boxShadow = '0 15px 40px rgba(52, 152, 219, 0.3)';
    }

    onDrag(event) {
        if (!this.isDragging || !this.currentHandle) return;
        
        event.preventDefault();
        
        const chartContainer = this.container.querySelector('.chart-container');
        const rect = chartContainer.getBoundingClientRect();
        
        let clientY;
        if (event.type === 'touchmove') {
            clientY = event.touches[0].clientY;
        } else {
            clientY = event.clientY;
        }
        
        const relativeY = clientY - rect.top;
        const clampedY = Math.max(0, Math.min(270, relativeY)); // Chart height is 270px
        const newValue = this.pixelToValue(clampedY);
        
        const handleType = this.currentHandle.dataset.handle;
        
        if (handleType === 'max') {
            this.currentMax = Math.max(this.currentMin + this.getMinimumStep(), this.roundToStep(newValue));
        } else {
            this.currentMin = Math.min(this.currentMax - this.getMinimumStep(), this.roundToStep(newValue));
        }
        
        // Check if manual adjustments have been made
        this.checkForManualAdjustments();
        
        this.updateSliderPosition();
        this.notifyChange();
    }

    stopDrag() {
        if (!this.isDragging) return;
        
        this.isDragging = false;
        if (this.currentHandle) {
            this.currentHandle.style.cursor = 'grab';
        }
        this.currentHandle = null;
        
        // Remove visual feedback - shadow removed
        // this.container.querySelector('.vital-slider').style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.1)';
    }

    /**
     * Check if the user has made manual adjustments to the slider values
     */
    checkForManualAdjustments() {
        const currentMin = Math.round(this.currentMin * 10) / 10;
        const currentMax = Math.round(this.currentMax * 10) / 10;
        
        const hasChanged = (currentMin !== this.originalMin) || (currentMax !== this.originalMax);
        
        if (hasChanged !== this.hasManualAdjustments) {
            this.hasManualAdjustments = hasChanged;
            this.updateButtonState();
        }
    }

    /**
     * Update the save button state based on whether manual adjustments have been made
     */
    updateButtonState() {
        const saveButton = this.container.querySelector('.save-button');
        if (saveButton) {
            if (this.hasManualAdjustments) {
                saveButton.classList.remove('outlined');
            } else {
                saveButton.classList.add('outlined');
            }
        }
    }

    /**
     * Load existing settings from SharedDataManager
     */
    loadExistingSettings() {
        if (window.sharedDataManager && this.config.patientId) {
            try {
                console.log(`🔄 Loading existing settings for ${this.config.parameter} from patient ${this.config.patientId}`);
                
                // Check if pneumonie is active and this is AF parameter - skip loading saved settings
                if (this.config.parameter === 'AF') {
                    const pneumonieState = window.sharedDataManager.getPatientConditionState('pneumonie', this.config.patientId);
                    if (pneumonieState && pneumonieState.isActive) {
                        console.log('🫁 Pneumonie is active - skipping saved AF settings to preserve 10-30 range');
                        console.log('ℹ️ No custom settings loaded for AF due to active pneumonie condition');
                        return false;
                    }
                }
                
                // Check if sepsis is active and this is HR or BP parameter - skip loading saved settings
                if (['HR', 'BP_Mean'].includes(this.config.parameter)) {
                    const sepsisState = window.sharedDataManager.getPatientConditionState('sepsis', this.config.patientId);
                    if (sepsisState && sepsisState.isActive) {
                        console.log(`🦠 Sepsis is active - skipping saved ${this.config.parameter} settings to preserve sepsis ranges`);
                        console.log(`ℹ️ No custom settings loaded for ${this.config.parameter} due to active sepsis condition`);
                        return false;
                    }
                }
                
                // Get patient medical info
                const medicalInfo = window.sharedDataManager.getPatientMedicalInfo(this.config.patientId);
                
                if (medicalInfo && medicalInfo.customThresholds) {
                    // Determine which organ system this parameter belongs to
                    let organSystem = 'overig'; // default
                    if (['HR', 'BP_Mean'].includes(this.config.parameter)) {
                        organSystem = 'circulatoir';
                    } else if (['Saturatie', 'RR', 'AF'].includes(this.config.parameter)) {
                        organSystem = 'respiratoir';
                    } else if (['Temp'].includes(this.config.parameter)) {
                        organSystem = 'overig';
                    }
                    
                    // Check if custom thresholds exist for this parameter
                    const customThreshold = medicalInfo.customThresholds[organSystem]?.[this.config.parameter];
                    
                    if (customThreshold) {
                        console.log(`✅ Found custom threshold for ${this.config.parameter}:`, customThreshold);
                        
                        // Update current values
                        this.currentMin = customThreshold.min;
                        this.currentMax = customThreshold.max;
                        
                        // Update the original values to track against
                        this.originalMin = customThreshold.min;
                        this.originalMax = customThreshold.max;
                        
                        // Update the configuration
                        this.config.targetRange.min = customThreshold.min;
                        this.config.targetRange.max = customThreshold.max;
                        
                        // Update the UI
                        this.updateSliderPosition();
                        this.updateDisplayValues();
                        
                        // Initial button state should be outlined since no manual adjustments yet
                        this.updateButtonState();
                        
                        console.log(`✅ Loaded settings: ${this.currentMin}-${this.currentMax} ${this.config.unit}`);
                        return true;
                    }
                }
                
                // Try to load from condition-based thresholds (sepsis, etc.)
                if (medicalInfo && medicalInfo.selectedTags) {
                    const thresholds = window.sharedDataManager.getThresholdsByTags(medicalInfo.selectedTags);
                    
                    if (thresholds && this.config.parameter === 'HR' && thresholds.circulatoir?.HR) {
                        const hrThresholds = thresholds.circulatoir.HR;
                        this.currentMin = hrThresholds.min;
                        this.currentMax = hrThresholds.max;
                        
                        // Update the original values to track against
                        this.originalMin = hrThresholds.min;
                        this.originalMax = hrThresholds.max;
                        
                        this.config.targetRange.min = hrThresholds.min;
                        this.config.targetRange.max = hrThresholds.max;
                        
                        this.updateSliderPosition();
                        this.updateDisplayValues();
                        
                        // Initial button state should be outlined since no manual adjustments yet
                        this.updateButtonState();
                        
                        console.log(`✅ Loaded condition-based HR thresholds: ${this.currentMin}-${this.currentMax} ${this.config.unit}`);
                        return true;
                    } else if (thresholds && this.config.parameter === 'BP_Mean' && thresholds.circulatoir?.BP_Mean) {
                        const bpThresholds = thresholds.circulatoir.BP_Mean;
                        this.currentMin = bpThresholds.min;
                        this.currentMax = bpThresholds.max;
                        
                        // Update the original values to track against
                        this.originalMin = bpThresholds.min;
                        this.originalMax = bpThresholds.max;
                        
                        this.config.targetRange.min = bpThresholds.min;
                        this.config.targetRange.max = bpThresholds.max;
                        
                        this.updateSliderPosition();
                        this.updateDisplayValues();
                        
                        // Initial button state should be outlined since no manual adjustments yet
                        this.updateButtonState();
                        
                        console.log(`✅ Loaded condition-based BP thresholds: ${this.currentMin}-${this.currentMax} ${this.config.unit}`);
                        return true;
                    }
                }
                
                console.log(`ℹ️ No custom settings found for ${this.config.parameter}, using defaults`);
                return false;
                
            } catch (error) {
                console.error('❌ Error loading existing settings:', error);
                return false;
            }
        } else {
            console.log('⚠️ SharedDataManager or patientId not available');
            return false;
        }
    }

    /**
     * Initialize alarm toggle functionality
     */
    initializeAlarmToggle() {
        const expectedId = `alarm-toggle-${this.config.parameter.toLowerCase()}`;
        const toggleInput = this.container.querySelector(`#${expectedId}`);
        
        console.log(`🔍 Initializing toggle for ${this.config.parameter}, looking for ID: ${expectedId}`);
        console.log(`🔍 Toggle input found:`, !!toggleInput);
        
        if (!toggleInput) {
            console.error(`❌ Toggle input not found for ${this.config.parameter}`);
            console.log('🔍 Available inputs in container:', this.container.querySelectorAll('input'));
            return;
        }

        // Load current alarm state from SharedDataManager
        if (window.sharedDataManager && this.config.patientId) {
            const isEnabled = window.sharedDataManager.getParameterAlarmEnabled(this.config.patientId, this.config.parameter);
            toggleInput.checked = isEnabled;
            console.log(`✅ Loaded alarm state for ${this.config.parameter}: ${isEnabled ? 'ON' : 'OFF'}`);
        } else {
            console.warn(`⚠️ SharedDataManager or patientId not available for ${this.config.parameter}`);
        }

        // Remove any existing event listeners to prevent duplicates
        const newToggleInput = toggleInput.cloneNode(true);
        toggleInput.parentNode.replaceChild(newToggleInput, toggleInput);

        // Add change event listener to the new element
        newToggleInput.addEventListener('change', (e) => {
            const isEnabled = e.target.checked;
            console.log(`🔔 Alarm toggle CHANGED for ${this.config.parameter}: ${isEnabled ? 'ON' : 'OFF'}`);
            console.log(`🔔 Patient ID: ${this.config.patientId}`);
            
            // Update visual state immediately
            this.updateParameterVisualState(isEnabled);
            
            // Update SharedDataManager
            if (window.sharedDataManager && this.config.patientId) {
                console.log(`📞 Calling setParameterAlarmEnabled(${this.config.patientId}, ${this.config.parameter}, ${isEnabled})`);
                window.sharedDataManager.setParameterAlarmEnabled(this.config.patientId, this.config.parameter, isEnabled);
            } else {
                console.error(`❌ Cannot save alarm state - missing SharedDataManager or patientId`);
            }
        });

        // Add click handler to the toggle label for additional debugging and activation
        const toggleLabel = newToggleInput.closest('.alarm-toggle');
        if (toggleLabel) {
            toggleLabel.addEventListener('click', (e) => {
                // Let the default behavior handle the toggle, just add logging
                console.log(`👆 Toggle label CLICKED for ${this.config.parameter}`);
                console.log(`👆 Current input state before click: ${newToggleInput.checked}`);
                
                // The click will trigger the change event above
            });
        }

        // Store reference for synchronization
        this.toggleInput = newToggleInput;

        // Set initial visual state
        this.updateParameterVisualState(newToggleInput.checked);

        // Listen for alarm state changes from other pages
        const syncHandler = (e) => {
            if (e.detail.parameter === this.config.parameter && e.detail.patientId === this.config.patientId) {
                if (this.toggleInput) {
                    this.toggleInput.checked = e.detail.isEnabled;
                    // Update visual state when synchronized
                    this.updateParameterVisualState(e.detail.isEnabled);
                    console.log(`🔄 Synchronized alarm state for ${this.config.parameter}: ${e.detail.isEnabled ? 'ON' : 'OFF'}`);
                }
            }
        };

        // Remove existing listener and add new one
        window.removeEventListener('parameterAlarmToggled', syncHandler);
        window.addEventListener('parameterAlarmToggled', syncHandler);
    }

    /**
     * Update visual state of parameter based on alarm enabled/disabled
     * @param {boolean} isEnabled - Whether the alarm is enabled
     */
    updateParameterVisualState(isEnabled) {
        const vitalSlider = this.container.querySelector('.vital-slider');
        if (vitalSlider) {
            if (isEnabled) {
                vitalSlider.classList.remove('parameter-disabled');
                console.log(`✅ ${this.config.parameter} visual state: ENABLED`);
            } else {
                vitalSlider.classList.add('parameter-disabled');
                console.log(`🔒 ${this.config.parameter} visual state: DISABLED`);
            }
        }
    }

    /**
     * Update display values in the UI
     */
    updateDisplayValues() {
        const maxValueElement = this.container.querySelector('.sliding-value-outside.max-value');
        const minValueElement = this.container.querySelector('.sliding-value-outside.min-value');
        
        if (maxValueElement) {
            maxValueElement.textContent = this.formatValue(this.currentMax);
        }
        if (minValueElement) {
            minValueElement.textContent = this.formatValue(this.currentMin);
        }
    }

    saveChanges() {
        // Check if parameter is disabled (alarm OFF)
        const vitalSlider = this.container.querySelector('.vital-slider');
        if (vitalSlider && vitalSlider.classList.contains('parameter-disabled')) {
            console.log(`⚠️ Cannot save ${this.config.parameter} - parameter is disabled (alarm OFF)`);
            return;
        }

        const button = this.container.querySelector('.save-button');
        const originalText = button.textContent;
        
        button.textContent = 'Saving...';
        button.disabled = true;
        
        // Save to SharedDataManager if available
        if (window.sharedDataManager && this.config.patientId) {
            try {
                // Create the settings object based on parameter type
                const settingsData = {
                    [this.config.parameter]: {
                        min: this.currentMin,
                        max: this.currentMax,
                        unit: this.config.unit
                    }
                };
                
                // Determine which organ system this parameter belongs to
                let organSystem = 'overig'; // default
                if (['HR', 'BP_Mean'].includes(this.config.parameter)) {
                    organSystem = 'circulatoir';
                } else if (['Saturatie', 'RR', 'AF'].includes(this.config.parameter)) {
                    organSystem = 'respiratoir';
                } else if (['Temp'].includes(this.config.parameter)) {
                    organSystem = 'overig';
                }
                
                // Get existing patient medical info
                const medicalInfo = window.sharedDataManager.getPatientMedicalInfo(this.config.patientId) || {};
                
                // Initialize custom thresholds if not exists
                if (!medicalInfo.customThresholds) {
                    medicalInfo.customThresholds = {};
                }
                if (!medicalInfo.customThresholds[organSystem]) {
                    medicalInfo.customThresholds[organSystem] = {};
                }
                
                // Update the specific parameter
                medicalInfo.customThresholds[organSystem][this.config.parameter] = {
                    min: this.currentMin,
                    max: this.currentMax,
                    unit: this.config.unit
                };
                medicalInfo.lastUpdated = new Date().toISOString();
                
                // Save updated medical info
                window.sharedDataManager.savePatientMedicalInfo(this.config.patientId, medicalInfo);
                
                // CRITICAL: Update the target ranges that alarm overview reads from
                let currentTargetRanges = window.sharedDataManager.getPatientTargetRanges(this.config.patientId) || {};
                console.log(`📊 Before updating target ranges for ${this.config.parameter}:`, JSON.stringify(currentTargetRanges));
                
                // Only update the specific parameter being changed
                currentTargetRanges[this.config.parameter] = {
                    min: this.currentMin,
                    max: this.currentMax,
                    unit: this.config.unit
                };
                
                console.log(`📊 After updating target ranges for ${this.config.parameter}:`, JSON.stringify(currentTargetRanges));
                window.sharedDataManager.savePatientTargetRanges(this.config.patientId, currentTargetRanges);
                
                console.log(`✅ Saved ${this.config.parameter} settings to SharedDataManager for patient ${this.config.patientId}`);
                
                // CONDITIONAL WEBSOCKET TRIGGER: Only send immediately if NOT part of tag parameter changes
                // Tag parameter changes have their own delayed websocket trigger to ensure proper order
                const isPartOfTagChange = sessionStorage.getItem('tagParameterChangeInProgress');
                if (!isPartOfTagChange) {
                    console.log(`📤 Slider threshold changed - sending current display state via websocket`);
                    window.sharedDataManager.sendFullThresholdsRiskLevels(this.config.patientId);
                } else {
                    console.log(`⏸️ Slider threshold changed - skipping immediate websocket (tag change in progress)`);
                }
                
                // Update original values since changes are now saved
                this.originalMin = this.currentMin;
                this.originalMax = this.currentMax;
                this.hasManualAdjustments = false;
                
                // Real save with success feedback
                setTimeout(() => {
                    button.textContent = 'Saved ✓';
                    button.style.background = '#FC6039';
                    button.style.opacity = '0.7';
                    
                    setTimeout(() => {
                        button.textContent = originalText;
                        button.disabled = false;
                        button.style.background = '';
                        button.style.opacity = '1';
                        
                        // Update button state to outlined since changes are saved
                        this.updateButtonState();
                    }, 1500);
                }, 300);
                
            } catch (error) {
                console.error('❌ Error saving to SharedDataManager:', error);
                
                // Show error feedback
                setTimeout(() => {
                    button.textContent = 'Error ✗';
                    button.style.background = 'linear-gradient(135deg, #e74c3c, #c0392b)';
                    
                    setTimeout(() => {
                        button.textContent = originalText;
                        button.disabled = false;
                        button.style.background = '';
                    }, 2000);
                }, 300);
            }
        } else {
            // Fallback to simulation if no data manager available
            setTimeout(() => {
                button.textContent = 'Saved ✓';
                button.style.background = '#FC6039';
                button.style.opacity = '0.7';
                
                setTimeout(() => {
                    button.textContent = originalText;
                    button.disabled = false;
                    button.style.background = '';
                    button.style.opacity = '1';
                }, 1500);
            }, 800);
            
            console.log('⚠️ SharedDataManager not available, using simulation mode');
        }
        
        this.notifyChange('save');
        console.log(`Saved changes for ${this.config.name}:`, {
            parameter: this.config.parameter,
            min: this.currentMin,
            max: this.currentMax,
            unit: this.config.unit,
            patientId: this.config.patientId
        });
    }

    onChange(callback) {
        this.callbacks.push(callback);
    }

    notifyChange(type = 'change') {
        const data = {
            type,
            parameter: this.config.parameter,
            min: this.currentMin,
            max: this.currentMax,
            patientId: this.config.patientId,
            patientName: this.config.patientName,
            config: this.config
        };
        
        // Call the onChange callback from config
        if (this.config.onChange) {
            this.config.onChange(data);
        }
        
        // Call any additional callbacks
        this.callbacks.forEach(callback => {
            callback(data);
        });
    }

    updateConfig(newConfig) {
        Object.assign(this.config, newConfig);
        this.currentMin = this.config.targetRange.min;
        this.currentMax = this.config.targetRange.max;
        this.scale = this.calculateScale();
        this.updateSliderPosition();
        this.generateAxes();
        // If monitoring level changed, regenerate the SVG graphics
        if (newConfig.monitoringLevel) {
            this.generateGraphLines();
        }
    }

    // Method to update monitoring level specifically
    updateMonitoringLevel(level) {
        if (['loose', 'mid', 'tight'].includes(level.toLowerCase())) {
            this.config.monitoringLevel = level.toLowerCase();
            this.generateGraphLines();
            console.log(`Monitoring level updated to: ${level}`);
        } else {
            console.error('Invalid monitoring level. Use: loose, mid, or tight');
        }
    }

    // Method to destroy/cleanup the slider
    destroy() {
        if (this.container) {
            this.container.innerHTML = '';
            // Remove any global event listeners if needed
        }
    }
}

// Patient Configuration Helper
class PatientConfigurationHelper {
    static getHeartRateConfig(patient, targetRange) {
        const age = patient.age;
        
        let yAxisConfig;
        
        // Age-based y-axis configuration for Heart Rate
        if (age <= 2) {
            // Infant (0-2 years)
            yAxisConfig = { min: 80, max: 200, step: 20 };
        } else if (age <= 12) {
            // Child (3-12 years)
            yAxisConfig = { min: 70, max: 180, step: 20 };
        } else if (age <= 17) {
            // Adolescent (13-17 years)
            yAxisConfig = { min: 40, max: 140, step: 20 };
        } else if (age <= 65) {
            // Adult (18-65 years)
            yAxisConfig = { min: 50, max: 140, step: 20 };
        } else {
            // Elderly (65+ years)
            yAxisConfig = { min: 40, max: 120, step: 20 };
        }
        
        return {
            parameter: 'HR',
            name: 'Heart Rate',
            unit: 'bpm',
            targetRange: targetRange,
            yAxis: yAxisConfig
        };
    }
    
    static getBloodPressureConfig(patient, targetRange) {
        const age = patient.age;
        
        let yAxisConfig;
        
        // Age-based y-axis for Blood Pressure (Mean)
        if (age <= 12) {
            yAxisConfig = { min: 40, max: 100, step: 10 };
        } else if (age <= 17) {
            yAxisConfig = { min: 50, max: 110, step: 10 };
        } else {
            yAxisConfig = { min: 60, max: 120, step: 10 };
        }
        
        return {
            parameter: 'BP_Mean',
            name: 'Blood Pressure (Mean)',
            unit: 'mmHg',
            targetRange: targetRange,
            yAxis: yAxisConfig
        };
    }
    
    static getTemperatureConfig(patient, targetRange) {
        return {
            parameter: 'Temp',
            name: 'Temperature',
            unit: '°C',
            targetRange: targetRange,
            yAxis: { min: 35, max: 42, step: 0.5 }
        };
    }
    
    static getSaturationConfig(patient, targetRange) {
        return {
            parameter: 'Saturatie',
            name: 'Oxygen Saturation',
            unit: '%',
            targetRange: targetRange,
            yAxis: { min: 80, max: 100, step: 5 }
        };
    }

    static getRespiratoryRateConfig(patient, targetRange) {
        const age = patient.age;
        
        let yAxisConfig;
        
        // Age-based y-axis for Respiratory Rate
        if (age <= 2) {
            yAxisConfig = { min: 20, max: 40, step: 5 };
        } else if (age <= 12) {
            yAxisConfig = { min: 15, max: 35, step: 5 };
        } else if (age <= 17) {
            yAxisConfig = { min: 12, max: 25, step: 3 };
        } else {
            yAxisConfig = { min: 8, max: 30, step: 4 };
        }
        
        return {
            parameter: 'RR',
            name: 'Respiratory Rate',
            unit: 'bpm',
            targetRange: targetRange,
            yAxis: yAxisConfig
        };
    }

    /**
     * Create a VitalParameterSlider with patient data from SharedDataManager
     */
    static createSliderFromSharedData(container, parameter, patientId, options = {}) {
        if (!window.sharedDataManager || !patientId) {
            console.error('❌ SharedDataManager or patientId not available');
            return null;
        }

        try {
            // Get patient info
            const patientInfo = window.sharedDataManager.getPatientInfo(patientId);
            if (!patientInfo) {
                console.error(`❌ Patient info not found for ID: ${patientId}`);
                return null;
            }

            // Get patient medical info to check for existing thresholds
            const medicalInfo = window.sharedDataManager.getPatientMedicalInfo(patientId);
            
            // Determine default target range based on parameter
            let defaultTargetRange;
            const thresholds = window.sharedDataManager.getThresholds('normal');
            
            switch (parameter) {
                case 'HR':
                    defaultTargetRange = thresholds.circulatoir?.HR ? 
                        { min: thresholds.circulatoir.HR.min, max: thresholds.circulatoir.HR.max } :
                        { min: 70, max: 110 };
                    break;
                case 'BP_Mean':
                    defaultTargetRange = thresholds.circulatoir?.BP_Mean ? 
                        { min: thresholds.circulatoir.BP_Mean.min, max: thresholds.circulatoir.BP_Mean.max } :
                        { min: 65, max: 85 };
                    break;
                case 'Saturatie':
                    defaultTargetRange = thresholds.respiratoir?.Saturatie ? 
                        { min: thresholds.respiratoir.Saturatie.min, max: thresholds.respiratoir.Saturatie.max } :
                        { min: 90, max: 100 };
                    break;
                case 'RR':
                case 'AF':
                    defaultTargetRange = thresholds.respiratoir?.AF ? 
                        { min: thresholds.respiratoir.AF.min, max: thresholds.respiratoir.AF.max } :
                        { min: 10, max: 25 };
                    break;
                case 'Temp':
                    defaultTargetRange = thresholds.overig?.Temp ? 
                        { min: thresholds.overig.Temp.min, max: thresholds.overig.Temp.max } :
                        { min: 36.0, max: 38.5 };
                    break;
                default:
                    defaultTargetRange = { min: 0, max: 100 };
            }

            // Check for condition-based thresholds (sepsis, etc.)
            if (medicalInfo && medicalInfo.selectedTags) {
                const conditionThresholds = window.sharedDataManager.getThresholdsByTags(medicalInfo.selectedTags);
                if (conditionThresholds) {
                    if (parameter === 'HR' && conditionThresholds.circulatoir?.HR) {
                        defaultTargetRange = {
                            min: conditionThresholds.circulatoir.HR.min,
                            max: conditionThresholds.circulatoir.HR.max
                        };
                    } else if (parameter === 'BP_Mean' && conditionThresholds.circulatoir?.BP_Mean) {
                        defaultTargetRange = {
                            min: conditionThresholds.circulatoir.BP_Mean.min,
                            max: conditionThresholds.circulatoir.BP_Mean.max
                        };
                    }
                }
            }

            // Get parameter-specific configuration
            let parameterConfig;
            switch (parameter) {
                case 'HR':
                    parameterConfig = this.getHeartRateConfig(patientInfo, defaultTargetRange);
                    break;
                case 'BP_Mean':
                    parameterConfig = this.getBloodPressureConfig(patientInfo, defaultTargetRange);
                    break;
                case 'Temp':
                    parameterConfig = this.getTemperatureConfig(patientInfo, defaultTargetRange);
                    break;
                case 'Saturatie':
                    parameterConfig = this.getSaturationConfig(patientInfo, defaultTargetRange);
                    break;
                case 'RR':
                case 'AF':
                    parameterConfig = this.getRespiratoryRateConfig(patientInfo, defaultTargetRange);
                    break;
                default:
                    console.error(`❌ Unknown parameter: ${parameter}`);
                    return null;
            }

            // Merge with any provided options
            const config = {
                ...parameterConfig,
                patientId: patientId,
                patientName: patientInfo.name,
                monitoringLevel: options.monitoringLevel || 'mid',
                onChange: options.onChange || (() => {}),
                ...options
            };

            console.log(`✅ Creating slider for ${parameter} with config:`, config);

            // Create and return the slider
            return new VitalParameterSlider(container, config);

        } catch (error) {
            console.error('❌ Error creating slider from shared data:', error);
            return null;
        }
    }
}

// Export classes for use in other files
if (typeof window !== 'undefined') {
    // Browser environment
    window.VitalParameterSlider = VitalParameterSlider;
    window.PatientConfigurationHelper = PatientConfigurationHelper;
}

if (typeof module !== 'undefined' && module.exports) {
    // Node.js environment
    module.exports = { VitalParameterSlider, PatientConfigurationHelper };
}
