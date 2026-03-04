// Usage: WIF=L1... node src/transfer-name.js myname.bch bitcoincash:qnewowner...

const SlpWallet = require('minimal-slp-wallet').default
const config = require('./config')
const { NAME_REGEX, LOKAD_PREFIX } = require('./parser')

async function transferName (name, to, wif) {
  // 1. Validate inputs
  const fullName = name.endsWith('.bch') ? name : name + '.bch'
  if (!NAME_REGEX.test(fullName)) {
    throw new Error(`Invalid name format: ${fullName} (must match ${NAME_REGEX})`)
  }
  if (!to) throw new Error('New owner address (to) is required')
  if (!wif) throw new Error('WIF private key is required (set WIF env var)')

  // 2. Init wallet from WIF (must be current owner)
  const wallet = new SlpWallet(wif, {
    interface: config.bchInterface,
    restURL: config.bchRestUrl
  })
  await wallet.walletInfoPromise
  await wallet.getUtxos()

  // 3. Build the JSON payload
  const payload = JSON.stringify({ op: 'T', name: fullName, to, v: 1 })

  // 4. No burn output for Transfer
  const bchOutput = []

  // 5. Broadcast
  const txid = await wallet.sendOpReturn(payload, LOKAD_PREFIX, bchOutput)
  console.log(`Name "${fullName}" transferred to ${to}! TXID: ${txid}`)
  return txid
}

// CLI entry point
if (require.main === module) {
  const [name, to] = process.argv.slice(2)
  if (!name || !to) {
    console.error('Usage: WIF=<private-key> node src/transfer-name.js <name.bch> <bitcoincash:q...>')
    process.exit(1)
  }
  transferName(name, to, process.env.WIF).catch(err => {
    console.error('Failed:', err.message || err)
    process.exit(1)
  })
}

module.exports = { transferName }
