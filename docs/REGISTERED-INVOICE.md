# Registered invoice names

HIR — History · Integrity · Responsibility

The customer application selects `HirRegisteredInvoiceLedger` and the public anchors in `config/registered-sepolia.json`. The earlier ledger, configuration and validation sources remain as references. The application does not search earlier ledgers or migrate their invoices. A pointer to another deployment returns an unsupported-deployment result, never a claim of tampering or a valid invoice.

## Native ENS hierarchy

The hierarchy is `.eth registry → organization registry → invoices registry → invoice token`. Both reusable subregistries are official factory-created `UserRegistry` proxies, checked against the pinned implementation. They are created once per organization, not per invoice. Parent links must match both directions. Namespace and invoice registrations must be active, owned by the policy’s actual organization controller, use the policy resolver, and have expiry bounded by their parent. The ledger checks these conditions onchain before accepting each publication. A valid issuer signature alone cannot bypass registration.

Official ENS deployment artifacts and role definitions are pinned to upstream revision `07e55a056f5b6a9c90119f501bdd05714e67dddd`; see [ENS deployments](https://docs.ens.domains/learn/deployments/) and vendor provenance. Invoice labels produce real `LabelRegistered` events and should appear in the Sepolia ENS Explorer. Resolver-only data is not described as token registration.

## Permissions and interactions

| Activity | Actor | Transactions | Message signatures |
| --- | --- | ---: | ---: |
| Shared platform deployment | Reviewed deployment operator | 1, once | 0 |
| Fresh organization hierarchy and policy | Organization owner | Up to 7, once; completed steps reused | 0 |
| Reuse a ready organization | Authorized wallet | 0 | 0 |
| New invoice name registration | Invoice signer with namespace registrar role | 1 | 0 |
| Invoice authorization and publication | Invoice signer | 1 | 1 EIP-712 |
| Recipient verification | No wallet | 0 | 0 |

Wallet connection, network selection and a private workspace access signature are additional. The access signature authorizes a session, not an invoice. All transactions require explicit wallet approval; no signing key or relayer is configured. The invoice signer gets only registrar role bit 0 at resource 0 in the invoice registry, no registry administration or upgrade role. Registered names belong to the organization owner. Resolver configuration, link and upgrade permissions remain separate. The application refuses an incompatible existing namespace rather than overwriting it.

The exact seven setup purposes and transaction targets are presented before wallet requests. An existing policy pointing at the earlier ledger requires an explicit owner-approved configuration change. This changes the selected policy; it does not overwrite old invoice records. Other pre-existing records and registrations are preserved.

## Acceptance and historical evidence

Publication binds the normalized invoice name, organization identity generation, current ENS policy, final PDF hash, protected details, approved receiving address/asset/network, sequence and deadline to the issuer’s EIP-712 signature. First acceptance refuses an existing resolver bundle or alias. The ENS write and acceptance revert together on failure. Registration itself remains confirmed if later evidence publication fails.

`InvoiceRegistrationChecked` captures the organization and invoice registries, namespace and leaf ownership resources, parent-bounded expiries, owner and resolver in the canonical acceptance receipt. Independent verification checks that event alongside the original signature, accepted invoice, policy, transaction, code pin and canonical logs. Current registration and policy are separate observations. Later ENS pointer, owner, expiry, signer or resolver changes cannot rewrite accepted evidence; discovery may become unavailable or point elsewhere. A trusted acceptance transaction/log can still be checked historically by the library. Old ledger availability is outside the revised application.

Corrections remain chained ledger revisions under the same registered name and stable pointer; there is no correction-creation UI. Cancellation is not supported. Expired names are not automatically re-registered or reused. General configuration editing, ownership transfer recovery and registrar rotation UI remain outside this milestone.

## Validation and live gate

Run `npm ci --ignore-scripts --no-audit --no-fund`, `npm run build`, `npm test`, and `node --test test/registered-invoice.test.mjs test/registered-service.test.mjs test/registered-deployment.test.mjs`. Run Worker variants sequentially because they share a test bundle output: `node --test test/worker-runtime.test.mjs`, then `node --test test/registered-worker-runtime.test.mjs`. Set `HIR_TEST_WORKER_BROWSER=1` and `HIR_BROWSER_CHANNEL=chrome` for sandbox-enabled installed Chrome. `npm run test:browser` checks existing wallet-session regressions.

Isolated tests are not a claim of Sepolia acceptance or a public deployment. The live gate requires a reviewed/merged GitHub revision, the Cloudflare website, the user’s approved deployment/setup/registration/publication transactions, two confirmations, measured receipts, visible namespace and leaf tokens in ENS Explorer, and a separate wallet-free original-PDF/tampered-PDF check. Preserve exact original PDFs; the Worker stores metadata only.
