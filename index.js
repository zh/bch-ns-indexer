const config = require('./src/config')
const { createApp } = require('./src/server')
const { initDb, closeDb } = require('./src/db')
const { startScanner, stopScanner } = require('./src/scanner')

async function main () {
  // 1. Initialize SQLite database
  const db = initDb(config.dbPath)
  console.log('Database initialized')

  // 2. Start Koa API server
  const app = createApp()
  const server = app.listen(config.port)
  console.log(`BCH-NS indexer API listening on port ${config.port}`)

  // 3. Graceful shutdown handler
  function shutdown () {
    console.log('Shutting down...')
    stopScanner()
    // Wait for scanner to finish current block, then close everything
    scannerPromise.then(() => {
      server.close(() => {
        closeDb()
        console.log('Shutdown complete')
        process.exit(0)
      })
    })
    // Force exit after 10s if scanner doesn't stop cleanly
    setTimeout(() => {
      console.error('Forced shutdown after timeout')
      closeDb()
      process.exit(1)
    }, 10000)
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)

  // 4. Start blockchain scanner in background
  const scannerPromise = startScanner(db).catch(err => {
    console.error('Scanner error:', err.message)
    process.exit(1)
  })
}

main().catch(err => {
  console.error('Startup error:', err.message)
  process.exit(1)
})
