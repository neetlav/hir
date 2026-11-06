# Deploy the invoice Worker

This is a manual deployment guide for the reviewed repository. No Cloudflare account connection, upload or public deployment is performed by the local tests.

## Account and billing

Use a Cloudflare Workers application, not Pages. This renderer performs substantial PDF/font work, so use Workers Paid; Free's 10 ms CPU allowance is not an appropriate target. Local workerd timings are wall time, not production CPU measurements. Confirm production CPU/memory in a smoke test after deployment. Paid starts at a $5 monthly subscription plus applicable usage; SQLite Durable Object requests/storage also have usage limits and charges. [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Durable Object pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/).

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

## Manual checks after deployment

Open the actual workers.dev URL; confirm fonts/screens and wallet-free recipient entry. Connect your own wallet, verify private access, load a configured organization and create/download a PDF. Reopen after a refresh and re-upload that exact PDF; verify tampering is rejected. Then sign/publish a test invoice with one message and one direct Sepolia transaction. Verify its original and changed PDFs in a separate recipient session. Check confirmation/recovery after redeploy and inspect Cloudflare CPU/memory metrics. These remote and real-extension-wallet checks remain pending until you connect and deploy the reviewed PR.
