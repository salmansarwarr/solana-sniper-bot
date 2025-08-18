const express = require('express');
const router = express.Router();
const {
    buyToken,
    detectNewSOLPairs,
    getTopHolders,
    fetchPools
} = require('../services/buyService');

// Manual buy endpoint
router.post('/buy', async (req, res) => {
    try {
        const { tokenMint, amountInSol = 0.0001 } = req.body;
        
        if (!tokenMint) {
            return res.status(400).json({ error: 'tokenMint is required' });
        }

        const result = await buyToken(tokenMint, amountInSol);
        res.json({
            success: true,
            transaction: result.txid,
            amountBought: result.amountBought,
            solscanUrl: `https://solscan.io/tx/${result.txid}`
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get top holders for a token
router.get('/holders/:mintAddress', async (req, res) => {
    try {
        const { mintAddress } = req.params;
        const { limit = 10, decimals = 9 } = req.query;
        
        const holders = await getTopHolders(mintAddress, parseInt(decimals), parseInt(limit));
        res.json({ holders });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Scan for new pairs manually
router.post('/scan', async (req, res) => {
    try {
        const newPairs = await detectNewSOLPairs();
        res.json({
            success: true,
            newPairsFound: newPairs.length,
            pairs: newPairs
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all pools
router.get('/pools', async (req, res) => {
    try {
        const pools = await fetchPools();
        res.json({ pools });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;