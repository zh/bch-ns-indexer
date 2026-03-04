const { expect } = require('chai')
const { parseBcnsTx, validatePayload, findBurnOutput, LOKAD_PREFIX, BURN_ADDRESS } = require('../src/parser')

/**
 * Build a scriptPubKey hex string for a BCNS OP_RETURN output.
 * Format: 6a + 04 + LOKAD_PREFIX + pushdata opcode + payload
 */
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

describe('parser', () => {
  describe('parseBcnsTx', () => {
    it('should parse a valid BCNS OP_RETURN', () => {
      const payload = JSON.stringify({ op: 'C', name: 'test.bch', addr: 'bitcoincash:qtest', v: 1 })
      const payloadHex = Buffer.from(payload, 'utf8').toString('hex')

      const txData = {
        vout: [{
          scriptPubKey: {
            hex: buildBcnsHex(payloadHex)
          }
        }]
      }

      const result = parseBcnsTx(txData)
      expect(result).to.deep.equal({ op: 'C', name: 'test.bch', addr: 'bitcoincash:qtest', v: 1 })
    })

    it('should parse payload using OP_PUSHDATA1 for large payloads', () => {
      // Build a payload > 75 bytes to trigger OP_PUSHDATA1
      const payload = JSON.stringify({ op: 'C', name: 'test.bch', addr: 'bitcoincash:qreallylongaddresspadding1234567890abcdef', v: 1 })
      const payloadHex = Buffer.from(payload, 'utf8').toString('hex')
      expect(payloadHex.length / 2).to.be.greaterThan(0x4b)

      const txData = {
        vout: [{
          scriptPubKey: {
            hex: buildBcnsHex(payloadHex)
          }
        }]
      }

      const result = parseBcnsTx(txData)
      expect(result.op).to.equal('C')
      expect(result.name).to.equal('test.bch')
    })

    it('should return null for non-BCNS transaction', () => {
      const txData = {
        vout: [{
          scriptPubKey: {
            hex: '6a04deadbeef03abcdef'
          }
        }]
      }

      expect(parseBcnsTx(txData)).to.equal(null)
    })

    it('should return null for transaction without OP_RETURN', () => {
      const txData = {
        vout: [{
          scriptPubKey: {
            hex: '76a914abcdef88ac'
          }
        }]
      }

      expect(parseBcnsTx(txData)).to.equal(null)
    })

    it('should return null for malformed payload', () => {
      const txData = {
        vout: [{
          scriptPubKey: {
            hex: '6a04' + LOKAD_PREFIX + '04gggggggg'
          }
        }]
      }

      expect(parseBcnsTx(txData)).to.equal(null)
    })

    it('should return null for null/undefined input', () => {
      expect(parseBcnsTx(null)).to.equal(null)
      expect(parseBcnsTx(undefined)).to.equal(null)
      expect(parseBcnsTx({})).to.equal(null)
    })
  })

  describe('validatePayload', () => {
    it('should accept valid Create payload', () => {
      const result = validatePayload({ op: 'C', name: 'test.bch', addr: 'bitcoincash:qtest' })
      expect(result.valid).to.equal(true)
    })

    it('should accept valid Update payload', () => {
      const result = validatePayload({ op: 'U', name: 'test.bch', addr: 'bitcoincash:qtest' })
      expect(result.valid).to.equal(true)
    })

    it('should accept valid Delete payload', () => {
      const result = validatePayload({ op: 'D', name: 'test.bch' })
      expect(result.valid).to.equal(true)
    })

    it('should accept valid Transfer payload', () => {
      const result = validatePayload({ op: 'T', name: 'test.bch', to: 'bitcoincash:qnew' })
      expect(result.valid).to.equal(true)
    })

    it('should reject missing op', () => {
      const result = validatePayload({ name: 'test.bch' })
      expect(result.valid).to.equal(false)
      expect(result.reason).to.include('op')
    })

    it('should reject unknown op', () => {
      const result = validatePayload({ op: 'X', name: 'test.bch' })
      expect(result.valid).to.equal(false)
      expect(result.reason).to.include('unknown op')
    })

    it('should reject invalid name format', () => {
      const result = validatePayload({ op: 'C', name: 'a.bch', addr: 'bitcoincash:qtest' })
      expect(result.valid).to.equal(false)
      expect(result.reason).to.include('invalid name format')
    })

    it('should reject Create without addr', () => {
      const result = validatePayload({ op: 'C', name: 'test.bch' })
      expect(result.valid).to.equal(false)
      expect(result.reason).to.include('addr')
    })

    it('should reject Transfer without to', () => {
      const result = validatePayload({ op: 'T', name: 'test.bch' })
      expect(result.valid).to.equal(false)
      expect(result.reason).to.include('to')
    })

    it('should reject null input', () => {
      const result = validatePayload(null)
      expect(result.valid).to.equal(false)
    })
  })

  describe('findBurnOutput', () => {
    it('should sum sats sent to burn address', () => {
      const txData = {
        vout: [
          {
            value: 0.0001,
            scriptPubKey: { addresses: [BURN_ADDRESS] }
          },
          {
            value: 0.001,
            scriptPubKey: { addresses: ['bitcoincash:qother'] }
          }
        ]
      }

      expect(findBurnOutput(txData)).to.equal(10000)
    })

    it('should return 0 when no burn output', () => {
      const txData = {
        vout: [{
          value: 0.001,
          scriptPubKey: { addresses: ['bitcoincash:qother'] }
        }]
      }

      expect(findBurnOutput(txData)).to.equal(0)
    })

    it('should sum multiple burn outputs', () => {
      const txData = {
        vout: [
          { value: 0.0001, scriptPubKey: { addresses: [BURN_ADDRESS] } },
          { value: 0.0002, scriptPubKey: { addresses: [BURN_ADDRESS] } }
        ]
      }

      expect(findBurnOutput(txData)).to.equal(30000)
    })

    it('should return 0 for null input', () => {
      expect(findBurnOutput(null)).to.equal(0)
      expect(findBurnOutput({})).to.equal(0)
    })
  })
})
