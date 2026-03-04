require('dotenv').config()

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3100,
  bchInterface: process.env.BCH_INTERFACE || 'consumer-api',
  bchRestUrl: process.env.BCH_REST_URL || 'https://free-bch.fullstack.cash',
  startBlock: parseInt(process.env.START_BLOCK, 10) || 850000,
  dbPath: process.env.DB_PATH || './data/bchns.sqlite'
}
