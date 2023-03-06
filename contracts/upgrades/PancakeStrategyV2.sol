// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import { SafeERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

import { IPancakeSwapFarm } from "../interfaces/IPancakeSwapFarm.sol";
import { IPancakeRouter02 } from "../interfaces/IPancakeRouter02.sol";
import { PancakeStrategy } from "../PancakeStrategy.sol";

contract PancakeStrategyV2 is PancakeStrategy {
  using SafeERC20Upgradeable for IERC20Upgradeable;

  // Receives new deposits from user
  function deposit(address, uint256 _wantAmt)
    public
    virtual
    override
    onlyHelioFarming
    whenNotPaused
    returns (uint256)
  {
    if (enableAutoHarvest) {
      _harvest();
    }
    IERC20Upgradeable(want).safeTransferFrom(address(msg.sender), address(this), _wantAmt);

    uint256 sharesAdded = _wantAmt;

    uint256 sharesTotalLocal = sharesTotal;
    uint256 wantLockedTotalLocal = _wantLockedTotal;

    if (wantLockedTotalLocal > 0 && sharesTotalLocal > 0) {
      sharesAdded = (_wantAmt * sharesTotalLocal) / wantLockedTotalLocal;
    }
    sharesTotal = sharesTotalLocal + sharesAdded;

    _farm();

    return sharesAdded;
  }

  function withdraw(address, uint256 _wantAmt)
    public
    virtual
    override
    onlyHelioFarming
    nonReentrant
    returns (uint256)
  {
    require(_wantAmt > 0, "_wantAmt <= 0");

    if (enableAutoHarvest) {
      _harvest();
    }

    uint256 sharesRemoved = (_wantAmt * sharesTotal) / _wantLockedTotal;

    uint256 sharesTotalLocal = sharesTotal;
    if (sharesRemoved > sharesTotalLocal) {
      sharesRemoved = sharesTotalLocal;
    }
    sharesTotal = sharesTotalLocal - sharesRemoved;

    _unfarm(_wantAmt);

    uint256 wantAmt = IERC20Upgradeable(want).balanceOf(address(this));
    if (_wantAmt > wantAmt) {
      _wantAmt = wantAmt;
    }

    if (_wantLockedTotal < _wantAmt) {
      _wantAmt = _wantLockedTotal;
    }

    _wantLockedTotal -= _wantAmt;

    IERC20Upgradeable(want).safeTransfer(helioFarming, _wantAmt);

    return sharesRemoved;
  }

  function farm() public virtual nonReentrant {
    _farm();
  }

  function _farm() internal virtual {
    uint256 wantAmt = IERC20Upgradeable(want).balanceOf(address(this));
    _wantLockedTotal += wantAmt;
    IERC20Upgradeable(want).safeIncreaseAllowance(farmContractAddress, wantAmt);

    IPancakeSwapFarm(farmContractAddress).deposit(pid, wantAmt);
  }

  function _unfarm(uint256 _wantAmt) internal virtual {
    IPancakeSwapFarm(farmContractAddress).withdraw(pid, _wantAmt);
  }

  // 1. Harvest farm tokens
  // 2. Converts farm tokens into want tokens
  // 3. Deposits want tokens
  function harvest() public virtual nonReentrant whenNotPaused {
    _harvest();
  }

  // 1. Harvest farm tokens
  // 2. Converts farm tokens into want tokens
  // 3. Deposits want tokens
  function _harvest() internal virtual {
    // Harvest farm tokens
    _unfarm(0);

    // Converts farm tokens into want tokens
    uint256 earnedAmt = IERC20Upgradeable(cake).balanceOf(address(this));

    IERC20Upgradeable(cake).safeApprove(router, 0);
    IERC20Upgradeable(cake).safeIncreaseAllowance(router, earnedAmt);

    if (earnedAmt < minEarnAmount) {
      return;
    }

    if (cake != token0) {
      // Swap half earned to token0
      _safeSwap(
        router,
        earnedAmt / 2,
        slippageFactor,
        earnedToToken0Path,
        address(this),
        block.timestamp + 600
      );
    }

    if (cake != token1) {
      // Swap half earned to token1
      _safeSwap(
        router,
        earnedAmt / 2,
        slippageFactor,
        earnedToToken1Path,
        address(this),
        block.timestamp + 600
      );
    }

    // Get want tokens, ie. add liquidity
    uint256 token0Amt = IERC20Upgradeable(token0).balanceOf(address(this));
    uint256 token1Amt = IERC20Upgradeable(token1).balanceOf(address(this));
    if (token0Amt > 0 && token1Amt > 0) {
      IERC20Upgradeable(token0).safeIncreaseAllowance(router, token0Amt);
      IERC20Upgradeable(token1).safeIncreaseAllowance(router, token1Amt);
      IPancakeRouter02(router).addLiquidity(
        token0,
        token1,
        token0Amt,
        token1Amt,
        0,
        0,
        address(this),
        block.timestamp + 600
      );
    }

    _farm();
  }

  function _safeSwap(
    address _uniRouterAddress,
    uint256 _amountIn,
    uint256 _slippageFactor,
    address[] memory _path,
    address _to,
    uint256 _deadline
  ) internal virtual {
    uint256[] memory amounts = IPancakeRouter02(_uniRouterAddress).getAmountsOut(_amountIn, _path);
    uint256 amountOut = amounts[amounts.length - 1];

    IPancakeRouter02(_uniRouterAddress).swapExactTokensForTokensSupportingFeeOnTransferTokens(
      _amountIn,
      (amountOut * _slippageFactor) / SLIPPAGE_FACTOR_MAX,
      _path,
      _to,
      _deadline
    );
  }

  function setAutoHarvest(bool _value) external onlyOwner {
    enableAutoHarvest = _value;
    emit AutoharvestChanged(_value);
  }

  function setSlippageFactor(uint256 _slippageFactor) external onlyOwner {
    require(_slippageFactor <= SLIPPAGE_FACTOR_UL, "slippageFactor too high");
    slippageFactor = _slippageFactor;
  }

  function setMinEarnAmount(uint256 _minEarnAmount) external onlyOwner {
    require(_minEarnAmount >= MIN_EARN_AMOUNT_LL, "min earn amount is too low");
    emit MinEarnAmountChanged(minEarnAmount, _minEarnAmount);
    minEarnAmount = _minEarnAmount;
  }

  function setPid(uint256 _pid) external onlyOwner {
    require(pid == 0, "pid already setted");
    pid = _pid;
  }

  function wantLockedTotal() external view virtual override returns (uint256) {
    return _wantLockedTotal;
  }
}
