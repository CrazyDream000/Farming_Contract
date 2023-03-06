// import chai, { assert, expect } from "chai";
// import chaiAsPromised from "chai-as-promised";
// import { ethers, upgrades } from "hardhat";
// import { BigNumber } from "ethers";
// import { solidity } from "ethereum-waffle";

// import {
//   advanceTime,
//   daysToSeconds,
//   getNextTimestampDivisibleBy,
//   getTimestamp,
//   setTimestamp,
// } from "../../helpers/utils";
// import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
// import { FakeERC20, Farming, IncentiveVoting, TokenBonding } from "../../typechain-types";
// import NetworkSnapshotter from "../../helpers/NetworkSnapshotter";

// const { AddressZero, MaxUint256 } = ethers.constants;

// chai.use(solidity);
// chai.use(chaiAsPromised);

// const week = daysToSeconds(BigNumber.from(7));
// const ten = BigNumber.from(10);
// const tenPow18 = ten.pow(18);

// describe("IncentiveVoting", () => {
//   let deployer: SignerWithAddress;
//   let signer1: SignerWithAddress;
//   let signer2: SignerWithAddress;
//   let signer3: SignerWithAddress;
//   let helio: FakeERC20;
//   let helioLp: FakeERC20;
//   let rewardToken: FakeERC20;
//   let tokenBonding: TokenBonding;
//   let incentiveVoting: IncentiveVoting;
//   let farming: Farming;
//   let firstFarmTkn: FakeERC20;
//   let secondFarmTkn: FakeERC20;
//   let startTime: BigNumber;

//   let helioCoefficient: BigNumber;
//   let helioLpCoefficient: BigNumber;

//   const networkSnapshotter = new NetworkSnapshotter();

//   const setStartContractTimestamp = async () => {
//     // set right time
//     await setTimestamp(startTime.toNumber() + 1);
//   };

//   before("setup token bonding", async () => {
//     // setup
//     [deployer, signer1, signer2, signer3] = await ethers.getSigners();

//     const FakeToken = await ethers.getContractFactory("FakeERC20");
//     const TokenBonding = await ethers.getContractFactory("TokenBonding");

//     helio = await FakeToken.connect(deployer).deploy("Helio Token", "Helio");
//     await helio.deployed();
//     helioLp = await FakeToken.connect(deployer).deploy("Helio LP Token", "HelioLP");
//     await helioLp.deployed();

//     helioCoefficient = tenPow18.mul(1);
//     helioLpCoefficient = tenPow18.mul(2);

//     startTime = await getNextTimestampDivisibleBy(week.toNumber());

//     const tokens = [helio.address, helioLp.address];
//     const coefficients = [helioCoefficient, helioLpCoefficient];
//     tokenBonding = (await upgrades.deployProxy(TokenBonding, [
//       startTime,
//       tokens,
//       coefficients,
//     ])) as TokenBonding;
//     await tokenBonding.deployed();

//     // mint tokens
//     const amount = BigNumber.from("100000").mul(tenPow18);

//     await helio.mint(signer1.address, amount);
//     await helioLp.mint(signer1.address, amount);
//     await helio.mint(signer2.address, amount);
//     await helioLp.mint(signer2.address, amount);

//     const bondingAmount = BigNumber.from("10000").mul(tenPow18);

//     // start contract
//     await setStartContractTimestamp();

//     // approve
//     await helio.connect(signer1).approve(tokenBonding.address, bondingAmount);
//     await helio.connect(signer2).approve(tokenBonding.address, bondingAmount);
//     await helioLp.connect(signer1).approve(tokenBonding.address, bondingAmount);
//     await helioLp.connect(signer2).approve(tokenBonding.address, bondingAmount);

//     // bond
//     await tokenBonding.connect(signer1).bond(helio.address, bondingAmount);
//     await tokenBonding.connect(signer2).bond(helio.address, bondingAmount);
//     await tokenBonding.connect(signer1).bond(helioLp.address, bondingAmount);
//     await tokenBonding.connect(signer2).bond(helioLp.address, bondingAmount);
//   });

//   before("setup Incentive Voting", async () => {
//     const IncentiveVoting = await ethers.getContractFactory("IncentiveVoting");
//     const Farming = await ethers.getContractFactory("Farming");
//     const FakeToken = await ethers.getContractFactory("FakeERC20");

