const config = require('./config')
const { initDb, listNames, closeDb } = require('./db')
const { NAME_SUFFIX } = require('./parser')

function list () {
  initDb(config.dbPath)
  const rows = listNames().filter(r => r.name.endsWith(`.${NAME_SUFFIX}`))
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
