# WebSocket Testing Guide

## 🧪 How to Test WebSocket Outbound Communication

The WebSocket system now includes a comprehensive testing mode that generates **ping/log messages** instead of trying to connect to actual servers. This allows you to test all message flows without needing a running WebSocket server.

## 🚀 Quick Start Testing

### Method 1: Dedicated Test Page
Open `websocket-test.html` in your browser for a comprehensive testing interface with:
- Individual message tests
- Realistic scenarios (patient admission, risk escalation, bed transfers)
- Integration tests
- Visual ping message display

### Method 2: URL Parameter Testing
Add `?testMode=true` to any page URL to enable test mode:
- `index.html?testMode=true` - Test mode on main patient overview
- `circulatoir-settings.html?testMode=true` - Test mode on circulatory settings
- `respiratory-settings.html?testMode=true` - Test mode on respiratory settings
- `websocket-config.html?testMode=true` - Test mode on WebSocket config

### Method 3: Runtime Toggle
On any page with WebSocket functionality, open browser console (F12) and run:
```javascript
// Enable test mode
window.toggleWebSocketTestMode(true);

// Disable test mode
window.toggleWebSocketTestMode(false);
```

## 📡 What Happens in Test Mode

When test mode is enabled:

1. **Visual Ping Display**: A floating panel appears in the top-right showing all ping messages
2. **Console Logging**: Detailed logs appear in browser console with distinctive styling
3. **No Network Requests**: No actual WebSocket connections are attempted
4. **Real Data Flow**: All the same data processing and message generation occurs

## 🧾 Message Types Tested

### 1. Patient Selection (`patient_selected`)
- **Triggered by**: Patient assignment in bed overview
- **Test data**: Patient info, bed number, timestamp
- **Example**: Assigning "John Doe" to bed 3

### 2. Patient Discharge (`patient_discharged`)
- **Triggered by**: Patient discharge or transfer
- **Test data**: Patient ID, bed number, reason
- **Example**: Discharging patient "P001" from bed 3

### 3. Thresholds & Risk Levels (`thresholds_risk_levels`)
- **Triggered by**: Risk level changes, threshold updates
- **Test data**: Patient ID, risk level, medical thresholds
- **Example**: Updating patient to "high" risk with new HR thresholds

## 🎭 Testing Scenarios

### Individual Tests
```javascript
// Test patient selection
window.webSocketManager.sendPatientSelected({
    id: 'TEST_001',
    name: 'Test Patient',
    age: 45
}, 1);

// Test patient discharge
window.webSocketManager.sendPatientDischarged('TEST_001', 1, 'discharge');

// Test threshold change
window.webSocketManager.sendThresholdsAndRiskLevels('TEST_001', {
    selectedRiskLevel: 'high',
    heartRateRange: { min: 60, max: 100 }
});
```

### Realistic Workflows
Use the `websocket-test.html` page buttons for:
- **Patient Admission**: Complete workflow from admission to risk assessment
- **Risk Escalation**: Progressive risk level changes low → medium → high
- **Bed Transfer**: Patient movement between beds
- **Load Testing**: Multiple rapid messages

### Integration Testing
Test actual data change detection:
```javascript
// Trigger real SharedDataManager functions
window.sharedDataManager.savePatientMedicalInfo('TEST_001', {
    selectedRiskLevel: 'high'
});

// This will automatically generate ping messages when risk levels change
```

## 👀 Monitoring Test Results

### 1. Ping Message Display
- Floating panel in top-right corner
- Shows message type, timestamp, and data summary
- Auto-scrolls with newest messages on top
- Clear button to reset

### 2. Browser Console
- Detailed logs with message type and full data
- Distinctive styling for ping messages
- Color-coded log levels

### 3. Console Commands
```javascript
// Check test mode status
window.webSocketManager.testMode

// Get connection status
window.webSocketManager.getConnectionStatus()

// Clear ping display
document.getElementById('ping-messages-list').innerHTML = '';
```

## 🔧 Switching Between Test and Real Mode

### Enable Real WebSocket Mode
1. Uncheck "Enable Test Mode" checkbox on any config page
2. Or use: `window.toggleWebSocketTestMode(false)`
3. Or remove `?testMode=true` from URL

### What Happens in Real Mode
- Attempts actual WebSocket connection to `localhost:8080`
- Queues messages if connection fails
- Auto-reconnection attempts
- Real network traffic

## 📋 Testing Checklist

- [ ] Test mode enabled and ping display visible
- [ ] Patient selection messages generate pings
- [ ] Patient discharge messages generate pings  
- [ ] Risk level changes generate pings
- [ ] Console shows detailed message logs
- [ ] Ping counter increments correctly
- [ ] Clear button works
- [ ] Toggle between test/real mode works
- [ ] URL parameter `?testMode=true` works
- [ ] Integration with SharedDataManager works

## 🐛 Troubleshooting

### Ping Messages Not Appearing
1. Check test mode is enabled: `window.webSocketManager.testMode`
2. Verify ping display exists: `document.getElementById('ping-messages-container')`
3. Check console for errors

### No Console Logs
1. Open browser developer tools (F12)
2. Check Console tab
3. Look for messages with distinctive ping styling

### WebSocket Manager Not Found
1. Verify all script files are loaded
2. Check browser console for script errors
3. Ensure scripts load in correct order:
   - `websocket-outbound-client.js`
   - `websocket-connection-manager.js`
   - `shared-data-manager.js`

## 🎯 Best Practices

1. **Always test in test mode first** before attempting real connections
2. **Use realistic data** in tests to verify proper message formatting
3. **Test integration points** using actual SharedDataManager functions
4. **Monitor both ping display and console** for complete picture
5. **Clear pings regularly** during extensive testing to avoid clutter

## 🔗 File Locations

- **Test Page**: `websocket-test.html`
- **WebSocket Client**: `js/websocket-outbound-client.js`
- **Connection Manager**: `js/websocket-connection-manager.js`
- **Data Manager**: `js/shared-data-manager.js`
- **Config Page**: `websocket-config.html`