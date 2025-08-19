//services/buyService.js
const {
    Connection,
    PublicKey,
    Keypair,
    VersionedTransaction,
} = require("@solana/web3.js");
const { savePurchase } = require("../utils/db");
const { addTokenToMempool } = require("./mempoolMonitor");
const bs58 = require("bs58");
require('dotenv').config();

const API_BASE = "https://api-v3.raydium.io";
const SOL_MINT = "So11111111111111111111111111111111111111112";
const RPC_URL = process.env.RPC_URL;
const connection = new Connection(RPC_URL, "confirmed");

let detectedPairs = new Set();
let monitoringInterval = null;
let isMonitoring = false;

const user = Keypair.fromSecretKey(bs58.default.decode(process.env.PRIVATE_KEY));

// Buy token using Jupiter
async function buyToken(outputMint, amountInSol = 0.0001) {
    try {
        const amount = Math.floor(amountInSol * 1e9);
        const slippageBps = 50;

        const quoteResponse = await fetch(
            `https://quote-api.jup.ag/v6/quote?inputMint=${SOL_MINT}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}`
        );
        const quote = await quoteResponse.json();

        if (!quote.outAmount) {
            throw new Error("No route found for swap");
        }

        const swapResponse = await fetch("https://quote-api.jup.ag/v6/swap", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    quoteResponse: quote,
                    userPublicKey: user.publicKey.toString(),
                    wrapAndUnwrapSol: true,
                }),
            });

        if (!swapResponse.ok) {
            throw new Error(`Swap API error: ${swapResponse.status}`);
        }

        const { swapTransaction } = await swapResponse.json();

        const swapTxBuf = Buffer.from(swapTransaction, "base64");
        const tx = VersionedTransaction.deserialize(swapTxBuf);
        tx.sign([user]);

        const txid = await connection.sendTransaction(tx, {
            skipPreflight: true,
        });
        await connection.confirmTransaction(txid);  

        const amountBought =
            quote.outAmount / 10 ** (quote.outputMintDecimals || 6);
        
        // Save purchase to database
        await savePurchase(outputMint, amountBought, quote.outputMintDecimals || 6);
        
        // ✅ ADD TOKEN TO MEMPOOL MONITORING
        console.log(`🎯 Adding ${outputMint} to mempool monitoring...`);
        await addTokenToMempool(outputMint);

        return {
            txid,
            amountBought,
            quote,
        };
    } catch (err) {
        throw new Error(`Swap failed: ${err.message}`);
    }
}

async function getSNSDomains(ownerPubkey) {
    try {
        const response = await fetch(
            `https://sns-api.bonfida.com/owners/${ownerPubkey}/domains`
        );
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        const data = await response.json();
        return data?.result || [];
    } catch (err) {
        console.error(
            `❌ Failed to fetch SNS for ${ownerPubkey}:`,
            err.message
        );
        return [];
    }
}

async function fetchPools() {
    try {
        const response = await fetch(
            `${API_BASE}/pools/info/list-v2?poolType=Standard&size=100&mint1=${SOL_MINT}`
        );
        if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
        const data = await response.json();
        return data?.data?.data || [];
    } catch (err) {
        console.error("❌ Failed to fetch pools:", err.message);
        return [];
    }
}

async function getTopHolders(mintAddress, decimals = 9, limit = 10) {
    try {
        const largestAccounts = await connection.getTokenLargestAccounts(
            new PublicKey(mintAddress)
        );

        const topTokenAccounts = largestAccounts.value.slice(0, limit);
        const holders = [];

        for (let i = 0; i < topTokenAccounts.length; i++) {
            const acc = topTokenAccounts[i];
            const tokenAccInfo = await connection.getParsedAccountInfo(
                acc.address
            );
            const owner =
                tokenAccInfo.value?.data?.parsed?.info?.owner || "Unknown";

            holders.push({
                rank: i + 1,
                tokenAccount: acc.address.toBase58(),
                ownerAccount: owner,
                amount: Number(acc.uiAmountString),
                rawAmount: acc.amount,
            });
        }

        return holders;
    } catch (err) {
        console.error(
            `❌ Failed to fetch top holders for ${mintAddress}:`,
            err.message
        );
        return [];
    }
}

