// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import { IExternalPool } from "../interfaces/IExternalPool.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IEllipsis {
  function notifyRewardAmount(address _rewardsToken, uint256 reward) external;
}

contract ExternalEllipsis is IExternalPool, Ownable {
  using SafeERC20 for IERC20;

  IEllipsis public ellipsis;
  IERC20 public token;

  constructor(address _ellipsis, address _token) {
    ellipsis = IEllipsis(_ellipsis);
    token = IERC20(_token);
    token.approve(_ellipsis, type(uint256).max);
  }

  function addReward(uint256 amount) external returns (bool) {
    token.safeTransferFrom(msg.sender, address(this), amount);
    ellipsis.notifyRewardAmount(address(token), amount);
    return true;
  }
}
