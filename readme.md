# 🎯 Solana Sniper Bot - Real-time Mempool Edition

A high-performance Solana sniper bot with **real-time WebSocket mempool monitoring** for instant sell detection and execution.

## 🚀 Key Features

### ✅ **NEW: Real-time Mempool Monitoring**
- **WebSocket-based** transaction monitoring (not polling!)
- **Sub-second** sell detection and execution
- **Instant** response to market movements
- **Persistent** connections with auto-reconnect

### ✅ **Smart Token Detection**
- Monitors Raydium for new SOL pairs
- Validates top 10 holders for SNS domains
- Automatic purchase when criteria are met
- Extensible for multiple DEX support

### ✅ **Two-Phase Sell Strategy**
- **First Sell**: 50% immediately when any sell is detected
- **Second Sell**: Remaining 50% at calculated target price
- **Target Price**: `tokens_sold / sol_received` ratio

## 📋 Prerequisites

- **Node.js** 16+ 
- **MongoDB** (local or Atlas)
- **Solana Wallet** with SOL for trading
- **RPC Access** (preferably paid for WebSocket support)

## 🛠️ Installation

```bash
# Clone and install
git clone <your-repo>
cd solana-sniper-bot
npm install

# Copy environment template
cp .env.example .env
```

## ⚙️ Configuration

### 1. **Set up your `.env` file:**

```bash
# Essential Configuration
RPC_URL=https://your-rpc-endpoint.com
RPC_WS_URL=wss://your-websocket-rpc-endpoint.com
PRIVATE_KEY=[your,private,key,array]
MONGO_URI=mongodb://localhost:27017/solanaBot

# Optional but Recommended
HELIUS_API_KEY=your-helius-key
PRIORITY_FEE_LAMPORTS=5000
```

### 2. **Get Your Private Key Array:**

```bash
# Using Solana CLI
solana-keygen pubkey ~/.config/solana/id.json --output json-compact

# Or from Phantom/other wallets (export as array format)
```

### 3. **Recommended RPC Providers:**

```bash
# Alchemy (Good WebSocket support)
RPC_URL=https://solana-mainnet.g.alchemy.com/v2/YOUR-KEY
RPC_WS_URL=wss://solana-mainnet.g.alchemy.com/v2/YOUR-KEY

# Helius (Best for mempool monitoring)
RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR-KEY
RPC_WS_URL=wss://mainnet.helius-rpc.com/?api-key=YOUR-KEY

# QuickNode
RPC_URL=https://your-endpoint.solana-mainnet.quiknode.pro/YOUR-KEY/
RPC_WS_URL=wss://your-endpoint.solana-mainnet.quiknode.pro/YOUR-KEY/
```

## 🚀 Usage

### **Option 1: Dashboard Interface**

```bash
npm start
# Visit http://localhost:3000
```

Use the web dashboard to:
- Start/stop all monitoring systems
- View real-time status
- Monitor detected opportunities

### **Option 2: API Control**

```bash
# Start complete monitoring system
curl -X POST http://localhost:3000/api/monitoring/start-all

# Start individual components
curl -X POST http://localhost:3000/api/monitoring/start
curl -X POST http://localhost:3000/api/monitoring/mempool/start

# Check status
curl http://localhost:3000/api/monitoring/all-status
```

### **Option 3: Programmatic Control**

```javascript
const { startBackgroundMonitoring } = require('./services/buyService');
const { startMempoolMonitor } = require('./services/mempoolMonitor');

// Start buy monitoring (scans for new pairs)
startBackgroundMonitoring(30); // Check every 30 seconds

// Start mempool monitoring (real-time sell detection)  
startMempoolMonitor();
```

## 📊 How It Works

### **1. Token Detection & Purchase**
```
New Raydium Pair Detected
         ↓
Check Top 10 Holders
         ↓
SNS Domain Found? → YES → Buy Token → Add to Mempool Monitor
         ↓
        NO → Skip
```

### **2. Real-time Sell Monitoring**
```
WebSocket Connection to Solana RPC
         ↓
Subscribe to Token Transactions
         ↓
Sell Transaction Detected → Execute First Sell (50%)
         ↓
Start Price Monitoring → Target Price Reached → Second Sell (50%)
```

## 🔧 API Endpoints

### **Monitoring Control**
- `POST /api/monitoring/start-all` - Start complete system
- `POST /api/monitoring/stop-all` - Stop all monitoring
- `GET /api/monitoring/all-status` - Comprehensive status

### **Mempool Monitoring**
- `POST /api/monitoring/mempool/start` - Start WebSocket monitoring
- `POST /api/monitoring/mempool/stop` - Stop mempool monitoring
- `GET /api/monitoring/mempool/status` - Mempool status

### **Manual Trading**
- `POST /api/buy/buy` - Manual token purchase
- `GET /api/buy/pools` - Get available pools
- `GET /api/buy/holders/:mintAddress` - Get token holders

## 📈 Performance Optimizations

### **WebSocket vs Polling Comparison:**

| Method | Detection Speed | Resource Usage | Reliability |
|--------|----------------|---------------|-------------|
| **WebSocket (NEW)** | **< 1 second** | **Low** | **High** |
| Polling (OLD) | 15+ seconds | High | Medium |

### **Recommended Settings:**
- **RPC**: Paid service with WebSocket support
- **Priority Fee**: 5,000-10,000 lamports
- **Slippage**: 0.5% (50 bps)
- **Buy Amount**: Start small (0.00001 SOL)

## 🛡️ Safety Features

- **Environment Validation** on startup
- **Graceful Shutdown** handling
- **Auto-reconnect** for WebSocket failures
- **Error Handling** with detailed logging
- **Transaction Confirmation** before proceeding

## 📝 Logging & Monitoring

```bash
# Console output shows:
🎯 New token detected with SNS holder
💰 Purchase executed: 0.00001 SOL
🔴 Sell detected in mempool!
✅ First sell completed: 0.5 tokens for 0.000005 SOL
🎯 Target price reached! Second sell executed.
```

## 🔧 Troubleshooting

### **WebSocket Connection Issues:**
```bash
# Check if your RPC supports WebSockets
curl -H "Upgrade: websocket" your-rpc-url

# Verify environment variables
node -e "console.log(process.env.RPC_WS_URL)"
```

### **Transaction Failures:**
- Increase priority fee (`PRIORITY_FEE_LAMPORTS`)
- Check SOL balance for gas fees
- Verify RPC endpoint performance

### **No Tokens Detected:**
- Ensure buy monitoring is running
- Check Raydium API accessibility
- Verify SNS API responses

## 🚀 Performance Tips

1. **Use Premium RPC**: Alchemy, Helius, or QuickNode
2. **Monitor Resource Usage**: Keep CPU/memory optimized  
3. **Set Appropriate Buy Amounts**: Start small while testing
4. **Monitor Logs**: Watch for connection issues
5. **Test WebSocket Connection**: Ensure low-latency access

## ⚠️ Important Notes

- **Test thoroughly** on devnet first
- **Start with small amounts** 
- **Monitor performance** and adjust settings
- **Keep private keys secure**
- **Have adequate SOL balance** for transactions and fees

## 🔄 Migration from Old Version

If upgrading from the polling-based version:

1. **Install new dependencies**: `npm install ws`
2. **Update environment**: Add `RPC_WS_URL` 
3. **Start mempool monitoring**: Use new endpoints
4. **Gradually migrate**: Can run both systems initially

---

## 🆘 Support

For issues or questions:
1. Check the logs for error messages
2. Verify your `.env` configuration
3. Test WebSocket connectivity
4. Review API endpoint responses

**Happy Sniping! 🎯⚡**