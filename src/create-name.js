// Usage: WIF=L1... node src/create-name.js myname.bch bitcoincash:qdestination...

const { initWallet, validateName, cliEntry } = require('./wallet-helper')
const { BURN_ADDRESS, BURN_AMOUNT_SATS, LOKAD_PREFIX } = require('./parser')

async function createName (name, addr, wif) {
  const fullName = validateName(name)
  if (!addr) throw new Error('Destination address (addr) is required')

  const wallet = await initWallet(wif)
  const payload = JSON.stringify({ op: 'C', name: fullName, addr, v: 1 })
  const bchOutput = [{ address: BURN_ADDRESS, amountSat: BURN_AMOUNT_SATS }]

  const txid = await wallet.sendOpReturn(payload, LOKAD_PREFIX, bchOutput)
  console.log(`Name "${fullName}" registered! TXID: ${txid}`)
  return txid
}

cliEntry(module, 'WIF=<private-key> node src/create-name.js <name.bch> <bitcoincash:q...>', 2,
  ([name, addr], wif) => createName(name, addr, wif)
)

module.exports = { createName }
