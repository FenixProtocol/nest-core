// SPDX-License-Identifier: MIT
pragma solidity =0.8.19;
import {BaseManagedNFTStrategyUpgradeable} from "../nest/BaseManagedNFTStrategyUpgradeable.sol";

contract BaseManagedNFTStrategyUpgradeableMock is BaseManagedNFTStrategyUpgradeable {
    function initialize(address managedNFTManager_, string memory name_) external initializer {
        __BaseManagedNFTStrategy__init(managedNFTManager_, name_);
    }

    function onAttach(uint256 tokenId, uint256 userBalance) external override {
        revert("not implemented");
    }

    function onDettach(uint256 tokenId, uint256 userBalance) external override returns (uint256 lockedRewards) {
        revert("not implemented");
    }

    function dettachLockWindowInfo()
        external
        view
        returns (
            bool locked,
            uint256 epochStart,
            uint256 lockEnd
    ) {}
    function detachmentLockDuration() external view returns (uint256 duration) {}
}
