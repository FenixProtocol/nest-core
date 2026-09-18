// SPDX-License-Identifier: MIT
pragma solidity =0.8.19;

import {IAlgebraPluginFactory} from "@cryptoalgebra/integral-core/contracts/interfaces/plugin/IAlgebraPluginFactory.sol";

contract AlgebraCustomPoolPluginFactoryMock is IAlgebraPluginFactory {
    function createPlugin(address, address, address) external pure override returns (address) {
        return address(0);
    }

    function beforeCreatePoolHook(
        address,
        address,
        address,
        address,
        address,
        bytes calldata
    ) external pure override returns (address) {
        return address(0);
    }

    function afterCreatePoolHook(address, address, address) external pure override {}

    function createCustomPool(
        address entryPoint_,
        address creator_,
        address tokenA_,
        address tokenB_,
        bytes calldata data_
    ) external returns (address pool) {
        (bool success, bytes memory result) = entryPoint_.call(
            abi.encodeWithSignature(
                "createCustomPool(address,address,address,address,bytes)",
                address(this),
                creator_,
                tokenA_,
                tokenB_,
                data_
            )
        );
        require(success);
        pool = abi.decode(result, (address));
    }
}
