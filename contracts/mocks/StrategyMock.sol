// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { IStrategy } from "../interfaces/IStrategy.sol";

contract StrategyMock is IStrategy {
  using SafeERC20 for IERC20;

  uint256 public wantLockedTotal;
  uint256 public sharesTotal;

  address public wantAddress;
  address public farmingAddress;

  constructor(address _wantAddress, address _farmingAddress) {
    wantAddress = _wantAddress;
    farmingAddress = _farmingAddress;
  }

  // Transfer want tokens autoFarm -> strategy
  function deposit(address, uint256 _wantAmt) external returns (uint256) {
    IERC20(wantAddress).safeTransferFrom(address(msg.sender), address(this), _wantAmt);

    sharesTotal += _wantAmt;
    wantLockedTotal += _wantAmt;

    return sharesTotal;
  }

  // Transfer want tokens strategy -> autoFarm
  function withdraw(address, uint256 _wantAmt) external returns (uint256) {
    sharesTotal -= _wantAmt;
    wantLockedTotal -= _wantAmt;

    IERC20(wantAddress).safeTransfer(farmingAddress, _wantAmt);

    return sharesTotal;
  }

  // Main want token compounding function
  function earn() external pure {
    revert("no need for tests");
  }

  function inCaseTokensGetStuck(
    address,
    uint256,
    address
  ) external pure {
    revert("no need for tests");
  }
}
