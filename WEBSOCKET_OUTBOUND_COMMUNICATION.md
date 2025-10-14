# WebSocket Outbound Communication System

## 🌐 **Overview**

The Smart Alarm System now includes a comprehensive **outbound WebSocket communication system** that can send real-time patient data, alarms, and monitoring updates to external systems via configurable IP addresses and ports.

## 🎯 **Key Features**

### **Centralized Connection Management**
- ✅ **Multiple Endpoints**: Connect to multiple monitoring systems simultaneously
- ✅ **IP Configuration**: Configurable IP addresses and ports (default: port 8080)
- ✅ **Auto-Reconnection**: Automatic reconnection with exponential backoff
- ✅ **Message Queuing**: Messages queued when disconnected and sent upon reconnection
- ✅ **Health Monitoring**: Real-time connection status and statistics

### **Automatic Data Transmission**
- 📤 **Patient Selection**: Sent when patients are assigned to beds
- 📤 **Risk Level Changes**: Sent when patient risk levels are modified
- 📤 **Patient Discharge**: Sent when patients are discharged from beds
- 📤 **Monitoring Changes**: Sent when vital sign thresholds are adjusted
- 📤 **Alarm Events**: Sent when critical alarms are triggered
- 📤 **Settings Updates**: Sent when system configurations change

### **Configuration Interface**
- 🖥️ **Web UI**: User-friendly configuration page at `/websocket-config.html`
- ⚡ **Quick Connect**: One-click connection to remote monitoring systems
- 🧪 **Test Messages**: Send test messages to verify connectivity
- 📋 **Real-time Logs**: Live logging of all WebSocket activities

## 📂 **System Architecture**

### **Core Components**

#### **1. WebSocketOutboundClient** (`js/websocket-outbound-client.js`)
**Purpose**: Individual WebSocket connection management
**Features**:
- Configurable endpoint (IP, port, protocol)
- Auto-reconnection with exponential backoff
- Message queuing for reliability
- Heartbeat mechanism for connection health
- Event-driven callbacks for connection state changes

#### **2. WebSocketConnectionManager** (`js/websocket-connection-manager.js`)
**Purpose**: Centralized management of multiple WebSocket connections
**Features**:
- Multiple named connections to different endpoints
- Broadcast messaging to all endpoints
- Configuration persistence in localStorage
- Connection health monitoring
- Import/export configuration capabilities

#### **3. Enhanced SharedDataManager** (`js/shared-data-manager.js`)
**Purpose**: Automatic WebSocket message sending on data changes
**Features**:
- Integrated WebSocket communication
- Automatic detection of patient data changes
- Risk level change detection and messaging
- Bed state change detection and messaging
- Remote monitoring system connectivity

#### **4. Configuration Interface** (`websocket-config.html`)
**Purpose**: User-friendly WebSocket configuration and management
**Features**:
- Add/remove WebSocket connections
- Connect/disconnect individual endpoints
- Quick connect to remote monitoring systems
- Test message functionality
- Real-time connection status display
- System logs and debugging information

## 🔧 **Configuration**

### **Add a New Connection**

#### **Via Configuration UI**:
1. Open `/websocket-config.html` in your browser
2. Fill in connection details:
   - **Name**: Unique identifier (e.g., "main-monitoring")
   - **IP Address**: Target system IP (e.g., "192.168.1.100")
   - **Port**: Target port (default: 8080)
   - **Protocol**: ws:// or wss:// for secure connections
3. Click "Add Connection"
4. Click "Connect" to establish the connection

#### **Via JavaScript**:
```javascript
// Add a connection to a remote monitoring system
window.webSocketManager.addRemoteConnection(
    'remote-monitoring',    // Connection name
    '192.168.1.100',       // IP address
    8080,                  // Port
    {
        onConnected: () => console.log('Connected to remote monitoring'),
        onDisconnected: () => console.log('Disconnected from remote monitoring'),
        onError: (error) => console.error('Connection error:', error)
    }
);

// Connect to the endpoint
window.webSocketManager.connect('remote-monitoring');
```

#### **Quick Connect Method**:
```javascript
// Quick connect to remote monitoring (creates connection and connects immediately)
const client = window.webSocketManager.connectToRemoteMonitoring('192.168.1.100', 8080);
```

## 📨 **Message Types and Formats**

All messages follow a standardized JSON format:

