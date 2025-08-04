// SPDX-License-Identifier: MIT
pragma solidity =0.8.19;

import "../core/CompoundEmissionExtensionUpgradeable.sol";

contract CompoundEmissionExtensionUpgradeableMock is CompoundEmissionExtensionUpgradeable {
    constructor() CompoundEmissionExtensionUpgradeable() {}

    function mock_setupVoter(address voter_) external {
        voter = voter_;
    }
}
