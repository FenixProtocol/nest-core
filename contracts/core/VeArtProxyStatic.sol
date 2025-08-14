// SPDX-License-Identifier: MIT
pragma solidity =0.8.19;

import "./interfaces/IVeArtProxyStatic.sol";

/**
 * @title VeArtProxyStatic
 * @notice A contract that manages art representation of locked and unlocked veNFT states.
 */
contract VeArtProxyStatic is IVeArtProxyStatic {
    /// @inheritdoc IVeArtProxyStatic
    string public override endPart;
    /// @inheritdoc IVeArtProxyStatic
    string public override startPart;
    /// @notice Boolean indicating whether the start part has been set up.
    bool public setupStart;
    /// @notice Boolean indicating whether the end part has been set up.
    bool public setupEnd;

    /**
     * @notice Sets the starting part of the veNFT art.
     * @dev This function can only be called once.
     * @param startPart_ The starting part to be set.
     */
    function setStartPart(string calldata startPart_) external {
        require(!setupStart, "Already setup");
        startPart = startPart_;
        setupStart = true;
    }

    /**
     * @notice Sets the ending part of the veNFT art.
     * @dev This function can only be called once.
     * @param endPart_ The ending part to be set.
     */
    function setEndPart(string calldata endPart_) external {
        require(!setupEnd, "Already setup");
        endPart = endPart_;
        setupEnd = true;
    }
}
