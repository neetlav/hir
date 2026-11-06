# Registered Agents ENS names

A resolving policy record is not proof that a name is registered. New Agents exchanges require an actual ENSv2 hierarchy: the existing organization, its registered `agents` namespace and a registered requester leaf. The application verifies this through the public chain, independently of its SQLite contexts or jobs. The setup UI shows name registration separately from policy publication and evidence anchoring.

## Shared organization prerequisite

The organization must already have an administrator-controlled official UserRegistry linked as its subregistry. Shared organization setup is managed separately from Agents. When the pointer is absent, Agents reports the prerequisite and prepares no transaction that changes the organization's root registry, ownership, resolver or subregistry pointer.

The current public registration anchors are in `config/sepolia.json`: ENS VerifiableFactory `0xda70306c98e97ece36f997a21368e53298572991` and UserRegistry implementation `0x9bd8a88719068d09ecee662f36c0e3856708366a`. Their expected runtime hashes are checked at the observation checkpoint. Registry proxies must verify through that factory against the expected implementation, have the correct parent registry/label and retain organization control. This is not a private replacement ENS registry. The version-pinned official test artifact, checksum and MIT license are under `vendor/ens-registration`.

Check the current [official Sepolia deployment](https://docs.ens.domains/learn/deployments/) and [ENS Explorer](https://sepolia.explorer.ens.domains) before live setup. A changed implementation, factory, owner, resolver or existing conflicting registration requires review rather than an automatic migration.

## Administrator wallet sequence

Sign in on the public Agents Worker with the organization controller, explicitly enter the organization and requester label, and select **Check permissions**. Matching existing policy bytes and dedicated signer addresses are reused. Do not republish an occupied policy or replace the signer keys for registration.

When shared setup is confirmed, **Prepare next registration action** prepares only one exact wallet intent at a time:

| Action | Transaction target | Effect |
| --- | --- | --- |
| Create Agents registry | Pinned official VerifiableFactory | Deploy its standard UserRegistry proxy, with initial roles assigned only to the organization controller |
| Set registry parent | Newly verified Agents registry proxy | Set the shared organization registry as parent under the `agents` label |
| Register namespace | Shared organization registry | Register `agents.<organization>` with the existing resolver and Agents child registry |
| Register requester | Agents registry | Register `<label>.agents.<organization>` with the existing resolver and organization controller as owner |

The controller receives registration, parent-setting, unregister, renew, subregistry/resolver management, corresponding role-administration and transfer-administration permissions. No upgrade roles are granted by this flow. Neither runtime signer receives registry, name or resolver administration rights. Registration expiry cannot exceed the verified parent expiry. Existing registered resources are reused; reserved, expired, conflicting or unexpectedly controlled resources are not overwritten.

Inspect each intent's purpose, target, calldata, controller, role bitmap and fees before selecting **Review in my wallet**. Approve the transaction yourself and use **Check confirmation**. The application validates the exact sender, nonce, chain, zero value and calldata, canonical receipt, at least two observed confirmations and the actual registration effect. It also rechecks that the original policy resolver, bytes and record ID remain unchanged. A recent policy checkpoint may require another block before the final registration is visible to a new run.

Dispatched requests and hashes survive refresh and Worker restart. An ambiguous request is never resent automatically: reconcile its existing public hash under the original signing wallet and organization. After confirmation, prepare the next action explicitly. No model call, key export, new evidence contract, policy overwrite or old evidence re-anchoring is part of this sequence.

## Independent registration and evidence checks

Both agents independently resolve the same registered requester name and policy at a canonical checkpoint. Checks cover active registrations, organization-owned namespace/leaf, bounded expiry, parent pointers, factory-verified registry implementation, exact resolver routing and absence of administrative rights for the runtime signers. New runs are blocked until the complete hierarchy and current policy are verified.

New signed bundles commit `run.registeredHierarchy: true`. The standalone/public verifier uses the independently selected trust file's `registration` anchors to inspect the registered hierarchy at the signed historical checkpoint, resolves the policy directly through ENS, and authenticates signed evidence against the public evidence contract. It does not obtain authority from HIR's database. Downloaded trust includes the public registration anchors; choose those expected values independently when verifying a received bundle.

Existing evidence retains its original request, policy, context and contract bindings. Older bundles can still verify against their historical checkpoints, but report `registration: not-asserted`; they are not retroactively presented as registered-name proof. The existing append-only evidence contract intentionally remains capable of recording authentic violations. Registration, receiver choice, policy compliance and execution/anchoring findings remain separate.

## Public acceptance gate

Local fixtures and mocked model replies establish implementation compatibility only. Final acceptance requires the reviewed GitHub change deployed to the public Cloudflare app, real wallet-approved Sepolia registrations, and both namespace/requester names visibly open in the official ENS Explorer. Use the actual Explorer links in setup; an indexer visibility failure remains an unmet acceptance condition.

Then retrieve the exact policy through ENS, run real basic/extended requests on the public app, inspect the actual 40-credit execution and 80-credit rejection, approve evidence anchoring yourself, and verify canonical onchain commitments independently. Record the actual Explorer/transaction links, addresses, blocks, deployed source SHA and public app URL. The application does not claim these live checks were performed by its local test suite.
