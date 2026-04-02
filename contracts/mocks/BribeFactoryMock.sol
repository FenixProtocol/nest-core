// SPDX-License-Identifier: MIT
pragma solidity =0.8.19;
import {BribeFactoryUpgradeable} from "../bribes/BribeFactoryUpgradeable.sol";
interface IBribeMock {
    function setVoter(address _voter) external;
}
contract BribeFactoryMock is BribeFactoryUpgradeable {
    function setImplementation(address _implementation) external {
        _checkAddressZero(_implementation);

        require(_implementation != address(0));
        emit bribeImplementationChanged(bribeImplementation, _implementation);
        bribeImplementation = _implementation;
    }

    function setVoterToBribe(address _bribe, address _voter) external {
        IBribeMock(_bribe).setVoter(_voter);
    }
}
