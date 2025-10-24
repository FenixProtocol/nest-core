
### Transfer Ownership — BribeFactory
-  **Contract (BribeFactory)**: `0xFD91dC9a8C3268fc556838baEd5871BE3Af6f32e`
-  **Current Owner From**: `0x0907fb24626a06e383BD289A0e9C8560b8cCC4b5`
-  **New owner (To)**: FENIX_MAINNET_DEPLOYER - `0x4867664baafe5926b3ca338e96c88fb5a5feab30`

**Action**: call `transferOwnership(address newOwner)` on **BribeFactory** with
`newOwner = 0x4867664baafe5926b3ca338e96c88fb5a5feab30`.

**Example:**
```
BribeFactory(0xFD91dC9a8C3268fc556838baEd5871BE3Af6f32e).transferOwnership(0x4867664baafe5926b3ca338e96c88fb5a5feab30)
```

## Grant Role — PairFactoryUpgradeable (FEES_MANAGER_ROLE)
-  **Contract (PairFactoryUpgradeable)**: `0xa19C51D91891D3DF7C13Ed22a2f89d328A82950f`
-  **Current Admin From**: `0xED8276141873621c18258D1c963C9F5d4014b5E5`
-  **Grantee (To)**: FENIX_MAINNET_DEPLOYER - `0x4867664baafe5926b3ca338e96c88fb5a5feab30`

**Action**: call `grantRole(bytes32 role, address account)` on `PairFactoryUpgradeable` with

`role = 0xad51469fd38cb9e4028f769761e769052a9f1f331b57ad921ac8a45c7903db28`

`account = 0x4867664baafe5926b3ca338e96c88fb5a5feab30`.

**Example:**
```
PairFactoryUpgradeable(0xa19C51D91891D3DF7C13Ed22a2f89d328A82950f).grantRole(0xad51469fd38cb9e4028f769761e769052a9f1f331b57ad921ac8a45c7903db28, 0x4867664baafe5926b3ca338e96c88fb5a5feab30)
```

## Grant Role — FeesVaultFactoryUpgradeable
-  **Contract (FeesVaultFactoryUpgradeable)**: `0x25D84140b5a611Fc8b13B0a73b7ac86d30C81edB`
-  **Current Admin From**: `0xED8276141873621c18258D1c963C9F5d4014b5E5`
-  **Grantee (To)**: FENIX_MAINNET_DEPLOYER - `0x4867664baafe5926b3ca338e96c88fb5a5feab30`

**Action**: call `grantRole(bytes32 role, address account)` on `PairFactoryUpgradeable` with
* CLAIM_FEES_CALLER_ROLE `0xfe49275f0792362c35d68ef6a44cd32d365c9617abd3c30568953b5891b0420d`
* FEES_VAULT_ADMINISTRATOR_ROLE `0x6318e0386017ad20a3ceaccdcc5664338f312d23d7291730079e3aa16981ac1e`

**Example:**
```
FeesVaultFactoryUpgradeable(0x25D84140b5a611Fc8b13B0a73b7ac86d30C81edB).grantRole(0xfe49275f0792362c35d68ef6a44cd32d365c9617abd3c30568953b5891b0420d, 0x4867664baafe5926b3ca338e96c88fb5a5feab30)

FeesVaultFactoryUpgradeable(0x25D84140b5a611Fc8b13B0a73b7ac86d30C81edB).grantRole(0x6318e0386017ad20a3ceaccdcc5664338f312d23d7291730079e3aa16981ac1e, 0x4867664baafe5926b3ca338e96c88fb5a5feab30)
```

### Transfer Ownership — AlgebraFactoryUpgradeable
-  **Contract (AlgebraFactoryUpgradeable)**: `0x7a44CD060afC1B6F4c80A2B9b37f4473E74E25Df`
-  **Current Owner From**: `0x0907fb24626a06e383BD289A0e9C8560b8cCC4b5`
-  **New owner (To)**: FENIX_MAINNET_DEPLOYER - `0x4867664baafe5926b3ca338e96c88fb5a5feab30`

**Action**: call `transferOwnership(address newOwner)` on **AlgebraFactoryUpgradeable** with
`newOwner = 0x4867664baafe5926b3ca338e96c88fb5a5feab30`.

**Example:**
```
AlgebraFactoryUpgradeable(0x7a44CD060afC1B6F4c80A2B9b37f4473E74E25Df).transferOwnership(0x4867664baafe5926b3ca338e96c88fb5a5feab30)
```


### Transfer Ownership — Gauges, ProxyAdmin

**Required to perform the **one-time Gauge upgrade** that introduces the drain function.**

-  **Contract (AlgebraFactoryUpgradeable)**: `0xdD75F0d1ccF1b2E115d87f0177b67c0F0F8429B5`
-  **Current Owner From**: `0x0907fb24626a06e383BD289A0e9C8560b8cCC4b5`
-  **New owner (To)**: FENIX_MAINNET_DEPLOYER - `0x4867664baafe5926b3ca338e96c88fb5a5feab30`

**Action**: call `transferOwnership(address newOwner)` on **ProxyAdmin** with
`newOwner = 0x4867664baafe5926b3ca338e96c88fb5a5feab30`.

**Example:**
```
ProxyAdmin(0xdD75F0d1ccF1b2E115d87f0177b67c0F0F8429B5).transferOwnership(0x4867664baafe5926b3ca338e96c88fb5a5feab30)
```