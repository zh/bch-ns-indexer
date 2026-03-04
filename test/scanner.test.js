const { expect } = require('chai')
const sinon = require('sinon')
const path = require('path')
const fs = require('fs')
const db = require('../src/db')
const { processTx } = require('../src/scanner')
const { LOKAD_PREFIX, BURN_ADDRESS } = require('../src/parser')

const TEST_DB_PATH = path.join(__dirname, 'scanner-test.sqlite')

function buildBcnsHex (payloadHex) {
  const len = payloadHex.length / 2
  let pushData
  if (len <= 0x4b) {
    pushData = len.toString(16).padStart(2, '0')
  } else if (len <= 0xff) {
    pushData = '4c' + len.toString(16).padStart(2, '0')
  } else {
    const lo = (len & 0xff).toString(16).padStart(2, '0')
    const hi = ((len >> 8) & 0xff).toString(16).padStart(2, '0')
    pushData = '4d' + lo + hi
  }
  return '6a04' + LOKAD_PREFIX + pushData + payloadHex
}

function buildBcnsTx (payload, opts = {}) {
  const payloadHex = Buffer.from(JSON.stringify(payload), 'utf8').toString('hex')
  const burnValue = opts.burnSats ? opts.burnSats / 1e8 : 0

  const vout = [{
    scriptPubKey: {
      hex: buildBcnsHex(payloadHex)
    }
  }]

  if (burnValue > 0) {
    vout.push({
      value: burnValue,
      scriptPubKey: { addresses: [BURN_ADDRESS] }
    })
  }

  return {
    txid: opts.txid || 'faketxid',
    vin: [{
      txid: 'prevtx',
      vout: 0,
      address: opts.sender || 'bitcoincash:qsender'
    }],
    vout
  }
}

