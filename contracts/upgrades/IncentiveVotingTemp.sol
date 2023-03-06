// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import { ITokenBonding } from "../interfaces/ITokenBonding.sol";

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import { IFarming } from "../interfaces/IFarming.sol";
import { ITokenBonding } from "../interfaces/ITokenBonding.sol";
import { IExternalPool } from "../interfaces/IExternalPool.sol";
import { IIncentiveVoting } from "../interfaces/IIncentiveVoting.sol";

struct Vote {
  address addr;
  bool isExternal;
  uint256 pid;
  uint256 votes;
}

struct Pool {
  uint256 id;
  bool isExternal;
}

// solhint-disable-next-line max-states-count
contract IncentiveVotingTemp is IIncentiveVoting, Initializable, OwnableUpgradeable {
  // pid -> week -> votes received
  mapping(uint256 => uint256[65535]) public pidVotes;

  // user -> week -> votes used
  mapping(address => uint256[65535]) public userVotes;

  // user -> pid -> week -> votes for pool
  mapping(address => mapping(uint256 => uint256[65535])) public userPidVotes;

  // week -> total votes used
  uint256[65535] public totalPidVotes;

  // week -> addedRewards
  uint256[65535] public totalPidRewards;

  uint256 internal constant WEEK = 1 weeks;
  // uint256 internal constant WEEK = 20 minutes;
  uint256 public override startTime;

  ITokenBonding public tokenBonding;
  IFarming public farming;

  mapping(uint256 => address) public tokenByPid;
  uint256[] public approvedPids;

  IERC20Upgradeable public rewardToken;

  // externalPid -> week -> votes received
  mapping(uint256 => uint256[65535]) public externalPidVotes;
  // user -> externalPid -> week -> votes for pool
  mapping(address => mapping(uint256 => uint256[65535])) public userExternalPidVotes;

  // week -> total votes used
  uint256[65535] public totalExternalPidVotes;

  mapping(uint256 => address) public externalPoolById;
  uint256[] public approvedExternalPids;

  bool[65535] public externalDistributionDone;

  event VotedForIncentives(
    address indexed voter,
    Pool[] pids,
    uint256[] votes,
    uint256 userVotesUsed,
    uint256 totalUserVotes
  );

  event RewardChanged(
    address indexed user,
    uint256 indexed week,
    int256 amount,
    uint256 totalAmount
  );

  function initialize(uint256 startTime_) public initializer {
    require(startTime_ > block.timestamp, "!epoch week");
    __Ownable_init();
    startTime = startTime_;
  }

  function setFarming(
    IFarming _farming,
    address[] calldata _initialApprovedTokens,
    address[] calldata _strategies
  ) external virtual returns (uint256[] memory) {
    require(address(farming) == address(0), "farming addresExternals can be set only once");
    uint256 length = _initialApprovedTokens.length;
    require(length == _strategies.length, "lengths are not equal");
    uint256[] memory _pids = new uint256[](length);
    farming = _farming;
    rewardToken = _farming.rewardToken();
    rewardToken.approve(address(_farming), type(uint256).max);
    for (uint256 i = 0; i < _initialApprovedTokens.length; i++) {
      address token = _initialApprovedTokens[i];
      tokenByPid[i] = token;
      approvedPids.push(i);
      _pids[i] = _farming.addPool(token, _strategies[i], false);
    }
    return _pids;
  }

  function approvedPoolsLength() external view returns (uint256) {
    return approvedPids.length;
  }

  function getWeek() public view virtual returns (uint256) {
    if (startTime > block.timestamp) return 0;
    return (block.timestamp - startTime) / WEEK;
  }

  /**
    @notice Get data on the current votes made in the active week
    @return _totalPidVotes Total number of votes this week for all internal pools
    @return _totalExternalPidVotes Total number of votes this week for all esternal pools
    @return _voteData Dynamic array of (token address, votes for token)
  */
  function getVotes(uint256 _week)
    external
    view
    virtual
    returns (
      uint256 _totalPidVotes,
      uint256 _totalExternalPidVotes,
      Vote[] memory _voteData
    )
  {
    uint256 totalLength = approvedPids.length + approvedExternalPids.length;
    _voteData = new Vote[](totalLength);
    for (uint256 i = 0; i < approvedPids.length; i++) {
      address token = tokenByPid[i];
      _voteData[i] = Vote({ addr: token, votes: pidVotes[i][_week], pid: i, isExternal: false });
    }
    for (uint256 i = approvedPids.length; i < totalLength; i++) {
      address farm = externalPoolById[i];
      _voteData[i] = Vote({
        addr: farm,
        votes: externalPidVotes[i][_week],
        pid: i,
        isExternal: true
      });
    }
    return (totalPidVotes[_week], _totalExternalPidVotes, _voteData);
  }

  /**
    @notice Get data on current votes `_user` has made in the active week
    @return _totalPidVotes Total number of votes from `_user` this week for all pools
    @return _voteData Dynamic array of (token address, votes for token)
  */
  function getUserVotes(address _user, uint256 _week)
    external
    view
    virtual
    returns (uint256 _totalPidVotes, Vote[] memory _voteData)
  {
    uint256 totalLength = approvedPids.length + approvedExternalPids.length;
    _voteData = new Vote[](totalLength);
    for (uint256 i = 0; i < approvedPids.length; i++) {
      address token = tokenByPid[i];
      _voteData[i] = Vote({
        addr: token,
        votes: userPidVotes[_user][i][_week],
        pid: i,
        isExternal: false
      });
    }
    for (uint256 i = approvedExternalPids.length; i < totalLength; i++) {
      address farm = externalPoolById[i];
      _voteData[i] = Vote({
        addr: farm,
        votes: userExternalPidVotes[_user][i][_week],
        pid: i,
        isExternal: true
      });
    }
    return (userVotes[_user][_week], _voteData);
  }

  /**
    @notice Get the amount of unused votes for for the current week being voted on
    @param _user Address to query
    @return uint Amount of unused votes
  */
  function availableVotes(address _user) external view virtual returns (uint256) {
    uint256 week = getWeek();
    uint256 usedVotes = userVotes[_user][week];
    uint256 _totalPidVotes = tokenBonding.userWeight(_user) / 1e18;
    return _totalPidVotes - usedVotes;
  }

  /**
    @notice Allocate votes toward LP tokens to receive emissions in the following week
    @dev A user may vote as many times as they like within a week, so long as their total
          available votes are not exceeded. If they receive additional votes by locking more
          tokens within `tokenBonding`, they can vote immediately.

          Votes can only be added - not modified or removed. Votes only apply to the
          following week - they do not carry over. A user must resubmit their vote each
          week.
    @param _pids List of pool ids of LP tokens to vote for
    @param _votes Votes to allocate to `_tokens`. Values are additive, they do
                    not include previous votes. For example, if you have already
                    allocated 100 votes and wish to allocate a total of 300,
                    the vote amount should be given as 200.
  */
  // pool id 0 - vote - 30
  // pool id 1 - vote - 60
  function vote(Pool[] calldata _pids, uint256[] calldata _votes) external virtual {
    require(_pids.length == _votes.length, "Input length mismatch");

    // update rewards per second, if required
    uint256 week = getWeek();

    // update accounting for this week's votes
    uint256 usedVotes = userVotes[msg.sender][week];
    for (uint256 i = 0; i < _pids.length; i++) {
      Pool memory pid = _pids[i];
      uint256 amount = _votes[i];
      if (pid.isExternal) {
        require(externalPoolById[pid.id] != address(0), "Not approved for incentives");
        externalPidVotes[pid.id][week] += amount;
        totalExternalPidVotes[week] += amount;
        userExternalPidVotes[msg.sender][pid.id][week] += amount;
      } else {
        require(tokenByPid[pid.id] != address(0), "Not approved for incentives");
        pidVotes[pid.id][week] += amount;
        totalPidVotes[week] += amount;
        userPidVotes[msg.sender][pid.id][week] += amount;
      }
      usedVotes += amount;
    }

    // make sure user has not exceeded available votes
    uint256 _totalUserVotes = tokenBonding.userWeight(msg.sender) / 1e18;
    require(usedVotes <= _totalUserVotes, "Available votes exceeded");
    userVotes[msg.sender][week] = usedVotes;

    emit VotedForIncentives(msg.sender, _pids, _votes, usedVotes, _totalUserVotes);
  }

  function setTokenBonding(address _tokenBonding) external {
    require(address(tokenBonding) == address(0), "already setted!");
    tokenBonding = ITokenBonding(_tokenBonding);
  }

  /**
    @dev Calculate and return the rewards per second for a given LP token.
          Called by `EllipsisLpStaker` when determining the emissions that each
          pool is entitled to.
  */
  function getRewardsPerSecond(uint256 _pid, uint256 _week)
    external
    view
    virtual
    returns (uint256)
  {
    if (_week == 0) return 0;
    // weekly rewards are calculated based on the previous week's votes
    _week -= 1;

    uint256 votes = pidVotes[_pid][_week];
    if (votes == 0) return 0;
    uint256 currentWeekTotalPidVotes = totalPidVotes[_week];
    uint256 rewards = (totalPidRewards[_week] * currentWeekTotalPidVotes) /
      (totalExternalPidVotes[_week] + currentWeekTotalPidVotes);

    return (rewards * votes) / (currentWeekTotalPidVotes * WEEK);
  }

  function distributeRewards(uint256 _week) external virtual returns (bool) {
    require(!externalDistributionDone[_week], "already distributed for this week");
    if (_week == 0) return false;
    // weekly rewards are calculated based on the previous week's votes
    _week -= 1;

    uint256 currentWeekTotalExternalPidVotes = totalExternalPidVotes[_week];
    uint256 rewards = (totalPidRewards[_week] * currentWeekTotalExternalPidVotes) /
      (currentWeekTotalExternalPidVotes + totalPidVotes[_week]);
    for (uint256 _pid; _pid < approvedExternalPids.length; ++_pid) {
      uint256 votes = externalPidVotes[_pid][_week];
      if (votes == 0) return false;
      uint256 pidReward = (rewards * votes) / (currentWeekTotalExternalPidVotes * WEEK);
      address externalPool = externalPoolById[_pid];
      if (rewardToken.allowance(address(this), externalPool) < pidReward) {
        rewardToken.approve(externalPool, type(uint256).max);
      }
      IExternalPool(externalPool).addReward(pidReward);
    }
    externalDistributionDone[_week] = true;
    return true;
  }

  function addTokenApproval(
    address _token,
    address _strategy,
    bool _withUpdate
  ) external virtual onlyOwner returns (uint256) {
    uint256 pid = approvedPids.length;
    tokenByPid[pid] = _token;
    approvedPids.push(pid);
    return farming.addPool(_token, _strategy, _withUpdate);
  }

  function addExternalPool(address _externalPool) external virtual onlyOwner returns (uint256) {
    uint256 pid = approvedExternalPids.length;
    externalPoolById[pid] = _externalPool;
    approvedExternalPids.push(pid);
    return pid;
  }

  function addReward(uint256 week, uint256 amount) public virtual {
    uint256 currentWeek = getWeek();
    require(currentWeek <= week, "You can add rewards starting from the current week");
    rewardToken.transferFrom(msg.sender, address(this), amount);
    uint256 totalAmount = totalPidRewards[week] + amount;
    totalPidRewards[week] = totalAmount;
    emit RewardChanged(msg.sender, week, int256(amount), totalAmount);
  }

  function removeReward(uint256 week, uint256 amount) external virtual onlyOwner {
    uint256 currentWeek = getWeek();
    require(currentWeek < week, "You can remove rewards starting from the next week");
    uint256 totalAmount = totalPidRewards[week] - amount;
    totalPidRewards[week] = totalAmount;
    rewardToken.transfer(msg.sender, amount);
    emit RewardChanged(msg.sender, week, -int256(amount), totalAmount);
  }
}
