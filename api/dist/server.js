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
    // Debug: Check if CryptoAPIs API key is loaded
    if (process.env.CRYPTOAPIS_API_KEY) {
        console.log(`✅ CryptoAPIs API key loaded (length: ${process.env.CRYPTOAPIS_API_KEY.trim().length} chars)`);
    }
    else {
        console.warn(`⚠️ CryptoAPIs API key not found. Check api/.env file for CRYPTOAPIS_API_KEY`);
    }
});
