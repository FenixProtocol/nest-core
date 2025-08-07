// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

/**
 * @title IRNest Interface
 * @dev Interface for the RNest token contract.
 * Provides the necessary declarations for interacting with the RNest functionalities.
 */
interface IRNest {
    /// @notice Emitted when rNEST tokens are converted to NEST and veNEST tokens.
    /// @param sender The address that initiated the conversion.
    /// @param amount The amount of rNEST tokens converted.
    /// @param toTokenAmount The amount of NEST tokens received from the conversion.
    /// @param toVeNFTAmount The amount of veNEST tokens received from the conversion.
    /// @param tokenId The ID of the veNEST token received, if applicable.
    event Converted(address indexed sender, uint256 amount, uint256 toTokenAmount, uint256 toVeNFTAmount, uint256 tokenId);

    /// @notice Emitted when NEST tokens are recovered from the contract.
    /// @param sender The address that performed the recovery.
    /// @param amount The amount of NEST tokens recovered.
    event Recover(address indexed sender, uint256 amount);

    /// @dev Reverts if the attempted operation involves zero amount.
    error ZERO_AMOUNT();

    /**
     * @notice Converts all rNEST tokens of the caller to NEST and veNEST tokens.
     */
    function convertAll() external;

    /**
     * @notice Converts a specific amount of rNEST tokens to NEST and veNEST tokens.
     * @param amount_ The amount of rNEST tokens to be converted.
     */
    function convert(uint256 amount_) external;

    /**
     * @notice Allows the contract owner to recover NEST tokens from the contract.
     * @param amount_ The amount of NEST tokens to be recovered.
     */
    function recoverToken(uint256 amount_) external;

    /**
     * @notice Mints rNEST tokens to a specified address.
     * @param to_ The address that will receive the minted rNEST tokens.
     * @param amount_ The amount of rNEST tokens to mint.
     */
    function mint(address to_, uint256 amount_) external;

    /**
     * @notice Returns the address of the NEST token.
     * @return address The NEST token contract address.
     */
    function token() external view returns (address);

    /**
     * @notice Returns the address of the Voting Escrow contract.
     * @return address The Voting Escrow contract address.
     */
    function votingEscrow() external view returns (address);
}
