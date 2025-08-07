// SPDX-License-Identifier: MIT
pragma solidity =0.8.19;

import {IPriceProvider} from "./interfaces/IPriceProvider.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ManualNESTPriceProvider
 * @notice This contract allows for manually setting the price of the NEST token in USD.
 *
 * It is intended for use cases where the price needs to be controlled or set by an authorized account.
 * Unlike automatic price feeds, this contract requires an administrator to provide the price.
 * *
 * Inherits from `Ownable` for access control, allowing only the owner to set the price.
 */
contract ManualNESTPriceProvider is IPriceProvider, Ownable {
    /**
     * @dev Emitted when the price is updated.
     * @param oldPrice The previous price of 1 USD in NEST tokens.
     * @param newPrice The new price of 1 USD in NEST tokens.
     */
    event SetPrice(uint256 indexed oldPrice, uint256 indexed newPrice);

    /**
     * @dev The current price of 1 USD in NEST tokens.
     */
    uint256 public price;

    /**
     * @dev Thrown when attempting to retrieve the price before it has been set.
     */
    error PriceNotSetup();

    /**
     * @notice Initializes the contract with the given initial price.
     * @dev Disables further initializers to prevent re-initialization.
     * @param price_ The initial price of 1 USD in NEST tokens.
     */
    constructor(uint256 price_) Ownable() {
        price = price_;
    }

    /**
     * @notice Sets the price of 1 USD in NEST tokens.
     * @dev Only callable by the owner of the contract.
     * @param price_ The new price of 1 USD in NEST tokens.
     */
    function setNestPrice(uint256 price_) external onlyOwner {
        uint256 oldPrice = price;
        price = price_;
        emit SetPrice(oldPrice, price_);
    }

    /**
     * @notice Retrieves the current price of 1 USD in NEST tokens.
     * @dev Reverts if the price has not been set.
     * @return The price of 1 USD in NEST tokens.
     */
    function getUsdToNESTPrice() external view override returns (uint256) {
        uint256 priceCache = price;
        if (priceCache == 0) {
            revert PriceNotSetup();
        }
        return priceCache;
    }
}
