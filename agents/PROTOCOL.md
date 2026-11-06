# Agents evidence protocol v1

## Native identity and policy

The agent name is `<label>.agents.<organization>.eth`; the data key is `hir.agents.identity-policy.v1`. Labels are normalized lowercase letters/digits with internal hyphens. The organization is an existing active second-level ASCII `.eth` name in the independently selected native ENSv2 registry. Registration is not part of this protocol.

Canonical ABI policy bytes bind version 1, chain ID, organization and agent namehashes, current controller, ownership resource, authoritative resolver, generation, separate requester/receiver addresses, action, catalogue, validity and `maxCredits = 50`. Initial preparation limits validity to seven days or the organization's earlier expiry. Runtime signers must be distinct from organization control and have no root/Agents-key data or link administration rights.

A publisher must have current root or Agents-key `SET_DATA` permission (`1 << 24`) on the authoritative resolver. Current organization ownership and resolver data delegation are inspected separately; knowing a public address does not prove its control. The returned transaction writes exactly the new agent's data record. Before submission, the approving signer/integrator must recheck the intended chain, name, resolver, exact bytes and current permission.

Policy lookup reads native resolution directly at a checkpoint, checks organization status/expiry, controller/resource, resolver routing/code, canonical policy bytes, exact expected fields and optional pinned policy hash/record ID. Historical lookup checks the checkpoint block hash again; unavailable or inconsistent RPC data does not pass authority. The default current lookup uses two-block lag and freshness limits, not a proof of finality.

## Signed linkage

The EIP-712 domain is `HIR Agents`, version `1`, with explicit chain ID and evidence-contract address. Exact field encodings are defined in `src/protocol.mjs` and mirrored by the contract:

1. **Request** binds a unique nonzero request ID, agent namehash, requester/receiver, action, input hash, mode/parameters hash, catalogue-derived credits, policy hash/generation and a bounded validity interval. The requester signs it.
2. **Decision** binds the request ID/digest, policy hash, historical checkpoint number/hash, independently computed assessment code, actual accepted/rejected choice, public-reason hash and decision time. The receiver signs it.
3. **Outcome** binds the same request ID and decision digest to an output hash, completion time and status: `0` rejected/reports not executed, `1` completed, `2` failed, `3` indeterminate. The receiver signs it.
4. **Seal** binds all three digests and the canonical evidence bundle hash. The receiver signs it. A submitter cannot replace the bundle commitment without this signature.

Assessment codes are `0` within authority, `1` outside authority, `2` unavailable/denied. The request's 40/80-credit price is derived from its exact signed mode and fixed versioned catalogue. A genuine signature cannot purchase extended analysis at an invented lower price. Assessment is distinct from receiver choice; accepting an outside-authority or unavailable request is retained as an attributable violation rather than suppressed by the evidence layer.

The deterministic executor validates bounded integer input and produces exact rational means/medians without floating-point ambiguity. An accepted basic computation can therefore be checked independently. The storage adapter must durably claim execution before computation and preserve immutable snapshots/outcomes; interrupted claimed execution becomes indeterminate, rather than being rerun automatically. Request-ID conflicts and frozen-decision changes are rejected.

## Anchoring and verification

The append-only contract authenticates requester, receiver decision/outcome and receiver seal signatures; checks linkage and structurally consistent outcome codes; and rejects repeated `(requester, requestId)` commitments. Any submitter may anchor authentic evidence. There is deliberately no cap/expiry/ENS policy gate that would hide authentic violations or historical statements.

Independent verification authenticates signatures, bundle bytes and the expected domain; retrieves historical authority itself; recomputes assessment and successful output; and authenticates the selected event against transaction/receipt/block/log/code/storage observations. Two observed confirmations are required for a confirmed anchor. `verified` means those checks succeeded; inspect `authority`, `receiverDecision`, `execution` and `violation` separately. `pending-anchor`, `unavailable` and `fail` remain distinct outcomes.

Expected organization, signer identities, generation, policy hash, evidence address/runtime and ENS service addresses/code hashes must come from an independently selected trust configuration. Do not adopt trust from an untrusted received bundle or treat canonical-chain RPC observations as a light-client proof. Complete logs, hidden execution/non-execution and uninterrupted ownership remain outside what these commitments establish.
