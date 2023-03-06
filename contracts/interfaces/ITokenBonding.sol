// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

interface ITokenBonding {
  function userWeight(address _user) external view returns (uint256);

  function totalWeight() external view returns (uint256);
}
