import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { ethers, upgrades } from "hardhat";
import { BigNumber } from "ethers";
import { solidity } from "ethereum-waffle";

import {
  advanceTime,
  daysToSeconds,
  getNextTimestampDivisibleBy,
  setTimestamp,
} from "../helpers/utils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { FakeERC20, Farming, IncentiveVoting } from "../typechain-types";
import NetworkSnapshotter from "../helpers/NetworkSnapshotter";

const { AddressZero, MaxUint256 } = ethers.constants;

chai.use(solidity);
chai.use(chaiAsPromised);

const week = daysToSeconds(BigNumber.from(7));
const ten = BigNumber.from(10);
const tenPow18 = ten.pow(18);

describe("IncentiveVoting", () => {
  let deployer: SignerWithAddress;
  let signer1: SignerWithAddress;
  let rewardToken: FakeERC20;
  let incentiveVoting: IncentiveVoting;
  let farming: Farming;
  let firstFarmTkn: FakeERC20;
  let secondFarmTkn: FakeERC20;
  let startTime: BigNumber;

  const networkSnapshotter = new NetworkSnapshotter();

  const setStartContractTimestamp = async () => {
    // set right time
    await setTimestamp(startTime.toNumber() + 1);
  };

  before("setup Incentive Voting", async () => {
    [deployer, signer1] = await ethers.getSigners();
    const IncentiveVoting = await ethers.getContractFactory("IncentiveVoting");
    const Farming = await ethers.getContractFactory("Farming");
    const FakeToken = await ethers.getContractFactory("FakeERC20");

    startTime = await getNextTimestampDivisibleBy(100);

    // deploy contracts
    incentiveVoting = (await upgrades.deployProxy(IncentiveVoting, [startTime])) as IncentiveVoting;
    await incentiveVoting.deployed();
    // start contract
    await setStartContractTimestamp();

    rewardToken = await FakeToken.connect(deployer).deploy("Token", "Reward");

    await rewardToken.deployed();
    farming = (await upgrades.deployProxy(Farming, [
      rewardToken.address,
      incentiveVoting.address,
    ])) as Farming;
    await farming.deployed();
    firstFarmTkn = await FakeToken.connect(deployer).deploy("First Farming", "First");
    await firstFarmTkn.deployed();
    secondFarmTkn = await FakeToken.connect(deployer).deploy("Second Farming", "Second");
    await secondFarmTkn.deployed();

    const mintAmount = BigNumber.from("1000000").mul(tenPow18);
    // mint reward tokens
    await rewardToken.mint(deployer.address, mintAmount);
    await rewardToken.mint(signer1.address, mintAmount);
    // approve rewards
    await rewardToken.connect(deployer).approve(incentiveVoting.address, MaxUint256);
    await rewardToken.connect(signer1).approve(incentiveVoting.address, MaxUint256);

    // set Farming contract
    await incentiveVoting.setFarming(
      farming.address,
      [firstFarmTkn.address, secondFarmTkn.address],
      [AddressZero, AddressZero]
    );

    await networkSnapshotter.firstSnapshot();
  });

  afterEach("revert", async () => await networkSnapshotter.revert());

  describe("# initial checks", () => {
    it("initial contract addresses", async () => {
      expect(await incentiveVoting.farming()).to.be.equal(farming.address);
      expect(await incentiveVoting.rewardToken()).to.be.equal(rewardToken.address);
      expect(await incentiveVoting.tokenBonding()).to.be.equal(AddressZero);
    });

    it("startTime is ok", async () => {
      expect(await incentiveVoting.startTime()).to.be.equal(startTime);
    });

    it("approvedTokens work is ok", async () => {
      expect(await incentiveVoting.approvedPoolsLength()).to.be.equal(2);
      expect(await incentiveVoting.tokenByPid(0)).to.be.equal(firstFarmTkn.address);
      expect(await incentiveVoting.tokenByPid(1)).to.be.equal(secondFarmTkn.address);
      expect(await incentiveVoting.tokenByPid(2)).to.be.equal(AddressZero);
    });

    it("getWeek is ok", async () => {
      expect(await incentiveVoting.getWeek()).to.be.equal(0);
      await advanceTime(week.toNumber());
      expect(await incentiveVoting.getWeek()).to.be.equal(1);
    });

    it("cannot set farming second time", async () => {
      await expect(
        incentiveVoting.setFarming(
          farming.address,
          [firstFarmTkn.address, secondFarmTkn.address],
          [AddressZero, AddressZero]
        )
      ).to.eventually.be.rejectedWith(Error, "farming address can be set only once");
    });
  });

  describe("# addTokenApproval", () => {
    it("function can call only owner", async () => {
      await expect(
        incentiveVoting.connect(signer1).addTokenApproval(AddressZero, AddressZero, false)
      ).to.eventually.be.rejectedWith("Ownable: caller is not the owner");
    });
  });

  describe("# adding/removing reward tokens to contract", () => {
    it("cannot add reward for previous week", async () => {
      await advanceTime(week.toNumber());

      await expect(incentiveVoting.addReward(0, 0)).to.eventually.be.rejectedWith(
        Error,
        "You can add rewards starting from the current week"
      );
    });

    it("addReward works as expected", async () => {
      const currentWeek = await incentiveVoting.getWeek();
      const nextWeek = currentWeek.add(1);

      const currentWeekAmount = BigNumber.from("1000").mul(tenPow18);
      const nextWeekAmount = BigNumber.from("2000").mul(tenPow18);

      const currentWeekTotalRewordsBefore = await incentiveVoting.totalRewards(currentWeek);
      const nextWeekTotalRewordsBefore = await incentiveVoting.totalRewards(nextWeek);

      await expect(incentiveVoting.connect(signer1).addReward(nextWeek, nextWeekAmount))
        .to.emit(rewardToken, "Transfer")
        .and.to.emit(incentiveVoting, "RewardChanged")
        .withArgs(
          signer1.address,
          nextWeek,
          nextWeekAmount,
          nextWeekTotalRewordsBefore.add(nextWeekAmount)
        );
      await expect(incentiveVoting.connect(signer1).addReward(currentWeek, currentWeekAmount))
        .to.emit(rewardToken, "Transfer")
        .and.to.emit(incentiveVoting, "RewardChanged")
        .withArgs(
          signer1.address,
          currentWeek,
          currentWeekAmount,
          currentWeekTotalRewordsBefore.add(currentWeekAmount)
        );

      expect(await incentiveVoting.totalRewards(currentWeek)).to.be.equal(
        currentWeekTotalRewordsBefore.add(currentWeekAmount)
      );
      expect(await incentiveVoting.totalRewards(nextWeek)).to.be.equal(
        nextWeekTotalRewordsBefore.add(nextWeekAmount)
      );

      const currentWeekPlusAmount = BigNumber.from("500").mul(tenPow18);
      await expect(incentiveVoting.connect(deployer).addReward(currentWeek, currentWeekPlusAmount))
        .to.emit(rewardToken, "Transfer")
        .and.to.emit(incentiveVoting, "RewardChanged")
        .withArgs(
          deployer.address,
          currentWeek,
          currentWeekPlusAmount,
          currentWeekTotalRewordsBefore.add(currentWeekAmount).add(currentWeekPlusAmount)
        );

      expect(await incentiveVoting.totalRewards(currentWeek)).to.be.equal(
        currentWeekTotalRewordsBefore.add(currentWeekAmount).add(currentWeekPlusAmount)
      );
    });

    it("removeReward can call only owner", async () => {
      await expect(
        incentiveVoting.connect(signer1).removeReward(0, 0)
      ).to.eventually.be.rejectedWith(Error, "Ownable: caller is not the owner");
    });

    it("removeReward can be called starting from the next week", async () => {
      const currentWeek = await incentiveVoting.getWeek();
      await expect(
        incentiveVoting.connect(deployer).removeReward(currentWeek, 0)
      ).to.eventually.be.rejectedWith(Error, "You can remove rewards starting from the next week");
    });

    it("cannot remove rewards if amount is more than reward for that week", async () => {
      const arithmeticErrorCode = "0x11";

      const currentWeek = await incentiveVoting.getWeek();
      const nextWeek = currentWeek.add(1);

      await expect(
        incentiveVoting.connect(deployer).removeReward(nextWeek, 1)
      ).to.eventually.be.rejectedWith(Error, arithmeticErrorCode);
    });

    it("removeReward works as expected", async () => {
      const currentWeek = await incentiveVoting.getWeek();
      const nextWeek = currentWeek.add(1);

      const amount = BigNumber.from("1000").mul(tenPow18);

      await incentiveVoting.connect(deployer).addReward(nextWeek, amount);

      const nextWeekTotalRewordsBefore = await incentiveVoting.totalRewards(nextWeek);

      await expect(incentiveVoting.connect(deployer).removeReward(nextWeek, amount))
        .to.emit(rewardToken, "Transfer")
        .and.to.emit(incentiveVoting, "RewardChanged")
        .withArgs(
          deployer.address,
          nextWeek,
          amount.mul("-1"),
          nextWeekTotalRewordsBefore.sub(amount)
        );

      expect(await incentiveVoting.totalRewards(nextWeek)).to.be.equal(
        nextWeekTotalRewordsBefore.sub(amount)
      );
    });
  });

  describe("# voting", () => {
    it("should fail if tokens length is not equal to votes length", async () => {
      await expect(incentiveVoting.connect(deployer).vote([0], [])).to.eventually.be.rejectedWith(
        Error,
        "Input length mismatch"
      );
    });

    it("should fail if pid does not exist", async () => {
      await expect(incentiveVoting.connect(deployer).vote([2], [0])).to.eventually.be.rejectedWith(
        Error,
        "Not approved for incentives"
      );
    });

    it("voting works as expected", async () => {
      const currentWeek = await incentiveVoting.getWeek();
      const voteAmount = BigNumber.from("10000");

      const userVotesBefore = await incentiveVoting.userVotes(deployer.address, currentWeek);
      const tokenVotesBefore = await incentiveVoting.pidVotes(0, currentWeek);
      const totalVotesBefore = await incentiveVoting.totalVotes(currentWeek);
      const userTokenVotesBefore = await incentiveVoting.userPidVotes(
        deployer.address,
        0,
        currentWeek
      );

      await expect(incentiveVoting.connect(deployer).vote([0], [voteAmount])).to.emit(
        incentiveVoting,
        "VotedForIncentives"
      );

      expect(await incentiveVoting.userVotes(deployer.address, currentWeek)).to.be.equal(
        userVotesBefore.add(voteAmount)
      );
      expect(await incentiveVoting.pidVotes(0, currentWeek)).to.be.equal(
        tokenVotesBefore.add(voteAmount)
      );
      expect(await incentiveVoting.totalVotes(currentWeek)).to.be.equal(
        totalVotesBefore.add(voteAmount)
      );
      expect(await incentiveVoting.userPidVotes(deployer.address, 0, currentWeek)).to.be.equal(
        userTokenVotesBefore.add(voteAmount)
      );
    });

    it("voting batch works as expected", async () => {
      const currentWeek = await incentiveVoting.getWeek();
      const firstVoteAmount = BigNumber.from("10000");
      const secondVoteAmount = BigNumber.from("20000");

      const userVotesBefore = await incentiveVoting.userVotes(deployer.address, currentWeek);
      const firstTknVotesBefore = await incentiveVoting.pidVotes(0, currentWeek);
      const secondTknVotesBefore = await incentiveVoting.pidVotes(0, currentWeek);
      const totalVotesBefore = await incentiveVoting.totalVotes(currentWeek);
      const userFirstTknVotesBefore = await incentiveVoting.userPidVotes(
        deployer.address,
        0,
        currentWeek
      );
      const userSecondTknVotesBefore = await incentiveVoting.userPidVotes(
        deployer.address,
        0,
        currentWeek
      );

      const tokens = [0, 1];
      const votes = [firstVoteAmount, secondVoteAmount];
      const votesSum = votes.reduce((prev, curr) => prev.add(curr), BigNumber.from(0));
      await expect(incentiveVoting.connect(deployer).vote(tokens, votes)).to.emit(
        incentiveVoting,
        "VotedForIncentives"
      );

      expect(await incentiveVoting.userVotes(deployer.address, currentWeek)).to.be.equal(
        userVotesBefore.add(votesSum)
      );
      expect(await incentiveVoting.pidVotes(0, currentWeek)).to.be.equal(
        firstTknVotesBefore.add(firstVoteAmount)
      );
      expect(await incentiveVoting.pidVotes(1, currentWeek)).to.be.equal(
        secondTknVotesBefore.add(secondVoteAmount)
      );
      expect(await incentiveVoting.totalVotes(currentWeek)).to.be.equal(
        totalVotesBefore.add(votesSum)
      );
      expect(await incentiveVoting.userPidVotes(deployer.address, 0, currentWeek)).to.be.equal(
        userFirstTknVotesBefore.add(firstVoteAmount)
      );
      expect(await incentiveVoting.userPidVotes(deployer.address, 1, currentWeek)).to.be.equal(
        userSecondTknVotesBefore.add(secondVoteAmount)
      );
    });
  });

  describe("# getRewardsPerSecond", async () => {
    it("if week equals to zero than reward per second is 0", async () => {
      expect(await incentiveVoting.getRewardsPerSecond(0, 0)).to.be.equal(0);
    });

    it("if there is no vote for that token than reward per second is 0", async () => {
      expect(await incentiveVoting.getRewardsPerSecond(0, 1)).to.be.equal(0);
    });

    it("returns 0 if rewards for that week is 0", async () => {
      const firstVoteAmount = BigNumber.from("10000");
      const secondVoteAmount = BigNumber.from("20000");
      const tokens = [0, 1];
      const votes = [firstVoteAmount, secondVoteAmount];
      await incentiveVoting.connect(deployer).vote(tokens, votes);

      expect(await incentiveVoting.getRewardsPerSecond(0, 1)).to.be.equal(0);
    });

    it("function works as expected", async () => {
      const currentWeek = await incentiveVoting.getWeek();
      const rewardAmount = BigNumber.from("1000").mul(tenPow18);
      await incentiveVoting.connect(deployer).addReward(currentWeek, rewardAmount);

      const firstVoteAmount = BigNumber.from("10000");
      const secondVoteAmount = BigNumber.from("20000");
      const tokens = [0, 1];
      const votes = [firstVoteAmount, secondVoteAmount];
      const votesSum = votes.reduce((prev, curr) => prev.add(curr), BigNumber.from(0));
      await incentiveVoting.connect(deployer).vote(tokens, votes);

      const expectedRewardsPerSecond = rewardAmount.mul(firstVoteAmount).div(votesSum.mul(week));

      expect(await incentiveVoting.getRewardsPerSecond(0, currentWeek.add(1))).to.be.equal(
        expectedRewardsPerSecond
      );
    });
  });

  describe("getter functions", () => {
    it("getVotes, getUserVotes, availableVotes work correctly", async () => {
      // get week
      const currentWeek = await incentiveVoting.getWeek();
      // vote
      const firstVoteAmount = BigNumber.from("7000");
      const secondVoteAmount = BigNumber.from("5000");
      const tokens = [0, 1];
      const votes = [firstVoteAmount, secondVoteAmount];
      const votesSum = votes.reduce((prev, curr) => prev.add(curr), BigNumber.from(0));
      await incentiveVoting.connect(deployer).vote(tokens, votes);

      // getVotes
      const weekVotes = await incentiveVoting.getVotes(currentWeek);
      expect(weekVotes._totalVotes).to.be.equal(votesSum);
      expect(weekVotes._voteData[0].token).to.be.equal(firstFarmTkn.address);
      expect(weekVotes._voteData[0].votes).to.be.equal(firstVoteAmount);
      expect(weekVotes._voteData[1].token).to.be.equal(secondFarmTkn.address);
      expect(weekVotes._voteData[1].votes).to.be.equal(secondVoteAmount);

      // getUserVotes
      const userWeekVotes = await incentiveVoting.getUserVotes(deployer.address, currentWeek);
      expect(userWeekVotes._totalVotes).to.be.equal(votesSum);
      expect(userWeekVotes._voteData[0].token).to.be.equal(firstFarmTkn.address);
      expect(userWeekVotes._voteData[0].votes).to.be.equal(firstVoteAmount);
      expect(userWeekVotes._voteData[1].token).to.be.equal(secondFarmTkn.address);
      expect(userWeekVotes._voteData[1].votes).to.be.equal(secondVoteAmount);
    });
  });
});