describe('scanner - processTx', () => {
  let bchjs

  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH)
    }
    db.initDb(TEST_DB_PATH)

    bchjs = {
      RawTransactions: {
        getRawTransaction: sinon.stub()
      }
    }
  })

  afterEach(() => {
    db.closeDb()
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH)
    }
  })

  describe('Create (C)', () => {
    it('should register a new name with sufficient burn', async () => {
      const txData = buildBcnsTx(
        { op: 'C', name: 'hello.bch', addr: 'bitcoincash:qaddr', v: 1 },
        { sender: 'bitcoincash:qowner', burnSats: 10000, txid: 'createtx' }
      )

      await processTx(bchjs, txData, 100, 0)

      const row = db.getName('hello.bch')
      expect(row).to.not.equal(null)
      expect(row.address).to.equal('bitcoincash:qaddr')
      expect(row.owner).to.equal('bitcoincash:qowner')
      expect(row.txid).to.equal('createtx')
      expect(row.status).to.equal('active')
    })

    it('should reject Create without sufficient burn', async () => {
      const txData = buildBcnsTx(
        { op: 'C', name: 'hello.bch', addr: 'bitcoincash:qaddr', v: 1 },
        { sender: 'bitcoincash:qowner', burnSats: 5000 }
      )

      await processTx(bchjs, txData, 100, 0)

      expect(db.getName('hello.bch')).to.equal(null)
    })

    it('should reject Create if name already active', async () => {
      db.upsertName('hello.bch', 'bitcoincash:qold', 'bitcoincash:qowner1', 'tx1', 50, 0)

      const txData = buildBcnsTx(
        { op: 'C', name: 'hello.bch', addr: 'bitcoincash:qnew', v: 1 },
        { sender: 'bitcoincash:qowner2', burnSats: 10000 }
      )

      await processTx(bchjs, txData, 100, 0)

      const row = db.getName('hello.bch')
      expect(row.address).to.equal('bitcoincash:qold')
    })

    it('should reject Create during cooldown', async () => {
      db.upsertName('hello.bch', 'bitcoincash:qold', 'bitcoincash:qowner', 'tx1', 50, 0)
      db.deleteName('hello.bch', 90)

      const txData = buildBcnsTx(
        { op: 'C', name: 'hello.bch', addr: 'bitcoincash:qnew', v: 1 },
        { sender: 'bitcoincash:qother', burnSats: 10000 }
      )

      await processTx(bchjs, txData, 100, 0)

      const row = db.getName('hello.bch')
      expect(row.status).to.equal('deleted')
    })
  })

  describe('Update (U)', () => {
    it('should update address when owner matches', async () => {
      db.upsertName('hello.bch', 'bitcoincash:qold', 'bitcoincash:qowner', 'tx1', 50, 0)

      const txData = buildBcnsTx(
        { op: 'U', name: 'hello.bch', addr: 'bitcoincash:qnew', v: 1 },
        { sender: 'bitcoincash:qowner', txid: 'updatetx' }
      )

      await processTx(bchjs, txData, 100, 0)

      const row = db.getName('hello.bch')
      expect(row.address).to.equal('bitcoincash:qnew')
      expect(row.owner).to.equal('bitcoincash:qowner')
      expect(row.txid).to.equal('updatetx')
    })

    it('should reject Update from non-owner', async () => {
      db.upsertName('hello.bch', 'bitcoincash:qold', 'bitcoincash:qowner', 'tx1', 50, 0)

      const txData = buildBcnsTx(
        { op: 'U', name: 'hello.bch', addr: 'bitcoincash:qnew', v: 1 },
        { sender: 'bitcoincash:qother' }
      )

      await processTx(bchjs, txData, 100, 0)

      const row = db.getName('hello.bch')
      expect(row.address).to.equal('bitcoincash:qold')
    })

    it('should reject Update for non-existent name', async () => {
      const txData = buildBcnsTx(
        { op: 'U', name: 'nope.bch', addr: 'bitcoincash:qnew', v: 1 },
        { sender: 'bitcoincash:qowner' }
      )

      await processTx(bchjs, txData, 100, 0)

      expect(db.getName('nope.bch')).to.equal(null)
    })
  })

  describe('Delete (D)', () => {
    it('should delete name when owner matches', async () => {
      db.upsertName('hello.bch', 'bitcoincash:qaddr', 'bitcoincash:qowner', 'tx1', 50, 0)

      const txData = buildBcnsTx(
        { op: 'D', name: 'hello.bch', v: 1 },
        { sender: 'bitcoincash:qowner' }
      )

      await processTx(bchjs, txData, 100, 0)

      const row = db.getName('hello.bch')
      expect(row.status).to.equal('deleted')
      expect(row.deleted_at_height).to.equal(100)
    })

    it('should reject Delete from non-owner', async () => {
      db.upsertName('hello.bch', 'bitcoincash:qaddr', 'bitcoincash:qowner', 'tx1', 50, 0)

      const txData = buildBcnsTx(
        { op: 'D', name: 'hello.bch', v: 1 },
        { sender: 'bitcoincash:qother' }
      )

      await processTx(bchjs, txData, 100, 0)

      const row = db.getName('hello.bch')
      expect(row.status).to.equal('active')
    })
  })

  describe('Transfer (T)', () => {
    it('should transfer ownership when owner matches', async () => {
      db.upsertName('hello.bch', 'bitcoincash:qaddr', 'bitcoincash:qowner', 'tx1', 50, 0)

      const txData = buildBcnsTx(
        { op: 'T', name: 'hello.bch', to: 'bitcoincash:qnewowner', v: 1 },
        { sender: 'bitcoincash:qowner', txid: 'transfertx' }
      )

      await processTx(bchjs, txData, 100, 0)

      const row = db.getName('hello.bch')
      expect(row.owner).to.equal('bitcoincash:qnewowner')
      expect(row.address).to.equal('bitcoincash:qaddr')
      expect(row.txid).to.equal('transfertx')
    })

    it('should reject Transfer from non-owner', async () => {
      db.upsertName('hello.bch', 'bitcoincash:qaddr', 'bitcoincash:qowner', 'tx1', 50, 0)

      const txData = buildBcnsTx(
        { op: 'T', name: 'hello.bch', to: 'bitcoincash:qnewowner', v: 1 },
        { sender: 'bitcoincash:qother' }
      )

      await processTx(bchjs, txData, 100, 0)

      const row = db.getName('hello.bch')
      expect(row.owner).to.equal('bitcoincash:qowner')
    })
  })

  describe('non-BCNS transactions', () => {
    it('should silently ignore non-BCNS transactions', async () => {
      const txData = {
        txid: 'normaltx',
        vin: [{ address: 'bitcoincash:qsender' }],
        vout: [{
          scriptPubKey: {
            hex: '76a914abcdef88ac'
          }
        }]
      }

      await processTx(bchjs, txData, 100, 0)
      // No error, no DB changes
    })
  })
})