### **Base Message Structure**
```json
{
    "type": "message_type",
    "sessionId": "client_session_id",
    "timestamp": "2024-10-14T10:30:00.000Z",
    "version": "1.0",
    "priority": "normal",
    "data": {
        // Message-specific data
    }
}
```

### **1. Patient Selection** (`patient_selected`)
**Triggered**: When a patient is assigned to a bed
```json
{
    "type": "patient_selected",
    "data": {
        "patient": {
            "id": "patient_001",
            "name": "John Doe",
            "age": 45,
            "gender": "M"
        },
        "bedNumber": 1,
        "timestamp": "2024-10-14T10:30:00.000Z",
        "metadata": {
            "source": "bed_overview",
            "action": "patient_assignment"
        }
    }
}
```

### **2. Risk Level Change** (`risk_level_changed`)
**Triggered**: When a patient's risk level is modified
```json
{
    "type": "risk_level_changed",
    "data": {
        "patientId": "patient_001",
        "oldRiskLevel": "low",
        "newRiskLevel": "high",
        "timestamp": "2024-10-14T10:30:00.000Z",
        "metadata": {
            "source": "setup_page",
            "action": "risk_assessment_update"
        }
    }
}
```

### **3. Patient Discharge** (`patient_discharged`)
**Triggered**: When a patient is discharged from a bed
```json
{
    "type": "patient_discharged",
    "data": {
        "patientId": "patient_001",
        "bedNumber": 1,
        "reason": "manual_discharge",
        "timestamp": "2024-10-14T10:30:00.000Z",
        "metadata": {
            "source": "bed_overview",
            "action": "patient_discharge"
        }
    }
}
```

### **4. Monitoring Level Change** (`monitoring_level_changed`)
**Triggered**: When vital sign monitoring parameters are adjusted
```json
{
    "type": "monitoring_level_changed",
    "data": {
        "patientId": "patient_001",
        "parameter": "HR",
        "oldLevel": "mid",
        "newLevel": "tight",
        "values": {
            "min": 60,
            "max": 100,
            "unit": "bpm"
        },
        "metadata": {
            "source": "settings_page",
            "action": "monitoring_adjustment"
        }
    }
}
```

### **5. Alarm Triggered** (`alarm_triggered`)
**Triggered**: When critical alarms are activated
```json
{
    "type": "alarm_triggered",
    "data": {
        "patientId": "patient_001",
        "parameter": "HR",
        "currentValue": 120,
        "threshold": {
            "min": 60,
            "max": 100
        },
        "severity": "high",
        "metadata": {
            "source": "monitoring_system",
            "action": "alarm_activation"
        }
    }
}
```

### **6. Settings Update** (`settings_updated`)
**Triggered**: When system settings are modified
```json
{
    "type": "settings_updated",
    "data": {
        "settingsType": "vital_thresholds",
        "settings": {
            "HR_MIN": 60,
            "HR_MAX": 100,
            "BP_MIN": 60,
            "BP_MAX": 90
        },
        "patientId": "patient_001",
        "metadata": {
            "source": "settings_page",
            "action": "configuration_change"
        }
    }
}
```

## 🚀 **Getting Started**

### **1. Start the Local Development Server**
```bash
# Start the web server
python3 -m http.server 8000
```

### **2. Access the Configuration Interface**
Open your browser and navigate to:
```
http://localhost:8000/websocket-config.html
```

### **3. Configure Your First Connection**
1. Click "Add New Connection"
2. Enter connection details:
   - **Name**: `monitoring-server`
   - **IP**: `192.168.1.100` (replace with your target IP)
   - **Port**: `8080`
3. Click "Add Connection"
4. Click "Connect" to establish the connection

### **4. Test the Connection**
1. Select your connection in the "Test Messages" section
2. Click "Test Patient Selection" to send a test message
3. Check the logs to verify the message was sent successfully

### **5. Monitor Real-time Data**
Once configured, the system will automatically send messages when:
- Patients are assigned to beds in the bed overview
- Risk levels are changed in the setup page
- Monitoring parameters are adjusted in settings pages
- Patients are discharged from beds

## 🔧 **Advanced Configuration**

