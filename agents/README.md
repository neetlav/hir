# HIR Agents

Two OpenAI Agents SDK agents exchange signed analysis requests and outcomes under a native ENSv2 policy. The application includes setup, published policy, live interaction and history/evidence screens, plus a separate Cloudflare Worker with SQLite Durable Object storage. After deployment it does not require a running laptop or tunnel.

The fixed action is `hir.analysis`. Basic analysis costs **40 illustrative credits**, extended costs **80**, and authority is capped at **50 per request**. These are service units, not cryptocurrency, payments or an account budget. The dataset is fixed: 12, 18, 9, 24, 15, 21, 10 and 17 minutes.

The requester interprets the task and uses catalogue/submission tools. The receiver independently resolves native ENS authority, explicitly chooses accept/reject, and can invoke deterministic analysis. Its actual decision is recorded separately from compliance. Authentic acceptance outside authority stays signed, flagged and recordable. There is no scripted fallback presented as a live agent decision. Production calls use `gpt-5.4-mini-2026-03-17`, Agents SDK 0.21.0 and OpenAI SDK 7.47.0; tracing and provider storage are disabled. Public messages, tool results and API identifiers are retained, not hidden reasoning.

## Install and validate

Use Node.js 24 or newer. From the repository root:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm --prefix agents ci --ignore-scripts --no-audit --no-fund
npm --prefix agents run compile
npm --prefix agents test
npm --prefix agents run test:worker
npm --prefix agents run build
npm --prefix agents run worker:check
```

Root dependencies serve the existing shared chain verifier; Agents has its own pinned application/build dependencies. Root application sources, manifests and Worker configuration are unchanged. Builds embed the published ENS ABIs and static assets, with no dependency on private deployment files, local state, generated customer evidence or another application's output. Generated `agents/build`, `agents/dist`, dependencies and local persistence are ignored.

Foundation tests exercise native authority, historical checkpoints, signatures, replay/execution claims, deterministic results and violations against an unforked local EVM. `test:worker` uses actual workerd/SQLite, the real Agents SDK and synthetic Responses HTTP replies. No real model API, wallet, Sepolia transaction or Cloudflare deployment is exercised by these tests. Test injection, inspection routes and synthetic wallet code are excluded from the production build entry.

For interactive browser testing, run `node test/browser-server.mjs` **from `agents`** and visit the printed loopback URL. This disposable fixture provides an explicitly named synthetic wallet, isolated chain and mocked model, and rewrites origin/cookies only in its local proxy. It is not a deployment server. Enter `agents-only.eth`, connect the fixture wallet, verify, check permissions and select the existing policy. Stop it with Ctrl+C. Never supply real keys to the fixture.

## Hosted access and persistence

An HttpOnly/Secure/SameSite cookie identifies a browser session; it is not proof of wallet control. A short-lived single-use challenge binds the exact HTTPS origin, wallet, organization and Sepolia chain. Each private operation rechecks current native organization ownership or Agents resolver SET_DATA authority. Context selection belongs to that browser session. Plans, wallet recovery and private evidence are scoped to the authenticated organization and original transaction sender. Account/network/disconnect events clear private UI state. Refresh and direct routes resume only with the matching connected provider/account/network and a valid server session; current roles are still checked.

SQLite separates job/evidence records, metadata and expiring sessions. Signed bundles are immutable. Durable run IDs and execution claims are written before provider calls/computation. HTTP requests await the bounded exchange; there is no detached 202 job or dependence on `waitUntil`. Runs have at most nine model calls, four requester/five receiver turns, 1,200 tokens per call, 30-second model/tool timeouts and a 150-second overall deadline. One exchange is active at a time. Interruption, restart or elapsed deadline leaves retained progress marked indeterminate and prevents automatic replay. An interrupted HTTP response is not a success claim.

Policy publication and evidence anchoring require separate human wallet approval. Exact intents are persisted before dispatch. An ambiguous wallet result requires reconciliation of the existing public hash; it is never automatically resent. Confirmation checks sender, destination, data, nonce, chain, canonical receipt, two confirmations and the actual policy/evidence commitment. An unrelated hash cannot replace the intended transaction.

See [Cloudflare deployment](DEPLOYMENT.md) for the manual Free-plan trial setup and remaining remote checks. Source readiness and local tests do not establish online availability.

## Protocol and independent verification

See [protocol and trust requirements](PROTOCOL.md). The append-only evidence contract authenticates linked requester/receiver signatures and their sealed bundle commitment. It has no payment, ENS administration, policy-cap enforcement, owner, upgrade or delete gate. Initial preparation only returns exact calldata for an unoccupied native name; it does not register domains or overwrite invoice records. Existing matching policies are observed independently without fabricating an original publication transaction.

Choose expected trust independently of a received bundle and use an archive-capable RPC:

```sh
npm --prefix agents run verify -- --trust /path/to/expected-trust.json --bundle /path/to/received-evidence.json --rpc https://your-archive-rpc.example
```

The trust file supplies `chainId`, normalized `org`, `label`, `controller`, `ownershipResource`, `resolver`, `generation`, `requester`, `receiver`, `universal`, `registry`, `codeHashes`, `policyHash`, `recordId`, `evidence` and `runtimeCodeHash`. A downloaded evidence file supplies `bundle`, `sealSignature` and, when anchored, `anchor: {transactionHash, logIndex}`. Keep RPC credentials out of public files and command history. The CLI rebuilds the contract and requires its runtime hash to match the selected trust.

The deliberate `POST /api/public/verify` endpoint accepts a complete provided bundle and independently chosen trust; it does not retrieve private stored jobs by ID. It requires a page session/CSRF token but no organization login. Both verifiers distinguish authenticity, historical authority, receiver choice, recomputable output and onchain anchoring. A receipt alone does not establish compliance. Unavailable historical RPC data is not a pass.

Only normalized second-level ASCII `.eth` organizations, one action/version, two EOA signers and the fixed catalogue are supported. Registration, policy editing/revocation, contract-wallet signatures and payments are outside scope. Signatures authenticate statements and commitments; they do not prove hidden execution/non-execution, complete logging, uninterrupted ownership or light-client finality.

The contract retains its MIT SPDX notice. ENS provenance/licenses remain in `vendor/ens-native`; pinned npm dependencies retain upstream licenses. Font licenses accompany the bundled assets.
