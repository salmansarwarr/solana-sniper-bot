const express = require('express');
const cors = require('cors');
const { connectDB } = require('./utils/db');
const buyRoutes = require('./routes/buy');
const monitoringRoutes = require('./routes/monitoring');
const { startBackgroundMonitoring } = require('./services/buyService');
const { startMempoolMonitor } = require('./services/mempoolMonitor');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// Routes
app.use('/api/buy', buyRoutes);
app.use('/api/monitoring', monitoringRoutes);

// Health check endpoint with monitoring status
app.get('/health', async (req, res) => {
    try {
        const { getMonitoringStatus } = require('./services/buyService');
        const { getMempoolMonitorStatus } = require('./services/mempoolMonitor');
        
        const buyStatus = getMonitoringStatus();
        const mempoolStatus = getMempoolMonitorStatus();
        
        res.json({ 
            status: 'OK', 
            timestamp: new Date().toISOString(),
            monitoring: {
                buyMonitoring: buyStatus.isMonitoring,
                mempoolMonitoring: mempoolStatus.isConnected,
                monitoredTokens: mempoolStatus.monitoredTokens
            }
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'ERROR', 
            timestamp: new Date().toISOString(),
            error: error.message 
        });
    }
});

// Dashboard endpoint
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Solana Sniper Bot</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { font-family: Arial, sans-serif; margin: 40px; background: #0f0f23; color: #cccccc; }
                .container { max-width: 800px; margin: 0 auto; }
                .status-card { background: #1a1a2e; padding: 20px; margin: 15px 0; border-radius: 8px; border-left: 4px solid #00ff88; }
                .status-card.error { border-left-color: #ff4444; }
                .status-card.warning { border-left-color: #ffaa00; }
                .button { background: #00ff88; color: #000; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; margin: 5px; }
                .button:hover { background: #00cc66; }
                .button.danger { background: #ff4444; color: white; }
                .button.danger:hover { background: #cc3333; }
                pre { background: #0a0a0a; padding: 15px; border-radius: 4px; overflow-x: auto; }
                .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🎯 Solana Sniper Bot Dashboard</h1>
                <p>Real-time mempool monitoring for instant sell detection</p>
                
                <div class="grid">
                    <div class="status-card">
                        <h3>🔍 Buy Monitoring</h3>
                        <p>Scans for new SOL pairs with SNS holders</p>
                        <button class="button" onclick="startBuyMonitoring()">Start Buy Monitor</button>
                        <button class="button danger" onclick="stopBuyMonitoring()">Stop</button>
                    </div>
                    
                    <div class="status-card">
                        <h3>⚡ Mempool Monitoring</h3>
                        <p><strong>NEW:</strong> Real-time WebSocket sell detection</p>
                        <button class="button" onclick="startMempoolMonitoring()">Start Mempool Monitor</button>
                        <button class="button danger" onclick="stopMempoolMonitoring()">Stop</button>
                    </div>
                </div>
                
                <div class="status-card">
                    <h3>🎛️ Quick Actions</h3>
                    <button class="button" onclick="startAllMonitoring()">🚀 Start All Monitoring</button>
                    <button class="button danger" onclick="stopAllMonitoring()">🛑 Stop All</button>
                    <button class="button" onclick="getStatus()">📊 Get Status</button>
                </div>
                
                <div class="status-card">
                    <h3>📊 System Status</h3>
                    <pre id="status">Loading...</pre>
                </div>
                
                <div class="status-card">
                    <h3>📋 API Endpoints</h3>
                    <ul>
                        <li><code>POST /api/monitoring/start-all</code> - Start complete system</li>
                        <li><code>POST /api/monitoring/mempool/start</code> - Start mempool monitoring</li>
                        <li><code>GET /api/monitoring/all-status</code> - Get comprehensive status</li>
                        <li><code>POST /api/buy/buy</code> - Manual token purchase</li>
                    </ul>
                </div>
            </div>
            
            <script>
                async function apiCall(endpoint, method = 'GET', body = null) {
                    try {
                        const options = { method, headers: { 'Content-Type': 'application/json' } };
                        if (body) options.body = JSON.stringify(body);
                        
                        const response = await fetch(endpoint, options);
                        const data = await response.json();
                        
                        if (!response.ok) throw new Error(data.error || 'Request failed');
                        return data;
                    } catch (error) {
                        alert('Error: ' + error.message);
                        console.error(error);
                    }
                }
                
                async function startBuyMonitoring() {
                    const result = await apiCall('/api/monitoring/start', 'POST', { intervalSeconds: 30 });
                    if (result) alert('Buy monitoring started!');
                    getStatus();
                }
                
                async function stopBuyMonitoring() {
                    const result = await apiCall('/api/monitoring/stop', 'POST');
                    if (result) alert('Buy monitoring stopped!');
                    getStatus();
                }
                
                async function startMempoolMonitoring() {
                    const result = await apiCall('/api/monitoring/mempool/start', 'POST');
                    if (result) alert('Mempool monitoring started!');
                    getStatus();
                }
                
                async function stopMempoolMonitoring() {
                    const result = await apiCall('/api/monitoring/mempool/stop', 'POST');
                    if (result) alert('Mempool monitoring stopped!');
                    getStatus();
                }
                
                async function startAllMonitoring() {
                    const result = await apiCall('/api/monitoring/start-all', 'POST');
                    if (result) alert('All monitoring systems started!');
                    getStatus();
                }
                
                async function stopAllMonitoring() {
                    const result = await apiCall('/api/monitoring/stop-all', 'POST');
                    if (result) alert('All monitoring stopped!');
                    getStatus();
                }
                
                async function getStatus() {
                    const status = await apiCall('/api/monitoring/all-status');
                    if (status) {
                        document.getElementById('status').textContent = JSON.stringify(status, null, 2);
                    }
                }
                
                // Auto-refresh status every 10 seconds
                setInterval(getStatus, 10000);
                getStatus();
            </script>
        </body>
        </html>
    `);
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
});

// Graceful shutdown handlers
process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT. Graceful shutdown...');
    
    const { stopBackgroundMonitoring } = require('./services/buyService');
    const { stopMempoolMonitor } = require('./services/mempoolMonitor');
    
    try {
        stopBackgroundMonitoring();
        stopMempoolMonitor();
        console.log('✅ All monitoring stopped');
    } catch (error) {
        console.error('❌ Error during shutdown:', error.message);
    }
    
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM. Graceful shutdown...');
    process.exit(0);
});

// Start server
async function startServer() {
    try {
        // Connect to database
        await connectDB();
        console.log('✅ Database connected');
        
        // Start the HTTP server
        app.listen(PORT, () => {
            console.log(`🚀 Express server running on port ${PORT}`);
            console.log(`🔗 Dashboard: http://localhost:${PORT}`);
            console.log('');
            console.log('🎯 Solana Sniper Bot Started!');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('⚡ Features:');
            console.log('  • Real-time mempool monitoring via WebSocket');
            console.log('  • SNS holder detection for new tokens');
            console.log('  • Instant sell execution on first detected sell');
            console.log('  • Two-phase sell strategy (50% immediate, 50% at target)');
            console.log('');
        });
        
        // Optional: Auto-start monitoring (comment out if you prefer manual control)
        // console.log('🔄 Auto-starting monitoring systems...');
        startBackgroundMonitoring(30); // Buy monitoring every 30 seconds
        startMempoolMonitor();          // Real-time sell monitoring
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Add environment validation
function validateEnvironment() {
    const required = ['RPC_URL', 'PRIVATE_KEY', 'MONGO_URI'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
        console.error('❌ Missing required environment variables:');
        missing.forEach(key => console.error(`  - ${key}`));
        console.error('\nCreate a .env file with:');
        console.error('RPC_URL=your_solana_rpc_url');
        console.error('RPC_WS_URL=your_websocket_rpc_url (optional)');
        console.error('PRIVATE_KEY=[your,private,key,array]');
        console.error('MONGO_URI=your_mongodb_connection_string');
        console.error('HELIUS_API_KEY=your_helius_key (optional)');
        process.exit(1);
    }
    
    console.log('✅ Environment variables validated');
}

// Validate and start
validateEnvironment();
startServer();

module.exports = app;