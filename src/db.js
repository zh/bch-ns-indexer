const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')

const COOLDOWN_BLOCKS = 100

let db = null

function initDb (dbPath) {
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')

  db.exec(`
    CREATE TABLE IF NOT EXISTS names (
      name         TEXT PRIMARY KEY,
      address      TEXT NOT NULL,
      owner        TEXT NOT NULL,
      txid         TEXT NOT NULL,
      block_height INTEGER NOT NULL,
      block_pos    INTEGER NOT NULL,
      status       TEXT NOT NULL DEFAULT 'active',
      deleted_at_height INTEGER
    );

    CREATE TABLE IF NOT EXISTS sync_state (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)

  return db
}

function getDb () {
  if (!db) throw new Error('Database not initialized. Call initDb() first.')
  return db
}

function getName (name) {
  const row = getDb().prepare(
    'SELECT name, address, owner, txid, block_height, block_pos, status, deleted_at_height FROM names WHERE name = ?'
  ).get(name)
  return row || null
}

function upsertName (name, address, owner, txid, blockHeight, blockPos) {
  getDb().prepare(`
    INSERT INTO names (name, address, owner, txid, block_height, block_pos, status)
    VALUES (?, ?, ?, ?, ?, ?, 'active')
    ON CONFLICT(name) DO UPDATE SET
      address = excluded.address,
      owner = excluded.owner,
      txid = excluded.txid,
      block_height = excluded.block_height,
      block_pos = excluded.block_pos,
      status = 'active',
      deleted_at_height = NULL
  `).run(name, address, owner, txid, blockHeight, blockPos)
}

function deleteName (name, blockHeight) {
  getDb().prepare(`
    UPDATE names SET status = 'deleted', deleted_at_height = ? WHERE name = ?
  `).run(blockHeight, name)
}

function getLastBlock () {
  const row = getDb().prepare(
    "SELECT value FROM sync_state WHERE key = 'last_block'"
  ).get()
  return row ? parseInt(row.value, 10) : null
}

function setLastBlock (height) {
  getDb().prepare(`
    INSERT INTO sync_state (key, value) VALUES ('last_block', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(String(height))
}

function isInCooldown (name, currentHeight) {
  const row = getName(name)
  if (!row || row.status !== 'deleted' || row.deleted_at_height == null) {
    return false
  }
  return (currentHeight - row.deleted_at_height) < COOLDOWN_BLOCKS
}

function listNames () {
  return getDb().prepare(
    'SELECT name, address, owner, txid, block_height, block_pos FROM names WHERE status = ? ORDER BY block_height ASC, block_pos ASC'
  ).all('active')
}

function closeDb () {
  if (db) {
    db.close()
    db = null
  }
}

module.exports = {
  initDb,
  getDb,
  getName,
  upsertName,
  deleteName,
  getLastBlock,
  setLastBlock,
  isInCooldown,
  listNames,
  closeDb,
  COOLDOWN_BLOCKS
}
