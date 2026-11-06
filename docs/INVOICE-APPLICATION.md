# HIR invoice application

HIR — History · Integrity · Responsibility

This application runs as a local Node server and uses the published Sepolia ledger and native ENSv2 resolver. It is not an online hosted service. No relayer is used.

## Run

Use Node.js 24 or later. From the repository root:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run compile
npm run app:start
```

Open http://127.0.0.1:4321. Use the literal loopback address rather than localhost; host and origin checks deliberately restrict access. Set HIR_CUSTOMER_PORT to select another local port. Set HIR_INVOICE_RPC to a trusted Ethereum Sepolia HTTP RPC if the default public endpoint is unavailable. Runtime state defaults to .local/hir-sepolia-website; HIR_CUSTOMER_STATE can select a separate directory strictly inside .local. Never share that directory: it contains private documents, pending operations and business state. Back it up securely and preserve it when restarting. The server never seeds an organization or copies another user's invoices into a new workspace.

The prebuilt stylesheet is included. To rebuild it after source changes, run npm run app:build:ui. Fonts and icons are local assets; their notices are in app/customer/public/fonts/licenses.

## Organization setup

Bring an active ENSv2-compatible .eth identity on the configured Sepolia registry. A name on a different ENS registry or resolver implementation is not sufficient. HIR does not register names. The resolver must support native full-name wildcard resolution, keyed data, record IDs, multicall and the permission model used by this ledger. Network deployments may change; a failed registry, runtime or permission check must be investigated rather than bypassed.

Load the organization and connect a wallet with its actual resolver configuration and writer-grant permissions. HIR requests a short personal-sign message to prove private workspace access. This message changes no blockchain state. An existing valid invoice policy and ledger writer grant are reused without a setup transaction.

For first configuration, choose a separate ordinary invoice-signing wallet, a supported test payment token, and an approved receiving wallet. The billing signer must not control resolver policy, record linking or upgrades. Review the configuration and approve one batched wallet transaction for policy and any missing writer grant. HIR checks actual permissions; ownership alone is not a substitute for them. Editing an already active configuration is not exposed here.

## Issue an invoice

Connect the configured signer, verify wallet access, and open the workspace. Create an invoice, preview the exact final PDF, and review its supplier, amount, network, token and receiving wallet. Downloaded and previewed bytes are frozen; changing those bytes blocks signing and publication.

Check the review box, sign one EIP-712 Invoice statement, and submit one direct wallet transaction. Connection, network-switch and private-access authentication prompts are additional to the one invoice signature and one publication transaction. HIR never signs or pays gas for you. No token payment is made by publication; Sepolia ETH is needed for gas. The application uses conservative testnet gas/fee caps and reports an error if those caps cannot cover publication.

The transaction atomically accepts evidence and creates the invoice-specific ENS pointer. Wait for confirmation. If a wallet response is uncertain, recheck the existing publication or record its known transaction hash. Do not create another submission until the original is reconciled. Only an explicit wallet rejection permits a retry. Pending operations and frozen PDFs survive server restarts; reconnect the original wallet to recover them.

## Recipient verification

Recipients need no wallet or HIR workspace. Open /verify, enter the Supplier ENS Name, copy the Invoice Authenticity Code from the PDF, and upload the received PDF. Independently confirm the supplier ENS identity through a trusted business contact; an invoice or its link must not decide whom you trust.

The code is the full invoice ENS name. Public ENS resolution discovers the ledger pointer; canonical transaction/receipt/log checks, the signature, historical policy and document hash establish the evidence independently of HIR's private records. The PDF link points to the local instance that generated it; recipients can instead enter the supplier and code in their own instance with the same independently trusted deployment configuration.

Results distinguish original supplier authorization, exact PDF integrity, receiving-address approval and current revision. An authentic earlier revision can remain authentic after a correction. Current ownership or pointer changes cannot rewrite accepted historical evidence. Verification relies on available historical RPC data and independently trusted ledger/runtime configuration; unavailable evidence is not a pass. It is not a light-client/finality proof and does not approve a payment or establish uninterrupted ENS ownership.

## Scope and limitations

The website can create and publish first invoices, reuse or create initial organization configuration, and verify current or prior accepted revisions. The ledger supports chained revisions, but correction creation is not exposed in this website. Cancellation, a general configuration editor, email delivery and contract-wallet issuers are not supported. Custody and Agents are outside this application. Private sessions expire and account/network/provider changes revoke browser access; reconnect and sign a fresh access message when needed. Local files are not an encrypted multi-tenant hosted storage service.

## Tests

```sh
npm test
npm run test:browser
```

Tests use disposable local EVM accounts/state or explicit HTTP/browser stubs, not live wallets or Sepolia writes. Browser checks require an installed Playwright Chromium browser; alternatively set HIR_BROWSER_CHANNEL=chrome to use installed Chrome. Browser sandboxing stays enabled. The contract/customer tests exercise actual native ENS bytecodes, exact PDF generation, atomic publication, independent recipient reads and rejection cases. Browser session checks exercise account, network, provider and session changes with isolated signing accounts. They do not claim to be live extension-wallet acceptance tests.
