// Usage: WIF=L1... node src/delete-name.js myname.bch

const { initWallet, validateName, cliEntry } = require('./wallet-helper')
const { LOKAD_PREFIX } = require('./parser')

async function deleteName (name, wif) {
  const fullName = validateName(name)

  const wallet = await initWallet(wif)
  const payload = JSON.stringify({ op: 'D', name: fullName, v: 1 })

  const txid = await wallet.sendOpReturn(payload, LOKAD_PREFIX, [])
  console.log(`Name "${fullName}" deleted! TXID: ${txid}`)
  return txid
}

cliEntry(module, 'WIF=<private-key> node src/delete-name.js <name.bch>', 1,
  ([name], wif) => deleteName(name, wif)
)

module.exports = { deleteName }
