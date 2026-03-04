const crypto = require('crypto')
const Router = require('koa-router')
const { getName, listNames } = require('../db')
const { NAME_REGEX } = require('../parser')
const config = require('../config')

const router = new Router()

function checkBasicAuth (ctx) {
  const header = ctx.get('Authorization')
  if (!header || !header.startsWith('Basic ')) return false

  const decoded = Buffer.from(header.slice(6), 'base64').toString()
  const sep = decoded.indexOf(':')
  if (sep === -1) return false

  const user = decoded.slice(0, sep)
  const pass = decoded.slice(sep + 1)

  const userBuf = Buffer.from(user)
  const passBuf = Buffer.from(pass)
  const expectedUser = Buffer.from(config.adminUser)
  const expectedPass = Buffer.from(config.adminPass)

  const userMatch = userBuf.length === expectedUser.length &&
    crypto.timingSafeEqual(userBuf, expectedUser)
  const passMatch = passBuf.length === expectedPass.length &&
    crypto.timingSafeEqual(passBuf, expectedPass)

  return userMatch && passMatch
}

router.get('/api/names', async (ctx) => {
  if (config.adminUser && config.adminPass) {
    if (!checkBasicAuth(ctx)) {
      ctx.status = 401
      ctx.set('WWW-Authenticate', 'Basic realm="admin"')
      ctx.body = { error: 'Unauthorized' }
      return
    }
  }

  const rows = listNames()
  ctx.body = {
    count: rows.length,
    names: rows.map(r => ({
      name: r.name,
      address: r.address,
      owner: r.owner,
      txid: r.txid,
      blockHeight: r.block_height
    }))
  }
})

router.get('/api/name/:name', async (ctx) => {
  const name = ctx.params.name.trim().toLowerCase()
  const fullName = name.endsWith('.bch') ? name : name + '.bch'

  if (!NAME_REGEX.test(fullName)) {
    ctx.status = 400
    ctx.body = { error: `Invalid name format: ${fullName}` }
    return
  }

  const row = getName(fullName)

  if (!row || row.status !== 'active') {
    ctx.status = 404
    ctx.body = { error: `Name not found: ${fullName}` }
    return
  }

  ctx.body = {
    address: row.address,
    owner: row.owner,
    txid: row.txid,
    blockHeight: row.block_height
  }
})

module.exports = router
