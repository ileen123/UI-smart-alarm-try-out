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
            testMode: config.testMode || false,
            ...config
        };
        
        this.websocket = null;
        this.reconnectAttempts = 0;
        this.reconnectTimer = null;
        this.heartbeatTimer = null;
        this.isConnecting = false;
        this.messageQueue = [];
        this.sessionId = this.generateSessionId();
        
        // Event handlers
        this.onConnected = config.onConnected || (() => {});
        this.onDisconnected = config.onDisconnected || (() => {});
        this.onMessage = config.onMessage || (() => {});
        this.onError = config.onError || (() => {});
        
        if (this.config.testMode) {
            console.log('🧪 WebSocket Outbound Client initialized in TEST MODE');
        } else {
            console.log('🌐 WebSocket Outbound Client initialized:', this.getWebSocketUrl());
        }
    }
    
    /**
     * Generate a unique session ID for this client instance
     */
    /**
     * Generate a unique session ID for this client instance
     */
    generateSessionId() {
        return 'client_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
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
        
        // Test mode: Just return success without actually sending
        if (this.config.testMode) {
            console.log(`📡 Test mode: Would send [${type}]:`, data);
            return true; // Always return success in test mode
        }
        
        // Real mode: Try to send via WebSocket
        if (this.isConnected()) {
            try {
                const messageStr = JSON.stringify(message);
                this.websocket.send(messageStr);
                console.log(`📤 Message sent [${type}]:`, data);
                return true;
            } catch (error) {
                console.error('❌ Error sending message:', error);
                this.queueMessage(message);
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