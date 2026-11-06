# HIR — History · Integrity · Responsibility

An ENSv2-powered evidence layer for verifiable records, actions, and authority.

HIR's invoice workflow lets an organization authorize an exact final PDF and its receiving details. Recipients use the invoice's ENS reference, an independently trusted supplier identity, and the received PDF to check original authorization, document integrity, receiving-address approval, and current record status without connecting a wallet.

The locally developed invoice architecture uses organizational ENSv2 configuration, a shared Evidence Ledger, and an invoice-specific ENS discovery record published atomically with ledger acceptance. There is no individual ENS token registration per invoice. Publication uses an issuer's EIP-712 signature and a direct wallet transaction. Private workspace access separately requires proof of wallet ownership and the relevant organization permissions.

## What this repository contains today

This first publication contains only the project introduction, ignore rules, and minimal Node.js package metadata and lockfile. It contains no application, contracts, deployed configuration, or runnable HIR workflow yet. The package has no dependencies or application scripts. No third-party code is included in this snapshot.

Node.js 24 or later is the intended baseline. To validate this dependency-free foundation, run:

```sh
npm ci --ignore-scripts --no-audit --no-fund
```

This command validates the package snapshot; it does not start HIR. Application run and validation commands will be documented when their implementations are published.
