# HIR Agents authority and evidence foundation

This package provides one native ENSv2 agent policy and an append-only evidence contract for a signed requesting identity and a signed receiving identity. It is a protocol and verification foundation. It does not serve an application, execute an LLM, load API credentials, manage browser sessions, or deploy a Worker or contract.

The fixed action is `hir.analysis`. Basic analysis costs **40 illustrative service credits**, extended analysis costs **80**, and the policy limit is **50 per request**. Credits are neither cryptocurrency nor a payment/budget mechanism. Receiver choice, deterministic policy compliance and the reported execution outcome are separate facts. Authentic acceptance outside authority remains recordable and is flagged by independent verification.

## Install and validate

Use Node.js 24 or newer. From the repository root:

```sh
# Existing shared verifier imports resolve against the repository's published dependencies.
npm ci --ignore-scripts --no-audit --no-fund
# Agents maintains its own pinned compiler/test dependencies and scripts.
npm --prefix agents ci --ignore-scripts --no-audit --no-fund
npm --prefix agents run compile
npm --prefix agents test
```

The root invoice package, commands and Worker configuration are unchanged. The Agents compiler generates `agents/build/HirAgentsEvidence.json`; generated builds are ignored. Compiler inputs use canonical LF line endings for reproducibility across Git checkout settings. There is no dependency on local deployment manifests, preloaded evidence, runtime state, model credentials or another application's build output.

Tests use random ephemeral accounts, disposable directories and an unforked local EVM with the official ENS implementations already pinned in `vendor/ens-native`. They cover native organization/policy bindings and historical checkpoints, delegated publication authority, canonical signatures and tamper/replay rejection, accepted basic analysis, rejected extended analysis, and authentic off-policy acceptance. These deterministic tests are not evidence of actual LLM operation, Sepolia deployment or online availability. No live wallet, paid API or live-chain transaction is needed.

## Interfaces

- `src/protocol.mjs`: canonical policy ABI, fixed prices/parameters, EIP-712 request/decision/outcome/seal types and digests.
- `src/policy.mjs`: `inspectOrganization` reads current ownership and resolver roles; `preparePolicy` returns exact bytes and native resolver transaction calldata for an unoccupied agent name. All chain/service/signer/evidence addresses are explicit. Neither function loads a private key, authenticates a human operator, sends a transaction, or overwrites an existing record. Publication must be explicitly approved outside this package and rechecked against current authority.
- `src/ens.mjs`: direct native Universal Resolver reads and independently pinned historical policy retrieval. No HIR authority endpoint is involved.
- `src/engine.mjs`: signed request authentication, independent assessment and signed receiver evidence. The caller injects two separate signer accounts, the chain client and a storage adapter. Receiver acceptance is an explicit caller decision; computation is the bounded deterministic function in `analysis.mjs`. The injected storage must implement durable append/load/claim semantics for restart safety. Only a disposable test adapter is included; production storage, authentication and operational endpoints are not provided.
- `contracts/HirAgentsEvidence.sol`: authenticates linked EOA signatures and one receiver seal, commits their hashes and emits one event per requester/request ID. It does not enforce ENS authority, catalogue prices or the 50-credit cap, and has no payment, ENS administration, owner, upgrade, erase or overwrite operation.
- `src/verifier.mjs`: verifies signed linkage and sealed bundle bytes, resolves the historical ENS checkpoint independently, recomputes compliance/results and authenticates the canonical event/storage commitment using the repository's shared chain-evidence verifier.

See [protocol and trust requirements](PROTOCOL.md) before preparing or verifying evidence.

## Independent verification

Choose expected trust independently of a received evidence bundle. Use an archive-capable RPC for that chain:

```sh
npm --prefix agents run verify -- --trust /path/to/expected-trust.json --bundle /path/to/received-evidence.json --rpc https://your-archive-rpc.example
```

The trust file supplies `chainId`, normalized `org`, `label`, organization `controller`/`ownershipResource`, `resolver`, `generation`, `requester`, `receiver`, `universal`, `registry`, `codeHashes`, `policyHash`, `evidence` and `runtimeCodeHash`. Pin the native `recordId` after initial publication to detect relinking. The evidence file contains `bundle`, `sealSignature` and, when anchored, `anchor: {transactionHash, logIndex}`. Keep RPC credentials out of public files and shell history.

The command rebuilds the contract locally and requires the build's runtime hash to match the independently selected trust file. It exits successfully only for `verified` historical evidence with an anchor; failure and unavailable historical RPC data are not an authorization pass. A valid receipt alone does not establish policy compliance.

## Limits and next integration boundary

Only normalized second-level ASCII `.eth` organizations, one action, one policy version, two EOA signing identities and the fixed catalogue are supported. Initial preparation rejects an occupied native name. Policy editing/revocation, contract-wallet signatures, registration, payments, LLM execution, UI/access sessions, production persistence and cloud hosting are not included.

Signatures authenticate attributable statements and commitments. They do not prove hidden execution, hidden non-execution, complete logging, uninterrupted ENS ownership or light-client finality. Successful deterministic output can be recomputed; a signed rejection is a receiver statement about non-execution.

Any future operational service must authenticate its caller, enforce current organization/action permissions, isolate selected contexts and protect model/signing credentials. This foundation exposes no unauthenticated operational HTTP service. A hosted adapter must preserve durable replay/execution claims and the independent receiver/compliance distinction. A future Worker integration will need bundled ENS ABIs and platform storage/client adapters; the current filesystem loaders and CLI are Node reference utilities.

The contract retains its MIT SPDX notice. OpenZeppelin is installed as a pinned npm dependency with its upstream license. ENS artifact provenance, checksums and license notices remain in `vendor/ens-native`; they are reused rather than duplicated.
