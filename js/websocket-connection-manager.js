/**
 * WebSocket Connection Manager
 * Simplified manager for single connection to localhost:8080
 * Automatically connects and manages the monitoring server connection
 */

class WebSocketConnectionManager {
    constructor(testMode = false, showPings = true) {
        this.client = null;
        this.testMode = testMode;
        this.showPings = showPings;
        this.config = {
            ip: 'localhost',
            port: 8080,
            protocol: 'ws',
            reconnectDelay: 5000,
            maxReconnectAttempts: 10,
            heartbeatInterval: 30000,
            testMode: testMode,
            showPings: showPings
        };
        
        if (testMode) {
            console.log('🧪 WebSocket Connection Manager initialized in TEST MODE - ping messages only');
        } else {
            console.log('🔧 WebSocket Connection Manager initialized for localhost:8080 with ping monitoring');
        }
        this.initializeConnection();
    }
    
    /**
     * Initialize the single WebSocket connection to localhost:8080
     */
    initializeConnection() {
        try {
            // Prevent multiple connection attempts
            if (this.client) {
                console.log('🔄 WebSocket client already exists, skipping initialization');
                return;
            }
            
            this.client = new WebSocketOutboundClient({
                ...this.config,
                onConnected: () => {
                    console.log('✅ Connected to monitoring server at localhost:8080');
                    this.onConnected();
                },
                onDisconnected: () => {
                    console.log('🔌 Disconnected from monitoring server at localhost:8080');
                    this.onDisconnected();
                },
                onError: (error) => {
                    console.error('❌ Monitoring server error:', error);
                    this.onError(error);
                },
                onMessage: (data) => {
                    console.log('📨 Message from monitoring server:', data);
                    this.onMessage(data);
                }
            });
            
            // Only auto-connect if not in test mode
            if (!this.testMode) {
                this.connect();
            } else {
                console.log('🧪 Test mode enabled - skipping actual WebSocket connection');
            }
            
        } catch (error) {
            console.error('❌ Error initializing WebSocket connection:', error);
        }
    }
    
    /**
     * Connect to the monitoring server
     */
    connect() {
        if (this.client) {
            this.client.connect();
            console.log('🔌 Connecting to monitoring server at localhost:8080');
        }
    }
    
    /**
     * Disconnect from the monitoring server
     */
    disconnect() {
        if (this.client) {
            this.client.disconnect();
            console.log('🔌 Disconnecting from monitoring server');
        }
    }
    
    /**
     * Check if connected
     */
    isConnected() {
        return this.client ? this.client.isConnected() : false;
    }
    
    /**
     * Send message to the monitoring server
     */
    sendMessage(type, data, priority = 'normal') {
        if (this.client) {
            return this.client.sendMessage(type, data, priority);
        }
        console.warn('⚠️ WebSocket client not available. Message not sent:', type);
        return false;
    }
    
    /**
     * Send patient selection data
     */
    sendPatientSelected(patientData, bedNumber) {
        if (this.client) {
            return this.client.sendPatientSelected(patientData, bedNumber);
        }
        return false;
    }
    
    /**
     * Send patient discharge data
     */
    sendPatientDischarged(patientId, bedNumber, reason) {
        if (this.client) {
            return this.client.sendPatientDischarged(patientId, bedNumber, reason);
        }
        return false;
    }
    
    /**
     * Send thresholds and risk levels data
     */
    sendThresholdsAndRiskLevels(patientId, data) {
        if (this.client) {
            return this.client.sendThresholdsAndRiskLevels(patientId, data);
        }
        return false;
    }
    
    /**
     * Get connection status
     */
    getConnectionStatus() {
        if (this.client) {
            return {
                ...this.client.getConnectionStatus(),
                config: this.config
            };
        }
        return {
            connected: false,
            connecting: false,
            url: `${this.config.protocol}://${this.config.ip}:${this.config.port}`,
            queuedMessages: 0,
            config: this.config
        };
    }
    
    /**
     * Enable or disable test mode
     */
    setTestMode(enabled) {
        this.testMode = enabled;
        this.config.testMode = enabled;
        if (this.client) {
            this.client.config.testMode = enabled;
            
            // Update ping display if it exists
            const container = document.getElementById('ping-messages-container');
            if (container && this.client.config.showPings) {
                // Remove old display and create new one with correct styling
                container.remove();
                this.client.addPingMessageDisplay();
            }
        }
        
        if (enabled) {
            console.log('🧪 Test mode ENABLED - will generate ping messages instead of WebSocket attempts');
        } else {
            console.log('🌐 Test mode DISABLED - will attempt real WebSocket connection with ping monitoring');
        }
    }
    
    /**
     * Enable or disable ping message display
     */
    setShowPings(enabled) {
        this.showPings = enabled;
        this.config.showPings = enabled;
        if (this.client) {
            this.client.config.showPings = enabled;
            
            const container = document.getElementById('ping-messages-container');
            if (enabled && !container) {
                // Add ping display
                this.client.addPingMessageDisplay();
            } else if (!enabled && container) {
                // Remove ping display
                container.remove();
            }
        }
        
        console.log(`📡 Ping message display ${enabled ? 'ENABLED' : 'DISABLED'}`);
    }
    
    /**
     * Event handlers (can be overridden)
     */
    onConnected() {
        // Override this method to handle connection events
    }
    
    onDisconnected() {
        // Override this method to handle disconnection events
    }
    
    onError(error) {
        // Override this method to handle error events
    }
    
    onMessage(data) {
        // Override this method to handle incoming messages
    }
}

// Check URL parameters for test mode and ping display
const urlParams = new URLSearchParams(window.location.search);
const testMode = urlParams.get('testMode') === 'true' || urlParams.get('test') === 'true';
const showPings = urlParams.get('showPings') !== 'false'; // Default to true unless explicitly disabled

// Initialize WebSocket manager when DOM is ready
function initializeWebSocketManager() {
    console.log('🚀 Initializing WebSocket manager with DOM ready...');
    
    // Global instance - with test mode and ping display support
    window.webSocketManager = new WebSocketConnectionManager(testMode, showPings);
    
    console.log('✅ Global WebSocket manager initialized');
}

// Check if DOM is ready and initialize accordingly
if (document.readyState === 'loading') {
    // DOM is still loading, wait for it
    document.addEventListener('DOMContentLoaded', initializeWebSocketManager);
} else {
    // DOM is already ready, initialize immediately
    initializeWebSocketManager();
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.WebSocketConnectionManager = WebSocketConnectionManager;
    
    // Add global test mode toggle function
    window.toggleWebSocketTestMode = function(enabled) {
        if (window.webSocketManager) {
            window.webSocketManager.setTestMode(enabled);
        }
    };
    
    // Add global ping display toggle function
    window.toggleWebSocketPings = function(enabled) {
        if (window.webSocketManager) {
            window.webSocketManager.setShowPings(enabled);
        }
    };
}