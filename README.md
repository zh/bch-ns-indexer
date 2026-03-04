# BCH Name Service (BCNS) Indexer

On-chain naming system for Bitcoin Cash. Register human-readable `.bch` names that resolve to BCH addresses, indexed from OP_RETURN transactions.

The indexer scans the blockchain for BCNS transactions, maintains a SQLite database of registered names, and serves name resolution via a REST API. CLI tools are included for managing names.

## Protocol

### OP_RETURN Format

```
OP_RETURN <4-byte BCNS prefix> <JSON payload>
```

LOKAD prefix: `42434e53` (ASCII "BCNS")

### Operations

| Op | Action   | Payload fields                          | Burn required |
|----|----------|-----------------------------------------|---------------|
| C  | Create   | `{ op, name, addr, v }`                 | 10,000 sats   |
| U  | Update   | `{ op, name, addr, v }`                 | No            |
| D  | Delete   | `{ op, name, v }`                       | No            |
| T  | Transfer | `{ op, name, to, v }`                   | No            |

- `name` — the `.bch` name being acted on
- `addr` — BCH address the name resolves to
- `to` — new owner address (Transfer only)
- `v` — protocol version (`1`)

### Name Rules

- 3–32 characters including the `.bch` suffix
- Must start and end with a lowercase alphanumeric character
- May contain lowercase letters, digits, and hyphens
- Regex: `/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]\.bch$/`

### Ownership & Constraints

- **Create**: the sender becomes the owner; requires a 10,000 sat burn to `bitcoincash:qqqqqqqqqqqqqqqqqqqqqqqqqqqqqu08dsyxz98whc`
- **Update / Delete / Transfer**: only the current owner can perform these
- **Cooldown**: 100 blocks must pass after deletion before the same name can be re-registered

## Getting Started

### Prerequisites

- Node.js
- Access to a Bitcoin Cash full node or API endpoint (default: [FullStack.cash](https://fullstack.cash))

### Install & Configure

```bash
npm install
cp sample.env .env
```

Edit `.env`:

| Variable        | Default                         | Description                          |
|-----------------|---------------------------------|--------------------------------------|
| `PORT`          | `3100`                          | API server port                      |
| `BCH_INTERFACE` | `consumer-api`                  | FullStack.cash interface type        |
| `BCH_REST_URL`  | `https://free-bch.fullstack.cash` | Blockchain API endpoint            |
| `START_BLOCK`   | `850000`                        | Block height to start scanning from  |
| `DB_PATH`       | `./data/bchns.sqlite`           | SQLite database file path            |

### Run

```bash
npm start
```

The indexer scans from `START_BLOCK`, processes all BCNS transactions, then polls every 30 seconds for new blocks.

## API

### Resolve a name

```
GET /api/name/:name
```

The `:name` parameter accepts names with or without the `.bch` suffix.

**Example:**

```bash
curl http://localhost:3100/api/name/alice.bch
```

```json
{
  "address": "bitcoincash:qp...",
  "owner": "bitcoincash:qz...",
  "txid": "abc123...",
  "blockHeight": 850100
}
```

Returns `404` if the name is not registered or has been deleted.

### List all names

```
GET /api/names
```

Returns all currently registered (active) names.

**Example:**

```bash
curl http://localhost:3100/api/names
```

```json
{
  "count": 1,
  "names": [
    {
      "name": "alice.bch",
      "address": "bitcoincash:qp...",
      "owner": "bitcoincash:qz...",
      "txid": "abc123...",
      "blockHeight": 850100
    }
  ]
}
```

## CLI Tools

Each CLI tool broadcasts a transaction using the private key provided via the `WIF` environment variable.

### Create a name

```bash
WIF=<private-key> node src/create-name.js <name.bch> <bitcoincash:address>
```

Registers a new `.bch` name pointing to the given address. Burns 10,000 sats.

### Update a name

```bash
WIF=<private-key> node src/update-name.js <name.bch> <bitcoincash:new-address>
```

Changes the address a name resolves to. Must be the current owner.

### Delete a name

```bash
WIF=<private-key> node src/delete-name.js <name.bch>
```

Deletes the name. The name enters a 100-block cooldown before it can be re-registered.

### Transfer ownership

```bash
WIF=<private-key> node src/transfer-name.js <name.bch> <bitcoincash:new-owner>
```

Transfers ownership of the name to a new address. The new owner gains control over future updates, deletions, and transfers.

### List registered names

```bash
node src/list-names.js
```

Prints all currently registered names from the local database. No wallet or private key needed.

## FAQ

See [FAQ.md](FAQ.md) for frequently asked questions about the protocol trust model, burn enforcement, and running your own indexer.

## Development

```bash
npm test              # run tests (mocha)
npm run test:coverage # coverage report (nyc)
npm run lint          # lint and auto-fix (standard)
```

## Donate / Test

Want to verify your wallet supports BCH Name Service? Try sending 10,000 sats (0.0001 BCH) to:

```
stoyan.bch
```

This should resolve to `bitcoincash:qpp0f8t557llskht7nhxpjwk33mnptjnfuw6cv3zvs`. If the transaction goes through, your wallet correctly resolves `.bch` names — and you just supported the project!
