// SPDX-License-Identifier: MIT
pragma solidity =0.8.19;

interface ICustomVolatileDynamicFee {
    function isEnable() external view returns (bool);

    function getFee(address pair_) external view returns (bool, uint256);
}
