# ENS native integration fixtures

The original six unmodified official deployment artifacts supply ABI and constructor bytecode for isolated native ENS integration tests. Their embedded compilation metadata contains Solidity sources, hashes and MIT license declarations. Original public deployment addresses and constructor data identify provenance; the fixture deploys fresh contracts with its own local arguments. `UserRegistryImpl.json` additionally retains the ABI and constructor bytecode extracted from the same pinned official deployment artifact for registered-name tests and customer setup. Its checksum and upstream URL are recorded in PROVENANCE.json.

The pinned upstream revision is 07e55a056f5b6a9c90119f501bdd05714e67dddd. Each artifact's source field identifies its upstream URL. PROVENANCE.json records SHA-256 checksums and upstream dependency revisions. Corresponding ENS, OpenZeppelin and Verifiable Factory license notices are retained in licenses/.

Tests deploy the real registry, resolver, factory and Universal Resolver implementations on an unforked local EVM. They use ephemeral accounts generated only after checking chain ID 31337. No live signing keys, external RPC or live deployment configuration is included. These artifacts are required test dependencies; tests do not silently refresh them.