//     // deploy contracts
//     incentiveVoting = (await upgrades.deployProxy(IncentiveVoting, [
//       tokenBonding.address,
//     ])) as IncentiveVoting;
//     await incentiveVoting.deployed();
//     rewardToken = await FakeToken.connect(deployer).deploy("Reward Token", "Reward");
//     await rewardToken.deployed();
//     farming = (await upgrades.deployProxy(Farming, [
//       rewardToken.address,
//       incentiveVoting.address,
//     ])) as Farming;
//     await farming.deployed();
//     firstFarmTkn = await FakeToken.connect(deployer).deploy("First Farming", "First");
//     await firstFarmTkn.deployed();
//     secondFarmTkn = await FakeToken.connect(deployer).deploy("Second Farming", "Second");
//     await secondFarmTkn.deployed();

//     const mintAmount = BigNumber.from("1000000").mul(tenPow18);
//     // mint reward tokens
//     await rewardToken.mint(deployer.address, mintAmount);
//     await rewardToken.mint(signer1.address, mintAmount);
//     // approve rewards
//     await rewardToken.connect(deployer).approve(incentiveVoting.address, MaxUint256);
//     await rewardToken.connect(signer1).approve(incentiveVoting.address, MaxUint256);

//     // set Farming contract
//     await incentiveVoting.setFarming(
//       farming.address,
//       [firstFarmTkn.address, secondFarmTkn.address],
//       [AddressZero, AddressZero]
//     );

//     await networkSnapshotter.firstSnapshot();
//   });

//   afterEach("revert", async () => await networkSnapshotter.revert());

//   describe("# initial checks", () => {
//     it("initial contract addresses", async () => {
//       expect(await incentiveVoting.farming()).to.be.equal(farming.address);
//       expect(await incentiveVoting.rewardToken()).to.be.equal(rewardToken.address);
//       expect(await incentiveVoting.tokenBonding()).to.be.equal(tokenBonding.address);
//     });

//     it("startTime is ok", async () => {
//       expect(await incentiveVoting.startTime()).to.be.equal(await tokenBonding.startTime());
//     });

//     it("approvedTokens work is ok", async () => {
//       expect(await incentiveVoting.approvedPoolsLength()).to.be.equal(2);
//       expect(await incentiveVoting.tokenByPid(0)).to.be.equal(firstFarmTkn.address);
//       expect(await incentiveVoting.tokenByPid(1)).to.be.equal(secondFarmTkn.address);
//       expect(await incentiveVoting.tokenByPid(2)).to.be.equal(AddressZero);
//     });

//     it("getWeek is ok", async () => {
//       expect(await incentiveVoting.getWeek()).to.be.equal(0);
//       await advanceTime(week.toNumber());
//       expect(await incentiveVoting.getWeek()).to.be.equal(1);

//       // test the case where startTime is more than block timestamp
//       const TokenBonding = await ethers.getContractFactory("TokenBonding");
//       const IncentiveVoting = await ethers.getContractFactory("IncentiveVoting");
//       const newStartTime = await getNextTimestampDivisibleBy(week.toNumber());
//       const newTokenBonding = (await upgrades.deployProxy(TokenBonding, [
//         newStartTime,
//         [],
//         [],
//       ])) as TokenBonding;
//       await newTokenBonding.deployed();
//       const newIncentiveVoting = (await upgrades.deployProxy(IncentiveVoting, [
//         newTokenBonding.address,
//       ])) as IncentiveVoting;
//       await newIncentiveVoting.deployed();

//       assert.isTrue(newStartTime.gt(await getTimestamp()));

//       expect(await newIncentiveVoting.getWeek()).to.be.equal(0);
//     });

//     it("cannot set farming if strategies length is not equal to tokens length", async () => {
//       const IncentiveVoting = await ethers.getContractFactory("IncentiveVoting");

//       // deploy contracts
//       const newIncentiveVoting = (await upgrades.deployProxy(IncentiveVoting, [
//         tokenBonding.address,
//       ])) as IncentiveVoting;
//       await expect(
//         newIncentiveVoting.setFarming(
//           farming.address,
//           [firstFarmTkn.address, secondFarmTkn.address],
//           [AddressZero]
//         )
//       ).to.eventually.be.rejectedWith(Error, "lengths are not equal");
//     });

//     it("cannot set farming second time", async () => {
//       await expect(
//         incentiveVoting.setFarming(
//           farming.address,
//           [firstFarmTkn.address, secondFarmTkn.address],
//           [AddressZero, AddressZero]
//         )
//       ).to.eventually.be.rejectedWith(Error, "farming address can be set only once");
//     });
//   });

//   describe("# addTokenApproval", () => {
//     it("function can call only owner", async () => {
//       await expect(
//         incentiveVoting.connect(signer3).addTokenApproval(AddressZero, AddressZero, false)
//       ).to.eventually.be.rejectedWith("Ownable: caller is not the owner");
//     });
//   });

