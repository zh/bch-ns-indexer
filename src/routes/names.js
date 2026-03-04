const Router = require('koa-router')
const { getName, listNames } = require('../db')
const { NAME_REGEX } = require('../parser')

const router = new Router()

router.get('/api/names', async (ctx) => {
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
