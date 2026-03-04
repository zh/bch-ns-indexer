const LOKAD_PREFIX = '42434e53' // hex for "BCNS"
const NAME_REGEX = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]\.bch$/
const BURN_ADDRESS = 'bitcoincash:qqqqqqqqqqqqqqqqqqqqqqqqqqqqqu08dsyxz98whc'
const BURN_AMOUNT_SATS = 10000

/**
 * Parse a raw transaction for BCNS OP_RETURN data.
 * Uses scriptPubKey.hex (deterministic) instead of asm (node-dependent).
 * Returns the parsed payload object or null if not a BCNS tx.
 */
function parseBcnsTx (txData) {
  if (!txData || !txData.vout) return null

  for (const vout of txData.vout) {
    const hex = (vout.scriptPubKey && vout.scriptPubKey.hex) || ''

    // OP_RETURN (6a) + push 4 bytes (04) + BCNS prefix (42434e53)
    if (!hex.startsWith('6a04' + LOKAD_PREFIX)) continue

    try {
      // Skip: 6a (1) + 04 (1) + prefix (4) = 6 bytes = 12 hex chars
      const remaining = hex.slice(12)

      // Read the push opcode for the payload
      let payloadHex
      const pushByte = parseInt(remaining.slice(0, 2), 16)

      if (pushByte <= 0x4b) {
        // Direct push: byte is the length
        payloadHex = remaining.slice(2, 2 + pushByte * 2)
      } else if (pushByte === 0x4c) {
        // OP_PUSHDATA1: next byte is length
        const len = parseInt(remaining.slice(2, 4), 16)
        payloadHex = remaining.slice(4, 4 + len * 2)
      } else if (pushByte === 0x4d) {
        // OP_PUSHDATA2: next 2 bytes (little-endian) are length
        const len = parseInt(remaining.slice(4, 6) + remaining.slice(2, 4), 16)
        payloadHex = remaining.slice(6, 6 + len * 2)
      } else {
        continue
      }

      const payloadStr = Buffer.from(payloadHex, 'hex').toString('utf8')
      return JSON.parse(payloadStr)
    } catch (err) {
      return null
    }
  }

  return null
}

/**
 * Validate a parsed BCNS payload.
 * Returns { valid: true } or { valid: false, reason: '...' }
 */
function validatePayload (payload) {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, reason: 'payload is not an object' }
  }

  const { op, name } = payload

  if (!op || typeof op !== 'string') {
    return { valid: false, reason: 'missing or invalid op' }
  }

  if (!['C', 'U', 'D', 'T'].includes(op)) {
    return { valid: false, reason: `unknown op: ${op}` }
  }

  if (!name || typeof name !== 'string') {
    return { valid: false, reason: 'missing or invalid name' }
  }

  const normalized = name.trim().toLowerCase()
  if (!NAME_REGEX.test(normalized)) {
    return { valid: false, reason: `invalid name format: ${normalized}` }
  }

  // Op-specific field checks
  if (op === 'C' && !payload.addr) {
    return { valid: false, reason: 'Create op requires addr field' }
  }
  if (op === 'U' && !payload.addr) {
    return { valid: false, reason: 'Update op requires addr field' }
  }
  if (op === 'T' && !payload.to) {
    return { valid: false, reason: 'Transfer op requires to field' }
  }

  return { valid: true }
}

/**
 * Sum sats sent to the burn address in a transaction.
 */
function findBurnOutput (txData) {
  if (!txData || !txData.vout) return 0

  let totalBurned = 0
  for (const vout of txData.vout) {
    const addresses = (vout.scriptPubKey && vout.scriptPubKey.addresses) || []
    if (addresses.includes(BURN_ADDRESS)) {
      totalBurned += Math.round((vout.value || 0) * 1e8)
    }
  }
  return totalBurned
}

module.exports = {
  parseBcnsTx,
  validatePayload,
  findBurnOutput,
  LOKAD_PREFIX,
  NAME_REGEX,
  BURN_ADDRESS,
  BURN_AMOUNT_SATS
}
