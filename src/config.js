require('dotenv').config()

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3100,
  bchInterface: process.env.BCH_INTERFACE || 'rest-api',
  bchRestUrl: process.env.BCH_REST_URL || 'https://api.fullstack.cash',
  walletInterface: process.env.WALLET_INTERFACE || 'consumer-api',
  walletRestUrl: process.env.WALLET_REST_URL || 'https://free-bch.fullstack.cash',
  startBlock: parseInt(process.env.START_BLOCK, 10) || 850000,
  dbPath: process.env.DB_PATH || './data/bchns.sqlite',
  scanDelayMs: process.env.SCAN_DELAY_MS != null ? parseInt(process.env.SCAN_DELAY_MS, 10) : 15000
}
