// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import { ITokenBonding } from "../interfaces/ITokenBonding.sol";

import { IncentiveVoting } from "../IncentiveVoting.sol";

contract IncentiveVotingV2 is IncentiveVoting {
  /**
    @notice Get the amount of unused votes for for the current week being voted on
    @param _user Address to query
    @return uint Amount of unused votes
  */
  function availableVotes(address _user) external view virtual override returns (uint256) {
    uint256 week = getWeek();
    uint256 usedVotes = userVotes[_user][week];
    uint256 _totalVotes = tokenBonding.userWeight(_user) / 1e18;
    return _totalVotes - usedVotes;
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
  function vote(uint256[] calldata _pids, uint256[] calldata _votes) external virtual override {
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

    // make sure user has not exceeded available votes
    uint256 _totalVotes = tokenBonding.userWeight(msg.sender) / 1e18;
    require(usedVotes <= _totalVotes, "Available votes exceeded");
    userVotes[msg.sender][week] = usedVotes;

    emit VotedForIncentives(msg.sender, _pids, _votes, usedVotes, _totalVotes);
  }

  function setTokenBonding(address _tokenBonding) external {
    require(address(tokenBonding) == address(0), "already setted!");
    tokenBonding = ITokenBonding(_tokenBonding);
  }
}
