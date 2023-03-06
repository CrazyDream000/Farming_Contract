// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { PausableUpgradeable } from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import { SafeERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import { IStrategy } from "./interfaces/IStrategy.sol";

// solhint-disable max-states-count
contract PancakeStrategy is
  IStrategy,
  OwnableUpgradeable,
  ReentrancyGuardUpgradeable,
  PausableUpgradeable
{
  using SafeERC20Upgradeable for IERC20Upgradeable;

  event AutoharvestChanged(bool value);
  event MinEarnAmountChanged(uint256 indexed oldAmount, uint256 indexed newAmount);

  uint256 public pid;
  address public farmContractAddress;
  address public want;
  address public cake;
  address public token0;
  address public token1;
  address public router;
  address public helioFarming;

  bool public enableAutoHarvest;

  address[] public earnedToToken0Path;
  address[] public earnedToToken1Path;

  uint256 internal _wantLockedTotal;
  uint256 public sharesTotal;

  uint256 public minEarnAmount;
  uint256 public constant MIN_EARN_AMOUNT_LL = 10**10;

  uint256 public slippageFactor;
  uint256 public constant SLIPPAGE_FACTOR_UL = 995;
  uint256 public constant SLIPPAGE_FACTOR_MAX = 1000;

  modifier onlyHelioFarming() {
    require(msg.sender == helioFarming, "!helio Farming");
    _;
  }

  function initialize(
    // uint256 _pid,
    uint256 _minEarnAmount,
    bool _enableAutoHarvest,
    address[] memory _addresses,
    // 0 address _farmContractAddress,
    // 1 address _want,
    // 2 address _cake,
    // 3 address _token0,
    // 4 address _token1,
    // 5 address _router,
    // 6 address _helioFarming,
    address[] memory _earnedToToken0Path,
    address[] memory _earnedToToken1Path
  ) public initializer {
    __Ownable_init();
    __ReentrancyGuard_init();
    __Pausable_init();
    require(_minEarnAmount >= MIN_EARN_AMOUNT_LL, "min earn amount is too low");
    slippageFactor = 950;
    // pid = _pid;
    minEarnAmount = _minEarnAmount;
    farmContractAddress = _addresses[0];
    want = _addresses[1];
    cake = _addresses[2];
    token0 = _addresses[3];
    token1 = _addresses[4];
    router = _addresses[5];
    helioFarming = _addresses[6];
    enableAutoHarvest = _enableAutoHarvest;
    earnedToToken0Path = _earnedToToken0Path;
    earnedToToken1Path = _earnedToToken1Path;
  }

  // Receives new deposits from user
  function deposit(address, uint256 _wantAmt)
    public
    virtual
    onlyHelioFarming
    whenNotPaused
    returns (uint256)
  {
    IERC20Upgradeable(want).safeTransferFrom(address(msg.sender), address(this), _wantAmt);

    uint256 sharesAdded = _wantAmt;
    sharesTotal += sharesAdded;

    return sharesAdded;
  }

  function withdraw(address, uint256 _wantAmt)
    public
    virtual
    onlyHelioFarming
    nonReentrant
    returns (uint256)
  {
    require(_wantAmt > 0, "_wantAmt <= 0");

    uint256 sharesRemoved = _wantAmt;
    uint256 sharesTotalLocal = sharesTotal;
    if (sharesRemoved > sharesTotalLocal) {
      sharesRemoved = sharesTotalLocal;
    }
    sharesTotal = sharesTotalLocal - sharesRemoved;

    uint256 wantAmt = IERC20Upgradeable(want).balanceOf(address(this));
    if (_wantAmt > wantAmt) {
      _wantAmt = wantAmt;
    }

    IERC20Upgradeable(want).safeTransfer(helioFarming, _wantAmt);

    return sharesRemoved;
  }

  function inCaseTokensGetStuck(
    address _token,
    uint256 _amount,
    address _to
  ) public virtual onlyOwner {
    require(_token != cake, "!safe");
    require(_token != want, "!safe");
    IERC20Upgradeable(_token).safeTransfer(_to, _amount);
  }

  function pause() public virtual onlyOwner {
    _pause();
  }

  function unpause() public virtual onlyOwner {
    _unpause();
  }

  function wantLockedTotal() external view virtual override returns (uint256) {
    return sharesTotal;
  }
}
