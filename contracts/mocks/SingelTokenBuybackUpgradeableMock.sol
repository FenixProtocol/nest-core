// SPDX-License-Identifier: MIT
pragma solidity =0.8.19;

import {SingleTokenBuybackUpgradeable} from "../nest/SingleTokenBuybackUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract SingleTokenBuybackUpgradeableMock is OwnableUpgradeable, SingleTokenBuybackUpgradeable {
    address public token;

    function initialize(address pathProivderV2_, address targetToken_) external initializer {
        __Ownable_init();
        __SingelTokenBuyback__init(pathProivderV2_);
        token = targetToken_;
    }

    function _checkBuybackSwapPermissions() internal view virtual override onlyOwner {}

    function _getBuybackTargetToken() internal view virtual override returns (address) {
        return token;
    }
}
