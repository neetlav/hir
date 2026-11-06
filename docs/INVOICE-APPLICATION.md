# HIR invoice application

HIR — History · Integrity · Responsibility

The invoice application has a Cloudflare Workers deployment target: website assets, API and persistent metadata run online from a workers.dev URL. No running laptop, tunnel, external Node host, R2 bucket or custom domain is required. Deployment is a separate manual step; repository validation is not a claim that a public instance is live. Follow [Cloudflare setup](CLOUDFLARE-WORKERS.md).

## Configure an organization

Bring an active ENSv2-compatible .eth identity on the configured Sepolia registry. HIR does not register names. A name on a different registry/resolver implementation is not sufficient. The resolver must support the native full-name data/permission methods used by the validated ledger.

Load the identity and connect a wallet with its actual resolver configuration/writer-grant permissions. A short personal-sign message proves private workspace access; it changes no blockchain state. Organization selection is browser-session-specific. Existing policy and writer permission are reused without a setup transaction.

For initial setup, choose a separate ordinary invoice signer, supported test payment token and approved receiving wallet. The billing signer must not control resolver policy, record linking or upgrades. Review and approve one batched setup transaction for the missing policy/writer configuration. Editing active configuration is not exposed.

## Issue and retain an invoice

Connect the configured signer and verify workspace access. Create the invoice, preview its exact final PDF and download it. Keep this original file: the Worker does not store PDFs or provide later server downloads. Only invoice metadata, document fingerprints, protected statements, signatures and publication/recovery state are persisted.

Review the final supplier, amount, token/network and receiving wallet. Sign one EIP-712 Invoice statement, then submit one direct wallet transaction. Connection, network-switch and private-access authentication prompts are additional. Publication uses Sepolia ETH for gas; it does not transfer the invoiced token. The ledger atomically accepts the evidence and creates the invoice-specific ENS pointer.

After a refresh or a direct workspace visit, an unexpired server-verified session can resume without signing again when the previously selected wallet still exposes the same account on Sepolia. Ambiguous, unavailable, changed or expired wallet access requires explicit reconnection/verification. The selected provider is a preference, not authorization; the server continues checking organization and action permissions. Configured organizations return to their existing workspace without another ENS setup transaction.

Reopen the saved draft and upload that exact downloaded PDF. Hash checks must match before signing or publication. HIR never regenerates a replacement and pretends its bytes are identical. If the original is lost, do not proceed with that draft. An unsubmitted draft may be left intact while you prepare and review a new invoice; uncertain/submitted transactions must first be reconciled.

Pending transaction intent and known hashes survive Worker recreation/redeployment. Confirmation is checked in bounded requests; no background process or relayer is required. Recheck the existing transaction or record its known hash when a wallet response is uncertain. Only explicit wallet rejection permits a new submission attempt.

## Verify a received invoice

Recipients need no wallet or private workspace. Enter Supplier ENS Name, copy Invoice Authenticity Code from the PDF, and upload the received PDF. Independently confirm that the supplier ENS identity belongs to the business you expect. An invoice/link must not decide whom you trust.

Public ENS resolution discovers the shared-ledger pointer. Canonical transaction/receipt/log checks, historical authorization, receiving policy and exact document hash establish evidence independently of HIR workspace data. Uploaded recipient PDFs are transient and never persisted. Results distinguish original supplier authorization, PDF integrity, receiving-address approval and current revision. HTTPS links/QR codes use the explicitly configured public origin.

Current pointer or ownership changes cannot rewrite accepted historical evidence. The verifier requires independently trusted chain/ledger/runtime configuration and available historical RPC data. Missing evidence is not a pass. These are RPC observations, not a light-client/finality proof or payment approval.

## Current limits

No correction-creation UI, cancellation, general configuration editor, contract-wallet issuers, email delivery, custody or Agents. Existing ledger revision history remains verifiable. A single SQLite Durable Object coordinates this initial application; this is not a high-throughput multi-region invoice backend. Private metadata is Cloudflare account data and must be protected accordingly. PDFs remain with their issuer/recipient.

The preserved Node reference server (`npm run app:start`) and its local state are not used by the deployed Worker. Local files are never imported or migrated into cloud state automatically.

Recipient verification permits at most one additional RPC read for a transient connection, timeout, rate-limit or temporarily missing block/transaction response. The retry uses the same method and arguments; it never submits a transaction or skips an evidence check. Persistent failures remain unknown and include a safe operation/error category in the verification details. Contract reverts, evidence mismatches and altered PDFs are not retried into a pass.
