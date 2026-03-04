// Usage: WIF=L1... node src/delete-name.js myname.bch

const SlpWallet = require('minimal-slp-wallet').default
const config = require('./config')
const { NAME_REGEX, LOKAD_PREFIX } = require('./parser')

async function deleteName (name, wif) {
  // 1. Validate inputs
  const fullName = name.endsWith('.bch') ? name : name + '.bch'
  if (!NAME_REGEX.test(fullName)) {
    throw new Error(`Invalid name format: ${fullName} (must match ${NAME_REGEX})`)
  }
  if (!wif) throw new Error('WIF private key is required (set WIF env var)')

  // 2. Init wallet from WIF (must be current owner)
  const wallet = new SlpWallet(wif, {
    interface: config.bchInterface,
    restURL: config.bchRestUrl
  })
  await wallet.walletInfoPromise
  await wallet.getUtxos()

  // 3. Build the JSON payload (no addr field for Delete)
  const payload = JSON.stringify({ op: 'D', name: fullName, v: 1 })

  // 4. No burn output for Delete
  const bchOutput = []

  // 5. Broadcast
  const txid = await wallet.sendOpReturn(payload, LOKAD_PREFIX, bchOutput)
  console.log(`Name "${fullName}" deleted! TXID: ${txid}`)
  return txid
}

// CLI entry point
if (require.main === module) {
  const [name] = process.argv.slice(2)
  if (!name) {
    console.error('Usage: WIF=<private-key> node src/delete-name.js <name.bch>')
    process.exit(1)
  }
  deleteName(name, process.env.WIF).catch(err => {
    console.error('Failed:', err.message || err)
    process.exit(1)
  })
}

module.exports = { deleteName }