### **Multiple Endpoints**
Connect to multiple monitoring systems simultaneously:
```javascript
// Add main monitoring server
window.webSocketManager.addConnection('main-monitoring', {
    ip: '192.168.1.100',
    port: 8080
});

// Add analytics server
window.webSocketManager.addConnection('analytics', {
    ip: '192.168.1.200',
    port: 8081
});

// Add backup monitoring
window.webSocketManager.addConnection('backup-monitoring', {
    ip: '192.168.1.150',
    port: 8080
});

// Connect to all
window.webSocketManager.connectAll();
```

### **Secure Connections (WSS)**
For secure WebSocket connections:
```javascript
window.webSocketManager.addConnection('secure-monitoring', {
    ip: 'monitoring.hospital.com',
    port: 443,
    protocol: 'wss'  // Secure WebSocket
});
```

### **Connection Health Monitoring**
```javascript
// Get status of all connections
const statuses = window.webSocketManager.getConnectionStatuses();
console.log('Connection statuses:', statuses);

// Health check
window.webSocketManager.healthCheck().then(results => {
    console.log('Health check results:', results);
});
```

### **Custom Message Sending**
```javascript
// Send custom message to specific endpoint
window.webSocketManager.sendMessage('main-monitoring', 'custom_event', {
    customData: 'your data here',
    timestamp: new Date().toISOString()
});

// Broadcast to all connected endpoints
window.webSocketManager.broadcastMessage('system_status', {
    status: 'operational',
    uptime: '24 hours'
});
```

## 🔍 **Troubleshooting**

### **Connection Issues**
1. **Check IP and Port**: Verify the target IP address and port are correct
2. **Firewall**: Ensure firewalls allow outbound connections on the specified port
3. **Network Connectivity**: Test basic network connectivity to the target system
4. **Protocol**: Verify using the correct protocol (ws:// vs wss://)

### **Message Delivery Issues**
1. **Connection Status**: Check connection status in the configuration interface
2. **Message Queue**: Check if messages are being queued (visible in status display)
3. **Logs**: Review system logs for error messages
4. **Test Messages**: Use the test message functionality to verify connectivity

### **Performance Optimization**
1. **Heartbeat Interval**: Adjust heartbeat interval for your network conditions
2. **Reconnection Settings**: Configure reconnection delays and max attempts
3. **Message Queuing**: Monitor queue sizes to prevent memory issues

## 🔐 **Security Considerations**

### **Network Security**
- Use **WSS (WebSocket Secure)** for production environments
- Implement **IP whitelisting** on the receiving server
- Consider **VPN connections** for sensitive medical data

### **Data Privacy**
- Patient data is transmitted in **real-time** - ensure compliance with medical data regulations
- Implement **encryption** at the application level if required
- Consider **data anonymization** for non-critical monitoring

## 📊 **Monitoring and Analytics**

### **Connection Metrics**
The system provides comprehensive monitoring:
- Connection uptime and reliability
- Message throughput and delivery rates
- Queue sizes and message latency
- Error rates and reconnection frequency

### **Operational Insights**
- Patient flow patterns (assignments, discharges)
- Risk level distribution and changes
- Alarm frequency and patterns
- System configuration changes

## 🔗 **Integration Examples**

### **Hospital Information System (HIS)**
```javascript
// Connect to hospital information system
window.webSocketManager.addConnection('his-integration', {
    ip: 'his.hospital.internal',
    port: 8080,
    onConnected: () => {
        // Send system registration
        window.webSocketManager.sendMessage('his-integration', 'system_registration', {
            systemId: 'smart-alarm-ui',
            department: 'ICU',
            capabilities: ['patient_monitoring', 'alarm_management']
        });
    }
});
```

### **Analytics Platform**
```javascript
// Connect to analytics platform
window.webSocketManager.addConnection('analytics-platform', {
    ip: 'analytics.hospital.com',
    port: 443,
    protocol: 'wss',
    onMessage: (data) => {
        if (data.type === 'analytics_request') {
            // Respond with requested data
            sendAnalyticsData(data.requestId);
        }
    }
});
```

### **Mobile Alert System**
```javascript
// Connect to mobile alert gateway
window.webSocketManager.addConnection('mobile-alerts', {
    ip: '10.0.0.50',
    port: 8080,
    onConnected: () => {
        console.log('Mobile alert system connected');
    }
});

// High-priority alarms are automatically sent to mobile alerts
```

The WebSocket outbound communication system provides a robust, scalable solution for real-time data integration with external monitoring and management systems, ensuring that critical patient information is always available where and when it's needed.