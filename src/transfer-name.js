// Usage: WIF=L1... node src/transfer-name.js myname.<suffix> bitcoincash:qnewowner...

const { initWallet, validateName, cliEntry } = require('./wallet-helper')
const { LOKAD_PREFIX, NAME_SUFFIX } = require('./parser')

async function transferName (name, to, wif) {
  const fullName = validateName(name)
  if (!to) throw new Error('New owner address (to) is required')

  const wallet = await initWallet(wif)
  const payload = JSON.stringify({ op: 'T', name: fullName, to, v: 1 })

  const txid = await wallet.sendOpReturn(payload, LOKAD_PREFIX, [])
  console.log(`Name "${fullName}" transferred to ${to}! TXID: ${txid}`)
  return txid
}

cliEntry(module, `WIF=<private-key> node src/transfer-name.js <name.${NAME_SUFFIX}> <bitcoincash:q...>`, 2,
  ([name, to], wif) => transferName(name, to, wif)
)

module.exports = { transferName }
