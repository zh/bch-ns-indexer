const { expect } = require('chai')
const path = require('path')
const fs = require('fs')
const {
  initDb, getName, upsertName, deleteName,
  getLastBlock, setLastBlock, isInCooldown, listNames, closeDb
} = require('../src/db')

const TEST_DB_PATH = path.join(__dirname, 'test.sqlite')

describe('db', () => {
  beforeEach(() => {
    // Start each test with a fresh database
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH)
    }
    initDb(TEST_DB_PATH)
  })

  afterEach(() => {
    closeDb()
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH)
    }
  })

  describe('upsertName / getName', () => {
    it('should insert and retrieve a name', () => {
      upsertName('test.bch', 'bitcoincash:qaddr', 'bitcoincash:qowner', 'abc123', 100, 5)

      const row = getName('test.bch')
      expect(row).to.not.equal(null)
      expect(row.name).to.equal('test.bch')
      expect(row.address).to.equal('bitcoincash:qaddr')
      expect(row.owner).to.equal('bitcoincash:qowner')
      expect(row.txid).to.equal('abc123')
      expect(row.block_height).to.equal(100)
      expect(row.block_pos).to.equal(5)
      expect(row.status).to.equal('active')
    })

    it('should update an existing name', () => {
      upsertName('test.bch', 'bitcoincash:qaddr1', 'bitcoincash:qowner', 'tx1', 100, 5)
      upsertName('test.bch', 'bitcoincash:qaddr2', 'bitcoincash:qowner', 'tx2', 101, 3)

      const row = getName('test.bch')
      expect(row.address).to.equal('bitcoincash:qaddr2')
      expect(row.txid).to.equal('tx2')
      expect(row.block_height).to.equal(101)
    })

    it('should return null for non-existent name', () => {
      expect(getName('nope.bch')).to.equal(null)
    })

    it('should reactivate a deleted name on upsert', () => {
      upsertName('test.bch', 'bitcoincash:qaddr', 'bitcoincash:qowner', 'tx1', 100, 5)
      deleteName('test.bch', 105)

      const deleted = getName('test.bch')
      expect(deleted.status).to.equal('deleted')

      upsertName('test.bch', 'bitcoincash:qnew', 'bitcoincash:qnewowner', 'tx2', 300, 1)
      const reactivated = getName('test.bch')
      expect(reactivated.status).to.equal('active')
      expect(reactivated.address).to.equal('bitcoincash:qnew')
      expect(reactivated.deleted_at_height).to.equal(null)
    })
  })

  describe('deleteName', () => {
    it('should mark a name as deleted', () => {
      upsertName('test.bch', 'bitcoincash:qaddr', 'bitcoincash:qowner', 'tx1', 100, 5)
      deleteName('test.bch', 110)

      const row = getName('test.bch')
      expect(row.status).to.equal('deleted')
      expect(row.deleted_at_height).to.equal(110)
    })
  })

  describe('sync state', () => {
    it('should return null when no last block set', () => {
      expect(getLastBlock()).to.equal(null)
    })

    it('should store and retrieve last block', () => {
      setLastBlock(12345)
      expect(getLastBlock()).to.equal(12345)
    })

    it('should update last block', () => {
      setLastBlock(100)
      setLastBlock(200)
      expect(getLastBlock()).to.equal(200)
    })
  })

  describe('listNames', () => {
    it('should return empty array when no names exist', () => {
      expect(listNames()).to.deep.equal([])
    })

    it('should return only active names', () => {
      upsertName('alice.bch', 'bitcoincash:qalice', 'bitcoincash:qoalice', 'tx1', 100, 1)
      upsertName('bob.bch', 'bitcoincash:qbob', 'bitcoincash:qobob', 'tx2', 101, 0)
      deleteName('bob.bch', 102)

      const rows = listNames()
      expect(rows).to.have.lengthOf(1)
      expect(rows[0].name).to.equal('alice.bch')
    })

    it('should return names sorted by block_height then block_pos', () => {
      upsertName('charlie.bch', 'bitcoincash:qc', 'bitcoincash:qoc', 'tx3', 200, 5)
      upsertName('alice.bch', 'bitcoincash:qa', 'bitcoincash:qoa', 'tx1', 100, 1)
      upsertName('bob.bch', 'bitcoincash:qb', 'bitcoincash:qob', 'tx2', 200, 2)

      const rows = listNames()
      expect(rows).to.have.lengthOf(3)
      expect(rows[0].name).to.equal('alice.bch')
      expect(rows[1].name).to.equal('bob.bch')
      expect(rows[2].name).to.equal('charlie.bch')
    })
  })

  describe('isInCooldown', () => {
    it('should return false for non-existent name', () => {
      expect(isInCooldown('nope.bch', 500)).to.equal(false)
    })

    it('should return false for active name', () => {
      upsertName('test.bch', 'bitcoincash:qaddr', 'bitcoincash:qowner', 'tx1', 100, 5)
      expect(isInCooldown('test.bch', 500)).to.equal(false)
    })

    it('should return true within cooldown period', () => {
      upsertName('test.bch', 'bitcoincash:qaddr', 'bitcoincash:qowner', 'tx1', 100, 5)
      deleteName('test.bch', 200)

      expect(isInCooldown('test.bch', 250)).to.equal(true)
      expect(isInCooldown('test.bch', 299)).to.equal(true)
    })

    it('should return false after cooldown period', () => {
      upsertName('test.bch', 'bitcoincash:qaddr', 'bitcoincash:qowner', 'tx1', 100, 5)
      deleteName('test.bch', 200)

      expect(isInCooldown('test.bch', 300)).to.equal(false)
      expect(isInCooldown('test.bch', 400)).to.equal(false)
    })
  })
})
