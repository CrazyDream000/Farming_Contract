// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IIncentiveVoting {
  function getRewardsPerSecond(uint256 _pid, uint256 _week) external view returns (uint256);

  function startTime() external view returns (uint256);
}
