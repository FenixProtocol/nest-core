// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.19;

import {Base64Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/Base64Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";

import {LibVotingEscrowUtils} from "./libraries/LibVotingEscrowUtils.sol";

import {DateTime} from "./libraries/DateTime.sol";
import {NumberFormatter, Strings} from "./libraries/NumberFormatter.sol";

import {IVeArtProxy} from "./interfaces/IVeArtProxy.sol";
import {IVotingEscrow} from "./interfaces/IVotingEscrow.sol";
import {IManagedNFTManager} from "../nest/interfaces/IManagedNFTManager.sol";
import {ICompoundVeNESTManagedNFTStrategy} from "../nest/interfaces/ICompoundVeNESTManagedNFTStrategy.sol";
import "./interfaces/IVeArtProxyStatic.sol";

/**
 * @title VeArtProxy Contract
 * @author The Nest Protocol team
 * @notice This contract provides a `tokenURI` function for generating on-chain art for tokens.
 * @dev The art is generated as SVG images and encoded in base64 format, making each token have a unique representation.
 */
contract VeArtProxy is IVeArtProxy {
    using DateTime for uint256;
    using Strings for uint256;

    address public artProxyStatic;
    address public votingEscrow;
    address public managedNftManager;

    /**
     * @notice Constructor to initialize the VeArtProxy contract.
     * @param artProxyStatic_ Address of the static art proxy contract.
     * @param votingEscrow_ Address of the voting escrow contract.
     * @param managedNftManager_ Address of the managed NFT manager contract.
     */
    constructor(address artProxyStatic_, address votingEscrow_, address managedNftManager_) {
        artProxyStatic = artProxyStatic_;
        votingEscrow = votingEscrow_;
        managedNftManager = managedNftManager_;
    }

    /**
     * @notice Generates the token URI for a given token ID.
     * @dev This function generates an SVG image representing the state of the token.
     *      The SVG includes visual representations of the token's current voting power,
     *      the timestamp of when the token's lock ends, and the amount of tokens locked.
     *      This SVG image is encoded in base64 and included in a JSON metadata structure,
     *      which is also encoded in base64. This metadata provides a unique, on-chain
     *      representation for each token, enhancing its traceability and uniqueness.
     * @param tokenId_ The ID of the token for which the URI is being generated.
     * @return output The base64 encoded JSON metadata for the token.
     */
    function tokenURI(uint256 tokenId_) external view virtual override returns (string memory output) {
        IVotingEscrow votingEscrowCache = IVotingEscrow(votingEscrow);
        IVotingEscrow.TokenState memory state = votingEscrowCache.getNftState(tokenId_);

        string memory strategyName;
        uint256 balance;
        uint256 votingPower;
        bool isTransferable = votingEscrowCache.isTransferable(tokenId_);
        uint256 lockedEnd = (state.isAttached || state.locked.isPermanentLocked)
            ? LibVotingEscrowUtils.maxUnlockTimestamp()
            : state.locked.end;
        if (state.isAttached) {
            address strategy = IERC721Upgradeable(address(votingEscrowCache)).ownerOf(
                IManagedNFTManager(managedNftManager).getAttachedManagedTokenId(tokenId_)
            );
            ICompoundVeNESTManagedNFTStrategy strategyTyped = ICompoundVeNESTManagedNFTStrategy(strategy);
            balance = strategyTyped.balanceOf(tokenId_);
            votingPower = balance;
            strategyName = strategyTyped.name();
        } else {
            balance = uint256(int256(state.locked.amount));
            votingPower = votingEscrowCache.balanceOfNftIgnoreOwnershipChange(tokenId_);
        }
        return
            string.concat(
                "data:application/json;base64,",
                Base64Upgradeable.encode(
                    bytes(
                        string.concat(
                            '{"name": "lock #',
                            tokenId_.toString(),
                            '", "description": "Nest locks, can be used to boost gauge yields, vote on token emission, and receive bribes", "image": "data:image/svg+xml;base64,',
                            Base64Upgradeable.encode(
                                bytes(
                                    generateSVG(
                                        tokenId_,
                                        balance,
                                        votingPower,
                                        lockedEnd,
                                        state.locked.isPermanentLocked,
                                        isTransferable,
                                        state.isAttached,
                                        strategyName
                                    )
                                )
                            ),
                            '"}'
                        )
                    )
                )
            );
    }

    /**
     * @notice Generates an SVG image representing the state of a given token.
     * @dev This function generates an SVG representation of the token's balance, voting power,
     *      locked end date, and other attributes.
     * @param tokenId_ The ID of the token for which the SVG is being generated.
     * @param balance_ The balance of the token.
     * @param votingPower_ The voting power of the token.
     * @param lockedEnd_ The timestamp when the token's lock ends.
     * @param isPermanentLock_ Indicates if the token is permanently locked.
     * @param isTransferable_ Indicates if the token is transferable.
     * @param isAttached_ Indicates if the token is attached to a strategy.
     * @param nestStrategyName_ The name of the strategy the token is attached to (if applicable).
     * @return svg The SVG representation of the token.
     */
    function generateSVG(
        uint256 tokenId_,
        uint256 balance_,
        uint256 votingPower_,
        uint256 lockedEnd_,
        bool isPermanentLock_,
        bool isTransferable_,
        bool isAttached_,
        string memory nestStrategyName_
    ) public view returns (string memory svg) {
        IVeArtProxyStatic artStatic = IVeArtProxyStatic(artProxyStatic);
        return
            string.concat(
                IVeArtProxyStatic(artProxyStatic).startPart(),
                '<text x="5.5em" y="4.2em" class="prefix__venest__font-poppins">',
                NumberFormatter.formatNumber(balance_, 18, 2),
                '</text><text x="5.5em" y="7.2em" class="prefix__venest__font-poppins">',
                NumberFormatter.formatNumber(votingPower_, 18, 2),
                '</text><text x="5.5em" y="31.7em" class="prefix__venest__font-poppins">',
                toDateString(lockedEnd_),
                '</text><text x="30.5em" y="31.7em" class="prefix__venest__font-poppins">',
                tokenId_.toString(),
                "</text>",
                artStatic.endPart()
            );
    }

    function toDateString(uint256 timestamp) public pure returns (string memory) {
        (uint256 year, uint256 month, uint256 day) = timestamp.timestampToDate();
        string[12] memory monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return string.concat(day.toString(), " ", monthNames[month - 1], ", ", year.toString());
    }
}
