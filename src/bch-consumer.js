const axios = require('axios')
const config = require('./config')

const MAX_RETRIES = 5
const BASE_DELAY_MS = 2000
const MAX_DELAY_MS = 30000

// Local bch-api needs full-node/ prefix; public FullStack API does not
const pathPrefix = config.scanDelayMs === 0 ? 'full-node/' : ''

function apiUrl (path) {
  return `${config.bchRestUrl}${pathPrefix}${path}`
}

async function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function requestWithRetry (fn) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const status = err.response && err.response.status
      if (status !== 429 || attempt === MAX_RETRIES) {
        throw err
      }
      const retryAfter = err.response.headers && err.response.headers['retry-after']
      const delayMs = retryAfter
        ? parseInt(retryAfter, 10) * 1000
        : Math.min(BASE_DELAY_MS * Math.pow(2, attempt), MAX_DELAY_MS)
      console.log(`429 rate limited, retry ${attempt + 1}/${MAX_RETRIES} after ${delayMs}ms`)
      await sleep(delayMs)
    }
  }
}

async function init () {
  console.log(`Scanner connecting: url=${config.bchRestUrl}`)
  const info = await getBlockchainInfo()
  console.log(`Connected to chain: ${info.chain}, tip: ${info.blocks}`)
}

async function getBlockchainInfo () {
  const { data } = await requestWithRetry(() =>
    axios.get(apiUrl('blockchain/getBlockchainInfo'))
  )
  return data
}

async function getBlockHash (height) {
  const { data } = await requestWithRetry(() =>
    axios.get(apiUrl(`blockchain/getBlockHash/${height}`))
  )
  return data
}

async function getBlock (hash) {
  // verbosity 2 returns full tx objects inline — no per-tx API calls needed
  const { data } = await requestWithRetry(() =>
    axios.post(apiUrl('blockchain/getblock'), {
      blockhash: hash,
      verbosity: 2
    })
  )
  return data
}

async function getRawTransaction (txid, verbose) {
  const { data } = await requestWithRetry(() =>
    axios.get(apiUrl(`rawtransactions/getRawTransaction/${txid}?verbose=${verbose}`))
  )
  return data
}

module.exports = { init, getBlockchainInfo, getBlockHash, getBlock, getRawTransaction }
