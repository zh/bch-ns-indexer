const { expect } = require('chai')
const sinon = require('sinon')
const { LOKAD_PREFIX } = require('../src/parser')

describe('deleteName', () => {
  let deleteName
  let SlpWalletStub
  let fakeWallet

  beforeEach(() => {
    fakeWallet = {
      walletInfoPromise: Promise.resolve(),
      getUtxos: sinon.stub().resolves(),
      sendOpReturn: sinon.stub().resolves('abc123txid')
    }

    SlpWalletStub = sinon.stub().returns(fakeWallet)

    // Replace the minimal-slp-wallet module with our stub
    const mod = require.resolve('minimal-slp-wallet')
    require.cache[mod] = {
      id: mod,
      filename: mod,
      loaded: true,
      exports: { default: SlpWalletStub }
    }

    // Clear cached delete-name so it picks up the stub
    delete require.cache[require.resolve('../src/delete-name')]
    deleteName = require('../src/delete-name').deleteName
  })

  afterEach(() => {
    sinon.restore()
    delete require.cache[require.resolve('minimal-slp-wallet')]
    delete require.cache[require.resolve('../src/delete-name')]
  })

  describe('input validation', () => {
    it('should reject invalid name format (too short)', async () => {
      try {
        await deleteName('a', 'L1testwif')
        expect.fail('should have thrown')
      } catch (err) {
        expect(err.message).to.include('Invalid name format')
      }
    })

    it('should reject name with uppercase letters', async () => {
      try {
        await deleteName('MyName.bch', 'L1testwif')
        expect.fail('should have thrown')
      } catch (err) {
        expect(err.message).to.include('Invalid name format')
      }
    })

    it('should reject missing WIF', async () => {
      try {
        await deleteName('testname.bch', null)
        expect.fail('should have thrown')
      } catch (err) {
        expect(err.message).to.include('WIF')
      }
    })
  })

  describe('payload construction', () => {
    it('should build correct JSON payload with op, name, v (no addr)', async () => {
      await deleteName('testname.bch', 'L1testwif')

      const call = fakeWallet.sendOpReturn.getCall(0)
      const payload = JSON.parse(call.args[0])

      expect(payload).to.deep.equal({
        op: 'D',
        name: 'testname.bch',
        v: 1
      })
    })

    it('should not include addr field in payload', async () => {
      await deleteName('testname.bch', 'L1testwif')

      const call = fakeWallet.sendOpReturn.getCall(0)
      const payload = JSON.parse(call.args[0])

      expect(payload).to.not.have.property('addr')
    })

    it('should auto-append .bch if missing', async () => {
      await deleteName('testname', 'L1testwif')

      const call = fakeWallet.sendOpReturn.getCall(0)
      const payload = JSON.parse(call.args[0])

      expect(payload.name).to.equal('testname.bch')
    })

    it('should pass LOKAD_PREFIX as second argument', async () => {
      await deleteName('testname.bch', 'L1testwif')

      const call = fakeWallet.sendOpReturn.getCall(0)
      expect(call.args[1]).to.equal(LOKAD_PREFIX)
    })
  })

  describe('no burn output', () => {
    it('should pass empty array as bchOutput (no burn for Delete)', async () => {
      await deleteName('testname.bch', 'L1testwif')

      const call = fakeWallet.sendOpReturn.getCall(0)
      const bchOutput = call.args[2]

      expect(bchOutput).to.deep.equal([])
    })
  })

  describe('wallet interaction', () => {
    it('should initialize wallet with WIF and config', async () => {
      await deleteName('testname.bch', 'L1testwif')

      expect(SlpWalletStub.calledOnce).to.equal(true)
      expect(SlpWalletStub.firstCall.args[0]).to.equal('L1testwif')
    })

    it('should wait for wallet init and fetch UTXOs', async () => {
      await deleteName('testname.bch', 'L1testwif')

      expect(fakeWallet.getUtxos.calledOnce).to.equal(true)
    })

    it('should return the txid from sendOpReturn', async () => {
      const txid = await deleteName('testname.bch', 'L1testwif')

      expect(txid).to.equal('abc123txid')
    })
  })
})
