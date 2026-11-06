# HIR public homepage

Standalone static homepage for HIR — History · Integrity · Responsibility. It introduces Invoices and AI Agents with equal prominence. It has no backend, authentication, wallet requests, database or document storage.

The homepage has its own Worker configuration. Building or deploying it does not replace the invoice or Agents applications. It uses the existing pinned root dependencies without changing their manifests.

## Build and check

Run from the repository root with Node.js 24:

```sh
npm ci
node homepage/build.mjs
npx wrangler deploy --config homepage/wrangler.jsonc --dry-run
HIR_BROWSER_CHANNEL=chrome node homepage/check.mjs
```

For PowerShell, set `$env:HIR_BROWSER_CHANNEL='chrome'` before the last command. Browser checks use local workerd static assets and sandboxed Chrome; they do not connect a wallet or visit private module pages. Screenshots are written to ignored `.local/` output. Without the channel variable, Playwright uses its installed Chromium.

## Connect Cloudflare Git after review and merge

Create a **Workers** project connected to GitHub, using these explicit settings. Do not accept the invoice repository's default build/deploy commands.

| Setting | Value |
| --- | --- |
| Repository | `neetlav/hir` |
| Worker name | `hir` |
| Production branch | `main` |
| Root directory | `homepage` |
| Build command | `npm ci --prefix .. && node build.mjs` |
| Deploy command | `npx wrangler deploy --config wrangler.jsonc` |
| Build environment | `NODE_VERSION=24` |
| Static output | `dist` relative to `homepage`, selected by its Wrangler configuration |
| Non-production branch builds / Previews | Disabled for this initial setup |
| Preview URLs | Disabled in the homepage configuration |
| Runtime bindings, variables and secrets | None |

The `hir` Worker on the `neetlav` account is intended to serve **https://hir.neetlav.workers.dev**. The Cloudflare project name must match the configuration's `name`. The `homepage` root directory selects its own configuration and the build command installs the unchanged parent lockfile. Keep automatic preview branch deployments disabled; if enabled later, their command must explicitly select `wrangler.jsonc` from this directory rather than the root invoice configuration.

After connecting, confirm the homepage, locally served fonts and icons, anchors, and outbound links on the actual URL. Invoice links target `https://hir-invoice.neetlav.workers.dev`; Agents links target the intended `https://hir-agents.neetlav.workers.dev`. The Agents endpoint returned HTTP 404 during implementation on 6 November 2026; its deployment remains separate. The homepage does not clear or transfer module cookies. Each module owns its own authentication.

Do not change the invoice `HIR_PUBLIC_ORIGIN`, cookie scope, bindings, migrations, root Worker name or deployment configuration for this homepage. No proxy, routing service or additional infrastructure is needed.

Configuration references: [Workers static assets](https://developers.cloudflare.com/workers/static-assets/), [asset response headers](https://developers.cloudflare.com/workers/static-assets/headers/), [Workers Builds settings](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/).
