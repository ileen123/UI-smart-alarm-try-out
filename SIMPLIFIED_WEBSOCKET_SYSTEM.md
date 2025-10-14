# Simplified WebSocket Outbound Communication

## Overview

The WebSocket outbound communication system has been simplified to provide automatic connectivity to a single monitoring server at `localhost:8080`. The system automatically connects and sends messages based on changes detected by the SharedDataManager.

## Architecture

### Components
- **WebSocketOutboundClient**: Core WebSocket client with auto-reconnection
- **WebSocketConnectionManager**: Simplified manager for single localhost:8080 connection
- **SharedDataManager**: Integrated automatic message sending on data changes

### Key Features
- **Automatic Connection**: Connects to localhost:8080 immediately on initialization
- **Auto-Reconnection**: Automatic reconnection with exponential backoff
- **Message Queuing**: Queues messages when disconnected and sends when reconnected
- **Change Detection**: Automatically sends messages when patient data changes

## Message Types

The system now supports only 3 simplified message types:

### 1. Patient Selected (`patient_selected`)
Sent when a patient is assigned to a bed.

```json
{
    "type": "patient_selected",
    "sessionId": "session_123",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "version": "1.0",
    "priority": "normal",
    "data": {
        "patient": {
            "id": "P001",
            "name": "John Doe",
            "age": 65,
            "gender": "M"
        },
        "bedNumber": 1,
        "timestamp": "2024-01-15T10:30:00.000Z",
        "metadata": {
            "source": "bed_overview",
            "action": "patient_assignment"
        }
    }
}
```

### 2. Patient Discharged (`patient_discharged`)
Sent when a patient is discharged from a bed.

```json
{
    "type": "patient_discharged",
    "sessionId": "session_123",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "version": "1.0",
    "priority": "normal",
    "data": {
        "patientId": "P001",
        "bedNumber": 1,
        "reason": "manual_discharge",
        "timestamp": "2024-01-15T10:30:00.000Z",
        "metadata": {
            "source": "bed_overview",
            "action": "patient_discharge"
        }
    }
}
```

### 3. Thresholds & Risk Levels (`thresholds_risk_levels`)
Sent when patient risk levels or medical thresholds change.

```json
{
    "type": "thresholds_risk_levels",
    "sessionId": "session_123",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "version": "1.0",
    "priority": "normal",
    "data": {
        "patientId": "P001",
        "riskLevel": "high",
        "medicalInfo": {
            "selectedRiskLevel": "high",
            "heartRateRange": { "min": 60, "max": 100 },
            "bloodPressureRange": {
                "systolic": { "min": 90, "max": 140 },
                "diastolic": { "min": 60, "max": 90 }
            }
        },
        "timestamp": "2024-01-15T10:30:00.000Z",
        "metadata": {
            "source": "shared_data_manager",
            "action": "risk_assessment_update",
            "previousRiskLevel": "low"
        }
    }
}
```

## Automatic Triggers

Messages are automatically sent when:

1. **Patient Assignment**: When a patient is assigned to a bed in the bed overview
2. **Patient Discharge**: When a patient is discharged or transferred
3. **Risk Level Changes**: When patient risk levels are updated in medical info
4. **Threshold Changes**: When vital sign thresholds are modified

## Implementation

### Initialization
The system automatically initializes when the SharedDataManager is loaded:

```javascript
// Automatic initialization in shared-data-manager.js
initializeWebSocketClient() {
    try {
        this.webSocketManager = window.webSocketManager;
        if (this.webSocketManager) {
            console.log('✅ WebSocket client initialized for outbound communication');
        } else {
            console.warn('⚠️ WebSocket manager not available');
        }
    } catch (error) {
        console.error('❌ Error initializing WebSocket client:', error);
    }
}
```

### Manual Message Sending
You can also send messages manually:

```javascript
// Send through SharedDataManager
window.sharedDataManager.sendWebSocketMessage('patient_selected', patientData);

// Send directly through WebSocket manager
window.webSocketManager.sendPatientSelected(patientData, bedNumber);
window.webSocketManager.sendPatientDischarged(patientId, bedNumber, reason);
window.webSocketManager.sendThresholdsAndRiskLevels(patientId, data);
```

## Configuration

The system is pre-configured for localhost:8080 with these settings:

```javascript
{
    ip: 'localhost',
    port: 8080,
    protocol: 'ws',
    reconnectDelay: 5000,
    maxReconnectAttempts: 10,
    heartbeatInterval: 30000
}
```

## Testing

Use the WebSocket configuration page (`websocket-config.html`) to:
- Monitor connection status
- Send test messages
- View system logs
- Test all 3 message types

## Error Handling

The system includes comprehensive error handling:
- Connection failures are logged and auto-retry is attempted
- Invalid messages are caught and logged
- Missing dependencies are gracefully handled with warnings

## Monitoring

Connection status can be monitored:

```javascript
// Check connection status
const status = window.webSocketManager.getConnectionStatus();
console.log('Connected:', status.connected);
console.log('URL:', status.url);
console.log('Queued messages:', status.queuedMessages);
```