const { expect } = require('chai')
const http = require('http')
const path = require('path')
const fs = require('fs')
const { initDb, upsertName, deleteName, closeDb } = require('../src/db')
const { createApp } = require('../src/server')

const TEST_DB_PATH = path.join(__dirname, 'test-api.sqlite')

function request (server, urlPath) {
  return new Promise((resolve, reject) => {
    const addr = server.address()
    http.get(`http://127.0.0.1:${addr.port}${urlPath}`, (res) => {
      let body = ''
      res.on('data', (chunk) => { body += chunk })
      res.on('end', () => {
        resolve({ status: res.statusCode, body: JSON.parse(body) })
      })
    }).on('error', reject)
  })
}

describe('GET /api/names', () => {
  let server

  beforeEach((done) => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH)
    }
    initDb(TEST_DB_PATH)

    const app = createApp()
    server = app.listen(0, done)
  })

  afterEach((done) => {
    server.close(() => {
      closeDb()
      if (fs.existsSync(TEST_DB_PATH)) {
        fs.unlinkSync(TEST_DB_PATH)
      }
      done()
    })
  })

  it('should return empty list when no names registered', async () => {
    const res = await request(server, '/api/names')
    expect(res.status).to.equal(200)
    expect(res.body).to.deep.equal({ count: 0, names: [] })
  })

  it('should return registered names with correct shape', async () => {
    upsertName('alice.bch', 'bitcoincash:qalice', 'bitcoincash:qoalice', 'tx1', 100, 1)

    const res = await request(server, '/api/names')
    expect(res.status).to.equal(200)
    expect(res.body.count).to.equal(1)
    expect(res.body.names[0]).to.deep.equal({
      name: 'alice.bch',
      address: 'bitcoincash:qalice',
      owner: 'bitcoincash:qoalice',
      txid: 'tx1',
      blockHeight: 100
    })
  })

  it('should exclude deleted names', async () => {
    upsertName('alice.bch', 'bitcoincash:qalice', 'bitcoincash:qoalice', 'tx1', 100, 1)
    upsertName('bob.bch', 'bitcoincash:qbob', 'bitcoincash:qobob', 'tx2', 101, 0)
    deleteName('bob.bch', 102)

    const res = await request(server, '/api/names')
    expect(res.status).to.equal(200)
    expect(res.body.count).to.equal(1)
    expect(res.body.names[0].name).to.equal('alice.bch')
  })
})
