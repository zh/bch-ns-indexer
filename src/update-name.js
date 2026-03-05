// Usage: WIF=L1... node src/update-name.js myname.<suffix> bitcoincash:qnewaddr...

const { initWallet, validateName, cliEntry } = require('./wallet-helper')
const { LOKAD_PREFIX, NAME_SUFFIX } = require('./parser')

async function updateName (name, addr, wif) {
  const fullName = validateName(name)
  if (!addr) throw new Error('Destination address (addr) is required')

  const wallet = await initWallet(wif)
  const payload = JSON.stringify({ op: 'U', name: fullName, addr, v: 1 })

  const txid = await wallet.sendOpReturn(payload, LOKAD_PREFIX, [])
  console.log(`Name "${fullName}" updated! TXID: ${txid}`)
  return txid
}

cliEntry(module, `WIF=<private-key> node src/update-name.js <name.${NAME_SUFFIX}> <bitcoincash:q...>`, 2,
  ([name, addr], wif) => updateName(name, addr, wif)
)

module.exports = { updateName }
