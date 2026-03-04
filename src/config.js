require('dotenv').config()

module.exports = {
  port: process.env.PORT != null ? parseInt(process.env.PORT, 10) : 3100,
  bchRestUrl: process.env.BCH_REST_URL != null ? process.env.BCH_REST_URL : 'https://api.fullstack.cash/v5/',
  walletInterface: process.env.WALLET_INTERFACE != null ? process.env.WALLET_INTERFACE : 'consumer-api',
  walletRestUrl: process.env.WALLET_REST_URL != null ? process.env.WALLET_REST_URL : 'https://free-bch.fullstack.cash',
  startBlock: process.env.START_BLOCK != null ? parseInt(process.env.START_BLOCK, 10) : 850000,
  dbPath: process.env.DB_PATH != null ? process.env.DB_PATH : './data/bchns.sqlite',
  scanDelayMs: process.env.SCAN_DELAY_MS != null ? parseInt(process.env.SCAN_DELAY_MS, 10) : 15000,
  adminUser: process.env.ADMIN_USER || '',
  adminPass: process.env.ADMIN_PASS || ''
}
