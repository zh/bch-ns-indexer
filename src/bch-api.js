const https = require('https')
const config = require('./config')

const BASE = config.bchRestUrl.replace(/\/$/, '')

function get (path) {
  return new Promise((resolve, reject) => {
    https.get(`${BASE}/${path}`, (res) => {
      let body = ''
      res.on('data', (chunk) => { body += chunk })
      res.on('end', () => {
        if (res.statusCode >= 400) {
          return reject(new Error(`${res.statusCode} ${body}`))
        }
        try { resolve(JSON.parse(body)) } catch (e) { resolve(body) }
      })
    }).on('error', reject)
  })
}

function post (path, data) {
  const payload = JSON.stringify(data)
  const url = new URL(`${BASE}/${path}`)
  const opts = {
    hostname: url.hostname,
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  }

  return new Promise((resolve, reject) => {
    const req = https.request(opts, (res) => {
      let body = ''
      res.on('data', (chunk) => { body += chunk })
      res.on('end', () => {
        if (res.statusCode >= 400) {
          return reject(new Error(`${res.statusCode} ${body}`))
        }
        try { resolve(JSON.parse(body)) } catch (e) { resolve(body) }
      })
    })
    req.on('error', reject)
    req.write(payload)
    req.end()
  })
}

async function getBlockchainInfo () {
  return get('blockchain/getBlockchainInfo')
}

async function getBlockHash (height) {
  return get(`blockchain/getBlockHash/${height}`)
}

async function getBlock (hash) {
  // verbosity=2 returns full tx objects inline, avoiding per-tx API calls
  return post('blockchain/getblock', { blockhash: hash, verbosity: 2 })
}

async function getRawTransaction (txid, verbose) {
  return get(`rawtransactions/getRawTransaction/${txid}?verbose=${verbose}`)
}

module.exports = { getBlockchainInfo, getBlockHash, getBlock, getRawTransaction }
