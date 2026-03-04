const SlpWallet = require('minimal-slp-wallet').default
const config = require('./config')
const db = require('./db')
const { parseBcnsTx, validatePayload, findBurnOutput, BURN_AMOUNT_SATS } = require('./parser')

const POLL_INTERVAL_MS = 30000

/**
 * Get the sender address from vin[0] of a raw transaction.
 */
async function getSenderAddress (bchjs, txData) {
  if (!txData.vin || !txData.vin.length) return null

  const vin0 = txData.vin[0]

  // Some full nodes include the address directly
  if (vin0.address) return vin0.address

  // Otherwise, look up the previous output
  if (vin0.txid && vin0.vout != null) {
    const prevTx = await bchjs.RawTransactions.getRawTransaction(vin0.txid, true)
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
async function processTx (bchjs, txData, blockHeight, blockPos) {
  const payload = parseBcnsTx(txData)
  if (!payload) return

  const validation = validatePayload(payload)
  if (!validation.valid) return

  const sender = await getSenderAddress(bchjs, txData)
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
async function processBlock (bchjs, blockHeight) {
  // Get block hash from height
  const blockHash = await bchjs.Blockchain.getBlockHash(blockHeight)
  const block = await bchjs.Blockchain.getBlock(blockHash)

  if (!block || !block.tx || !block.tx.length) return

  for (let i = 0; i < block.tx.length; i++) {
    const txid = block.tx[i]
    try {
      const txData = await bchjs.RawTransactions.getRawTransaction(txid, true)
      await processTx(bchjs, txData, blockHeight, i)
    } catch (err) {
      // Skip transactions we can't decode
      console.error(`Error processing tx ${txid} at block ${blockHeight}:`, err.message || err)
    }
  }
}

/**
 * Main scanner loop: scans blocks sequentially, sleeps when caught up.
 */
async function startScanner (database) {
  // Initialize wallet to access bchjs
  const wallet = new SlpWallet(undefined, {
    interface: config.bchInterface,
    restURL: config.bchRestUrl
  })
  await wallet.walletInfoPromise

  const bchjs = wallet.ar.bchjs

  console.log('Scanner started')

  while (true) {
    const lastBlock = db.getLastBlock() || (config.startBlock - 1)
    const nextBlock = lastBlock + 1

    try {
      const chainInfo = await bchjs.Blockchain.getBlockchainInfo()
      const tipHeight = chainInfo.blocks

      if (nextBlock > tipHeight) {
        // Caught up — wait and poll again
        await sleep(POLL_INTERVAL_MS)
        continue
      }

      console.log(`Scanning block ${nextBlock} (tip: ${tipHeight})`)
      await processBlock(bchjs, nextBlock)
      db.setLastBlock(nextBlock)
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
