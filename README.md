# HIR — History · Integrity · Responsibility

An ENSv2-powered evidence layer for verifiable records, actions, and authority.

## Invoice evidence contracts and verification

This snapshot contains the active shared invoice Evidence Ledger, structured-signature protocol, native ENS discovery, historical evidence verification, compiler entry point and isolated security tests. It publishes pre-existing local development for review. The invoice customer application is included; Agents are not part of this repository snapshot.

An organization configures an existing ENSv2 resolver to authorize an issuer and the approved receiving address, payment asset and network. An invoice statement binds the exact final document hash, protected details, namespace, policy, revision, predecessor and expiry. One issuer signature and one direct publication transaction accept the evidence and create its ENS discovery record atomically. There is no per-invoice ENS token, resolver deployment or relayer requirement.

## Install and validate

Use Node.js 24 or later:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run compile
npm test
```

Compilation uses pinned solc and local OpenZeppelin imports. It prints a compilation summary without deploying a contract. Tests use an unforked Hardhat EVM (chain ID 31337), ephemeral accounts and pinned official ENS bytecodes. They require no wallet, credentials, Sepolia funds or external RPC. The installation requires access to the npm registry.

The test fixture is limited to the active ledger. It does not depend on an earlier invoice application or ledger. Its document bytes are opaque fingerprint fixtures: these tests check byte integrity, not PDF rendering or business content.

## Independent verification API

- scripts/invoice-record/protocol.mjs encodes policies and statements, derives invoice names and pointers, and creates the EIP-712 domain and digest.
- scripts/invoice-record/discovery.mjs exports discover and verifyHistorical. Supply an independently expected organization, full invoice ENS name, received document bytes, public client, ABIs, expected ledger address and trusted runtime code hash. Historical verification also accepts the acceptance transaction hash and log index.
- scripts/invoice-record/verifier.mjs checks original supplier authorization, received document integrity, current identity/payment policy and revision separately. scripts/shared/chain-evidence.mjs checks canonical receipt/log/transaction/code relationships.

Clients must disable automatic CCIP-Read for this native onchain flow. Discovery uses public ENS and ledger reads rather than a private invoice database. Trust anchors must be selected independently; they must not be accepted blindly from an invoice sender. Evidence availability depends on the selected RPC, including historical reads. These observations are not light-client or finality proofs, and unavailable evidence is never a pass. Verification does not approve a payment or establish uninterrupted ENS ownership.

## Scope and limits

The ledger enforces separate issuer and administration authority, approved receiving details, replay protection, revision links and invoice-name binding. Tests cover failed ENS-write rollback, signature/domain/policy failures, aliasing, authorization, altered document bytes, mismatched suppliers, canonical evidence failures and historical changes.

Chained revisions and historical verification are included. Cancellation is not implemented. The supported organization input is a normalized ASCII .eth identity. Invoice issuers are ordinary code-free accounts. The customer application adds private wallet sessions, exact PDF generation and direct Sepolia publication. A Cloudflare Worker deployment target is included; no public deployment is claimed. Agents are excluded. Native ENS fixture provenance and dependency licenses are in vendor/ens-native/.

## Invoice customer application

Run `npm run app:start` after installing dependencies, then open http://127.0.0.1:4321. See [invoice application instructions](docs/INVOICE-APPLICATION.md) for one-time ENS setup, exact PDF review, direct wallet publication, recipient verification, recovery and limitations. Public Sepolia trust anchors and ABI provenance are documented in [config](config/README.md). The Node server remains a reference runner. For the fully online deployment target, follow [Cloudflare Workers setup](docs/CLOUDFLARE-WORKERS.md). The Worker stores metadata and pending operations, never PDF files; keep the downloaded original to resume.