//   describe("# adding/removing reward tokens to contract", () => {
//     it("cannot add reward for previous week", async () => {
//       await advanceTime(week.toNumber());

//       await expect(incentiveVoting.addReward(0, 0)).to.eventually.be.rejectedWith(
//         Error,
//         "You can add rewards starting from the current week"
//       );
//     });

//     it("addReward works as expected", async () => {
//       const currentWeek = await incentiveVoting.getWeek();
//       const nextWeek = currentWeek.add(1);

//       const currentWeekAmount = BigNumber.from("1000").mul(tenPow18);
//       const nextWeekAmount = BigNumber.from("2000").mul(tenPow18);

//       const currentWeekTotalRewordsBefore = await incentiveVoting.totalRewards(currentWeek);
//       const nextWeekTotalRewordsBefore = await incentiveVoting.totalRewards(nextWeek);

//       await expect(incentiveVoting.connect(signer1).addReward(nextWeek, nextWeekAmount))
//         .to.emit(rewardToken, "Transfer")
//         .and.to.emit(incentiveVoting, "RewardChanged")
//         .withArgs(
//           signer1.address,
//           nextWeek,
//           nextWeekAmount,
//           nextWeekTotalRewordsBefore.add(nextWeekAmount)
//         );
//       await expect(incentiveVoting.connect(signer1).addReward(currentWeek, currentWeekAmount))
//         .to.emit(rewardToken, "Transfer")
//         .and.to.emit(incentiveVoting, "RewardChanged")
//         .withArgs(
//           signer1.address,
//           currentWeek,
//           currentWeekAmount,
//           currentWeekTotalRewordsBefore.add(currentWeekAmount)
//         );

//       expect(await incentiveVoting.totalRewards(currentWeek)).to.be.equal(
//         currentWeekTotalRewordsBefore.add(currentWeekAmount)
//       );
//       expect(await incentiveVoting.totalRewards(nextWeek)).to.be.equal(
//         nextWeekTotalRewordsBefore.add(nextWeekAmount)
//       );

//       const currentWeekPlusAmount = BigNumber.from("500").mul(tenPow18);
//       await expect(incentiveVoting.connect(deployer).addReward(currentWeek, currentWeekPlusAmount))
//         .to.emit(rewardToken, "Transfer")
//         .and.to.emit(incentiveVoting, "RewardChanged")
//         .withArgs(
//           deployer.address,
//           currentWeek,
//           currentWeekPlusAmount,
//           currentWeekTotalRewordsBefore.add(currentWeekAmount).add(currentWeekPlusAmount)
//         );

//       expect(await incentiveVoting.totalRewards(currentWeek)).to.be.equal(
//         currentWeekTotalRewordsBefore.add(currentWeekAmount).add(currentWeekPlusAmount)
//       );
//     });

//     it("removeReward can call only owner", async () => {
//       await expect(
//         incentiveVoting.connect(signer1).removeReward(0, 0)
//       ).to.eventually.be.rejectedWith(Error, "Ownable: caller is not the owner");
//     });

//     it("removeReward can be called starting from the next week", async () => {
//       const currentWeek = await incentiveVoting.getWeek();
//       await expect(
//         incentiveVoting.connect(deployer).removeReward(currentWeek, 0)
//       ).to.eventually.be.rejectedWith(Error, "You can remove rewards starting from the next week");
//     });

//     it("cannot remove rewards if amount is more than reward for that week", async () => {
//       const arithmeticErrorCode = "0x11";

//       const currentWeek = await incentiveVoting.getWeek();
//       const nextWeek = currentWeek.add(1);

//       await expect(
//         incentiveVoting.connect(deployer).removeReward(nextWeek, 1)
//       ).to.eventually.be.rejectedWith(Error, arithmeticErrorCode);
//     });

//     it("removeReward works as expected", async () => {
//       const currentWeek = await incentiveVoting.getWeek();
//       const nextWeek = currentWeek.add(1);

//       const amount = BigNumber.from("1000").mul(tenPow18);

//       await incentiveVoting.connect(deployer).addReward(nextWeek, amount);

//       const nextWeekTotalRewordsBefore = await incentiveVoting.totalRewards(nextWeek);

//       await expect(incentiveVoting.connect(deployer).removeReward(nextWeek, amount))
//         .to.emit(rewardToken, "Transfer")
//         .and.to.emit(incentiveVoting, "RewardChanged")
//         .withArgs(
//           deployer.address,
//           nextWeek,
//           amount.mul("-1"),
//           nextWeekTotalRewordsBefore.sub(amount)
//         );

