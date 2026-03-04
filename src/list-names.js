const config = require('./config')
const { initDb, listNames, closeDb } = require('./db')

function list () {
  initDb(config.dbPath)
  const rows = listNames()
  closeDb()
  return rows
}

if (require.main === module) {
  const rows = list()
  if (rows.length === 0) {
    console.log('No registered names.')
    process.exit(0)
  }
  console.log(`Registered names: ${rows.length}\n`)
  for (const r of rows) {
    console.log(`  ${r.name}  ->  ${r.address}`)
  }
}

module.exports = { list }
