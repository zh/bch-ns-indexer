const config = require('./src/config')
const { createApp } = require('./src/server')
const { initDb } = require('./src/db')
const { startScanner } = require('./src/scanner')

async function main () {
  // 1. Initialize SQLite database
  const db = initDb(config.dbPath)
  console.log('Database initialized')

  // 2. Start Koa API server
  const app = createApp()
  await app.listen(config.port)
  console.log(`BCH-NS indexer API listening on port ${config.port}`)

  // 3. Start blockchain scanner in background
  startScanner(db).catch(err => {
    console.error('Scanner error:', err.message)
    process.exit(1)
  })
}

main().catch(err => {
  console.error('Startup error:', err.message)
  process.exit(1)
})
