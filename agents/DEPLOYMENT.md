# Manual Cloudflare Free-plan trial

This is a separate Worker named **hir-agents**, intended for `https://hir-agents.neetlav.workers.dev`. It does not share invoice/homepage Worker bindings. Local validation is not a remote deployment. Account connection, billing choices, secret entry, live model calls and wallet approvals remain manual.

## Build and Git integration

After review and merge, connect `neetlav/hir` to **hir-agents** in Cloudflare Workers Builds:

| Setting | Value |
| --- | --- |
| Root directory | `agents` |
| Production branch | `main` |
| Node version | 24 or newer (`NODE_VERSION=24`) |
| Build command | `npm --prefix .. ci --ignore-scripts --no-audit --no-fund && npm ci --ignore-scripts --no-audit --no-fund && npm run build` |
| Deploy command | `npm run deploy` |
| Non-production builds/deployments | Disabled; do not deploy PR branches |
| Watch paths | `agents/**`, `vendor/ens-native/**`, `scripts/shared/chain-evidence.mjs`, root `package.json` and `package-lock.json` |

The Agents Wrangler config pins the compatibility date and `nodejs_compat`, serves static assets, binds `AGENTS_STATE` to SQLite class `AgentsState` and applies the `v1` migration. Preview URLs are disabled. It contains no Paid-only CPU setting or account credentials. Preserve the namespace/migration on later deployments; replacing it loses the application's link to existing storage. Do not connect this config to `hir-invoice`.

For manual CLI deployment, install both package trees, then from `agents` run `npm run build`, `npm run worker:check` and, only when ready to deploy, `npm run deploy`. A dry run is not remote CPU validation.

## Bindings

Enter secrets only through Cloudflare's secret UI or interactive `wrangler secret put NAME` from `agents`. Do not put values in Git, build variables, source, chat, logs, command arguments or browser assets.

| Binding | Kind | Purpose |
| --- | --- | --- |
| `HIR_AGENTS_ORIGIN` | Plain variable | Exact HTTPS origin, configured as `https://hir-agents.neetlav.workers.dev` |
| `OPENAI_API_KEY` | Secret | Dedicated model key with access to the pinned model |
| `HIR_AGENTS_REQUESTER_KEY` | Secret | Dedicated requester EOA private key |
| `HIR_AGENTS_RECEIVER_KEY` | Secret | Distinct dedicated receiver EOA private key |
| `HIR_AGENTS_REQUESTER_RPC` | Optional secret | Requester's own Sepolia RPC URL |
| `HIR_AGENTS_REQUESTER_FALLBACK_RPC` | Optional secret | Secondary endpoint for the requester's missing-block authority reads, with the same chain/checkpoint checks |
| `HIR_AGENTS_RECEIVER_RPC` | Optional secret | Receiver/verifier Sepolia RPC URL with historical state access |
| `HIR_AGENTS_RECEIVER_FALLBACK_RPC` | Optional secret | Secondary endpoint for missing-block authority reads; must agree on chain and the exact selected block hash |

Without custom RPC bindings, clients independently use the public Sepolia endpoint. Authority checks fail closed on errors. Model/signing secrets are never stored in SQLite or returned to browsers. No default organization, selected identity or prior evidence is bundled.

For the default PublicNode endpoints, a missing pinned block can be checked through `https://sepolia.gateway.tenderly.co`. Recovery is limited to reads at the same already-observed block number and hash, with chain verification and canonical-hash checks. It does not substitute an older checkpoint, bypass a contract revert, retry a quota error or send transactions. Custom URLs keep their existing routing unless an explicit fallback binding is supplied for that client. No authority result is cached across requests.

The derived signing addresses **must match the chosen existing native policy**. Secure manual entry of the existing dedicated keys is a deployment prerequisite. Windows account-encrypted local credentials are not portable Worker bindings; this project does not decrypt/export/copy them. If those keys are unavailable through your secure custody process, stop the existing-policy deployment. Do not silently generate replacements or republish an occupied policy. A new pair requires a separately authorized fresh agent label/policy.

`config/sepolia.json` contains public ENS/evidence anchors. The evidence contract is `0x42c1625af677a89cdd85ea358fde74b0c283ef33`, expected runtime hash `0xe122a21e1f543a7c055b6e010628365a327e3e21f46f24e07f10c3e979d0e10d`. Builds do not redeploy it. Setup independently checks current chain state, exact signers/policy, resolver binding and code before reuse. Existing records are not migrated or preloaded into cloud storage.

## Free-plan constraints and go-live checks

Start with Free. Cloudflare documents 10 ms CPU for regular Free Workers and a separate 30-second default CPU allowance for Durable Objects; network waiting is not CPU time. Model execution is awaited while the HTTP caller remains connected. The 30-second `waitUntil` grace is not used to keep a 150-second exchange alive. SQLite Durable Objects are available on Free; platform request, CPU, memory and storage quotas still apply. Consult current [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [Durable Object limits](https://developers.cloudflare.com/durable-objects/platform/limits/) and [Durable Object pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/).

Before calling the service live, manually check the deployed origin and actual bundle startup/CPU/memory on Free, secret-to-policy signer match, and archive RPC access. Use a real wallet to sign in and select an explicitly entered organization; test refresh/direct history navigation, account/network changes, unrelated wallets and delegate revocation. Run one real basic and one exact extended request, inspect actual choices/tool results, and approve evidence transactions yourself. Check canonical confirmation and independent verification. Interrupt one request and recover existing progress without replay. Confirm isolation between sessions/organizations.

New runs additionally require the [registered Agents hierarchy](REGISTRATION.md). Reuse the separately confirmed shared organization registry; Agents must not change its pointer during setup. Complete the explicit administrator-approved namespace/requester registrations on the public app and confirm both names in the official Sepolia ENS Explorer before the live model/evidence gate. No additional secret binding or replacement evidence-contract deployment is needed for this registration adapter.

If Free CPU, quotas or model latency fail, retain the failure/indeterminate state and inspect platform metrics. Do not treat local wall time as remote CPU evidence, silently enable billing, or switch to detached execution. Deployment, remote measurements, real model behavior and wallet confirmations remain pending until those checks are completed.
