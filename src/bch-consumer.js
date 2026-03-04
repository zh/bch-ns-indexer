const SlpWallet = require('minimal-slp-wallet').default
const config = require('./config')

let bchjs = null

async function init () {
  const wallet = new SlpWallet(undefined, {
    interface: config.walletInterface,
    restURL: config.walletRestUrl
  })
  await wallet.walletInfoPromise
  bchjs = wallet.ar.bchjs
}

async function getBlockchainInfo () {
  return bchjs.Blockchain.getBlockchainInfo()
}

async function getBlockHash (height) {
  return bchjs.Blockchain.getBlockHash(height)
}

async function getBlock (hash) {
  // consumer-api getBlock returns txid strings, not full tx objects.
  // Fetch each tx to get full tx data with vout details.
  const block = await bchjs.Blockchain.getBlock(hash)
  const txData = []
  for (const txid of block.tx) {
    txData.push(await bchjs.RawTransactions.getRawTransaction(txid, true))
  }
  block.tx = txData
  return block
}

async function getRawTransaction (txid, verbose) {
  return bchjs.RawTransactions.getRawTransaction(txid, verbose)
}

module.exports = { init, getBlockchainInfo, getBlockHash, getBlock, getRawTransaction }