async function loadExistingSOLPairs() {
    const pools = await fetchPools();
    detectedPairs.clear();
    for (const pool of pools) {
        const poolId = pool.id || pool.ammId || "unknown";
        detectedPairs.add(poolId);
    }
    return detectedPairs.size;
}

async function detectNewSOLPairs() {
    const pools = await fetchPools();
    const newSOLPairs = [];

    for (const pool of pools) {
        const poolId = pool.id || pool.ammId || "unknown";
        if (detectedPairs.has(poolId)) continue;

        const tokenA = pool.mintA || {};
        const tokenB = pool.mintB || {};
        const nonSolToken = tokenA.address === SOL_MINT ? tokenB : tokenA;

        const pairInfo = {
            poolId,
            symbolA: tokenA.symbol || "Unknown",
            symbolB: tokenB.symbol || "Unknown",
            mintA: tokenA.address,
            mintB: tokenB.address,
            liquidity: pool.tvl || 0,
            volume24h: pool.day?.volume || 0,
            price: pool.price || 0,
            openTime: pool.openTime || 0,
            nonSolMint: nonSolToken.address,
            nonSolSymbol: nonSolToken.symbol || "Unknown",
            decimals: nonSolToken.decimals || 9,
        };

        detectedPairs.add(poolId);
        newSOLPairs.push(pairInfo);

        // Check top holders for SNS domains
        const holders = await getTopHolders(
            pairInfo.nonSolMint,
            pairInfo.decimals,
            10
        );

        let shouldBuy = false;
        for (const holder of holders) {
            const snsDomains = await getSNSDomains(holder.ownerAccount);
            if (snsDomains.length > 0) {
                shouldBuy = true;
                pairInfo.snsHolders = snsDomains;
                console.log(`✅ Found SNS holder for ${pairInfo.nonSolMint}: ${snsDomains.join(', ')}`);
                break;
            }
        }

        if (shouldBuy) {
            try {
                console.log(`🎯 SNS criteria met! Buying ${pairInfo.nonSolMint}...`);
                const buyResult = await buyToken(pairInfo.nonSolMint, process.env.DEFAULT_BUY_AMOUNT);
                pairInfo.purchased = true;
                pairInfo.purchaseDetails = buyResult;
                
                console.log(`✅ Successfully bought ${pairInfo.nonSolSymbol}!`);
                console.log(`🔗 Transaction: https://solscan.io/tx/${buyResult.txid}`);
                
            } catch (error) {
                console.error(`❌ Purchase failed for ${pairInfo.nonSolMint}:`, error.message);
                pairInfo.purchaseError = error.message;
            }
        }

        pairInfo.holders = holders;
    }

    return newSOLPairs;
}

function startBackgroundMonitoring(intervalSeconds = 30) {
    if (isMonitoring) {
        console.log("⚠️ Monitoring already running");
        return;
    }

    isMonitoring = true;

    // Load existing pairs first
    loadExistingSOLPairs().then((count) => {
        console.log(`✅ Baseline loaded: ${count} SOL pairs`);
    });

    monitoringInterval = setInterval(async () => {
        try {
            const newPairs = await detectNewSOLPairs();
            if (newPairs.length > 0) {
                console.log(`🎉 Found ${newPairs.length} new SOL pairs`);
                const purchasedPairs = newPairs.filter(p => p.purchased);
                if (purchasedPairs.length > 0) {
                    console.log(`💰 Purchased ${purchasedPairs.length} tokens with SNS holders`);
                }
            } else {
                console.log("🔍 No new SOL pairs found this cycle");
            }
        } catch (error) {
            console.error("Error in monitoring cycle:", error.message);
        }
    }, intervalSeconds * 1000);

    console.log(
        `🔥 Background monitoring started (${intervalSeconds}s interval)`
    );
}

function stopBackgroundMonitoring() {
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;
        isMonitoring = false;
        console.log("⏹️ Background monitoring stopped");
    }
}

function getMonitoringStatus() {
    return {
        isMonitoring,
        detectedPairsCount: detectedPairs.size,
        walletAddress: user.publicKey.toString(),
    };
}

module.exports = {
    buyToken,
    fetchPools,
    detectNewSOLPairs,
    getTopHolders,
    startBackgroundMonitoring,
    stopBackgroundMonitoring,
    getMonitoringStatus,
    loadExistingSOLPairs,
};