//       expect(await incentiveVoting.totalRewards(nextWeek)).to.be.equal(
//         nextWeekTotalRewordsBefore.sub(amount)
//       );
//     });
//   });

//   describe("# voting", () => {
//     it("should fail if tokens length is not equal to votes length", async () => {
//       await expect(incentiveVoting.connect(signer1).vote([0], [])).to.eventually.be.rejectedWith(
//         Error,
//         "Input length mismatch"
//       );
//     });

//     it("should fail if pid does not exist", async () => {
//       await expect(incentiveVoting.connect(signer1).vote([2], [0])).to.eventually.be.rejectedWith(
//         Error,
//         "Not approved for incentives"
//       );
//     });

//     it("should fail when trying to vote more than the user have", async () => {
//       const voteAmount = BigNumber.from("100000");
//       await expect(
//         incentiveVoting.connect(signer1).vote([0], [voteAmount])
//       ).to.eventually.be.rejectedWith(Error, "Available votes exceeded");
//     });

//     it("voting works as expected", async () => {
//       const currentWeek = await incentiveVoting.getWeek();
//       const voteAmount = BigNumber.from("10000");

//       const userWeightBefore = await tokenBonding.userWeight(signer1.address);
//       const userVotesBefore = await incentiveVoting.userVotes(signer1.address, currentWeek);
//       const tokenVotesBefore = await incentiveVoting.pidVotes(0, currentWeek);
//       const totalVotesBefore = await incentiveVoting.totalVotes(currentWeek);
//       const userTokenVotesBefore = await incentiveVoting.userPidVotes(
//         signer1.address,
//         0,
//         currentWeek
//       );

//       await expect(incentiveVoting.connect(signer1).vote([0], [voteAmount]))
//         .to.emit(incentiveVoting, "VotedForIncentives")
//         .withArgs(
//           signer1.address,
//           [0],
//           [voteAmount],
//           userVotesBefore.add(voteAmount),
//           userWeightBefore.div(tenPow18)
//         );

//       expect(await incentiveVoting.userVotes(signer1.address, currentWeek)).to.be.equal(
//         userVotesBefore.add(voteAmount)
//       );
//       expect(await incentiveVoting.pidVotes(0, currentWeek)).to.be.equal(
//         tokenVotesBefore.add(voteAmount)
//       );
//       expect(await incentiveVoting.totalVotes(currentWeek)).to.be.equal(
//         totalVotesBefore.add(voteAmount)
//       );
//       expect(await incentiveVoting.userPidVotes(signer1.address, 0, currentWeek)).to.be.equal(
//         userTokenVotesBefore.add(voteAmount)
//       );
//     });

//     it("voting batch works as expected", async () => {
//       const currentWeek = await incentiveVoting.getWeek();
//       const firstVoteAmount = BigNumber.from("10000");
//       const secondVoteAmount = BigNumber.from("20000");

//       const userWeightBefore = await tokenBonding.userWeight(signer1.address);
//       const userVotesBefore = await incentiveVoting.userVotes(signer1.address, currentWeek);
//       const firstTknVotesBefore = await incentiveVoting.pidVotes(0, currentWeek);
//       const secondTknVotesBefore = await incentiveVoting.pidVotes(0, currentWeek);
//       const totalVotesBefore = await incentiveVoting.totalVotes(currentWeek);
//       const userFirstTknVotesBefore = await incentiveVoting.userPidVotes(
//         signer1.address,
//         0,
//         currentWeek
//       );
//       const userSecondTknVotesBefore = await incentiveVoting.userPidVotes(
//         signer1.address,
//         0,
//         currentWeek
//       );

//       const tokens = [0, 1];
//       const votes = [firstVoteAmount, secondVoteAmount];
//       const votesSum = votes.reduce((prev, curr) => prev.add(curr), BigNumber.from(0));
//       await expect(incentiveVoting.connect(signer1).vote(tokens, votes))
//         .to.emit(incentiveVoting, "VotedForIncentives")
//         .withArgs(
//           signer1.address,
//           tokens,
//           votes,
//           userVotesBefore.add(votesSum),
//           userWeightBefore.div(tenPow18)
//         );

