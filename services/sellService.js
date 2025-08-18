// services/sellService.js
const https = require("https");
const {
    Connection,
    Keypair,
    VersionedTransaction,
} = require("@solana/web3.js");
const { getTokensForFirstSell, markFirstSell } = require("../utils/db");

const SOL_MINT = "So11111111111111111111111111111111111111112";
const RPC_URL = process.env.RPC_URL;
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;

const connection = new Connection(RPC_URL, "confirmed");
const user = Keypair.fromSecretKey(JSON.parse(process.env.PRIVATE_KEY));

let state = {
    knownSignatures: new Set(),
    isRunning: false,
    pollInterval: null,
    intervalMs: 15000,
};

const makeRequest = (url) =>
    new Promise((resolve, reject) => {
        https
            .get(url, (res) => {
                let data = "";
                res.on("data", (c) => {
                    data += c;
                });
                res.on("end", () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(e);
                    }
                });
            })
            .on("error", reject);
    });

const buildApiUrl = (mintAddress, before = null) => {
    let url = `https://api.helius.xyz/v0/addresses/${mintAddress}/transactions?api-key=${HELIUS_API_KEY}`;
    return before ? `${url}&before=${before}` : url;
};

const fetchTransactions = async (mintAddress, before = null) => {
    try {
        const url = buildApiUrl(mintAddress, before);
        const response = await makeRequest(url);
        return Array.isArray(response) ? response : [];
    } catch (e) {
        console.error(`Error fetching tx for ${mintAddress}:`, e.message);
        return [];
    }
};

const isSellTransaction = (tx, mintAddress) => {
    const { tokenTransfers } = tx;
    if (!tokenTransfers?.length) return false;
    return tokenTransfers.some(
        (t) =>
            t.mint === mintAddress &&
            t.fromUserAccount &&
            t.toUserAccount &&
            t.fromUserAccount !== t.toUserAccount
    );
};

const extractSellEventData = (tx, mintAddress) => {
    const {
        description,
        tokenTransfers,
        nativeTransfers,
        signature,
        timestamp,
    } = tx;
    const sells =
        tokenTransfers?.filter(
            (t) =>
                t.mint === mintAddress &&
                t.fromUserAccount &&
                t.toUserAccount &&
                t.fromUserAccount !== t.toUserAccount
        ) || [];

    return sells
        .map((s) => {
            const seller = s.fromUserAccount;
            const solRecv = nativeTransfers?.find(
                (n) => n.toUserAccount === seller && n.amount > 0
            );
            return {
                mintAddress,
                signature,
                timestamp: new Date(timestamp * 1000),
                seller,
                tokenAmount: s.tokenAmount,
                solReceived: solRecv ? solRecv.amount / 1e9 : null,
                description: description || "Token sell detected",
            };
        })
        .filter((e) => e.solReceived != null);
};

const logSellEvent = (e) => {
    console.log("\n🔴 SELL TRANSACTION DETECTED!");
    console.log("═══════════════════════════════════════");
    console.log(`Token Mint: ${e.mintAddress}`);
    console.log(`Timestamp : ${e.timestamp.toISOString()}`);
    console.log(`Signature : ${e.signature}`);
    console.log(`Seller    : ${e.seller}`);
    console.log(`Amount    : ${e.tokenAmount.toLocaleString()}`);
    console.log(`SOL Recv  : ${e.solReceived.toFixed(6)} SOL`);
    console.log(`Explorer  : https://solscan.io/tx/${e.signature}`);
    console.log("═══════════════════════════════════════\n");
};

// --- Jupiter sell ---
async function sellToken(inputMint, amountInTokens, tokenDecimals) {
    const amount = Math.floor(amountInTokens * 10 ** tokenDecimals);
    const slippageBps = 50; // 0.5%
    const quoteResponse = await fetch(
        `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${SOL_MINT}&amount=${amount}&slippageBps=${slippageBps}`
    );
    const quote = await quoteResponse.json();
    if (!quote.outAmount) throw new Error("No route found for swap");

    const { swapTransaction } = await (
        await fetch("https://quote-api.jup.ag/v6/swap", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                quoteResponse: quote,
                userPublicKey: user.publicKey.toString(),
                wrapAndUnwrapSol: true,
            }),
        })
    ).json();

    const swapTxBuf = Buffer.from(swapTransaction, "base64");
    const tx = VersionedTransaction.deserialize(swapTxBuf);
    tx.sign([user]);

    const txid = await connection.sendTransaction(tx, { skipPreflight: true });
    await connection.confirmTransaction(txid);
    const solReceived = quote.outAmount / 1e9;
    return { txid, solReceived, quote };
}

// ------- core poller -------
async function processOnce() {
    const tokens = await getTokensForFirstSell();
    if (!tokens.length) return;

    // fetch transactions per token
    const tokenResults = await Promise.all(
        tokens.map(async (t) => ({
            mintAddress: t.mintAddress,
            decimals: t.decimals,
            amount: t.amount,
            transactions: await fetchTransactions(t.mintAddress),
        }))
    );

    let newCount = 0;

    for (const {
        mintAddress,
        decimals,
        amount,
        transactions,
    } of tokenResults) {
        const tokenData = tokens.find(t => t.tokenMint === mintAddress);
        if (tokenData && tokenData.firstSell) {
            console.log(`⏭️ Skipping ${mintAddress} - already sold`);
            continue;
        }
        
        const unseen = transactions.filter(
            (tx) => !state.knownSignatures.has(tx.signature)
        );
        if (unseen.length) newCount += unseen.length;

        for (const tx of unseen) {
            state.knownSignatures.add(tx.signature);

            if (!isSellTransaction(tx, mintAddress)) continue;

            const events = extractSellEventData(tx, mintAddress);
            for (const ev of events) {
                logSellEvent(ev);

                // Execute our own sell action (your strategy, here we sell amountToSell)
                try {
                    const { txid, solReceived } = await sellToken(
                        mintAddress,
                        amount * 0.5,
                        decimals
                    );
                    console.log(
                        `💰 Sold 50% of ${mintAddress} for ${solReceived} SOL (tx: ${txid})`
                    );
                    await markFirstSell(mintAddress);
                } catch (sellErr) {
                    console.error(
                        "❌ Sell transaction failed:",
                        sellErr.message
                    );
                }
            }
        }
    }

    if (newCount > 0) {
        console.log(
            `Processed ${newCount} new transactions across ${tokens.length} tokens...`
        );
    }
}

function startSellMonitor(intervalMs = 15000) {
    if (state.isRunning) {
        console.log("⚠️ Sell monitor already running");
        return;
    }
    state.isRunning = true;
    state.intervalMs = intervalMs;
    console.log(`🚀 Starting sell monitor (every ${intervalMs / 1000}s)`);
    processOnce().then(() => {
        console.log("✅ Initial load complete, monitoring...");
    });
    state.pollInterval = setInterval(processOnce, intervalMs);
}

function stopSellMonitor() {
    if (state.pollInterval) clearInterval(state.pollInterval);
    state = {
        knownSignatures: new Set(),
        isRunning: false,
        pollInterval: null,
        intervalMs: state.intervalMs,
    };
    console.log("🛑 Sell monitor stopped.");
}

function getSellMonitorStatus() {
    return {
        isRunning: state.isRunning,
        intervalMs: state.intervalMs,
        knownSignatures: state.knownSignatures.size,
    };
}

module.exports = {
    startSellMonitor,
    stopSellMonitor,
    getSellMonitorStatus,
    // for tests:
    processOnce,
};
