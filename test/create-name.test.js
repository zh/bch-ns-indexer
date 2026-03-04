const { expect } = require('chai')
const sinon = require('sinon')
const { BURN_ADDRESS, BURN_AMOUNT_SATS, LOKAD_PREFIX } = require('../src/parser')

describe('createName', () => {
  let createName
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

    // Clear cached create-name so it picks up the stub
    delete require.cache[require.resolve('../src/create-name')]
    createName = require('../src/create-name').createName
  })

  afterEach(() => {
    sinon.restore()
    delete require.cache[require.resolve('minimal-slp-wallet')]
    delete require.cache[require.resolve('../src/create-name')]
  })

  describe('input validation', () => {
    it('should reject invalid name format (too short)', async () => {
      try {
        await createName('a', 'bitcoincash:qtest', 'L1testwif')
        expect.fail('should have thrown')
      } catch (err) {
        expect(err.message).to.include('Invalid name format')
      }
    })

    it('should reject name with uppercase letters', async () => {
      try {
        await createName('MyName.bch', 'bitcoincash:qtest', 'L1testwif')
        expect.fail('should have thrown')
      } catch (err) {
        expect(err.message).to.include('Invalid name format')
      }
    })

    it('should reject missing addr', async () => {
      try {
        await createName('testname.bch', null, 'L1testwif')
        expect.fail('should have thrown')
      } catch (err) {
        expect(err.message).to.include('addr')
      }
    })

    it('should reject missing WIF', async () => {
      try {
        await createName('testname.bch', 'bitcoincash:qtest', null)
        expect.fail('should have thrown')
      } catch (err) {
        expect(err.message).to.include('WIF')
      }
    })
  })

  describe('payload construction', () => {
    it('should build correct JSON payload with op, name, addr, v', async () => {
      await createName('testname.bch', 'bitcoincash:qtest', 'L1testwif')

      const call = fakeWallet.sendOpReturn.getCall(0)
      const payload = JSON.parse(call.args[0])

      expect(payload).to.deep.equal({
        op: 'C',
        name: 'testname.bch',
        addr: 'bitcoincash:qtest',
        v: 1
      })
    })

    it('should auto-append .bch if missing', async () => {
      await createName('testname', 'bitcoincash:qtest', 'L1testwif')

      const call = fakeWallet.sendOpReturn.getCall(0)
      const payload = JSON.parse(call.args[0])

      expect(payload.name).to.equal('testname.bch')
    })

    it('should pass LOKAD_PREFIX as second argument', async () => {
      await createName('testname.bch', 'bitcoincash:qtest', 'L1testwif')

      const call = fakeWallet.sendOpReturn.getCall(0)
      expect(call.args[1]).to.equal(LOKAD_PREFIX)
    })
  })

  describe('burn output', () => {
    it('should send BURN_AMOUNT_SATS to BURN_ADDRESS', async () => {
      await createName('testname.bch', 'bitcoincash:qtest', 'L1testwif')

      const call = fakeWallet.sendOpReturn.getCall(0)
      const bchOutput = call.args[2]

      expect(bchOutput).to.deep.equal([{
        address: BURN_ADDRESS,
        amountSat: BURN_AMOUNT_SATS
      }])
    })
  })

  describe('wallet interaction', () => {
    it('should initialize wallet with WIF and wallet config', async () => {
      await createName('testname.bch', 'bitcoincash:qtest', 'L1testwif')

      expect(SlpWalletStub.calledOnce).to.equal(true)
      expect(SlpWalletStub.firstCall.args[0]).to.equal('L1testwif')

      const config = require('../src/config')
      const opts = SlpWalletStub.firstCall.args[1]
      expect(opts.interface).to.equal(config.walletInterface)
      expect(opts.restURL).to.equal(config.walletRestUrl)
    })

    it('should wait for wallet init and fetch UTXOs', async () => {
      await createName('testname.bch', 'bitcoincash:qtest', 'L1testwif')

      expect(fakeWallet.getUtxos.calledOnce).to.equal(true)
    })

    it('should return the txid from sendOpReturn', async () => {
      const txid = await createName('testname.bch', 'bitcoincash:qtest', 'L1testwif')

      expect(txid).to.equal('abc123txid')
    })
  })
})