//       expect(await incentiveVoting.userVotes(signer1.address, currentWeek)).to.be.equal(
//         userVotesBefore.add(votesSum)
//       );
//       expect(await incentiveVoting.pidVotes(0, currentWeek)).to.be.equal(
//         firstTknVotesBefore.add(firstVoteAmount)
//       );
//       expect(await incentiveVoting.pidVotes(1, currentWeek)).to.be.equal(
//         secondTknVotesBefore.add(secondVoteAmount)
//       );
//       expect(await incentiveVoting.totalVotes(currentWeek)).to.be.equal(
//         totalVotesBefore.add(votesSum)
//       );
//       expect(await incentiveVoting.userPidVotes(signer1.address, 0, currentWeek)).to.be.equal(
//         userFirstTknVotesBefore.add(firstVoteAmount)
//       );
//       expect(await incentiveVoting.userPidVotes(signer1.address, 1, currentWeek)).to.be.equal(
//         userSecondTknVotesBefore.add(secondVoteAmount)
//       );
//     });
//   });

//   describe("# getRewardsPerSecond", async () => {
//     it("if week equals to zero than reward per second is 0", async () => {
//       expect(await incentiveVoting.getRewardsPerSecond(0, 0)).to.be.equal(0);
//     });

//     it("if there is no vote for that token than reward per second is 0", async () => {
//       expect(await incentiveVoting.getRewardsPerSecond(0, 1)).to.be.equal(0);
//     });

//     it("returns 0 if rewards for that week is 0", async () => {
//       const firstVoteAmount = BigNumber.from("10000");
//       const secondVoteAmount = BigNumber.from("20000");
//       const tokens = [0, 1];
//       const votes = [firstVoteAmount, secondVoteAmount];
//       await incentiveVoting.connect(signer1).vote(tokens, votes);

//       expect(await incentiveVoting.getRewardsPerSecond(0, 1)).to.be.equal(0);
//     });

//     it("function works as expected", async () => {
//       const currentWeek = await incentiveVoting.getWeek();
//       const rewardAmount = BigNumber.from("1000").mul(tenPow18);
//       await incentiveVoting.connect(deployer).addReward(currentWeek, rewardAmount);

//       const firstVoteAmount = BigNumber.from("10000");
//       const secondVoteAmount = BigNumber.from("20000");
//       const tokens = [0, 1];
//       const votes = [firstVoteAmount, secondVoteAmount];
//       const votesSum = votes.reduce((prev, curr) => prev.add(curr), BigNumber.from(0));
//       await incentiveVoting.connect(signer1).vote(tokens, votes);

//       const expectedRewardsPerSecond = rewardAmount.mul(firstVoteAmount).div(votesSum.mul(week));

//       expect(await incentiveVoting.getRewardsPerSecond(0, currentWeek.add(1))).to.be.equal(
//         expectedRewardsPerSecond
//       );
//     });
//   });

//   describe("getter functions", () => {
//     it("getVotes, getUserVotes, availableVotes work correctly", async () => {
//       // get week
//       const currentWeek = await incentiveVoting.getWeek();
//       // vote
//       const firstVoteAmount = BigNumber.from("7000");
//       const secondVoteAmount = BigNumber.from("5000");
//       const tokens = [0, 1];
//       const votes = [firstVoteAmount, secondVoteAmount];
//       const votesSum = votes.reduce((prev, curr) => prev.add(curr), BigNumber.from(0));
//       await incentiveVoting.connect(signer1).vote(tokens, votes);

//       // getVotes
//       const weekVotes = await incentiveVoting.getVotes(currentWeek);
//       expect(weekVotes._totalVotes).to.be.equal(votesSum);
//       expect(weekVotes._voteData[0].token).to.be.equal(firstFarmTkn.address);
//       expect(weekVotes._voteData[0].votes).to.be.equal(firstVoteAmount);
//       expect(weekVotes._voteData[1].token).to.be.equal(secondFarmTkn.address);
//       expect(weekVotes._voteData[1].votes).to.be.equal(secondVoteAmount);

//       // getUserVotes
//       const userWeekVotes = await incentiveVoting.getUserVotes(signer1.address, currentWeek);
//       expect(userWeekVotes._totalVotes).to.be.equal(votesSum);
//       expect(userWeekVotes._voteData[0].token).to.be.equal(firstFarmTkn.address);
//       expect(userWeekVotes._voteData[0].votes).to.be.equal(firstVoteAmount);
//       expect(userWeekVotes._voteData[1].token).to.be.equal(secondFarmTkn.address);
//       expect(userWeekVotes._voteData[1].votes).to.be.equal(secondVoteAmount);

//       // availableVotes
//       const userAvailableVotes = await incentiveVoting.availableVotes(signer1.address);
//       const userWeight = await tokenBonding.userWeight(signer1.address);
//       const totalVotes = userWeight.div(tenPow18);
//       const expectedAvailableVotes = totalVotes.sub(votesSum);
//       expect(userAvailableVotes).to.be.equal(expectedAvailableVotes);
//     });
//   });
// });
