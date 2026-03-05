# FAQ

## How is the burn requirement enforced?

The 10,000 sat burn is **not** embedded inside the OP_RETURN. It is a separate, regular transaction output in the same transaction that sends 10,000 sats to the burn address.

A valid Create transaction has at minimum two outputs:

1. The OP_RETURN containing the BCNS JSON payload (`{ op: "C", name, addr, v }`)
2. A payment output sending at least 10,000 sats to the burn address

Every compliant indexer independently verifies the burn by scanning the transaction's outputs for payments to the burn address (`findBurnOutput` in `src/parser.js`). If the total sent to the burn address is less than 10,000 sats, the Create is rejected and the name is not registered.

This follows the same trust model as SLP tokens: there is no miner-level enforcement. Protocol rules are enforced by indexers validating on-chain data. A name registered without a proper burn would only be recognized by a modified, non-compliant indexer — every standard indexer would ignore it.

The burn is fully verifiable on-chain since transaction outputs are permanent blockchain data that anyone can inspect.

## Do I need to trust someone else's indexer?

No. You can run your own indexer and derive the full namespace state directly from the blockchain.

The indexer deterministically replays all BCNS transactions from `START_BLOCK` and applies the protocol rules. Given the same blockchain data, every compliant indexer arrives at the same result.

This means you don't need to trust any third-party API or service — just point the indexer at your own BCH full node and verify everything yourself.

## Can someone change the burn address and receive the burn payments?

The burn address is a **protocol constant** hardcoded in `src/parser.js`, not something stored on-chain. The OP_RETURN payload only contains `{ op, name, addr, v }` where `addr` is the resolution address (where the name points), not the burn address. The validation logic (`findBurnOutput`) checks transaction outputs specifically for payments to the hardcoded `BURN_ADDRESS` and sums them — both the destination address and the minimum amount must match.

If someone modifies `BURN_ADDRESS` in their local copy of `parser.js`, their fork would work internally: the CLI tool (which imports the constant to build the burn output) would send sats to the new address, and their modified indexer (which validates against the same constant) would accept it. However, **no standard indexer would recognize names registered through a modified burn address**, because every compliant indexer checks against the original protocol address.

Crucially, they **cannot redirect burns from other users**. When someone registers a name using the standard tools, the sats are sent to the real burn address in an on-chain transaction that is already confirmed and immutable.

This is the same trust model as all indexer-based protocols: the protocol is defined by the source code the community agrees to run. Forking the code means forking the namespace — you get your own incompatible registry that no one else recognizes.

## Are the burned sats truly destroyed?

Yes. The burn address is `bitcoincash:qqqqqqqqqqqqqqqqqqqqqqqqqqqqqu08dsyxz98whc` — a **provably unspendable** address. The `qqqqqqqqqqqqqqqqqqqqqqqqqqqqqq` portion encodes a 160-bit hash of all zeros (`0x0000000000000000000000000000000000000000`).

To spend from any BCH address you need a private key whose public key hashes (SHA-256 then RIPEMD-160) to that address's hash. Finding an input that produces an all-zero hash requires brute-forcing ~2^160 possibilities — a number so large it is computationally impossible. No one owns this address and no one can ever gain access to it.

This means every sat sent to the burn address is **permanently removed from circulation**. The burn is not a payment to a trusted party — it is provable destruction, verifiable by anyone inspecting the address.

## Can someone register a name that's already taken?

No. The indexer enforces a strict first-come-first-served rule. When a Create transaction is processed, the indexer checks whether the name is already active. If it is, the transaction is silently ignored — the name stays with its original owner.

The ordering is deterministic: blocks are processed sequentially, and transactions within the same block are processed by their position. If two people try to register the same name in the same block, the transaction that appears first wins.

After a name is deleted, there is a 100-block cooldown before anyone (including the previous owner) can re-register it. This prevents rapid delete-and-squat attacks.

Note that the blockchain itself does not prevent duplicate registration transactions — they will be mined like any other valid transaction. The indexer is what enforces uniqueness by ignoring duplicates. This follows the same trust model as SLP tokens: protocol rules are enforced by indexers, not miners. You can verify everything by running your own indexer.

Only the name's owner (proven cryptographically via transaction signature) can update, delete, or transfer it. No one else can modify or take over an active name.
