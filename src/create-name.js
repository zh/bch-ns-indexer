// Usage: WIF=L1... node src/create-name.js myname.bch bitcoincash:qdestination...

const SlpWallet = require('minimal-slp-wallet').default
const config = require('./config')
const { BURN_ADDRESS, BURN_AMOUNT_SATS, NAME_REGEX, LOKAD_PREFIX } = require('./parser')

async function createName (name, addr, wif) {
  // 1. Validate inputs
  const fullName = name.endsWith('.bch') ? name : name + '.bch'
  if (!NAME_REGEX.test(fullName)) {
    throw new Error(`Invalid name format: ${fullName} (must match ${NAME_REGEX})`)
  }
  if (!addr) throw new Error('Destination address (addr) is required')
  if (!wif) throw new Error('WIF private key is required (set WIF env var)')

  // 2. Init wallet from WIF
  const wallet = new SlpWallet(wif, {
    interface: config.walletInterface,
    restURL: config.walletRestUrl
  })
  await wallet.walletInfoPromise
  await wallet.getUtxos()

  // 3. Build the JSON payload
  const payload = JSON.stringify({ op: 'C', name: fullName, addr, v: 1 })

  // 4. Burn output: send BURN_AMOUNT_SATS to the burn address
  const bchOutput = [{ address: BURN_ADDRESS, amountSat: BURN_AMOUNT_SATS }]

  // 5. Broadcast
  const txid = await wallet.sendOpReturn(payload, LOKAD_PREFIX, bchOutput)
  console.log(`Name "${fullName}" registered! TXID: ${txid}`)
  return txid
}

// CLI entry point
if (require.main === module) {
  const [name, addr] = process.argv.slice(2)
  if (!name || !addr) {
    console.error('Usage: WIF=<private-key> node src/create-name.js <name.bch> <bitcoincash:q...>')
    process.exit(1)
  }
  createName(name, addr, process.env.WIF).catch(err => {
    console.error('Failed:', err.message || err)
    process.exit(1)
  })
}

module.exports = { createName }
