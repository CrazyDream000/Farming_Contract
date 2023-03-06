# Using Contracts

## Token Bonding

- `bond(<token>, <amount>)` - bonds `<amount>` of `<token>` and gets "veHelio" for voting
- `bondBatch(<tokensArray>, <amountsArray>)` - bonds many tokens with one transaction
- `requestUnbond(<token>, <amount>)` - request `<amount>` of `<token>` to unbond(requester should wait 1 week)
- `requestUnbondBatch(<tokensArray>, <amountsArray>)` - request unbond for the batch of tokens
- `decreaseUnbondAmount(<token>, <amount>)` - decreases requested `<token>` by `<amount>`(if you want to decrease all amount(cancel request), you should give `type(uint256).max` as `<amount>`)
- `decreaseUnbondAmountBatch(<tokensArray>, <amountsArray>)` - decreases unbond amount for the batch of tokens
- `unbond(<token>)` - unbond requested `<token>` after time elapsed(1 week)
- `unbondBatch(<tokensArray>)` - unbond for the batch of tokens
- `addToken(<newToken>, <coefficient>)` - add new bonding `<token>` with `<coefficient>`(18 decimals)(only owner can call this function)

## Incentive Voting

- `vote(<pidsArray>, <votesArray>)` - vote for `pid`(pool id) for the `vote` amount
- `addTokenApproval(<token>, <strategy>, <withUpdate>)` - add new token with strategy to farming contract. `<withUpdate>` will update all pools information in farming contract.
- `addReward(<week>, <amount>)` - adds reward tokens for the `<week>` to contract address to incentivize farming contract users(`<week>` can start from current week)
- `removeReward(<week>, <amount>)` remove reward token from contract(started from the next `<week>`)

## Farming

- `poolLength()` - returns length of all pools
- `addPool(<token>, <strategy>, <withUpdate>)` - adds token to the farming contract with the corresponding strategy contract. `<withUpdate>` will update all pools information in contract. (can be called only by IncentiveVoting contract)
- `setClaimReceiver(<receiverAddress>)` - sets the reward token receiver address for the user(msg.sender)
- `setBlockThirdPartyActions(<block>)` - allow or block other accounts to claim reward for the user(msg.sender). `<block>` variable is boolean type.
- `stakedWantTokens(<pid>, <userAddress>)` - returns staked token(pool id token) amount for the user
- `massUpdatePools()` - updates all pools information
- `updatePool(pid)` - updates pool information by pid(pool id)
- `claimableReward(<userAddress>, <pids>)` - returns claimable reward amount for the user, for the poolIds array
- `deposit(<pid>, <wantAmount>, <claimRewards>)` - deposits for `pid`(pool id) for the `wantAmount` tokens. `claimRewards` is boolean variable and automatically will claim accumulated rewards if `true`
- `withdraw(<pid>, <wantAmount>, <claimRewards>)` - withdraws deposited `wantAmount` tokens from `pid`(pool id). `claimRewards` is boolean variable and automatically will claim accumulated rewards if `true`
- `withdrawAll(<pid>, <claimable>)` - withdraws all deposited tokens from the pid(pool id) `claimRewards` is boolean variable and automatically will claim accumulated rewards if `true`
- `claim(<user>, <pids>)` - Claim pending rewards for one or more pids for a user.(if blockThirdPartiActions is true, than only user can call this function)
- `inCaseTokensGetStuck(<token>, <amount>)` if some tokens were stuck in the contract(except rewardToken) owner can get them from contract address
- `emergencyWithdraw(<pid>)` - Withdraw without caring about rewards. EMERGENCY ONLY.

## Usage

- addresses are located to addresses folder

### Steps

1. mint fakeHelio/fakeHelioLp tokens to your address by `mintMe(amount)` function
2. bond fakeHelio/fakeHelioLp tokens to get veHelio for voting power, `TokenBonding.bond()`(for each fakeHelio you get 1 veHelio and for each fakeHelioLp you get 2 veHelio)
3. you can add rewards tokens(fakeHay) to the incentiveVoting contract by `addReward` function
4. you can vote for pid(pool id) with veHelio to increase rewards percent for the pool by calling `IncentiveVoting.vote()` function .(in our case pool is only one(with poolId 0))
5. you can deposit fakeHay(pool id 0) and accumulate rewards for the week by `Farming.deposit()`
6. you can withdraw tokens by calling `Farming.withdraw()`
7. you can claim rewards(fakeHay) by calling `Farming.claim()`
