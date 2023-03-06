// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

interface IExternalPool {
  function addReward(uint256 amount) external returns (bool);
}
