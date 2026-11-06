# Public Sepolia trust configuration

The customer application selects `registered-sepolia.json`, `registered-invoice-ledger-abi.json` and `registered-ledger-deployment.json`. The guarded ledger requires genuine registered invoice names and official reusable ENS subregistries. The reviewed manifest pins operator nonce, creation input, constructor, predicted address, source hashes and runtime hash. It requires separate browser-wallet approval; its presence is not proof of deployment. A changed nonce requires refreshed review. The application refuses missing or different runtime code. See [registered-name protocol](../docs/REGISTERED-INVOICE.md).

The following earlier configuration remains preserved as a reference. The revised application does not discover or display its invoices.

sepolia.json contains only the ledger address/runtime hash, ENS Universal Resolver and .eth registry addresses, record keys, chain ID and default test-token address used by this application. It deliberately contains no organization policy, invoice, signer secret or customer state.

The ledger is the pre-existing Option C Sepolia deployment at 0xb80Cca2797CB98D2C8a00D6B8d10E5a2800D405C. These values were selected from its public deployment metadata; this publication does not deploy or migrate it. invoice-ledger-abi.json is its compiler-produced ABI. The resolver and Universal Resolver ABI subsets retain only the functions/events required by the application. The official ENS fixture revision and licenses are documented in vendor/ens-native.

Review these trust anchors independently before use. The server verifies the RPC chain on startup and pins the ledger runtime during organization/operation checks. Read-only verification also checks historical code and canonical evidence. The supplied expected runtime hash is 0xedfc73c2d0afd55b9bb2b087ba15d5856192a130864ea39548b0f6e19f84427c. Configured addresses are public testnet identifiers, not permission to sign or a guarantee of future network availability.
