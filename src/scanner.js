const config = require('./config')
const db = require('./db')
const { parseBcnsTx, validatePayload, findBurnOutput, BURN_AMOUNT_SATS } = require('./parser')
const bchApi = require('./bch-api')

const POLL_INTERVAL_MS = 30000

/**
 * Get the sender address from vin[0] of a raw transaction.
 */
async function getSenderAddress (txData) {
  if (!txData.vin || !txData.vin.length) return null

  const vin0 = txData.vin[0]

  // Some full nodes include the address directly
  if (vin0.address) return vin0.address

  // Otherwise, look up the previous output
  if (vin0.txid && vin0.vout != null) {
    const prevTx = await bchApi.getRawTransaction(vin0.txid, true)
    const prevOut = prevTx.vout[vin0.vout]
    if (prevOut && prevOut.scriptPubKey && prevOut.scriptPubKey.addresses) {
      return prevOut.scriptPubKey.addresses[0]
    }
  }

  return null
}

/**
 * Process a single transaction: parse, validate, and apply rules.
 */
async function processTx (txData, blockHeight, blockPos) {
  const payload = parseBcnsTx(txData)
  if (!payload) return

  const validation = validatePayload(payload)
  if (!validation.valid) return

  const sender = await getSenderAddress(txData)
  if (!sender) return

  const name = payload.name.trim().toLowerCase()
  const existing = db.getName(name)

  switch (payload.op) {
    case 'C': {
      // Reject if name already active
      if (existing && existing.status === 'active') return
      // Reject if in cooldown
      if (db.isInCooldown(name, blockHeight)) return
      // Reject if insufficient burn
      const burned = findBurnOutput(txData)
      if (burned < BURN_AMOUNT_SATS) return
      db.upsertName(name, payload.addr, sender, txData.txid, blockHeight, blockPos)
      break
    }
    case 'U': {
      if (!existing || existing.status !== 'active') return
      if (existing.owner !== sender) return
      db.upsertName(name, payload.addr, existing.owner, txData.txid, blockHeight, blockPos)
      break
    }
    case 'D': {
      if (!existing || existing.status !== 'active') return
      if (existing.owner !== sender) return
      db.deleteName(name, blockHeight)
      break
    }
    case 'T': {
      if (!existing || existing.status !== 'active') return
      if (existing.owner !== sender) return
      db.upsertName(name, existing.address, payload.to, txData.txid, blockHeight, blockPos)
      break
    }
  }
}

/**
 * Process all transactions in a single block.
 */
async function processBlock (blockHeight) {
  // Get block hash from height
  const blockHash = await bchApi.getBlockHash(blockHeight)
  // verbosity=2 returns full tx objects inline
  const block = await bchApi.getBlock(blockHash)

  if (!block || !block.tx || !block.tx.length) return

  for (let i = 0; i < block.tx.length; i++) {
    const txData = block.tx[i]
    try {
      await processTx(txData, blockHeight, i)
    } catch (err) {
      // Skip transactions we can't decode
      console.error(`Error processing tx ${txData.txid} at block ${blockHeight}:`, err.message || err)
    }
  }
}

/**
 * Main scanner loop: scans blocks sequentially, sleeps when caught up.
 */
async function startScanner () {
  console.log('Scanner started')

  let cachedTip = 0

  while (true) {
    const lastBlock = db.getLastBlock() || (config.startBlock - 1)
    const nextBlock = lastBlock + 1

    try {
      // Only refresh tip when caught up or stale
      if (nextBlock > cachedTip) {
        const chainInfo = await bchApi.getBlockchainInfo()
        cachedTip = chainInfo.blocks
      }

      if (nextBlock > cachedTip) {
        // Caught up — wait and poll again
        await sleep(POLL_INTERVAL_MS)
        continue
      }

      console.log(`Scanning block ${nextBlock} (tip: ${cachedTip})`)
      await processBlock(nextBlock)
      db.setLastBlock(nextBlock)

      // Rate-limit: ~2 API calls per block, 10 req/min limit on free tier
      if (config.scanDelayMs > 0) await sleep(config.scanDelayMs)
    } catch (err) {
      console.error(`Scanner error at block ${nextBlock}:`, err.message || err)
      await sleep(POLL_INTERVAL_MS)
    }
  }
}

function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

module.exports = {
  startScanner,
  processBlock,
  processTx,
  getSenderAddress
}
