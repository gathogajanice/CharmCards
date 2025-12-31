"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Load .env file FIRST, before any other imports
// This ensures environment variables are available when modules are loaded
const dotenv_1 = __importDefault(require("dotenv"));
const path = __importStar(require("path"));
dotenv_1.default.config({ path: path.resolve(__dirname, '../.env') });
// Now import other modules (they can now access process.env)
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const gift_cards_1 = __importDefault(require("./routes/gift-cards"));
const utxo_1 = __importDefault(require("./routes/utxo"));
const broadcast_1 = __importDefault(require("./routes/broadcast"));
const broadcast_2 = require("./routes/broadcast");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Routes
app.use('/api/gift-cards', gift_cards_1.default);
app.use('/api/utxo', utxo_1.default);
app.use('/api/broadcast', broadcast_1.default);
// Root route - API status
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        service: 'charm-cards-api',
        version: '1.0.0',
        network: process.env.BITCOIN_NETWORK || 'testnet4',
        endpoints: ['/health', '/api/gift-cards', '/api/utxo', '/api/broadcast'],
        message: 'Charm Cards API is running. Visit /health for health check.'
    });
});
// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'charm-cards-api' });
});
// Start server
app.listen(PORT, () => {
    console.log(`🚀 Charms Gift Cards API server running on port ${PORT}`);
    console.log(`📦 App path: ${process.env.CHARMS_APP_PATH || '../gift-cards'}`);
    console.log(`🔑 App VK: ${process.env.CHARMS_APP_VK?.substring(0, 16)}...`);
    // Check if Bitcoin Core RPC is configured
    const bitcoinRpcConfig = (0, broadcast_2.getBitcoinRpcConfig)();
    if (bitcoinRpcConfig) {
        const rpcUrl = process.env.BITCOIN_RPC_URL;
        // Hide credentials in log
        const safeUrl = rpcUrl?.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@') || 'unknown';
        console.log(`✅ Bitcoin Core RPC configured: ${safeUrl}`);
        console.log(`   Package broadcasting will use submitpackage RPC method`);
        // Test RPC connection on startup (with timeout to not block server startup)
        console.log(`🔍 Testing Bitcoin Core RPC connection...`);
        Promise.race([
            (0, broadcast_2.testBitcoinRpcConnection)(bitcoinRpcConfig),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Connection test timeout after 15 seconds')), 15000))
        ])
            .then((result) => {
            if (result.connected) {
                if (result.loading) {
                    console.log(`⏳ Bitcoin Core RPC connected (node is initializing)`);
                    console.log(`   ${result.error || 'Node is initializing and will be ready soon'}`);
                    console.log(`   Package broadcasting will be available once initialization completes.`);
                }
                else {
                    console.log(`✅ Bitcoin Core RPC connection successful`);
                    if (result.details) {
                        const blocks = result.details.blocks || 0;
                        const headers = result.details.headers || 0;
                        const progress = result.details.verificationprogress || 0;
                        const progressPercent = (progress * 100).toFixed(2);
                        const chain = result.details.chain || 'unknown';
                        if (headers > 0) {
                            console.log(`   Chain: ${chain}, Blocks: ${blocks.toLocaleString()} / ${headers.toLocaleString()} (${progressPercent}%)`);
                        }
                        else {
                            console.log(`   Chain: ${chain}, Blocks: ${blocks.toLocaleString()} (${progressPercent}%)`);
                        }
                    }
                    console.log(`   Package broadcasting is ready!`);
                }
            }
            else {
                console.warn(`⚠️ Bitcoin Core RPC connection failed: ${result.error}`);
                console.warn(`   The node may still be starting up. Package broadcasting will fail until the node is available.`);
                console.warn(`   Run ./check-bitcoin-rpc.sh for detailed diagnostics and troubleshooting steps.`);
            }
        })
            .catch((error) => {
            // Timeout or other error - don't fail server startup, just warn
            if (error.message?.includes('timeout')) {
                console.log(`⏳ Bitcoin Core RPC connection test timed out (node may be busy syncing)`);
                console.log(`   This is normal during heavy sync operations. The node is likely reachable.`);
                console.log(`   Package broadcasting will be attempted when needed.`);
                console.log(`   Check status: curl http://localhost:${PORT}/api/broadcast/health`);
            }
            else {
                console.warn(`⚠️ Error testing Bitcoin Core RPC connection: ${error.message}`);
                console.warn(`   The node may still be starting up. Package broadcasting will fail until the node is available.`);
            }
        });
    }
    else {
        console.log(`ℹ️ Bitcoin Core RPC not configured (BITCOIN_RPC_URL not set)`);
        console.log(`   Package broadcasting requires Bitcoin Core RPC. Set BITCOIN_RPC_URL in api/.env to enable broadcasting.`);
    }
});
