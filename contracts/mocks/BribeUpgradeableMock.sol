// SPDX-License-Identifier: MIT
pragma solidity =0.8.19;

import "../bribes/BribeUpgradeable.sol";
contract BribeUpgradeableMockWithFixTargetEpoch is BribeUpgradeable {
    uint256 immutable __mock_targetEpoch;

    constructor(uint256 mock_targetEpoch) {
        __mock_targetEpoch = mock_targetEpoch;
    }

    // it is copy of earnedWithTimestamp function but public
    function earnedWithTimestampPublic(address _owner, address _rewardToken) public view returns (uint256, uint256) {
        uint256 k = 0;
        uint256 reward = 0;
        uint256 _endTimestamp = IMinter(minter).active_period(); // claim until current epoch
        uint256 _userLastTime = userTimestamp[_owner][_rewardToken];

        // if user first time then set it to first bribe - week to avoid any timestamp problem
        if (_userLastTime < firstBribeTimestamp) {
            _userLastTime = firstBribeTimestamp - WEEK;
        }

        for (k; k < 50; k++) {
            if (_userLastTime == _endTimestamp) {
                // if we reach the current epoch, exit
                break;
            }
            reward += _earned(_owner, _rewardToken, _userLastTime);
            _userLastTime += WEEK;
        }
        return (reward, _userLastTime);
    }

    function fixVotingPowerForPreviusEpoch(
        uint256 tokenId_,
        uint256 newBalance_
    ) external onlyAllowed whenRewardClaimPaused reinitializer(2) {
        uint256 targetEpoch = (block.timestamp / WEEK) * WEEK - WEEK;
        require(targetEpoch == __mock_targetEpoch, "invalid epoch to fix");
        address tokenOwner = IVotingEscrow(ve).ownerOf(tokenId_);
        uint256 balance = _balances[tokenOwner][targetEpoch];
        _totalSupply[targetEpoch] -= balance;
        _totalSupply[targetEpoch] += newBalance_;
        _balances[tokenOwner][targetEpoch] = newBalance_;
        if (balance > 0) {
            emit Withdrawn(tokenId_, balance);
        }
        emit Staked(tokenId_, newBalance_);
    }
}
