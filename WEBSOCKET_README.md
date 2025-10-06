# WebSocket Implementation for Patient Data

This implementation adds WebSocket communication to send patient data from the Smart Alarm UI to a server when a patient is selected.

## Features

- **Real-time Communication**: WebSocket connection for instant patient data transmission
- **Auto-Reconnection**: Automatically attempts to reconnect if connection is lost
- **Patient Data Transmission**: Sends comprehensive patient information including name, age, gender, weight, and bed number
- **Error Handling**: Robust error handling and logging for debugging

## WebSocket Server Setup

### Prerequisites
- Node.js (v14 or higher)
- npm (Node Package Manager)

### Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the WebSocket server**:
   ```bash
   npm start
   ```
   
   Or for development with auto-restart:
   ```bash
   npm run dev
   ```

3. **Server will start on**: `ws://localhost:8080`

## Usage

1. **Start the WebSocket server** (see setup above)
2. **Open the Smart Alarm UI** in your browser (http://localhost:8000)
3. **Select a patient** for any bed
4. **Patient data will be automatically sent** to the WebSocket server

## Data Structure

When a patient is selected, the following JSON structure is sent via WebSocket:

```json
{
  "type": "patient_selected",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "data": {
    "id": "1",
    "name": "S. Groen",
    "age": 16,
    "gender": "Vrouw",
    "weight": 55,
    "bedNumber": 1,
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

## Server Response

The server will acknowledge receipt with:

```json
{
  "type": "acknowledgment",
  "message": "Patient S. Groen data received successfully",
  "patientId": "1",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Configuration

### WebSocket URL
The WebSocket URL is configured in `index.html`:
```javascript
const WEBSOCKET_URL = 'ws://localhost:8080';
```

You can change this to point to your production server:
```javascript
const WEBSOCKET_URL = 'ws://your-server.com:8080';
```

### Port Configuration
To change the server port, modify `websocket-server.js`:
```javascript
const wss = new WebSocket.Server({ 
    port: 8080,  // Change this port
    perMessageDeflate: false
});
```

## Testing

1. **Start the WebSocket server**:
   ```bash
   npm start
   ```

2. **Start the web application**:
   ```bash
   python3 -m http.server 8000
   ```

3. **Open browser** to `http://localhost:8000`

4. **Select a patient** for any bed

5. **Check server console** for received patient data

## Console Output

### Client Side (Browser)
- `🔌 Attempting to connect to WebSocket`
- `✅ WebSocket connected successfully`
- `📤 Sending patient data via WebSocket`
- `✅ Patient data sent to server via WebSocket`

### Server Side (Terminal)
- `🚀 WebSocket server starting on ws://localhost:8080`
- `🔌 New client connected`
- `👤 PATIENT DATA RECEIVED:`
- `✅ Acknowledgment sent to client`

## Troubleshooting

### Connection Issues
- Ensure the WebSocket server is running
- Check that port 8080 is not blocked by firewall
- Verify the WebSocket URL is correct

### No Data Received
- Check browser console for WebSocket errors
- Ensure patient selection is working correctly
- Verify JSON structure is valid

### Auto-Reconnection
- The client automatically attempts to reconnect every 5 seconds if connection is lost
- Server restart will trigger reconnection

## Integration with External Systems

The WebSocket server can be extended to:
- Save patient data to databases
- Forward data to hospital information systems
- Trigger notifications to healthcare staff
- Log patient assignments for auditing
- Integrate with electronic health records (EHR)

## Security Considerations

For production use, consider:
- Using WSS (WebSocket Secure) with SSL certificates
- Implementing authentication and authorization
- Validating and sanitizing incoming data
- Rate limiting connections
- Monitoring for suspicious activity