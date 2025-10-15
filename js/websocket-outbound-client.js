/**
 * WebSocket Outbound Communication Client
 * Provides centralized WebSocket connectivity for sending data to external systems
 * Supports configurable IP addresses and automatic reconnection
 */

class WebSocketOutboundClient {
    constructor(config = {}) {
        this.config = {
            // Default configuration
            ip: config.ip || 'localhost',
            port: config.port || 8080,
            protocol: config.protocol || 'ws',
            reconnectDelay: config.reconnectDelay || 5000,
            maxReconnectAttempts: config.maxReconnectAttempts || 10,
            heartbeatInterval: config.heartbeatInterval || 30000,
            testMode: config.testMode || false, // Enable test mode for ping messages
            showPings: config.showPings !== false, // Show ping messages (default: true, can be disabled)
            ...config
        };
        
        this.websocket = null;
        this.reconnectAttempts = 0;
        this.reconnectTimer = null;
        this.heartbeatTimer = null;
        this.isConnecting = false;
        this.messageQueue = [];
        this.sessionId = this.generateSessionId();
        this.pingCount = 0; // Counter for ping messages
        
        // Event handlers
        this.onConnected = config.onConnected || (() => {});
        this.onDisconnected = config.onDisconnected || (() => {});
        this.onMessage = config.onMessage || (() => {});
        this.onError = config.onError || (() => {});
        
        if (this.config.testMode) {
            console.log('🧪 WebSocket Outbound Client initialized in TEST MODE - will generate ping messages');
        } else {
            console.log('🌐 WebSocket Outbound Client initialized:', this.getWebSocketUrl());
        }
        
        // Always add ping display if showPings is enabled
        if (this.config.showPings) {
            this.addPingMessageDisplay();
        }
    }
    
