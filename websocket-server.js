#!/usr/bin/env node

/**
 * Simple WebSocket Server for receiving patient data
 * 
 * To run this server:
 * 1. Make sure you have Node.js installed
 * 2. Install the ws package: npm install ws
 * 3. Run the server: node websocket-server.js
 * 
 * The server will listen on ws://localhost:8080
 */

const WebSocket = require('ws');

// Create WebSocket server on port 8080
const wss = new WebSocket.Server({ 
    port: 8080,
    perMessageDeflate: false
});

console.log('🚀 WebSocket server starting on ws://localhost:8080');

wss.on('listening', () => {
    console.log('✅ WebSocket server is listening on ws://localhost:8080');
    console.log('📝 Ready to receive patient data from the web application');
});

wss.on('connection', function connection(ws, req) {
    const clientIP = req.socket.remoteAddress;
    console.log(`🔌 New client connected from ${clientIP}`);
    
    // Send welcome message to client
    const welcomeMessage = {
        type: 'connection',
        message: 'Connected to patient data server',
        timestamp: new Date().toISOString()
    };
    
    try {
        ws.send(JSON.stringify(welcomeMessage));
    } catch (error) {
        console.error('❌ Error sending welcome message:', error);
    }

    // Handle incoming messages
    ws.on('message', function incoming(data) {
        try {
            const message = JSON.parse(data.toString());
            console.log('\n📨 Received message from client:');
            console.log('📅 Timestamp:', message.timestamp);
            console.log('📋 Type:', message.type);
            
            if (message.type === 'patient_selected' && message.data) {
                const patient = message.data;
                console.log('\n👤 PATIENT DATA RECEIVED:');
                console.log('🆔 ID:', patient.id);
                console.log('👨‍⚕️ Name:', patient.name);
                console.log('🎂 Age:', patient.age);
                console.log('⚧ Gender:', patient.gender);
                console.log('⚖️ Weight:', patient.weight, 'kg');
                console.log('🛏️ Bed Number:', patient.bedNumber);
                console.log('⏰ Selected at:', patient.timestamp);
                
                // Send acknowledgment back to client
                const ackMessage = {
                    type: 'acknowledgment',
                    message: `Patient ${patient.name} data received successfully`,
                    patientId: patient.id,
                    timestamp: new Date().toISOString()
                };
                
                try {
                    ws.send(JSON.stringify(ackMessage));
                    console.log('✅ Acknowledgment sent to client');
                } catch (error) {
                    console.error('❌ Error sending acknowledgment:', error);
                }
                
                // Here you could:
                // - Save to database
                // - Forward to other systems
                // - Trigger notifications
                // - etc.
                
            } else {
                console.log('📋 Other message type received:', message);
            }
            
        } catch (error) {
            console.error('❌ Error parsing incoming message:', error);
            console.error('📄 Raw data:', data.toString());
            
            // Send error response
            const errorMessage = {
                type: 'error',
                message: 'Invalid JSON format',
                timestamp: new Date().toISOString()
            };
            
            try {
                ws.send(JSON.stringify(errorMessage));
            } catch (sendError) {
                console.error('❌ Error sending error message:', sendError);
            }
        }
    });

    // Handle client disconnect
    ws.on('close', function close(code, reason) {
        console.log(`🔌 Client disconnected. Code: ${code}, Reason: ${reason || 'No reason provided'}`);
    });

    // Handle errors
    ws.on('error', function error(err) {
        console.error('❌ WebSocket error:', err);
    });
});

// Handle server errors
wss.on('error', function error(err) {
    console.error('❌ WebSocket server error:', err);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down WebSocket server...');
    wss.close(() => {
        console.log('✅ WebSocket server closed');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down WebSocket server...');
    wss.close(() => {
        console.log('✅ WebSocket server closed');
        process.exit(0);
    });
});

console.log('💡 Server is ready to receive patient data');
console.log('💡 Use Ctrl+C to stop the server');