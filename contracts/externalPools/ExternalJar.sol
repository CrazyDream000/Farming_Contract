// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import { IExternalPool } from "../interfaces/IExternalPool.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IJar {
  function replenish(uint256 wad, bool newSpread) external;
}

contract ExternalJar is IExternalPool, Ownable {
  using SafeERC20 for IERC20;

  IJar public jar;
  IERC20 public token;
  bool public newSpread;

  constructor(address _jar, address _token) {
    jar = IJar(_jar);
    token = IERC20(_token);
    token.approve(_jar, type(uint256).max);
  }

  function addReward(uint256 amount) external returns (bool) {
    token.safeTransferFrom(msg.sender, address(this), amount);
    jar.replenish(amount, newSpread);
    return true;
  }

  function setSpread(bool _newSpread) external onlyOwner {
    newSpread = _newSpread;
  }
}
