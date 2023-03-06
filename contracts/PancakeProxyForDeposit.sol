// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { SafeERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

import { IFarming } from "./interfaces/IFarming.sol";
import { IPancakeFactory } from "./interfaces/IPancakeFactory.sol";
import { IPancakeRouter02 } from "./interfaces/IPancakeRouter02.sol";

struct PairInfo {
  IERC20Upgradeable pair;
  uint256 pid;
}

contract PancakeProxyForDeposit is Initializable, OwnableUpgradeable {
  using SafeERC20Upgradeable for IERC20Upgradeable;

  event PidChanged(address indexed token0, address indexed token1, uint256 indexed pid);

  IFarming public farming;
  IPancakeRouter02 public router;
  IPancakeFactory public factory;

  mapping(address => mapping(address => PairInfo)) public supportedPids;

  function initialize(IFarming _farming, IPancakeRouter02 _router) public initializer {
    __Ownable_init();
    farming = _farming;
    router = _router;
    factory = IPancakeFactory(router.factory());
  }

  function depositToFarming(
    IERC20Upgradeable tokenA,
    IERC20Upgradeable tokenB,
    uint256 amountA,
    uint256 amountB,
    uint256 amountAMin,
    uint256 amountBMin
  ) external {
    tokenA.safeTransferFrom(msg.sender, address(this), amountA);
    tokenB.safeTransferFrom(msg.sender, address(this), amountB);
    router.addLiquidity(
      address(tokenA),
      address(tokenB),
      amountA,
      amountB,
      amountAMin,
      amountBMin,
      address(this),
      block.timestamp
    );
    PairInfo memory pairInfo = getPairInfo(address(tokenA), address(tokenB));
    require(address(pairInfo.pair) != address(0), "tokens are not supported");
    farming.deposit(pairInfo.pid, pairInfo.pair.balanceOf(address(this)), false, msg.sender);
    uint256 tokenABal = tokenA.balanceOf(address(this));
    uint256 tokenBBal = tokenB.balanceOf(address(this));
    if (tokenABal > 0) {
      tokenA.safeTransfer(msg.sender, tokenABal);
    }
    if (tokenBBal > 0) {
      tokenB.safeTransfer(msg.sender, tokenBBal);
    }
  }

  function addSupportedTokens(
    address tokenA,
    address tokenB,
    uint256 pid
  ) external onlyOwner {
    (address token0, address token1) = sortTokens(tokenA, tokenB);
    IERC20Upgradeable pair = IERC20Upgradeable(factory.getPair(token0, token1));
    IERC20Upgradeable(token0).approve(address(router), type(uint256).max);
    IERC20Upgradeable(token1).approve(address(router), type(uint256).max);
    pair.approve(address(farming), type(uint256).max);
    supportedPids[token0][token1] = PairInfo({ pair: pair, pid: pid });
    emit PidChanged(token0, token1, pid);
  }

  function sortTokens(address tokenA, address tokenB)
    internal
    pure
    returns (address token0, address token1)
  {
    (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
    require(token0 != address(0), "ZERO_ADDRESS");
  }

  function getPairInfo(address tokenA, address tokenB) internal view returns (PairInfo memory) {
    (address token0, address token1) = sortTokens(tokenA, tokenB);
    return supportedPids[token0][token1];
  }
}
