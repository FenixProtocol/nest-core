// SPDX-License-Identifier: MIT
pragma solidity =0.8.19;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import {IGaugeFactory} from "./interfaces/IGaugeFactory.sol";
import {IGauge} from "./interfaces/IGauge.sol";
import {GaugeProxy} from "./GaugeProxy.sol";

contract GaugeFactoryUpgradeable is IGaugeFactory, OwnableUpgradeable {
    address public last_gauge;
    address public voter;
    address public override gaugeImplementation;
    address public override merklGaugeMiddleman;

    error AddressZero();

    constructor() {
        _disableInitializers();
    }

    function initialize(address _voter, address _gaugeImplementation, address _merklGaugeMiddleman) external initializer {
        _checkAddressZero(_voter);
        _checkAddressZero(_gaugeImplementation);

        __Ownable_init();

        voter = _voter;
        gaugeImplementation = _gaugeImplementation;
        merklGaugeMiddleman = _merklGaugeMiddleman;
    }

    function createGauge(
        address _rewardToken,
        address _ve,
        address _token,
        address _distribution,
        address _internal_bribe,
        address _external_bribe,
        bool _isDistributeEmissionToMerkle,
        address _feeVault
    ) external virtual override returns (address) {
        require(msg.sender == voter || msg.sender == owner(), "only voter or owner");

        address newLastGauge = address(new GaugeProxy());
        IGauge(newLastGauge).initialize(
            _rewardToken,
            _ve,
            _token,
            _distribution,
            _internal_bribe,
            _external_bribe,
            _isDistributeEmissionToMerkle,
            merklGaugeMiddleman,
            _feeVault
        );

        last_gauge = newLastGauge;

        return newLastGauge;
    }

    function gaugeOwner() external view returns (address) {
        return owner();
    }

    function changeImplementation(address _implementation) external onlyOwner {
        _checkAddressZero(_implementation);
        emit GaugeImplementationChanged(gaugeImplementation, _implementation);
        gaugeImplementation = _implementation;
    }

    function setMerklGaugeMiddleman(address _newMerklGaugeMiddleman) external onlyOwner {
        _checkAddressZero(_newMerklGaugeMiddleman);
        address oldMerklGaugeMiddleman = merklGaugeMiddleman;
        merklGaugeMiddleman = _newMerklGaugeMiddleman;
        emit MerklGaugeMiddlemanChanged(oldMerklGaugeMiddleman, _newMerklGaugeMiddleman);
    }

    /**
     * @dev Checked provided address on zero value, throw AddressZero error in case when addr_ is zero
     *
     * @param addr_ The address which will checked on zero
     */
    function _checkAddressZero(address addr_) internal pure {
        if (addr_ == address(0)) {
            revert AddressZero();
        }
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