    /**
     * Generate a unique session ID for this client instance
     */
    generateSessionId() {
        return 'client_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    /**
     * Add ping message display panel to the page
     */
    addPingMessageDisplay() {
        // Check if DOM is ready before creating display
        if (!document.body) {
            console.log('📱 DOM not ready for ping display, deferring...');
            // Defer until DOM is ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    this.addPingMessageDisplay();
                });
            } else {
                // DOM is ready but body is not available yet, wait a bit
                setTimeout(() => this.addPingMessageDisplay(), 100);
            }
            return;
        }
        
        // Only add if the display doesn't already exist
        if (document.getElementById('ping-display-container')) {
            return;
        }
        
        const container = document.createElement('div');
        container.id = 'ping-display-container';
        container.innerHTML = `
            <div style="position: fixed; top: 20px; right: 20px; width: 320px; z-index: 9999; 
                       background: rgba(255, 255, 255, 0.95); border: 2px solid #007ACC; border-radius: 8px; 
                       box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2); font-family: 'Segoe UI', sans-serif;">
                <div style="background: #007ACC; color: white; padding: 8px 12px; border-radius: 6px 6px 0 0; 
                           font-weight: bold; display: flex; justify-content: space-between; align-items: center;">
                    <span>WebSocket Monitor</span>
                    <button onclick="this.parentElement.parentElement.style.display='none'" 
                           style="background: rgba(255,255,255,0.2); color: white; border: none; 
                                   border-radius: 3px; padding: 2px 6px; cursor: pointer;">×</button>
                </div>
                <div style="padding: 8px 12px; font-size: 12px; border-bottom: 1px solid #ddd;">
                    <div>URL: <span id="websocket-url" style="font-weight: bold; color: #007ACC;">localhost:8080</span></div>
                    <div>Status: <span id="connection-status" style="font-weight: bold;">Connecting...</span></div>
                    <div>Mode: <span id="connection-mode" style="font-weight: bold; color: ${this.config.testMode ? '#ff6600' : '#00aa00'};">${this.config.testMode ? 'TEST' : 'REAL'}</span></div>
                    <button onclick="document.getElementById('ping-messages-list').innerHTML=''" 
                           style="background: #ff6666; color: white; float: right; font-size: 10px; 
                                   border: none; border-radius: 3px; padding: 2px 6px; cursor: pointer;">Clear</button>
                </div>
                <div id="ping-messages-list" style="padding: 10px; max-height: 300px; overflow-y: auto;"></div>
            </div>
        `;
        document.body.appendChild(container);
        console.log('📱 Ping display panel added to DOM');
    }
    
    /**
     * Add a ping message to the display
     */
    addPingMessage(type, data, status = 'ping') {
        this.pingCount++;
        const timestamp = new Date().toLocaleTimeString();
        const pingList = document.getElementById('ping-messages-list');
        
        if (pingList) {
            const messageDiv = document.createElement('div');
            
            // Different styling based on status and mode
            let borderColor, statusIcon, statusText, bgColor;
            
            if (this.config.testMode) {
                borderColor = '#ffd700';
                statusIcon = '📡';
                statusText = 'PING';
                bgColor = 'rgba(255,215,0,0.1)';
            } else {
                switch (status) {
                    case 'sent':
                        borderColor = '#4ade80';
                        statusIcon = '✅';
                        statusText = 'SENT';
                        bgColor = 'rgba(74,222,128,0.1)';
                        break;
                    case 'queued':
                        borderColor = '#fbbf24';
                        statusIcon = '⏳';
                        statusText = 'QUEUED';
                        bgColor = 'rgba(251,191,36,0.1)';
                        break;
                    case 'failed':
                        borderColor = '#ef4444';
                        statusIcon = '❌';
                        statusText = 'FAILED';
                        bgColor = 'rgba(239,68,68,0.1)';
                        break;
                    default:
                        borderColor = '#3b82f6';
                        statusIcon = '📤';
                        statusText = 'ATTEMPT';
                        bgColor = 'rgba(59,130,246,0.1)';
                }
            }
            
            messageDiv.style.cssText = `
                margin-bottom: 8px; padding: 8px; 
                background: ${bgColor}; 
                border-radius: 5px; border-left: 4px solid ${borderColor};
            `;
            
            const summary = this.createDataSummary(data);
            messageDiv.innerHTML = `
                <div style="color: ${borderColor}; font-weight: bold;">${statusIcon} ${statusText} #${this.pingCount} - ${type}</div>
                <div style="color: #e2e8f0; font-size: 11px;">${timestamp}</div>
                <div style="color: #cbd5e0; margin-top: 4px;">${summary}</div>
            `;
            
            pingList.insertBefore(messageDiv, pingList.firstChild);
            
            // Keep only last 20 messages
            while (pingList.children.length > 20) {
                pingList.removeChild(pingList.lastChild);
            }
            
            // Also log to console with distinctive styling
            const logStyle = this.config.testMode 
                ? 'background: linear-gradient(45deg, #667eea, #764ba2); color: white; padding: 2px 8px; border-radius: 3px; font-weight: bold;'
                : `background: ${status === 'sent' ? '#4ade80' : status === 'queued' ? '#fbbf24' : status === 'failed' ? '#ef4444' : '#3b82f6'}; color: white; padding: 2px 8px; border-radius: 3px; font-weight: bold;`;
                
            console.log(`%c${statusIcon} ${statusText} #${this.pingCount} - ${type}`, logStyle, data);
        } else {
            // If ping display is not available, still log to console with basic styling
            let statusIcon, statusText;
            
            if (this.config.testMode) {
                statusIcon = '📡';
                statusText = 'PING';
            } else {
                switch (status) {
                    case 'sent':
                        statusIcon = '✅';
                        statusText = 'SENT';
                        break;
                    case 'queued':
                        statusIcon = '⏳';
                        statusText = 'QUEUED';
                        break;
                    case 'failed':
                        statusIcon = '❌';
                        statusText = 'FAILED';
                        break;
                    default:
                        statusIcon = '📤';
                        statusText = 'ATTEMPT';
                }
            }
            
            const logStyle = this.config.testMode 
                ? 'background: linear-gradient(45deg, #667eea, #764ba2); color: white; padding: 2px 8px; border-radius: 3px; font-weight: bold;'
                : `background: ${status === 'sent' ? '#4ade80' : status === 'queued' ? '#fbbf24' : status === 'failed' ? '#ef4444' : '#3b82f6'}; color: white; padding: 2px 8px; border-radius: 3px; font-weight: bold;`;
                
            console.log(`%c${statusIcon} ${statusText} #${this.pingCount} - ${type}`, logStyle, data);
        }
    }
    
    /**
     * Create a summary of data for display
     */
    createDataSummary(data) {
        if (!data) return 'No data';
        
        const keys = Object.keys(data);
        if (keys.length === 0) return 'Empty data';
        
        const importantKeys = ['patientId', 'bedNumber', 'riskLevel', 'patient'];
        const summary = [];
        
        // Show important keys first
        importantKeys.forEach(key => {
            if (data[key] !== undefined) {
                if (typeof data[key] === 'object' && data[key] !== null) {
                    if (data[key].id) summary.push(`${key}: ${data[key].id}`);
                    else if (data[key].name) summary.push(`${key}: ${data[key].name}`);
                    else summary.push(`${key}: [object]`);
                } else {
                    summary.push(`${key}: ${data[key]}`);
                }
            }
        });
        
        // Add count of other keys
        const otherKeys = keys.filter(k => !importantKeys.includes(k));
        if (otherKeys.length > 0) {
            summary.push(`+${otherKeys.length} more fields`);
        }
        
        return summary.join(', ') || 'Complex data structure';
    }
    
    /**
     * Get the full WebSocket URL
     */
    getWebSocketUrl() {
        return `${this.config.protocol}://${this.config.ip}:${this.config.port}`;
    }
    
    /**
     * Update connection configuration (useful for switching to different IPs)
     */
    updateConfig(newConfig) {
        const wasConnected = this.isConnected();
        
        // Disconnect if currently connected
        if (wasConnected) {
            this.disconnect();
        }
        
        // Update configuration
        Object.assign(this.config, newConfig);
        console.log('🔧 WebSocket configuration updated:', this.getWebSocketUrl());
        
        // Reconnect if was previously connected
        if (wasConnected) {
            setTimeout(() => this.connect(), 1000);
        }
    }
    
    /**
     * Connect to the WebSocket server
     */
    connect() {
        if (this.isConnecting || this.isConnected()) {
            console.log('⚠️ WebSocket already connecting or connected');
            return;
        }
        
        this.isConnecting = true;
        const url = this.getWebSocketUrl();
        
        try {
            console.log(`🔌 Attempting to connect to WebSocket at: ${url}`);
            this.websocket = new WebSocket(url);
            
            this.websocket.onopen = (event) => {
                console.log(`✅ WebSocket connected successfully to ${url}`);
                this.isConnecting = false;
                this.reconnectAttempts = 0;
                this.clearReconnectTimer();
                this.startHeartbeat();
                this.flushMessageQueue();
                this.onConnected(event);
            };
            
            this.websocket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('📨 WebSocket message received:', data);
                    this.handleIncomingMessage(data);
                    this.onMessage(data, event);
                } catch (error) {
                    console.error('❌ Error parsing WebSocket message:', error);
                    this.onError(error, event);
                }
            };
            
            this.websocket.onclose = (event) => {
                console.log(`🔌 WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason}`);
                this.isConnecting = false;
                this.websocket = null;
                this.stopHeartbeat();
                this.onDisconnected(event);
                this.scheduleReconnect();
            };
            
            this.websocket.onerror = (error) => {
                console.error('❌ WebSocket error:', error);
                this.isConnecting = false;
                this.onError(error);
            };
            
        } catch (error) {
            console.error('❌ Error creating WebSocket connection:', error);
            this.isConnecting = false;
            this.onError(error);
            this.scheduleReconnect();
        }
    }
    
    /**
     * Disconnect from the WebSocket server
     */
    disconnect() {
        this.clearReconnectTimer();
        this.stopHeartbeat();
        
        if (this.websocket) {
            console.log('🔌 Disconnecting WebSocket...');
            this.websocket.close();
            this.websocket = null;
        }
        
        this.isConnecting = false;
        this.reconnectAttempts = 0;
    }
    
    /**
     * Check if WebSocket is connected
     */
    isConnected() {
        return this.websocket && this.websocket.readyState === WebSocket.OPEN;
    }
    
    /**
     * Send a message to the WebSocket server
     */
    sendMessage(type, data, priority = 'normal') {
        const message = {
            type: type,
            sessionId: this.sessionId,
            timestamp: new Date().toISOString(),
            version: '1.0',
            priority: priority,
            data: data
        };
        
        // Test mode: Generate ping message instead of sending
        if (this.config.testMode) {
            if (this.config.showPings) {
                this.addPingMessage(type, data, 'ping');
            }
            return true; // Always return success in test mode
        }
        
        // Real mode: Try to send via WebSocket AND show ping messages
        if (this.isConnected()) {
            try {
                const messageStr = JSON.stringify(message);
                this.websocket.send(messageStr);
                console.log(`📤 Message sent [${type}]:`, data);
                
                // Show ping message indicating successful send
                if (this.config.showPings) {
                    this.addPingMessage(type, data, 'sent');
                }
                return true;
            } catch (error) {
                console.error('❌ Error sending message:', error);
                this.queueMessage(message);
                
                // Show ping message indicating failed send
                if (this.config.showPings) {
                    this.addPingMessage(type, data, 'failed');
                }
                return false;
            }
        } else {
            // Try to reconnect if not connected and not already connecting
            if (!this.isConnecting) {
                console.log(`🔄 WebSocket not connected for ${type} message. Attempting to reconnect...`);
                this.connect();
            }
            
            console.warn(`⚠️ WebSocket not connected. Queueing message [${type}]`);
            this.queueMessage(message);
            
            // Show ping message indicating queued message
            if (this.config.showPings) {
                this.addPingMessage(type, data, 'queued');
            }
            return false;
        }
    }
    
    /**
     * Send patient selection data
     */
    sendPatientSelected(patientData, bedNumber) {
        return this.sendMessage('patient_selected', {
            patient: patientData,
            bedNumber: bedNumber,
            metadata: {
                source: 'bed_overview',
                action: 'patient_assignment'
            }
        });
    }
    
    /**
     * Send patient discharge data
     */
    sendPatientDischarged(patientId, bedNumber, reason) {
        return this.sendMessage('patient_discharged', {
            patientId: patientId,
            bedNumber: bedNumber,
            reason: reason || 'manual_discharge',
            metadata: {
                source: 'bed_overview',
                action: 'patient_discharge'
            }
        });
    }
    
    /**
     * Send thresholds and risk levels data (delta-based message type)
     */
    sendThresholdsAndRiskLevels(patientId, data) {
        return this.sendMessage('thresholds_risk_levels', {
            patientId: patientId,
            bedNumber: data.bedNumber,
            changeType: 'delta',
            changes: {
                medicalProblem: data.changes?.medicalProblem || {},
                riskLevels: data.changes?.riskLevels || {},
                thresholds: data.changes?.thresholds || {}
            }
        });
    }
    
    /**
     * Queue message for later sending
     */
    queueMessage(message) {
        this.messageQueue.push(message);
        console.log(`📥 Message queued [${message.type}]. Queue size: ${this.messageQueue.length}`);
        
        // Limit queue size to prevent memory issues
        if (this.messageQueue.length > 100) {
            const removed = this.messageQueue.shift();
            console.warn('⚠️ Message queue full, removed oldest message:', removed.type);
        }
    }
    
    /**
     * Send all queued messages
     */
    flushMessageQueue() {
        if (this.messageQueue.length === 0) return;
        
        console.log(`📤 Flushing ${this.messageQueue.length} queued messages...`);
        const messages = [...this.messageQueue];
        this.messageQueue = [];
        
        messages.forEach(message => {
            try {
                const messageStr = JSON.stringify(message);
                this.websocket.send(messageStr);
                console.log(`📤 Queued message sent [${message.type}]`);
            } catch (error) {
                console.error('❌ Error sending queued message:', error);
                this.queueMessage(message); // Re-queue if failed
            }
        });
    }
    
    /**
     * Handle incoming messages from server
     */
    handleIncomingMessage(data) {
        switch (data.type) {
            case 'acknowledgment':
                console.log('✅ Server acknowledgment:', data.message);
                break;
            case 'heartbeat_response':
                console.log('💓 Heartbeat response received');
                break;
            case 'error':
                console.error('❌ Server error:', data.message);
                break;
            case 'disconnect':
                console.log('👋 Server requested disconnect:', data.message);
                this.disconnect();
                break;
            default:
                console.log('ℹ️ Unknown message type:', data.type);
        }
    }
    
    /**
     * Start heartbeat mechanism
     */
    startHeartbeat() {
        this.stopHeartbeat();
        this.heartbeatTimer = setInterval(() => {
            if (this.isConnected()) {
                this.sendMessage('heartbeat', {
                    timestamp: new Date().toISOString()
                });
            }
        }, this.config.heartbeatInterval);
    }
    
    /**
     * Stop heartbeat mechanism
     */
    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }
    
    /**
     * Schedule reconnection attempt
     */
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
            console.error(`❌ Maximum reconnection attempts (${this.config.maxReconnectAttempts}) reached. Giving up.`);
            return;
        }
        
        this.clearReconnectTimer();
        this.reconnectAttempts++;
        
        const delay = this.config.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
        console.log(`🔄 Scheduling reconnection attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts} in ${delay}ms`);
        
        this.reconnectTimer = setTimeout(() => {
            this.connect();
        }, delay);
    }
    
    /**
     * Clear reconnection timer
     */
    clearReconnectTimer() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }
    
    /**
     * Get connection status
     */
    getConnectionStatus() {
        return {
            connected: this.isConnected(),
            connecting: this.isConnecting,
            url: this.getWebSocketUrl(),
            sessionId: this.sessionId,
            reconnectAttempts: this.reconnectAttempts,
            queuedMessages: this.messageQueue.length
        };
    }
    
    /**
     * Get connection statistics
     */
    getStats() {
        return {
            ...this.getConnectionStatus(),
            config: this.config,
            uptime: this.websocket ? Date.now() - this.connectionStartTime : 0
        };
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.WebSocketOutboundClient = WebSocketOutboundClient;
}