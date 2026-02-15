// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import {IRouterV2} from "../../dexV2/interfaces/IRouterV2.sol";

interface ISingleTokenBuyback {
    event BuybackTokenByV2(
        address indexed caller,
        address indexed inputToken,
        address indexed outputToken,
        IRouterV2.route[] routes,
        uint256 inputAmount,
        uint256 outputAmount
    );

    /**
     * @notice Address of the Router V2 Path Provider used for fetching and calculating optimal token swap routes.
     * @dev This address is utilized to access routing functionality for executing token buybacks.
     */
    function routerV2PathProvider() external view returns (address);

    /**
     * @notice Retrieves the target token for buybacks.
     * @dev Provides an abstraction layer over internal details, potentially allowing for dynamic updates in the future.
     * @return The address of the token targeted for buyback operations.
     */
    function getBuybackTargetToken() external view returns (address);
}
