// SPDX-License-Identifier: MIT
pragma solidity =0.8.19;

import {IUpgradeCall} from "../integration/interfaces/IUgradeCall.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract UtilsUpgradeable is Initializable {

    function multiUpgradeCall(address[] calldata targets_) external virtual {
        for (uint256 i; i < targets_.length; ) {
            IUpgradeCall(targets_[i]).upgradeCall();
            unchecked {
                i++;
            }
        }
    }
}
