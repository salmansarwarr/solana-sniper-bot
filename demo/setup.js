#!/usr/bin/env node

/**
 * 🛠️ Solana Sniper Bot - Interactive Setup Script
 * 
 * This script helps configure the bot for first-time users
 * Run with: npm run setup
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { Connection, PublicKey } = require('@solana/web3.js');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

class SetupWizard {
    constructor() {
        this.config = {};
    }

    log(message, type = 'info') {
        const symbols = {
            'success': '✅',
            'error': '❌',
            'warning': '⚠️',
            'info': 'ℹ️',
            'question': '❓'
        };
        console.log(`${symbols[type]} ${message}`);
    }

    async ask(question) {
        return new Promise((resolve) => {
            rl.question(`❓ ${question}: `, resolve);
        });
    }

    async confirm(question) {
        const answer = await this.ask(`${question} (y/n)`);
        return answer.toLowerCase().startsWith('y');
    }

    async start() {
        console.clear();
        console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                🛠️  SOLANA SNIPER BOT SETUP WIZARD              ║
║                                                               ║
║  This wizard will help you configure your bot for trading    ║
╚═══════════════════════════════════════════════════════════════╝
        `);

        this.log('Welcome to the Solana Sniper Bot setup wizard!', 'info');
        this.log('We\'ll help you configure everything step by step.\n', 'info');

        try {
            await this.collectConfiguration();
            await this.validateConfiguration();
            await this.saveConfiguration();
            await this.showNextSteps();
        } catch (error) {
            this.log(`Setup failed: ${error.message}`, 'error');
            process.exit(1);
        }

        rl.close();
    }

    async collectConfiguration() {
        this.log('📡 STEP 1: RPC Configuration', 'info');
        console.log('─'.repeat(50));

        const useCustomRpc = await this.confirm('Do you have a custom Solana RPC endpoint');
        
        if (useCustomRpc) {
            this.config.RPC_URL = await this.ask('Enter your RPC URL (https://)');
            
            const hasWebSocket = await this.confirm('Does your RPC provider support WebSocket');
            if (hasWebSocket) {
                const wsUrl = await this.ask('Enter WebSocket URL (wss://) [optional]');
                if (wsUrl.trim()) {
                    this.config.RPC_WS_URL = wsUrl;
                }
            }
        } else {
            this.log('Using default Solana RPC (may be slower)', 'warning');
            this.config.RPC_URL = 'https://api.mainnet-beta.solana.com';
            this.config.RPC_WS_URL = 'wss://api.mainnet-beta.solana.com';
            
            console.log('\n💡 Recommended RPC providers for better performance:');
            console.log('   • Helius: https://helius.xyz');
            console.log('   • Alchemy: https://alchemy.com');
            console.log('   • QuickNode: https://quicknode.com\n');
        }

        this.log('\n💼 STEP 2: Wallet Configuration', 'info');
        console.log('─'.repeat(50));

        console.log('You need to provide your wallet private key as a JSON array.');
        console.log('Example: [123,45,67,89,12,34,56,78,90,...]');
        console.log('⚠️  This will be stored in .env - keep it secure!\n');

        const hasPrivateKey = await this.confirm('Do you have your private key ready');
        if (!hasPrivateKey) {
            this.log('You can get your private key from:', 'info');
            this.log('  • Solana CLI: solana-keygen pubkey ~/.config/solana/id.json --output json-compact', 'info');
            this.log('  • Phantom: Settings → Export Private Key → Copy as Array', 'info');
            this.log('  • Other wallets: Export/backup options\n', 'info');
            
            const continueSetup = await this.confirm('Continue setup without private key (you can add it later)');
            if (!continueSetup) {
                throw new Error('Setup cancelled - private key required');
            }
            this.config.PRIVATE_KEY = '[YOUR,PRIVATE,KEY,ARRAY,HERE]';
        } else {
            const privateKeyInput = await this.ask('Enter your private key array');
            this.config.PRIVATE_KEY = privateKeyInput;
        }

        this.log('\n🗄️  STEP 3: Database Configuration', 'info');
        console.log('─'.repeat(50));

        const hasMongoDb = await this.confirm('Do you have MongoDB installed/accessible');
        
        if (hasMongoDb) {
            const useLocal = await this.confirm('Use local MongoDB (localhost:27017)');
            if (useLocal) {
                this.config.MONGO_URI = 'mongodb://localhost:27017/solanaBot';
            } else {
                this.config.MONGO_URI = await this.ask('Enter your MongoDB connection string');
            }
        } else {
            this.log('You need MongoDB for the bot to work. Options:', 'warning');
            this.log('  • Install locally: https://docs.mongodb.com/manual/installation/', 'info');
            this.log('  • Use MongoDB Atlas (cloud): https://www.mongodb.com/atlas', 'info');
            this.config.MONGO_URI = 'mongodb://localhost:27017/solanaBot';
        }

        this.log('\n⚙️  STEP 4: Trading Parameters', 'info');
        console.log('─'.repeat(50));

        const defaultBuyAmount = await this.ask('Default buy amount in SOL [0.00001]') || '0.00001';
        this.config.DEFAULT_BUY_AMOUNT = defaultBuyAmount;

        const priorityFee = await this.ask('Priority fee in lamports for faster execution [5000]') || '5000';
        this.config.PRIORITY_FEE_LAMPORTS = priorityFee;

        const slippage = await this.ask('Default slippage in basis points (50 = 0.5%) [50]') || '50';
        this.config.DEFAULT_SLIPPAGE_BPS = slippage;

        this.log('\n🔧 STEP 5: Optional API Keys', 'info');
        console.log('─'.repeat(50));

        const hasHeliusKey = await this.confirm('Do you have a Helius API key (recommended for transaction history)');
        if (hasHeliusKey) {
            this.config.HELIUS_API_KEY = await this.ask('Enter your Helius API key');
        }

        // Additional configuration
        this.config.PORT = '3000';
        this.config.MONGO_DB = 'solanaBot';
        this.config.PAIR_SCAN_INTERVAL = '30';
        this.config.PRICE_CHECK_INTERVAL = '2000';
        this.config.LOG_LEVEL = 'info';
        this.config.ENABLE_TX_LOGGING = 'true';
    }

    async validateConfiguration() {
        this.log('\n🔍 Validating configuration...', 'info');

        // Validate RPC URL
        if (this.config.RPC_URL && this.config.RPC_URL !== '[YOUR,PRIVATE,KEY,ARRAY,HERE]') {
            try {
                const connection = new Connection(this.config.RPC_URL);
                await connection.getLatestBlockhash();
                this.log('RPC connection: OK', 'success');
            } catch (error) {
                this.log(`RPC connection failed: ${error.message}`, 'warning');
            }
        }

        // Validate private key format
        if (this.config.PRIVATE_KEY && this.config.PRIVATE_KEY !== '[YOUR,PRIVATE,KEY,ARRAY,HERE]') {
            try {
                const keyArray = JSON.parse(this.config.PRIVATE_KEY);
                if (Array.isArray(keyArray) && keyArray.length === 64) {
                    this.log('Private key format: OK', 'success');
                } else {
                    this.log('Private key format: Invalid (should be 64-element array)', 'warning');
                }
            } catch (error) {
                this.log('Private key format: Invalid JSON', 'warning');
            }
        }

        // Validate MongoDB URI format
        if (this.config.MONGO_URI) {
            if (this.config.MONGO_URI.startsWith('mongodb://') || this.config.MONGO_URI.startsWith('mongodb+srv://')) {
                this.log('MongoDB URI format: OK', 'success');
            } else {
                this.log('MongoDB URI format: Invalid', 'warning');
            }
        }
    }

    async saveConfiguration() {
        this.log('\n💾 Saving configuration...', 'info');

        const envContent = Object.entries(this.config)
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');

        const envTemplate = `# Solana Sniper Bot Configuration
# Generated by setup wizard on ${new Date().toISOString()}

# ============ SOLANA RPC CONFIGURATION ============
RPC_URL=${this.config.RPC_URL}
${this.config.RPC_WS_URL ? `RPC_WS_URL=${this.config.RPC_WS_URL}` : '# RPC_WS_URL=wss://your-websocket-endpoint'}

# ============ WALLET CONFIGURATION ============
PRIVATE_KEY=${this.config.PRIVATE_KEY}

# ============ DATABASE CONFIGURATION ============
MONGO_URI=${this.config.MONGO_URI}
MONGO_DB=${this.config.MONGO_DB}

# ============ TRADING PARAMETERS ============
DEFAULT_BUY_AMOUNT=${this.config.DEFAULT_BUY_AMOUNT}
DEFAULT_SLIPPAGE_BPS=${this.config.DEFAULT_SLIPPAGE_BPS}
PRIORITY_FEE_LAMPORTS=${this.config.PRIORITY_FEE_LAMPORTS}

# ============ MONITORING CONFIGURATION ============
PAIR_SCAN_INTERVAL=${this.config.PAIR_SCAN_INTERVAL}
PRICE_CHECK_INTERVAL=${this.config.PRICE_CHECK_INTERVAL}

# ============ SERVER CONFIGURATION ============
PORT=${this.config.PORT}

# ============ EXTERNAL API KEYS ============
${this.config.HELIUS_API_KEY ? `HELIUS_API_KEY=${this.config.HELIUS_API_KEY}` : '# HELIUS_API_KEY=your-helius-api-key'}

# ============ LOGGING ============
LOG_LEVEL=${this.config.LOG_LEVEL}
ENABLE_TX_LOGGING=${this.config.ENABLE_TX_LOGGING}
`;

        fs.writeFileSync('.env', envTemplate);
        this.log('Configuration saved to .env file', 'success');

        // Create .env.example for reference
        const exampleContent = envTemplate.replace(/=.*/g, '=your-value-here');
        fs.writeFileSync('.env.example', exampleContent);
        this.log('Example configuration saved to .env.example', 'success');
    }

    async showNextSteps() {
        console.log('\n' + '='.repeat(60));
        this.log('🎉 Setup completed successfully!', 'success');
        console.log('='.repeat(60));

        console.log('\n🚀 Next Steps:');
        console.log('1. Review your .env file and update any placeholder values');
        console.log('2. Ensure MongoDB is running (if using local instance)');
        console.log('3. Fund your wallet with SOL for trading and gas fees');
        
        console.log('\n🧪 Test the setup:');
        console.log('   npm run quick-demo    # Run safe simulation');
        console.log('   npm run demo          # Interactive demo with real connections');
        console.log('   npm start             # Start the bot with dashboard');

        console.log('\n📚 Documentation:');
        console.log('   README.md             # Complete usage guide');
        console.log('   http://localhost:3000 # Dashboard when running');

        if (this.config.PRIVATE_KEY === '[YOUR,PRIVATE,KEY,ARRAY,HERE]') {
            console.log('\n⚠️  Important: Update your PRIVATE_KEY in .env before running live trading!');
        }

        console.log('\n💡 Pro Tips:');
        console.log('• Start with small buy amounts while testing');
        console.log('• Monitor the console logs for optimization opportunities');
        console.log('• Use premium RPC providers for better performance');
        console.log('• Keep your private key secure and never share it');

        console.log('\n✨ Happy sniping! 🎯\n');
    }
}

// Main execution
async function main() {
    const wizard = new SetupWizard();
    await wizard.start();
}

// Handle interruption
process.on('SIGINT', () => {
    console.log('\n\n🛑 Setup interrupted. You can run "npm run setup" again anytime.');
    process.exit(0);
});

if (require.main === module) {
    main();
}

module.exports = { SetupWizard };