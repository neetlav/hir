# Deploy the invoice Worker

This is a manual deployment guide for the reviewed repository. No Cloudflare account connection, upload or public deployment is performed by the local tests.

## Start with a Free-plan trial

Use a Cloudflare Workers application, not Pages. You can attempt this deployment on Workers Free without first subscribing to Paid: SQLite-backed Durable Objects are supported on Free. The configuration deliberately leaves out limits.cpu_ms; setting that value does not grant a larger plan allowance. A successful local build or workerd test does not prove that the production Free deployment will pass. [Free SQLite availability and quotas](https://developers.cloudflare.com/durable-objects/platform/pricing/).

The runtime boundaries matter. worker/index.mjs handles origin checks, assets and forwarding. InvoiceState in worker/state.mjs invokes the invoice service, renderer, wallet authentication and verifier inside the Durable Object. Regular Worker Free HTTP requests have a documented 10 ms active-CPU limit; the Durable Object limits page separately lists a 30-second default per DO invocation. Do not apply the regular Worker number to the entire PDF request or treat elapsed request time as CPU time. Actual enforcement, startup and resource usage must be checked on the deployed Free account. [Worker limits](https://developers.cloudflare.com/workers/platform/limits/), [Durable Object CPU limits](https://developers.cloudflare.com/durable-objects/platform/limits/).

Current published Free quotas include 100,000 regular Worker requests/day. SQLite Durable Object quotas include 100,000 requests/day, 13,000 GB-seconds/day, 5 million rows read/day, 100,000 rows written/day and 5 GB account storage. These are shared account quotas; repeated polling and session writes also consume them. Both runtime isolates have a 128 MB memory limit. Check Cloudflare's current limits when deploying; quota exhaustion can fail operations even if individual requests are fast. [Worker limits](https://developers.cloudflare.com/workers/platform/limits/), [Durable Object quotas](https://developers.cloudflare.com/durable-objects/platform/pricing/).

Trial the existing renderer first. It embeds Inter fonts, uses a vector QR code and has no raster artwork. The local sample invoice is about 26 KB; small output does not establish low CPU cost. The renderer, glyph checks and signed fingerprints are unchanged for this trial. Existing downloaded originals must still be re-uploaded exactly; no old draft or issued PDF is regenerated. If the real Free trial fails, identify the specific failing boundary before making a measured simplification.

## Git integration settings

After review and merge, connect GitHub to Cloudflare Workers Builds and select the repository:

| Setting | Exact value |
| --- | --- |
| Repository | neetlav/hir |
| Worker name | hir-invoice |
| Production branch | main |
| Root directory | / (repository root) |
| Install command | npm ci --ignore-scripts --no-audit --no-fund (included explicitly in Build command below) |
| Build command | npm ci --ignore-scripts --no-audit --no-fund && npm run build |
| Deploy command | npm run deploy |
| Build variable | NODE_VERSION = 24 (Text) |
| Non-production/preview builds | Disable |

Workers Builds may automatically install dependencies before the build command; the explicit npm ci ensures the lockfile/installation policy is still applied. The repository pins Wrangler and its local runtime test dependencies. Build and deploy are separate commands; no private key or invoice wallet is needed. Use Cloudflare's normal Git connection/Builds authorization rather than putting an account-wide token in the repository. [Build configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/), [build image and Node version](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/).

## Runtime variables

Set these under the Worker's Settings → Variables & Secrets, not only Build variables:

| Name | Type | Value |
| --- | --- | --- |
| HIR_PUBLIC_ORIGIN | Text, required | https://hir-invoice.YOUR-ACTUAL-SUBDOMAIN.workers.dev |
| HIR_INVOICE_RPC | Text, optional | https://ethereum-sepolia-rpc.publicnode.com (default) |

Replace YOUR-ACTUAL-SUBDOMAIN with the account's workers.dev subdomain shown by Cloudflare. Do not invent a URL, include a trailing slash/path, or point this at localhost. Origin checks accept only this exact hir-invoice workers.dev host. Requests with another origin, including forwarded-header attempts, fail. The same configured HTTPS origin drives cookies, wallet challenges and PDF links/QR codes. The application returns a configuration error until this value is set. If the URL is first learned during deployment, set it afterward and redeploy/save the runtime configuration.

The public RPC needs no credential. If you choose a credentialed provider URL, store HIR_INVOICE_RPC as a Secret instead; never commit it. No OpenAI/Agents, signing keys or R2 variables are used. `keep_vars: true` preserves dashboard-managed text variables on subsequent Wrangler deploys. Changing public origin invalidates previously stored access sessions; invoice evidence remains intact. [Dashboard variable preservation](https://developers.cloudflare.com/workers/wrangler/configuration/#source-of-truth).

## Provisioned resources

`wrangler.jsonc` uses compatibility date 2026-11-06 (Node compatibility is enabled by this date), static assets in dist/assets through ASSETS, and the INVOICE_STATE binding to the exported InvoiceState class. The v1 migration declares new_sqlite_classes and provisions its SQLite namespace on deployment. There is no separate D1 database, KV namespace, R2 bucket or manual data seed. Keep the Worker/class/binding identity and migration history stable across deploys; do not delete/recreate them to update code. No existing local runtime/customer files are uploaded. [Node compatibility](https://developers.cloudflare.com/workers/runtime-apis/nodejs/), [SQLite storage](https://developers.cloudflare.com/durable-objects/best-practices/access-durable-objects-storage/), [migration configuration](https://developers.cloudflare.com/workers/wrangler/configuration/#migrations).

PDFKit evaluates a color-profile metadata URL at module load. Wrangler defines a stable virtual bundle URL for this otherwise unused filesystem path; the invoice renderer supplies embedded font bytes and does not request filesystem fonts or PDF/A color-profile reads. Layout, PDFKit/font versions and invoice cryptographic protocol are retained. There is no persistent PDF storage binding. Metadata writes use synchronous SQLite transactions; session challenges, authentication and pending operations are persisted rather than relying on detached promises or process lifetime.

Preview URLs are disabled in the repository. Also disable non-production/preview builds in the dashboard; do not point unreviewed branch versions at production state. No custom domain is needed.

## Reproduce validation without deploying

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run compile
npm run build
npm run worker:check
npm test
npm run test:worker
# Optional installed Chrome for the existing browser checks:
HIR_BROWSER_CHANNEL=chrome npm run test:browser
# Include the full Worker UI download/re-upload/publication journey:
HIR_TEST_WORKER_BROWSER=1 HIR_BROWSER_CHANNEL=chrome npm run test:worker
```

`worker:check` is a dry-run. Worker tests bundle a separate test-only harness and use workerd/Miniflare, temporary SQLite state and disposable simulated-chain keys. Its storage-inspection endpoint and platform override are absent from the production entry point. These tests do not deploy, open real wallet prompts or submit Sepolia transactions. The browser checks require installed Chrome or Playwright Chromium and retain sandboxing.

## Manual Free-plan acceptance test

1. After review and merge, connect Workers Builds on your Free account using the exact settings above. Keep the Worker name, SQLite migration and binding unchanged. Set the actual HIR_PUBLIC_ORIGIN runtime value. Do not add a cpu_ms override or upgrade billing merely to attempt the trial. No laptop server or tunnel is part of this test.
2. Open the real HTTPS workers.dev URL. Confirm the homepage, fonts and recipient form load. Connect your own wallet, sign the private-access challenge and load an already configured organization. Reuse should require no setup transaction.
3. Create a short test invoice, preview it and download its original PDF. Check readable supplier identity, amount, receiving wallet, asset/network and authenticity code. Record file size and elapsed request time separately from Cloudflare CPU measurements.
4. Refresh, reconnect and reopen the saved draft. Confirm it requires the downloaded original; re-upload it successfully. A modified copy must be rejected. This stage needs no new blockchain transaction.
5. In a separate recipient session with no wallet connection, verify a previously published invoice using its actual original PDF, expected supplier and authenticity code. Its changed copy must fail integrity. An unpublished new draft is not valid evidence for this check. If desired after the resource trial succeeds, publish the new draft with one EIP-712 signature and one direct Sepolia transaction and repeat verification.
6. Redeploy the same Worker and confirm metadata/pending-operation recovery remains intact. Retain originals yourself: the Worker stores no PDFs and uses no R2.

In Workers & Pages → hir-invoice → Metrics, inspect request failures, CPU time, wall time, memory and invocation outcomes around each step. Error 1102 / Exceeded Resources requires investigation; also check quota errors and startup failures. A successful HTTP response alone is not a resource measurement. [Worker metrics](https://developers.cloudflare.com/workers/observability/metrics-and-analytics/).

Separately open Durable Objects → the InvoiceState namespace → Metrics for its usage and available request/storage/memory information. Inspect DO errors/request traces and CPU data where exposed; if CPU data is absent, mark it unavailable rather than substituting wall time or GB-seconds. Record only operation, timestamp, outcome and resource readings when sharing diagnostics, never PDF contents, cookies or wallet proofs. [Durable Object metrics](https://developers.cloudflare.com/durable-objects/observability/metrics-and-analytics/).

The remote Free-tier, real-extension-wallet and redeploy checks remain pending until you connect and deploy. If they fail, preserve original files and pending transaction state, capture the exact failing operation/resource error, and make the smallest targeted change. Do not weaken authorization or receipt validation, silently replace signed PDFs, or assume that a smaller PDF file fixes CPU limits.
