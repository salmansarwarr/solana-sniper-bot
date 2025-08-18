const express = require('express');
const cors = require('cors');
const { connectDB } = require('./utils/db');
const buyRoutes = require('./routes/buy');
const monitoringRoutes = require('./routes/monitoring');
const { startBackgroundMonitoring } = require('./services/buyService');
const { startSellMonitor } = require('./services/sellService');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// Routes
app.use('/api/buy', buyRoutes);
app.use('/api/monitoring', monitoringRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
});

// Start server
async function startServer() {
    try {
        await connectDB();
        
        // Start background monitoring
        startBackgroundMonitoring(30); // 30 seconds interval
        startSellMonitor(15 * 1000);   // sells
        
        app.listen(PORT, () => {
            console.log(`🚀 Express server running on port ${PORT}`);
            console.log(`📊 Dashboard: http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

module.exports = app;