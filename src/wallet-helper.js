const SlpWallet = require('minimal-slp-wallet').default
const config = require('./config')
const { NAME_REGEX } = require('./parser')

/**
 * Initialize a wallet from a WIF key, ready for sending transactions.
 */
async function initWallet (wif) {
  if (!wif) throw new Error('WIF private key is required (set WIF env var)')
  const wallet = new SlpWallet(wif, {
    interface: config.walletInterface,
    restURL: config.walletRestUrl
  })
  await wallet.walletInfoPromise
  await wallet.getUtxos()
  return wallet
}

/**
 * Normalize and validate a BCNS name. Returns the full name with .bch suffix.
 */
function validateName (name) {
  const fullName = name.endsWith('.bch') ? name : name + '.bch'
  if (!NAME_REGEX.test(fullName)) {
    throw new Error(`Invalid name format: ${fullName} (must match ${NAME_REGEX})`)
  }
  return fullName
}

/**
 * CLI entry point helper. Parses args, validates count, runs handler.
 * @param {object} callerModule - Pass `module` from the calling script
 * @param {string} usage - Usage string shown on error
 * @param {number} requiredArgs - Number of required positional args
 * @param {function} handler - async (args, wif) => void
 */
function cliEntry (callerModule, usage, requiredArgs, handler) {
  if (require.main !== callerModule) return
  const args = process.argv.slice(2)
  if (args.length < requiredArgs) {
    console.error(`Usage: ${usage}`)
    process.exit(1)
  }
  handler(args, process.env.WIF).catch(err => {
    console.error('Failed:', err.message || err)
    process.exit(1)
  })
}

module.exports = { initWallet, validateName, cliEntry }
