import { id } from 'ethers';
import { ethers } from 'hardhat';

export const Roles = {
  DEFAULT_ADMIN_ROLE: ethers.ZeroHash,
  VotingEscrowUpgradeableV2: {
    DEFAULT_ADMIN_ROLE: ethers.ZeroHash,
  },
  VoterV2: {
    VOTER_ADMIN_ROLE: ethers.id('VOTER_ADMIN_ROLE'),
    GOVERNANCE_ROLE: ethers.id('GOVERNANCE_ROLE'),
  },
};
