import chai, { assert, expect } from "chai";
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
import { FakeERC20, Farming, IncentiveVoting, StrategyMock } from "../typechain-types";
import NetworkSnapshotter from "../helpers/NetworkSnapshotter";

const { AddressZero, MaxUint256 } = ethers.constants;

chai.use(solidity);
chai.use(chaiAsPromised);

const week = daysToSeconds(BigNumber.from(7));
const ten = BigNumber.from(10);
const tenPow18 = ten.pow(18);

describe("Farming", () => {
  let deployer: SignerWithAddress;
  let signer1: SignerWithAddress;
  let signer2: SignerWithAddress;
  let signer3: SignerWithAddress;
  let rewardToken: FakeERC20;
  let incentiveVoting: IncentiveVoting;
  let farming: Farming;
  let firstFarmTkn: FakeERC20;
  let secondFarmTkn: FakeERC20;
  let firstStrategy: StrategyMock;
  let secondStrategy: StrategyMock;
  let startTime: BigNumber;

  const networkSnapshotter = new NetworkSnapshotter();

  const setStartContractTimestamp = async () => {
    // set right time
    await setTimestamp(startTime.toNumber() + 1);
  };

  before("setup Incentive Voting and Farming", async () => {
    [deployer, signer1, signer2, signer3] = await ethers.getSigners();
    const IncentiveVoting = await ethers.getContractFactory("IncentiveVoting");
    const Farming = await ethers.getContractFactory("Farming");
    const FakeToken = await ethers.getContractFactory("FakeERC20");
    const Strategy = await ethers.getContractFactory("StrategyMock");

    startTime = await getNextTimestampDivisibleBy(100);

    // deploy contracts
    incentiveVoting = (await upgrades.deployProxy(IncentiveVoting, [startTime])) as IncentiveVoting;
    await incentiveVoting.deployed();

    await setStartContractTimestamp();

    rewardToken = await FakeToken.connect(deployer).deploy("Reward Token", "Reward");
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
    firstStrategy = await Strategy.connect(deployer).deploy(firstFarmTkn.address, farming.address);
    await firstStrategy.deployed();
    secondStrategy = await Strategy.connect(deployer).deploy(
      secondFarmTkn.address,
      farming.address
    );
    await secondStrategy.deployed();

    const mintAmount = BigNumber.from("1000000").mul(tenPow18);
    // mint reward tokens
    await rewardToken.mint(deployer.address, mintAmount);
    // approve rewards
    await rewardToken.connect(deployer).approve(incentiveVoting.address, MaxUint256);

    // set Farming contract
    await incentiveVoting.setFarming(
      farming.address,
      [firstFarmTkn.address, secondFarmTkn.address],
      [firstStrategy.address, secondStrategy.address]
    );
    // add rewards to incentiveVoting contract
    await incentiveVoting.addReward(0, mintAmount.mul(3).div(10));
    await incentiveVoting.addReward(1, mintAmount.mul(7).div(10));

    // mint tokens
    await firstFarmTkn.mint(signer1.address, mintAmount);
    await firstFarmTkn.mint(signer2.address, mintAmount);
    // approve tokens to farming contract
    await firstFarmTkn.connect(signer1).approve(farming.address, MaxUint256);
    await firstFarmTkn.connect(signer2).approve(farming.address, MaxUint256);
    await secondFarmTkn.connect(signer1).approve(farming.address, MaxUint256);
    await secondFarmTkn.connect(signer2).approve(farming.address, MaxUint256);

    // vote
    const firstVoteAmount = BigNumber.from("10000");
    const secondVoteAmount = BigNumber.from("20000");
    const tokens = [0, 1];
    const votes = [firstVoteAmount, secondVoteAmount];
    await incentiveVoting.connect(deployer).vote(tokens, votes);

    // snapshot a network
    await networkSnapshotter.firstSnapshot();
  });

  afterEach("revert", async () => await networkSnapshotter.revert());

  describe("# initial checks", () => {
    it("startTime is ok", async () => {
      expect(await farming.startTime()).to.be.equal(await incentiveVoting.startTime());
    });

    it("pool is ok", async () => {
      // initial length
      expect(await farming.poolLength()).to.be.equal(2);

      const pool0Info = await farming.poolInfo(0);
      expect(pool0Info.token).to.be.equal(firstFarmTkn.address);
      expect(pool0Info.strategy).to.be.equal(firstStrategy.address);
      expect(pool0Info.rewardsPerSecond).to.be.equal(0);
      expect(pool0Info.accRewardPerShare).to.be.equal(0);

      const pool1Info = await farming.poolInfo(1);
      expect(pool1Info.token).to.be.equal(secondFarmTkn.address);
      expect(pool1Info.strategy).to.be.equal(secondStrategy.address);
      expect(pool1Info.rewardsPerSecond).to.be.equal(0);
      expect(pool1Info.accRewardPerShare).to.be.equal(0);

      // id cannot be more than length
      await expect(farming.poolInfo(2)).to.eventually.be.rejected;
    });

    it("initial contract addresses", async () => {
      expect(await farming.rewardToken()).to.be.equal(rewardToken.address);
      expect(await farming.incentiveVoting()).to.be.equal(incentiveVoting.address);
    });
  });

  describe("# addPool", () => {
    it("only incentiveVoting contract can call this function", async () => {
      await expect(farming.addPool(AddressZero, AddressZero, false)).to.eventually.be.rejectedWith(
        Error,
        "Sender not incentiveVoting"
      );
    });

    it("addPool works as expected", async () => {
      const FakeToken = await ethers.getContractFactory("FakeERC20");
      const Strategy = await ethers.getContractFactory("StrategyMock");

      const newToken = await FakeToken.deploy("New Token", "NTK");
      await newToken.deployed();
      const newStrat = await Strategy.deploy(newToken.address, farming.address);
      await newStrat.deployed();

      const poolLenBefore = await farming.poolLength();

      await incentiveVoting
        .connect(deployer)
        .addTokenApproval(newToken.address, newStrat.address, false);

      const poolLenAfter = await farming.poolLength();

      expect(poolLenAfter).to.be.equal(poolLenBefore.add(1));

      const addedPoolInfo = await farming.poolInfo(poolLenAfter.sub(1));
      expect(addedPoolInfo.token).to.be.equal(newToken.address);
      expect(addedPoolInfo.strategy).to.be.equal(newStrat.address);
    });

    it("addPool works as expected with massUpdatePool", async () => {
      const FakeToken = await ethers.getContractFactory("FakeERC20");
      const Strategy = await ethers.getContractFactory("StrategyMock");

      const newToken = await FakeToken.deploy("New Token", "NTK");
      await newToken.deployed();
      const newStrat = await Strategy.deploy(newToken.address, farming.address);
      await newStrat.deployed();

      const poolLenBefore = await farming.poolLength();

      console.log("AAAAAAAAAAAAAAAAAAAAAAA");
      await incentiveVoting
        .connect(deployer)
        .addTokenApproval(newToken.address, newStrat.address, true);
      console.log("AAAAAAAAAAAAAAAAAAAAAAA");

      const poolLenAfter = await farming.poolLength();

      expect(poolLenAfter).to.be.equal(poolLenBefore.add(1));

      const addedPoolInfo = await farming.poolInfo(poolLenAfter.sub(1));
      expect(addedPoolInfo.token).to.be.equal(newToken.address);
      expect(addedPoolInfo.strategy).to.be.equal(newStrat.address);
    });
  });

  describe("# setClaimReceiver, setBlockThirdPartyActions", () => {
    it("setClaimReceiver works as expected", async () => {
      const signer = signer1;
      const signerAddr = signer1.address;
      const receiverAddr = signer3.address;

      expect(await farming.claimReceiver(signerAddr)).to.be.equal(AddressZero);
      await farming.connect(signer).setClaimReceiver(receiverAddr);
      expect(await farming.claimReceiver(signerAddr)).to.be.equal(receiverAddr);
    });

    it("setBlockThirdPartyActions works as expected", async () => {
      assert.isFalse(await farming.blockThirdPartyActions(signer1.address));
      await farming.connect(signer1).setBlockThirdPartyActions(true);
      assert.isTrue(await farming.blockThirdPartyActions(signer1.address));
      await farming.connect(signer1).setBlockThirdPartyActions(false);
      assert.isFalse(await farming.blockThirdPartyActions(signer1.address));
    });
  });

  describe("# deposit", () => {
    it("cannot deposit 0", async () => {
      await expect(farming.deposit(0, 0, false, deployer.address)).to.eventually.be.rejectedWith(
        Error,
        "Cannot deposit zero"
      );
    });

    it("cannot deposit to nonexisting pool id", async () => {
      const errCode = "0x32";
      const wantAmount = BigNumber.from("1000").mul(tenPow18);
      await expect(
        farming.connect(signer1).deposit(2, wantAmount, false, signer1.address)
      ).to.eventually.be.rejectedWith(Error, errCode);
    });

    it("function works as expected", async () => {
      const wantAmount = BigNumber.from("1000").mul(tenPow18);
      const pid = BigNumber.from(0);
      const userInfoBefore = await farming.userInfo(pid, signer1.address);
      await expect(farming.connect(signer1).deposit(pid, wantAmount, false, signer1.address))
        .to.emit(farming, "Deposit")
        .and.to.emit(firstFarmTkn, "Transfer")
        .and.to.emit(firstFarmTkn, "Transfer");

      const userInfoAfter = await farming.userInfo(pid, signer1.address);

      assert.isTrue(userInfoAfter.shares.gt(userInfoBefore.shares));
      expect(await farming.stakedWantTokens(pid, signer1.address)).to.be.equal(wantAmount);
    });
  });

  describe("# withdraw", () => {
    it("cannot withdraw 0", async () => {
      await expect(farming.withdraw(0, 0, false)).to.eventually.be.rejectedWith(
        Error,
        "Cannot withdraw zero"
      );
    });

    it("cannot withdraw from nonexisting pool id", async () => {
      const errCode = "0x32";
      const wantAmount = BigNumber.from("1000").mul(tenPow18);
      await expect(farming.withdraw(2, wantAmount, false)).to.eventually.be.rejectedWith(
        Error,
        errCode
      );
    });

    it("cannot withdraw if not deposited yet", async () => {
      const pid = BigNumber.from(0);
      const wantAmount = BigNumber.from("1000").mul(tenPow18);
      await expect(
        farming.connect(signer1).withdraw(pid, wantAmount.div(2), false)
      ).to.eventually.be.rejectedWith(Error, "user.shares is 0");
    });

    it("withdraw works correctly", async () => {
      const wantAmount = BigNumber.from("1000").mul(tenPow18);
      const pid = BigNumber.from(0);
      // deposit
      await farming.connect(signer1).deposit(pid, wantAmount, false, signer1.address);
      // withdraw
      await expect(farming.connect(signer1).withdraw(pid, wantAmount.div(2), false))
        .to.emit(farming, "Withdraw")
        .withArgs(signer1.address, pid, wantAmount.div(2));
    });

    it("withdrawAll works correctly", async () => {
      const wantAmount = BigNumber.from("1000").mul(tenPow18);
      const pid = BigNumber.from(0);
      // deposit
      await farming.connect(signer1).deposit(pid, wantAmount, false, signer1.address);

      const wantLockedTotal = await firstStrategy.wantLockedTotal();
      const sharesTotal = await firstStrategy.sharesTotal();
      const userShares = (await farming.userInfo(pid, signer1.address)).shares;
      const calculatedWantAmount = userShares.mul(wantLockedTotal).div(sharesTotal);
      // withdraw
      await expect(farming.connect(signer1).withdrawAll(pid, false))
        .to.emit(farming, "Withdraw")
        .withArgs(signer1.address, pid, calculatedWantAmount);
    });
  });

  describe("# claiming rewards", () => {
    it("claim will revert if caller is not user and third party actions are blocked", async () => {
      await farming.connect(signer1).setBlockThirdPartyActions(true);

      await expect(
        farming.connect(signer2).claim(signer1.address, [])
      ).to.eventually.be.rejectedWith("Cannot claim on behalf of this account");
    });

    it("claim works as expected", async () => {
      const pid = BigNumber.from(0);
      const pids = [pid];
      const wantAmount = BigNumber.from("1000").mul(tenPow18);
      // deposit
      await farming.connect(signer1).deposit(pid, wantAmount, false, signer1.address);

      await advanceTime(week.toNumber());
      const claimable = await farming.claimableReward(signer1.address, pids);
      const rewardBalanceBefore = await rewardToken.balanceOf(signer1.address);

      await farming.claim(signer1.address, pids);

      const rewardBalanceAfter = await rewardToken.balanceOf(signer1.address);

      assert.isTrue(rewardBalanceAfter.sub(rewardBalanceBefore).gte(claimable[0]));
      expect((await farming.userInfo(pid, signer1.address)).claimable).to.be.equal(0);
    });

    it("if receiver is setted than rewards will be transfer to the receiver address", async () => {
      const pid = BigNumber.from(0);
      const pids = [pid];
      const wantAmount = BigNumber.from("1000").mul(tenPow18);

      // set claim receiver
      await farming.connect(signer1).setClaimReceiver(signer3.address);
      // deposit
      await farming.connect(signer1).deposit(pid, wantAmount, false, signer1.address);

      await advanceTime(week.toNumber());
      const claimable = await farming.claimableReward(signer1.address, pids);
      const userRewardBalanceBefore = await rewardToken.balanceOf(signer1.address);
      const receiverRewardBalanceBefore = await rewardToken.balanceOf(signer3.address);

      await farming.claim(signer1.address, pids);

      const userRewardBalanceAfter = await rewardToken.balanceOf(signer1.address);
      const receiverRewardBalanceAfter = await rewardToken.balanceOf(signer3.address);

      expect(userRewardBalanceAfter).to.be.equal(userRewardBalanceBefore);
      assert.isTrue(receiverRewardBalanceAfter.sub(receiverRewardBalanceBefore).gte(claimable[0]));
      expect((await farming.userInfo(pid, signer1.address)).claimable).to.be.equal(0);
    });

    it("claim in deposit function works as expected", async () => {
      const pid = BigNumber.from(0);
      const pids = [pid];
      const wantAmount = BigNumber.from("1000").mul(tenPow18);
      // deposit
      await farming.connect(signer1).deposit(pid, wantAmount, false, signer1.address);

      await advanceTime(week.toNumber());

      const claimable = await farming.claimableReward(signer1.address, pids);
      const rewardBalanceBefore = await rewardToken.balanceOf(signer1.address);

      // deposit
      await farming.connect(signer1).deposit(pid, wantAmount, true, signer1.address);
      const rewardBalanceAfter = await rewardToken.balanceOf(signer1.address);
      assert.isTrue(rewardBalanceAfter.sub(rewardBalanceBefore).gte(claimable[0]));
      expect((await farming.userInfo(pid, signer1.address)).claimable).to.be.equal(0);
    });

    it("adding to claimable in deposit function works as expected", async () => {
      const pid = BigNumber.from(0);
      const wantAmount = BigNumber.from("1000").mul(tenPow18);
      // deposit
      await farming.connect(signer1).deposit(pid, wantAmount, false, signer1.address);

      await advanceTime(week.toNumber());

      const rewardBalanceBefore = await rewardToken.balanceOf(signer1.address);
      const userClaimableBefore = (await farming.userInfo(pid, signer1.address)).claimable;

      // deposit
      await farming.connect(signer1).deposit(pid, wantAmount, false, signer1.address);

      const rewardBalanceAfter = await rewardToken.balanceOf(signer1.address);
      const userClaimableAfter = (await farming.userInfo(pid, signer1.address)).claimable;

      expect(rewardBalanceAfter).to.be.equal(rewardBalanceBefore);
      assert.isTrue(userClaimableAfter.gt(userClaimableBefore));
    });

    it("claim in withdraw works correctly", async () => {
      const pid = BigNumber.from(0);
      const pids = [pid];
      const wantAmount = BigNumber.from("1000").mul(tenPow18);
      // deposit
      await farming.connect(signer1).deposit(pid, wantAmount, false, signer1.address);

      await advanceTime(week.toNumber());

      const claimable = await farming.claimableReward(signer1.address, pids);
      const rewardBalanceBefore = await rewardToken.balanceOf(signer1.address);

      // deposit
      await farming.connect(signer1).withdraw(pid, wantAmount, true);
      const rewardBalanceAfter = await rewardToken.balanceOf(signer1.address);
      assert.isTrue(rewardBalanceAfter.sub(rewardBalanceBefore).gte(claimable[0]));
      expect((await farming.userInfo(pid, signer1.address)).claimable).to.be.equal(0);
    });

    it("adding to claimable in withdraw function works as expected", async () => {
      const pid = BigNumber.from(0);
      const wantAmount = BigNumber.from("1000").mul(tenPow18);
      // deposit
      await farming.connect(signer1).deposit(pid, wantAmount, false, signer1.address);

      await advanceTime(week.toNumber());

      const rewardBalanceBefore = await rewardToken.balanceOf(signer1.address);
      const userClaimableBefore = (await farming.userInfo(pid, signer1.address)).claimable;

      // deposit
      await farming.connect(signer1).withdraw(pid, wantAmount, false);

      const rewardBalanceAfter = await rewardToken.balanceOf(signer1.address);
      const userClaimableAfter = (await farming.userInfo(pid, signer1.address)).claimable;

      expect(rewardBalanceAfter).to.be.equal(rewardBalanceBefore);
      assert.isTrue(userClaimableAfter.gt(userClaimableBefore));
    });
  });

  describe("# inCaseTokensGetStuck", () => {
    it("only owner can call this function", async () => {
      await expect(
        farming.connect(signer1).inCaseTokensGetStuck(AddressZero, 0)
      ).to.eventually.be.rejectedWith(Error, "Ownable: caller is not the owner");
    });

    it("cannot withdraw reward token", async () => {
      await expect(
        farming.connect(deployer).inCaseTokensGetStuck(rewardToken.address, 0)
      ).to.eventually.be.rejectedWith(Error, "!safe");
    });

    it("function works as expected", async () => {
      const amount = BigNumber.from("10000");
      await firstFarmTkn.connect(signer1).transfer(farming.address, amount);
      const ownerTokenBalBefore = await firstFarmTkn.balanceOf(deployer.address);
      await farming.connect(deployer).inCaseTokensGetStuck(firstFarmTkn.address, amount);
      expect(await firstFarmTkn.balanceOf(deployer.address)).to.be.equal(
        ownerTokenBalBefore.add(amount)
      );
    });
  });

  describe("# others", () => {
    it("updatePool will revert if pool id is invalid", async () => {
      await expect(farming.updatePool(2)).to.eventually.be.rejected;
    });

    it("emergency withdraw will withdraw all deposited amount without claiming rewards", async () => {
      const pid = BigNumber.from(0);
      const pids = [pid];
      const wantAmount = BigNumber.from("1000").mul(tenPow18);
      // deposit
      await farming.connect(signer1).deposit(pid, wantAmount, false, signer1.address);

      await advanceTime(week.toNumber());

      const claimable = await farming.claimableReward(signer1.address, pids);
      const rewardBalanceBefore = await rewardToken.balanceOf(signer1.address);
      assert.isTrue(claimable[0].gt(0));

      // emergency withdraw
      await expect(farming.connect(signer1).emergencyWithdraw(pid)).to.emit(
        farming,
        "EmergencyWithdraw"
      );

      const rewardBalanceAfter = await rewardToken.balanceOf(signer1.address);
      // no rewords claimed
      expect(rewardBalanceAfter).to.be.equal(rewardBalanceBefore);
      expect((await farming.userInfo(pid, signer1.address)).claimable).to.be.equal(0);
    });
  });
});
