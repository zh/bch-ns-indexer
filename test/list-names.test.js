const { expect } = require('chai')
const path = require('path')
const fs = require('fs')
const { initDb, upsertName, closeDb } = require('../src/db')

const TEST_DB_PATH = path.join(__dirname, 'test-list.sqlite')

describe('list-names', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH)
    }
    // Stub config before requiring list-names so it uses our test DB
    delete require.cache[require.resolve('../src/list-names')]
    delete require.cache[require.resolve('../src/config')]
    require.cache[require.resolve('../src/config')] = {
      id: require.resolve('../src/config'),
      filename: require.resolve('../src/config'),
      loaded: true,
      exports: { dbPath: TEST_DB_PATH }
    }
  })

  afterEach(() => {
    closeDb()
    delete require.cache[require.resolve('../src/list-names')]
    delete require.cache[require.resolve('../src/config')]
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH)
    }
  })

  it('should return empty array for empty database', () => {
    initDb(TEST_DB_PATH)
    const { list } = require('../src/list-names')
    const rows = list()
    expect(rows).to.deep.equal([])
  })

  it('should return registered names', () => {
    initDb(TEST_DB_PATH)
    upsertName('alice.bch', 'bitcoincash:qalice', 'bitcoincash:qoalice', 'tx1', 100, 1)
    closeDb()

    const { list } = require('../src/list-names')
    const rows = list()
    expect(rows).to.have.lengthOf(1)
    expect(rows[0].name).to.equal('alice.bch')
    expect(rows[0].address).to.equal('bitcoincash:qalice')
  })
})
