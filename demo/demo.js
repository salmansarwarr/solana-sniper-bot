#!/usr/bin/env node

/**
 * 🎯 Solana Sniper Bot - Interactive Demo Script
 * 
 * This demo showcases:
 * - Real-time mempool monitoring
 * - SNS holder detection
 * - Automated buy/sell execution
 * - Two-phase sell strategy
 * 
 * Run with: node demo.js
 */

const readline = require('readline');
const chalk = require('chalk');
const { Connection, PublicKey, Keypair } = require('@solana/web3.js');

require('dotenv').config();

// Import our services
const { startBackgroundMonitoring, stopBackgroundMonitoring, getMonitoringStatus } = require('../services/buyService');
const { startMempoolMonitor, stopMempoolMonitor, getMempoolMonitorStatus } = require('../services/mempoolMonitor');
const { connectDB, getPurchases } = require('../utils/db');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

class SniperBotDemo {
    constructor() {
        this.isRunning = false;
        this.demoMode = 'mainnet'; // 'mainnet' or 'simulation'
        this.stats = {
            tokensDetected: 0,
            tokensPurchased: 0,
            tokensFirstSold: 0,
            tokensSecondSold: 0,
            totalProfit: 0
        };
    }

    // ============ DEMO UTILITIES ============

    log(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const prefix = `[${timestamp}]`;
        
        switch(type) {
            case 'success':
                console.log(chalk.green(`${prefix} ✅ ${message}`));
                break;
            case 'error':
                console.log(chalk.red(`${prefix} ❌ ${message}`));
                break;
            case 'warning':
                console.log(chalk.yellow(`${prefix} ⚠️  ${message}`));
                break;
            case 'info':
                console.log(chalk.blue(`${prefix} ℹ️  ${message}`));
                break;
            case 'trade':
                console.log(chalk.magenta(`${prefix} 💰 ${message}`));
                break;
            case 'detect':
                console.log(chalk.cyan(`${prefix} 🎯 ${message}`));
                break;
            default:
                console.log(`${prefix} ${message}`);
        }
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    displayHeader() {
        console.clear();
        console.log(chalk.cyan.bold(`
┌─────────────────────────────────────────────────────────────┐
│                  🎯 SOLANA SNIPER BOT DEMO                  │
│                                                             │
│  Real-time Mempool Monitoring • SNS Holder Detection       │
│  Automated Buy/Sell Execution • Two-Phase Strategy         │
└─────────────────────────────────────────────────────────────┘
        `));
    }

    displayStats() {
        console.log(chalk.white.bold('\n📊 SESSION STATISTICS'));
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`Tokens Detected:    ${chalk.cyan(this.stats.tokensDetected)}`);
        console.log(`Tokens Purchased:   ${chalk.green(this.stats.tokensPurchased)}`);
        console.log(`First Sells:        ${chalk.yellow(this.stats.tokensFirstSold)}`);
        console.log(`Second Sells:       ${chalk.blue(this.stats.tokensSecondSold)}`);
        console.log(`Total Profit:       ${chalk.green(this.stats.totalProfit.toFixed(6))} SOL`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    }

    // ============ DEMO SCENARIOS ============

    async simulateTokenDetection() {
        this.log('Scanning Raydium for new SOL pairs...', 'info');
        await this.sleep(2000);

        // Simulate finding a new token
        const mockToken = {
            mint: 'DemoTokenMint123...',
            symbol: 'DEMO',
            liquidity: 50000,
            holders: [
                { rank: 1, account: 'ABC123...', amount: 1000000, snsName: 'cryptowhale.sol' },
                { rank: 2, account: 'DEF456...', amount: 500000, snsName: null },
                { rank: 3, account: 'GHI789...', amount: 250000, snsName: 'trader.sol' }
            ]
        };

        this.log(`New token detected: ${mockToken.symbol} (${mockToken.mint})`, 'detect');
        this.stats.tokensDetected++;

        await this.sleep(1000);
        this.log('Analyzing top 10 holders...', 'info');
        await this.sleep(2000);

        this.log(`Found SNS holders: ${mockToken.holders.filter(h => h.snsName).map(h => h.snsName).join(', ')}`, 'success');
        this.log('SNS criteria met! Executing purchase...', 'trade');

        await this.sleep(1500);
        const txid = 'DemoTx' + Math.random().toString(36).substr(2, 8);
        this.log(`✅ Purchase successful!`, 'success');
        this.log(`   Amount: 0.00001 SOL → 1,234.56 DEMO tokens`, 'trade');
        this.log(`   Transaction: https://solscan.io/tx/${txid}`, 'info');
        this.log(`   🎯 Added to mempool monitoring`, 'detect');

        this.stats.tokensPurchased++;
        return mockToken;
    }

    async simulateMempoolDetection(token) {
        this.log('WebSocket connected to Solana RPC', 'success');
        this.log(`Monitoring mempool for ${token.symbol} transactions...`, 'info');

        await this.sleep(3000);

        // Simulate mempool activity
        this.log('📡 Mempool activity detected...', 'info');
        await this.sleep(1000);
        this.log('🔍 Analyzing transaction logs...', 'info');
        await this.sleep(1500);

        console.log(chalk.red.bold('\n🔴 SELL TRANSACTION DETECTED IN MEMPOOL!'));
        console.log('════════════════════════════════════════════════════════════');
        console.log(`Token: ${token.symbol} (${token.mint})`);
        console.log(`Signature: SellTx${Math.random().toString(36).substr(2, 8)}`);
        console.log(`Amount Sold: 25,000 tokens`);
        console.log(`Detection Time: < 500ms`);
        console.log('════════════════════════════════════════════════════════════\n');

        await this.sleep(1000);
        this.log('⚡ EXECUTING IMMEDIATE SELL (50% position)...', 'trade');
        await this.sleep(2000);

        const firstSellTx = 'FirstSell' + Math.random().toString(36).substr(2, 8);
        this.log('✅ First sell completed!', 'success');
        this.log(`   Sold: 617.28 tokens (50% of position)`, 'trade');
        this.log(`   Received: 0.000008 SOL`, 'trade');
        this.log(`   Target Price: 77,160 tokens/SOL`, 'trade');
        this.log(`   Transaction: https://solscan.io/tx/${firstSellTx}`, 'info');

        this.stats.tokensFirstSold++;
        this.stats.totalProfit += 0.000003; // Simulated profit

        return { targetPrice: 77160, remainingTokens: 617.28 };
    }

    async simulatePriceMonitoring(sellData) {
        this.log('🎯 Starting price monitoring for second sell...', 'info');
        this.log(`Target: ${sellData.targetPrice.toLocaleString()} tokens/SOL`, 'info');

        let currentPrice = 85000;
        let attempts = 0;
        const maxAttempts = 5;

        while (currentPrice > sellData.targetPrice && attempts < maxAttempts) {
            attempts++;
            await this.sleep(2000);
            
            currentPrice = sellData.targetPrice + Math.random() * 10000 - 5000;
            this.log(`Current price: ${currentPrice.toFixed(0)} tokens/SOL (Target: ${sellData.targetPrice})`, 'info');

            if (currentPrice <= sellData.targetPrice) {
                break;
            }
        }

        console.log(chalk.green.bold('\n🎯 TARGET PRICE REACHED!'));
        this.log('⚡ EXECUTING SECOND SELL (remaining 50%)...', 'trade');
        await this.sleep(2000);

        const secondSellTx = 'SecondSell' + Math.random().toString(36).substr(2, 8);
        this.log('✅ Second sell completed!', 'success');
        this.log(`   Sold: ${sellData.remainingTokens} tokens (remaining 50%)`, 'trade');
        this.log(`   Received: 0.000012 SOL`, 'trade');
        this.log(`   Transaction: https://solscan.io/tx/${secondSellTx}`, 'info');

        this.stats.tokensSecondSold++;
        this.stats.totalProfit += 0.000012;

        this.log('🎉 Complete trading cycle finished!', 'success');
        this.log(`💰 Total profit from this trade: ${(0.000012 + 0.000008 - 0.00001).toFixed(6)} SOL`, 'trade');
    }

    // ============ LIVE SYSTEM DEMONSTRATION ============

    async demonstrateLiveSystem() {
        this.log('Starting LIVE system demonstration...', 'warning');
        this.log('This will use real Solana connections and monitoring', 'warning');

        try {
            // Connect to database
            await connectDB();
            this.log('Database connected', 'success');

            // Check wallet
            const user = Keypair.fromSecretKey(JSON.parse(process.env.PRIVATE_KEY));
            this.log(`Wallet: ${user.publicKey.toString()}`, 'info');

            // Start monitoring systems
            this.log('Starting buy monitoring...', 'info');
            startBackgroundMonitoring(30);
            await this.sleep(1000);

            this.log('Starting mempool monitoring...', 'info');
            startMempoolMonitor();
            await this.sleep(2000);

            // Display status
            const buyStatus = getMonitoringStatus();
            const mempoolStatus = getMempoolMonitorStatus();

            this.log(`Buy monitoring: ${buyStatus.isMonitoring ? 'ACTIVE' : 'INACTIVE'}`, buyStatus.isMonitoring ? 'success' : 'error');
            this.log(`Mempool monitoring: ${mempoolStatus.isConnected ? 'CONNECTED' : 'DISCONNECTED'}`, mempoolStatus.isConnected ? 'success' : 'error');
            this.log(`Monitored tokens: ${mempoolStatus.monitoredTokens}`, 'info');

            this.log('✅ Live system is now running!', 'success');
            this.log('Monitor the console for real trading opportunities...', 'info');

            // Show recent purchases
            const purchases = await getPurchases(5);
            if (purchases.length > 0) {
                console.log('\n📈 Recent Purchases:');
                purchases.forEach((p, i) => {
                    const status = p.secondSell ? '✅ Complete' : p.firstSell ? '🟡 50% Sold' : '🔄 Monitoring';
                    console.log(`  ${i + 1}. ${p.tokenMint.substring(0, 8)}... - ${p.amount.toFixed(2)} tokens - ${status}`);
                });
            }

        } catch (error) {
            this.log(`Error starting live system: ${error.message}`, 'error');
        }
    }

    async stopLiveSystem() {
        this.log('Stopping live monitoring systems...', 'info');
        
        try {
            stopBackgroundMonitoring();
            stopMempoolMonitor();
            this.log('All systems stopped', 'success');
        } catch (error) {
            this.log(`Error stopping systems: ${error.message}`, 'error');
        }
    }

    // ============ MENU SYSTEM ============

    async showMainMenu() {
        console.log(chalk.yellow.bold('\n🎛️  DEMO OPTIONS'));
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('1. 🎬 Run Complete Simulation (Safe Demo)');
        console.log('2. 🎯 Token Detection Demo');
        console.log('3. ⚡ Mempool Monitoring Demo');
        console.log('4. 💰 Trading Strategy Demo');
        console.log('5. 🔴 Start LIVE System (Real Trading)');
        console.log('6. 🟢 Stop LIVE System');
        console.log('7. 📊 Show Current Status');
        console.log('8. 📈 View Trading History');
        console.log('9. ❌ Exit');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        return new Promise((resolve) => {
            rl.question(chalk.cyan('\nSelect an option (1-9): '), resolve);
        });
    }

    async handleMenuChoice(choice) {
        switch(choice) {
            case '1':
                await this.runCompleteSimulation();
                break;
            case '2':
                await this.simulateTokenDetection();
                break;
            case '3':
                const token = await this.simulateTokenDetection();
                await this.simulateMempoolDetection(token);
                break;
            case '4':
                const token2 = await this.simulateTokenDetection();
                const sellData = await this.simulateMempoolDetection(token2);
                await this.simulatePriceMonitoring(sellData);
                break;
            case '5':
                await this.demonstrateLiveSystem();
                break;
            case '6':
                await this.stopLiveSystem();
                break;
            case '7':
                await this.showSystemStatus();
                break;
            case '8':
                await this.showTradingHistory();
                break;
            case '9':
                await this.exitDemo();
                return false;
            default:
                this.log('Invalid option. Please choose 1-9.', 'error');
        }
        return true;
    }

    async runCompleteSimulation() {
        this.log('🎬 Starting complete trading simulation...', 'info');
        console.log(chalk.yellow('\nThis is a SAFE DEMO - no real trades will be executed\n'));

        // Full cycle simulation
        const token = await this.simulateTokenDetection();
        await this.sleep(1000);
        
        const sellData = await this.simulateMempoolDetection(token);
        await this.sleep(1000);
        
        await this.simulatePriceMonitoring(sellData);
        
        this.displayStats();
        this.log('🎉 Complete simulation finished!', 'success');
    }

    async showSystemStatus() {
        try {
            await connectDB();
            const buyStatus = getMonitoringStatus();
            const mempoolStatus = getMempoolMonitorStatus();

            console.log(chalk.white.bold('\n🔍 SYSTEM STATUS'));
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`Buy Monitoring:     ${buyStatus.isMonitoring ? chalk.green('ACTIVE') : chalk.red('INACTIVE')}`);
            console.log(`Mempool Monitoring: ${mempoolStatus.isConnected ? chalk.green('CONNECTED') : chalk.red('DISCONNECTED')}`);
            console.log(`Detected Pairs:     ${buyStatus.detectedPairsCount || 0}`);
            console.log(`Monitored Tokens:   ${mempoolStatus.monitoredTokens || 0}`);
            console.log(`Wallet Address:     ${buyStatus.walletAddress || 'Not loaded'}`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        } catch (error) {
            this.log(`Error getting status: ${error.message}`, 'error');
        }
    }

    async showTradingHistory() {
        try {
            await connectDB();
            const purchases = await getPurchases(10);

            console.log(chalk.white.bold('\n📈 TRADING HISTORY (Last 10)'));
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            
            if (purchases.length === 0) {
                console.log(chalk.gray('No trading history found.'));
            } else {
                purchases.forEach((p, i) => {
                    const status = p.secondSell ? '✅ Complete' : p.firstSell ? '🟡 50% Sold' : '🔄 Monitoring';
                    const date = new Date(p.timestamp).toLocaleString();
                    console.log(`${i + 1}. ${p.tokenMint.substring(0, 12)}... | ${p.amount.toFixed(2)} tokens | ${status} | ${date}`);
                });
            }
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        } catch (error) {
            this.log(`Error getting trading history: ${error.message}`, 'error');
        }
    }

    async exitDemo() {
        this.log('Shutting down demo...', 'info');
        await this.stopLiveSystem();
        this.log('Thank you for trying the Solana Sniper Bot! 🎯', 'success');
        rl.close();
    }

    // ============ MAIN DEMO LOOP ============

    async start() {
        this.displayHeader();
        
        // Environment check
        if (!process.env.RPC_URL || !process.env.PRIVATE_KEY) {
            this.log('Missing required environment variables!', 'error');
            this.log('Please set RPC_URL and PRIVATE_KEY in your .env file', 'error');
            return;
        }

        this.log('Solana Sniper Bot Demo Started!', 'success');
        this.log('This demo showcases real-time mempool monitoring and trading automation', 'info');

        while (true) {
            try {
                this.displayStats();
                const choice = await this.showMainMenu();
                const shouldContinue = await this.handleMenuChoice(choice.trim());
                
                if (!shouldContinue) break;

                // Pause before showing menu again
                await new Promise(resolve => {
                    rl.question(chalk.gray('\nPress Enter to continue...'), resolve);
                });

            } catch (error) {
                this.log(`Demo error: ${error.message}`, 'error');
                break;
            }
        }
    }
}

// ============ STARTUP ============

async function main() {
    try {
        // Check for required dependencies
        try {
            require('chalk');
        } catch (e) {
            console.log('Installing required demo dependencies...');
            require('child_process').execSync('npm install chalk', { stdio: 'inherit' });
            console.log('Dependencies installed! Please run the demo again.');
            process.exit(0);
        }

        const demo = new SniperBotDemo();
        await demo.start();
        
    } catch (error) {
        console.error('Failed to start demo:', error.message);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n🛑 Demo interrupted. Cleaning up...');
    try {
        stopBackgroundMonitoring();
        stopMempoolMonitor();
    } catch (e) {
        // Ignore cleanup errors
    }
    process.exit(0);
});

// Start the demo
if (require.main === module) {
    main();
}

module.exports = { SniperBotDemo };