// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC20MintBurnable } from "./interfaces/IERC20MintBurnable.sol";

contract PancakeRouterMock {
  IERC20 public earn;
  IERC20 public hay;
  IERC20 public busd;
  IERC20MintBurnable public lp;

  uint256 public constant HAY_BUSD = 1e18;
  uint256 public constant EARN_STABLE = 1e18 / 5;
  uint256 public constant STABLE_EARN = 5 * 1e18;

  mapping(IERC20 => mapping(IERC20 => uint256)) public tokenCoefficients;

  constructor(
    IERC20 _earn,
    IERC20 _hay,
    IERC20 _busd,
    IERC20MintBurnable _lp
  ) {
    earn = _earn;
    hay = _hay;
    busd = _busd;
    lp = _lp;
    tokenCoefficients[hay][busd] = HAY_BUSD;
    tokenCoefficients[busd][hay] = HAY_BUSD;
    tokenCoefficients[earn][hay] = EARN_STABLE;
    tokenCoefficients[earn][busd] = EARN_STABLE;
    tokenCoefficients[hay][earn] = STABLE_EARN;
    tokenCoefficients[busd][earn] = STABLE_EARN;
  }

  function addliquidity(
    IERC20 tokenA,
    IERC20 tokenB,
    uint256 amountADesired,
    uint256 amountBDesired,
    uint256,
    uint256,
    address to,
    uint256 deadline
  )
    external
    returns (
      uint256 amountA,
      uint256 amountB,
      uint256 liquidity
    )
  {
    require(tokenA == earn || tokenA == hay || tokenA == busd, "Wrong Token");
    require((tokenB == earn || tokenB == hay || tokenB == busd) && tokenA != tokenB, "Wrong Token");
    require(deadline >= block.timestamp, "deadline passed");
  }
}
