// services/mempoolMonitor.js
const WebSocket = require('ws');
const { Connection, PublicKey } = require('@solana/web3.js');
const { getTokensForFirstSell, markFirstSell } = require('../utils/db');
const { sellToken } = require('./sellService');
require('dotenv').config();

const RPC_URL = process.env.RPC_URL;
const RPC_WS_URL = process.env.RPC_WS_URL || RPC_URL.replace('https://', 'wss://');

class MempoolMonitor {
    constructor() {
        this.connection = new Connection(RPC_URL, 'confirmed');
        this.ws = null;
        this.isConnected = false;
        this.subscriptions = new Map(); // tokenMint -> subscriptionId
        this.monitoredTokens = new Set();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 5000;
    }

    async start() {
        try {
            console.log('🚀 Starting WebSocket mempool monitor...');
            await this.connect();
            await this.loadTokensToMonitor();
            console.log('✅ Mempool monitor started successfully');
        } catch (error) {
            console.error('❌ Failed to start mempool monitor:', error.message);
            throw error;
        }
    }

    async connect() {
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(RPC_WS_URL);

                this.ws.on('open', () => {
                    console.log('🔌 WebSocket connected to Solana RPC');
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    resolve();
                });

                this.ws.on('message', (data) => {
                    this.handleMessage(data);
                });

                this.ws.on('close', () => {
                    console.log('🔌 WebSocket disconnected');
                    this.isConnected = false;
                    this.handleDisconnect();
                });

                this.ws.on('error', (error) => {
                    console.error('🔌 WebSocket error:', error.message);
                    if (!this.isConnected) {
                        reject(error);
                    }
                });

                // Timeout for connection
                setTimeout(() => {
                    if (!this.isConnected) {
                        reject(new Error('WebSocket connection timeout'));
                    }
                }, 10000);

            } catch (error) {
                reject(error);
            }
        });
    }

    async handleDisconnect() {
        this.subscriptions.clear();
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`🔄 Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${this.reconnectDelay/1000}s...`);
            
            setTimeout(async () => {
                try {
                    await this.connect();
                    await this.resubscribeToTokens();
                } catch (error) {
                    console.error('❌ Reconnection failed:', error.message);
                }
            }, this.reconnectDelay);
        } else {
            console.error('❌ Max reconnection attempts reached. Manual restart required.');
        }
    }

    async loadTokensToMonitor() {
        const tokens = await getTokensForFirstSell();
        console.log(`📊 Loading ${tokens.length} tokens for mempool monitoring...`);
        
        for (const token of tokens) {
            await this.subscribeToToken(token.tokenMint, token);
        }
    }

    async resubscribeToTokens() {
        console.log('🔄 Re-subscribing to monitored tokens...');
        const tokens = Array.from(this.monitoredTokens);
        this.monitoredTokens.clear();
        
        for (const tokenMint of tokens) {
            const tokenData = await this.getTokenData(tokenMint);
            if (tokenData) {
                await this.subscribeToToken(tokenMint, tokenData);
            }
        }
    }

    async getTokenData(tokenMint) {
        try {
            const tokens = await getTokensForFirstSell();
            return tokens.find(t => t.tokenMint === tokenMint);
        } catch (error) {
            console.error(`Failed to get token data for ${tokenMint}:`, error.message);
            return null;
        }
    }

    async subscribeToToken(tokenMint, tokenData) {
        if (!this.isConnected) {
            console.log('⚠️ WebSocket not connected, skipping subscription');
            return;
        }

        try {
            // Subscribe to all transactions involving this token mint
            const subscriptionRequest = {
                jsonrpc: '2.0',
                id: `sub_${tokenMint}`,
                method: 'logsSubscribe',
                params: [
                    {
                        mentions: [tokenMint] // Monitor all transactions mentioning this token
                    },
                    {
                        commitment: 'processed', // Fastest confirmation level
                        encoding: 'jsonParsed'
                    }
                ]
            };

            this.ws.send(JSON.stringify(subscriptionRequest));
            
            // Store token data for later processing
            this.monitoredTokens.add(tokenMint);
            console.log(`👀 Subscribed to mempool for token: ${tokenMint}`);

        } catch (error) {
            console.error(`Failed to subscribe to ${tokenMint}:`, error.message);
        }
    }

    async handleMessage(data) {
        try {
            const message = JSON.parse(data.toString());

            // Handle subscription confirmations
            if (message.result && typeof message.result === 'number') {
                const tokenMint = message.id.replace('sub_', '');
                this.subscriptions.set(tokenMint, message.result);
                console.log(`✅ Subscription confirmed for ${tokenMint} (ID: ${message.result})`);
                return;
            }

            // Handle transaction notifications
            if (message.method === 'logsNotification' && message.params) {
                await this.processTransaction(message.params);
            }

        } catch (error) {
            console.error('Error processing WebSocket message:', error.message);
        }
    }

    async processTransaction(params) {
        try {
            const { result } = params;
            const { signature, logs, err } = result.value;

            // Skip failed transactions
            if (err) return;

            // Quick log analysis for token transfers
            const hasTokenTransfer = logs.some(log => 
                log.includes('Transfer') || 
                log.includes('Program log: Instruction: Transfer')
            );

            if (!hasTokenTransfer) return;

            // Get full transaction details for analysis
            const txDetails = await this.connection.getTransaction(signature, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0
            });

            if (!txDetails) return;

            await this.analyzeSellTransaction(txDetails, signature);

        } catch (error) {
            console.error('Error processing transaction:', error.message);
        }
    }

    async analyzeSellTransaction(txDetails, signature) {
        try {
            const { meta, transaction } = txDetails;
            if (!meta || meta.err) return;

            // Extract token transfers from transaction
            const postTokenBalances = meta.postTokenBalances || [];
            const preTokenBalances = meta.preTokenBalances || [];

            // Look for token decreases (sells)
            for (const postBalance of postTokenBalances) {
                const preBalance = preTokenBalances.find(
                    pre => pre.accountIndex === postBalance.accountIndex
                );

                if (!preBalance) continue;

                const tokenMint = postBalance.mint;
                
                // Check if this is a monitored token
                if (!this.monitoredTokens.has(tokenMint)) continue;

                const preAmount = parseFloat(preBalance.uiTokenAmount.uiAmountString || '0');
                const postAmount = parseFloat(postBalance.uiTokenAmount.uiAmountString || '0');

                // Detect sell (token balance decreased)
                if (preAmount > postAmount && preAmount - postAmount > 0) {
                    console.log('\n🔴 SELL DETECTED IN MEMPOOL!');
                    console.log('════════════════════════════════════════');
                    console.log(`Token: ${tokenMint}`);
                    console.log(`Signature: ${signature}`);
                    console.log(`Amount Sold: ${(preAmount - postAmount).toLocaleString()}`);
                    console.log(`Explorer: https://solscan.io/tx/${signature}`);
                    console.log('════════════════════════════════════════\n');

                    // Execute our sell immediately
                    await this.executeSell(tokenMint, signature);
                }
            }

        } catch (error) {
            console.error('Error analyzing sell transaction:', error.message);
        }
    }

    async executeSell(tokenMint, triggerSignature) {
        try {
            const tokenData = await this.getTokenData(tokenMint);
            if (!tokenData) {
                console.log(`⚠️ No token data found for ${tokenMint}`);
                return;
            }

            if (tokenData.firstSell) {
                console.log(`⭐️ ${tokenMint} already sold, skipping...`);
                return;
            }

            // Sell 50% of our position
            const sellAmount = tokenData.amount * 0.5;
            
            console.log(`💰 Executing first sell: ${sellAmount} tokens of ${tokenMint}...`);
            
            const { txid, solReceived } = await sellToken(
                tokenMint,
                sellAmount,
                tokenData.decimals || 6
            );

            // Calculate target price for remaining 50%
            const targetPrice = sellAmount / solReceived; // tokens per SOL
            
            await markFirstSell(tokenMint, targetPrice);

            console.log(`✅ First sell completed!`);
            console.log(`💰 Sold ${sellAmount} tokens for ${solReceived} SOL`);
            console.log(`🎯 Target price set: ${targetPrice.toFixed(6)} tokens/SOL`);
            console.log(`🔗 Transaction: https://solscan.io/tx/${txid}`);

            // Start price monitoring for second sell
            this.startPriceMonitoring(tokenMint, tokenData, targetPrice);

        } catch (error) {
            console.error(`❌ Sell execution failed for ${tokenMint}:`, error.message);
        }
    }

    startPriceMonitoring(tokenMint, tokenData, targetPrice) {
        const monitorInterval = setInterval(async () => {
            try {
                const currentPrice = await this.getCurrentPrice(tokenMint, tokenData.decimals || 6);
                
                if (currentPrice && currentPrice >= targetPrice) {
                    console.log(`🎯 Target price reached for ${tokenMint}! Executing second sell...`);
                    
                    const remainingAmount = tokenData.amount * 0.5;
                    const { txid, solReceived } = await sellToken(
                        tokenMint,
                        remainingAmount,
                        tokenData.decimals || 6
                    );

                    console.log(`💰 Second sell completed: ${solReceived} SOL (tx: ${txid})`);
                    
                    // Update database
                    const db = await require('../utils/db').connectDB();
                    await db.collection('purchases').updateOne(
                        { tokenMint },
                        { $set: { secondSell: true, secondSellTimestamp: new Date() } }
                    );

                    // Stop monitoring this token
                    clearInterval(monitorInterval);
                    this.unsubscribeFromToken(tokenMint);
                }
            } catch (error) {
                console.error(`Price monitoring error for ${tokenMint}:`, error.message);
            }
        }, 2000); // Check every 2 seconds
    }

    async getCurrentPrice(mintAddress, decimals) {
        try {
            const amount = 10 ** decimals;
            const response = await fetch(
                `https://quote-api.jup.ag/v6/quote?inputMint=${mintAddress}&outputMint=So11111111111111111111111111111111111111112&amount=${amount}&slippageBps=50`
            );
            const data = await response.json();
            return Number(data.outAmount) / 1e9;
        } catch (error) {
            console.error("Price fetch error:", error.message);
            return null;
        }
    }

    async addTokenToMonitor(tokenMint) {
        const tokenData = await this.getTokenData(tokenMint);
        if (tokenData && !tokenData.firstSell) {
            await this.subscribeToToken(tokenMint, tokenData);
        }
    }

    async unsubscribeFromToken(tokenMint) {
        const subscriptionId = this.subscriptions.get(tokenMint);
        if (subscriptionId && this.isConnected) {
            const unsubRequest = {
                jsonrpc: '2.0',
                id: `unsub_${tokenMint}`,
                method: 'logsUnsubscribe',
                params: [subscriptionId]
            };
            
            this.ws.send(JSON.stringify(unsubRequest));
            this.subscriptions.delete(tokenMint);
            this.monitoredTokens.delete(tokenMint);
            console.log(`🔕 Unsubscribed from ${tokenMint}`);
        }
    }

    stop() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
        this.subscriptions.clear();
        this.monitoredTokens.clear();
        console.log('🛑 Mempool monitor stopped');
    }

    getStatus() {
        return {
            isConnected: this.isConnected,
            monitoredTokens: this.monitoredTokens.size,
            activeSubscriptions: this.subscriptions.size,
            reconnectAttempts: this.reconnectAttempts
        };
    }
}

// Singleton instance
let mempoolMonitor = null;

function startMempoolMonitor() {
    if (mempoolMonitor && mempoolMonitor.isConnected) {
        console.log('⚠️ Mempool monitor already running');
        return mempoolMonitor;
    }

    mempoolMonitor = new MempoolMonitor();
    mempoolMonitor.start().catch(error => {
        console.error('Failed to start mempool monitor:', error.message);
    });
    
    return mempoolMonitor;
}

function stopMempoolMonitor() {
    if (mempoolMonitor) {
        mempoolMonitor.stop();
        mempoolMonitor = null;
    }
}

function getMempoolMonitorStatus() {
    return mempoolMonitor ? mempoolMonitor.getStatus() : {
        isConnected: false,
        monitoredTokens: 0,
        activeSubscriptions: 0,
        reconnectAttempts: 0
    };
}

async function addTokenToMempool(tokenMint) {
    if (mempoolMonitor && mempoolMonitor.isConnected) {
        await mempoolMonitor.addTokenToMonitor(tokenMint);
    }
}

module.exports = {
    startMempoolMonitor,
    stopMempoolMonitor,
    getMempoolMonitorStatus,
    addTokenToMempool,
    MempoolMonitor
};