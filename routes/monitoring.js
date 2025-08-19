// routes/monitoring.js
const express = require("express");
const router = express.Router();
const {
    startBackgroundMonitoring,
    stopBackgroundMonitoring,
    getMonitoringStatus,
    loadExistingSOLPairs,
} = require("../services/buyService");

// Import mempool monitoring functions
const {
    startMempoolMonitor,
    stopMempoolMonitor,
    getMempoolMonitorStatus,
} = require("../services/mempoolMonitor");

// Legacy sell service (keeping for backwards compatibility)
const { 
    getSellMonitorStatus, 
    startSellMonitor, 
    stopSellMonitor 
} = require("../services/sellService");

// ============ BUY MONITORING ============

// Start buy monitoring
router.post("/start", (req, res) => {
    try {
        const { intervalSeconds = 30 } = req.body;
        startBackgroundMonitoring(intervalSeconds);
        res.json({ success: true, message: "Buy monitoring started" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Stop buy monitoring
router.post("/stop", (req, res) => {
    try {
        stopBackgroundMonitoring();
        res.json({ success: true, message: "Buy monitoring stopped" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get buy monitoring status
router.get("/status", (req, res) => {
    try {
        const status = getMonitoringStatus();
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Reload existing pairs
router.post("/reload", async (req, res) => {
    try {
        const count = await loadExistingSOLPairs();
        res.json({
            success: true,
            message: `Loaded ${count} existing pairs`,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ MEMPOOL MONITORING ============

// Start real-time mempool monitoring
router.post("/mempool/start", (req, res) => {
    try {
        startMempoolMonitor();
        res.json({ 
            success: true, 
            message: "Real-time mempool monitoring started" 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Stop mempool monitoring
router.post("/mempool/stop", (req, res) => {
    try {
        stopMempoolMonitor();
        res.json({ 
            success: true, 
            message: "Mempool monitoring stopped" 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get mempool monitoring status
router.get("/mempool/status", (req, res) => {
    try {
        const status = getMempoolMonitorStatus();
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ LEGACY SELL MONITORING (DEPRECATED) ============

// Start legacy sell monitor (polling-based - deprecated)
router.post("/sell-monitor/start", (req, res) => {
    try {
        const { intervalSeconds = 15 } = req.body;
        startSellMonitor(intervalSeconds * 1000);
        res.json({ 
            success: true, 
            message: "⚠️ Legacy sell monitor started (consider using mempool monitoring instead)" 
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Stop legacy sell monitor
router.post("/sell-monitor/stop", (req, res) => {
    try {
        stopSellMonitor();
        res.json({ 
            success: true, 
            message: "Legacy sell monitor stopped" 
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get legacy sell monitor status
router.get("/sell-monitor/status", (req, res) => {
    try {
        const status = getSellMonitorStatus();
        res.json({
            ...status,
            deprecated: true,
            recommendation: "Use /api/monitoring/mempool/status for real-time monitoring"
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ============ COMBINED STATUS ============

// Get comprehensive monitoring status
router.get("/all-status", (req, res) => {
    try {
        const buyStatus = getMonitoringStatus();
        const mempoolStatus = getMempoolMonitorStatus();
        const legacySellStatus = getSellMonitorStatus();

        res.json({
            buyMonitoring: buyStatus,
            mempoolMonitoring: mempoolStatus,
            legacySellMonitoring: {
                ...legacySellStatus,
                deprecated: true
            },
            overall: {
                allSystemsRunning: buyStatus.isMonitoring && mempoolStatus.isConnected,
                recommendedSetup: "Buy monitoring + Mempool monitoring"
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ CONTROL ALL ============

// Start complete monitoring system
router.post("/start-all", (req, res) => {
    try {
        const { buyIntervalSeconds = 30 } = req.body;
        
        // Start buy monitoring
        startBackgroundMonitoring(buyIntervalSeconds);
        
        // Start mempool monitoring
        startMempoolMonitor();
        
        res.json({ 
            success: true, 
            message: "Complete monitoring system started (buy + mempool)" 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Stop complete monitoring system
router.post("/stop-all", (req, res) => {
    try {
        // Stop all monitoring
        stopBackgroundMonitoring();
        stopMempoolMonitor();
        stopSellMonitor(); // Stop legacy as well
        
        res.json({ 
            success: true, 
            message: "All monitoring systems stopped" 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;