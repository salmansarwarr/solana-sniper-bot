// routes/monitoring.js

const express = require("express");
const router = express.Router();
const {
    startBackgroundMonitoring,
    stopBackgroundMonitoring,
    getMonitoringStatus,
    loadExistingSOLPairs,
} = require("../services/buyService");
const { getSellMonitorStatus, startSellMonitor, stopSellMonitor } = require("../services/sellService");

// Start monitoring
router.post("/start", (req, res) => {
    try {
        const { intervalSeconds = 30 } = req.body;
        startBackgroundMonitoring(intervalSeconds);
        res.json({ success: true, message: "Monitoring started" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Stop monitoring
router.post("/stop", (req, res) => {
    try {
        stopBackgroundMonitoring();
        res.json({ success: true, message: "Monitoring stopped" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get monitoring status
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

// ---- NEW: sell monitor control ----
router.post("/sell-monitor/start", (req, res) => {
    try {
        const { intervalSeconds = 15 } = req.body;
        startSellMonitor(intervalSeconds * 1000);
        res.json({ success: true, message: "Sell monitor started" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post("/sell-monitor/stop", (req, res) => {
    try {
        stopSellMonitor();
        res.json({ success: true, message: "Sell monitor stopped" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get("/sell-monitor/status", (req, res) => {
    try {
        res.json(getSellMonitorStatus());
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
