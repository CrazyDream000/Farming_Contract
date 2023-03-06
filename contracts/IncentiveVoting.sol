// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import { IFarming } from "./interfaces/IFarming.sol";
import { ITokenBonding } from "./interfaces/ITokenBonding.sol";
import { IIncentiveVoting } from "./interfaces/IIncentiveVoting.sol";

contract IncentiveVoting is IIncentiveVoting, Initializable, OwnableUpgradeable {
  struct Vote {
    address token;
    uint256 votes;
  }

  // pid -> week -> votes received
  mapping(uint256 => uint256[65535]) public pidVotes;

  // user -> week -> votes used
  mapping(address => uint256[65535]) public userVotes;

  // user -> pid -> week -> votes for pool
  mapping(address => mapping(uint256 => uint256[65535])) public userPidVotes;

  // week -> total votes used
  uint256[65535] public totalVotes;

  // week -> addedRewards
  uint256[65535] public totalRewards;

  uint256 internal constant WEEK = 1 weeks;
  uint256 public override startTime;

  ITokenBonding public tokenBonding;
  IFarming public farming;

  mapping(uint256 => address) public tokenByPid;
  uint256[] public approvedPids;

  IERC20Upgradeable public rewardToken;

  event VotedForIncentives(
    address indexed voter,
    uint256[] pids,
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
    require(address(farming) == address(0), "farming address can be set only once");
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
    @return _totalVotes Total number of votes this week for all pools
    @return _voteData Dynamic array of (token address, votes for token)
  */
  function getVotes(uint256 _week)
    external
    view
    virtual
    returns (uint256 _totalVotes, Vote[] memory _voteData)
  {
    _voteData = new Vote[](approvedPids.length);
    for (uint256 i = 0; i < _voteData.length; i++) {
      address token = tokenByPid[i];
      _voteData[i] = Vote({ token: token, votes: pidVotes[i][_week] });
    }
    return (totalVotes[_week], _voteData);
  }

  /**
    @notice Get data on current votes `_user` has made in the active week
    @return _totalVotes Total number of votes from `_user` this week for all pools
    @return _voteData Dynamic array of (token address, votes for token)
  */
  function getUserVotes(address _user, uint256 _week)
    external
    view
    virtual
    returns (uint256 _totalVotes, Vote[] memory _voteData)
  {
    _voteData = new Vote[](approvedPids.length);
    for (uint256 i = 0; i < _voteData.length; i++) {
      address token = tokenByPid[i];
      _voteData[i] = Vote({ token: token, votes: userPidVotes[_user][i][_week] });
    }
    return (userVotes[_user][_week], _voteData);
  }

  /**
    @notice Get the amount of unused votes for for the current week being voted on
    @param _user Address to query
    @return uint Amount of unused votes
  */
  function availableVotes(address _user) external view virtual returns (uint256) {
    if (_user == owner()) {
      return type(uint256).max;
    }
    return 0;
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
  function vote(uint256[] calldata _pids, uint256[] calldata _votes) external virtual onlyOwner {
    require(_pids.length == _votes.length, "Input length mismatch");

    // update rewards per second, if required
    uint256 week = getWeek();

    // update accounting for this week's votes
    uint256 usedVotes = userVotes[msg.sender][week];
    for (uint256 i = 0; i < _pids.length; i++) {
      uint256 pid = _pids[i];
      uint256 amount = _votes[i];
      require(tokenByPid[pid] != address(0), "Not approved for incentives");
      pidVotes[pid][week] += amount;
      totalVotes[week] += amount;
      userPidVotes[msg.sender][pid][week] += amount;
      usedVotes += amount;
    }

    userVotes[msg.sender][week] = usedVotes;

    emit VotedForIncentives(msg.sender, _pids, _votes, usedVotes, type(uint256).max);
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

    return (totalRewards[_week] * votes) / (totalVotes[_week] * WEEK);
  }

  /**
    @notice Modify the approval for a token to receive incentives.
    @dev This can only be called on tokens that were already voted in, it cannot
    be used to bypass the voting process. It is intended to block emissions in
    case of an exploit or act of maliciousness from a token within an approved pool.
  */
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

  function addReward(uint256 week, uint256 amount) external virtual {
    uint256 currentWeek = getWeek();
    require(currentWeek <= week, "You can add rewards starting from the current week");
    rewardToken.transferFrom(msg.sender, address(this), amount);
    uint256 totalAmount = totalRewards[week] + amount;
    totalRewards[week] = totalAmount;
    emit RewardChanged(msg.sender, week, int256(amount), totalAmount);
  }

  function removeReward(uint256 week, uint256 amount) external virtual onlyOwner {
    uint256 currentWeek = getWeek();
    require(currentWeek < week, "You can remove rewards starting from the next week");
    uint256 totalAmount = totalRewards[week] - amount;
    totalRewards[week] = totalAmount;
    rewardToken.transfer(msg.sender, amount);
    emit RewardChanged(msg.sender, week, -int256(amount), totalAmount);
  }
}
