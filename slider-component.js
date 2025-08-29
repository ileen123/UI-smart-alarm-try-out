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
        this.isDragging = false;
        this.currentHandle = null;
        this.scale = this.calculateScale();
        this.callbacks = [];
        
        this.render();
        this.attachEventListeners();
        
        // Load existing settings from SharedDataManager after initial render
        setTimeout(() => {
            this.loadExistingSettings();
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
                <div class="slider-title">${this.config.name}</div>
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
                <button class="save-button">Save Changes</button>
            </div>
        `;

        this.container.innerHTML = sliderHTML;
        this.updateSliderPosition();
        this.generateAxes();
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
        
        console.log(`generateGraphLines called, loading ${this.config.monitoringLevel} SVG...`);
        
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
        
        const levelData = svgDefinitions[level.toLowerCase()];
        if (!levelData) {
            console.warn(`Unknown monitoring level: ${level}, using tight as fallback`);
            levelData = svgDefinitions.tight;
        }
        
        // Create upper areas
        levelData.upper.forEach(elementData => {
            const element = document.createElementNS('http://www.w3.org/2000/svg', elementData.type);
            Object.entries(elementData.attrs).forEach(([key, value]) => {
                element.setAttribute(key, value);
            });
            upperAreas.appendChild(element);
        });
        
        // Create lower areas
        levelData.lower.forEach(elementData => {
            const element = document.createElementNS('http://www.w3.org/2000/svg', elementData.type);
            Object.entries(elementData.attrs).forEach(([key, value]) => {
                element.setAttribute(key, value);
            });
            lowerAreas.appendChild(element);
        });
        
        // Set the viewBox to match the original SVG
        svg.setAttribute('viewBox', '0 0 437 270');
        svg.setAttribute('preserveAspectRatio', 'none');
        
        console.log(`Embedded SVG created for ${level} level with correct original content`);
        
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
            // Position the SVG so its bottom edge touches the upper dashed line
            // The SVG extends upward from this line and gets clipped by the chart boundaries
            upperAreas.setAttribute('transform', `translate(0,${upperPos - 155})`);
        }
        
        // Move lower-areas group: attach the TOP of the SVG to the lower dashed line (so it extends downward)
        const lowerAreas = svg.querySelector('.lower-areas');
        if (lowerAreas && lowerAreas.firstChild) {
            // Attach the top edge of the SVG to the lower dashed line
            lowerAreas.setAttribute('transform', `translate(0,${lowerPos})`);
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
        
        // Create x-axis labels for seconds (0, 5, 10, 15, 20, 25, 30)
        const timePoints = [0, 5, 10, 15, 20, 25, 30];
        const chartContainer = this.container.querySelector('.chart-container');
        const chartWidth = chartContainer.offsetWidth - 40; // Subtract y-axis width
        
        timePoints.forEach(seconds => {
            const label = document.createElement('div');
            label.className = 'x-axis-label';
            
            if (seconds === 30) {
                // Position "30" at the right edge
                label.style.left = `${chartWidth}px`;
            } else {
                // Compress other labels to fit in remaining space
                label.style.left = `${(seconds / 29) * (chartWidth - 10)}px`;
            }
            
            label.textContent = seconds;
            xAxis.appendChild(label);
        });
        
        // Store the 15-second position for slider alignment
        this.fifteenSecondPosition = (15 / 29) * (chartWidth - 10);
    }

    updateSliderPosition() {
        const targetRangeOverlay = this.container.querySelector('.target-range-overlay');
        const upperHandle = this.container.querySelector('.range-handle.upper');
        const lowerHandle = this.container.querySelector('.range-handle.lower');
        const maxValueElement = this.container.querySelector('.sliding-value-outside.max-value');
        const minValueElement = this.container.querySelector('.sliding-value-outside.min-value');
        
        const upperPos = this.valueToPixel(this.currentMax);
        const lowerPos = this.valueToPixel(this.currentMin);
        
        // Calculate 15-second position (middle of 0-30 timeline)
        const chartContainer = this.container.querySelector('.chart-container');
        const chartWidth = chartContainer.offsetWidth - 40; // Account for right margin only
        // The colored rectangle starts at 0 (after padding), so 15s is in the center of the chart area
        const fifteenSecondPos = (15 / 30) * chartWidth + 0; // 0 is the left edge of the colored area
        
        // Update handle positions - align with 15 seconds
        upperHandle.style.top = `${upperPos}px`;
        upperHandle.style.left = `${fifteenSecondPos}px`;
        lowerHandle.style.top = `${lowerPos}px`;
        lowerHandle.style.left = `${fifteenSecondPos}px`;
        
        // Update target range overlay
        targetRangeOverlay.style.top = `${upperPos}px`;
        targetRangeOverlay.style.height = `${lowerPos - upperPos}px`;
        
        // Update sliding values position and content
        maxValueElement.style.top = `${upperPos}px`;
        maxValueElement.textContent = Math.round(this.currentMax);
        minValueElement.style.top = `${lowerPos}px`;
        minValueElement.textContent = Math.round(this.currentMin);
        
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
        
        // Add visual feedback
        this.container.querySelector('.vital-slider').style.boxShadow = '0 15px 40px rgba(52, 152, 219, 0.3)';
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
            this.currentMax = Math.max(this.currentMin + 1, Math.round(newValue));
        } else {
            this.currentMin = Math.min(this.currentMax - 1, Math.round(newValue));
        }
        
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
        
        // Remove visual feedback
        this.container.querySelector('.vital-slider').style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.1)';
    }

    /**
     * Load existing settings from SharedDataManager
     */
    loadExistingSettings() {
        if (window.sharedDataManager && this.config.patientId) {
            try {
                console.log(`🔄 Loading existing settings for ${this.config.parameter} from patient ${this.config.patientId}`);
                
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
                        
                        // Update the configuration
                        this.config.targetRange.min = customThreshold.min;
                        this.config.targetRange.max = customThreshold.max;
                        
                        // Update the UI
                        this.updateSliderPosition();
                        this.updateDisplayValues();
                        
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
                        this.config.targetRange.min = hrThresholds.min;
                        this.config.targetRange.max = hrThresholds.max;
                        
                        this.updateSliderPosition();
                        this.updateDisplayValues();
                        
                        console.log(`✅ Loaded condition-based HR thresholds: ${this.currentMin}-${this.currentMax} ${this.config.unit}`);
                        return true;
                    } else if (thresholds && this.config.parameter === 'BP_Mean' && thresholds.circulatoir?.BP_Mean) {
                        const bpThresholds = thresholds.circulatoir.BP_Mean;
                        this.currentMin = bpThresholds.min;
                        this.currentMax = bpThresholds.max;
                        this.config.targetRange.min = bpThresholds.min;
                        this.config.targetRange.max = bpThresholds.max;
                        
                        this.updateSliderPosition();
                        this.updateDisplayValues();
                        
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
     * Update display values in the UI
     */
    updateDisplayValues() {
        const maxValueElement = this.container.querySelector('.sliding-value-outside.max-value');
        const minValueElement = this.container.querySelector('.sliding-value-outside.min-value');
        
        if (maxValueElement) {
            maxValueElement.textContent = Math.round(this.currentMax);
        }
        if (minValueElement) {
            minValueElement.textContent = Math.round(this.currentMin);
        }
    }

    saveChanges() {
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
                
                // For circulatoir parameters, also save to specific circulatoir settings
                if (organSystem === 'circulatoir') {
                    const circulatoirSettings = window.sharedDataManager.getPatientCirculatoirSettings(this.config.patientId) || {
                        hr: { min: 70, max: 110 },
                        bp: { min: 65, max: 85 }
                    };
                    
                    if (this.config.parameter === 'HR') {
                        circulatoirSettings.hr = { min: this.currentMin, max: this.currentMax };
                    } else if (this.config.parameter === 'BP_Mean') {
                        circulatoirSettings.bp = { min: this.currentMin, max: this.currentMax };
                    }
                    
                    window.sharedDataManager.savePatientCirculatoirSettings(this.config.patientId, circulatoirSettings);
                }
                
                console.log(`✅ Saved ${this.config.parameter} settings to SharedDataManager for patient ${this.config.patientId}`);
                
                // Real save with success feedback
                setTimeout(() => {
                    button.textContent = 'Saved ✓';
                    button.style.background = 'linear-gradient(135deg, #00b894, #00a085)';
                    
                    setTimeout(() => {
                        button.textContent = originalText;
                        button.disabled = false;
                        button.style.background = '';
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
                button.style.background = 'linear-gradient(135deg, #00b894, #00a085)';
                
                setTimeout(() => {
                    button.textContent = originalText;
                    button.disabled = false;
                    button.style.background = '';
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
            yAxis: { min: 35, max: 42, step: 1 }
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
                        { min: 36.5, max: 39 };
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
