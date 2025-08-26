const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // Serve static files from current directory

// API endpoint to save patient data
app.post('/api/save-patient-data', async (req, res) => {
    try {
        const patientData = req.body;
        const filePath = path.join(__dirname, 'data', 'patient-data.json');
        
        // Write the data to the JSON file
        await fs.writeFile(filePath, JSON.stringify(patientData, null, 2));
        
        console.log('Patient data saved to file:', filePath);
        res.json({ success: true, message: 'Patient data saved successfully' });
    } catch (error) {
        console.error('Error saving patient data:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// API endpoint to get patient data
app.get('/api/get-patient-data', async (req, res) => {
    try {
        const filePath = path.join(__dirname, 'data', 'patient-data.json');
        const data = await fs.readFile(filePath, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        console.error('Error reading patient data:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Open http://localhost:${PORT}/index.html to use the application`);
});
