import chai, { assert, expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { ethers, upgrades } from "hardhat";
import { BigNumber } from "ethers";
import { solidity } from "ethereum-waffle";

import {
  advanceBlock,
  advanceBlockAndTime,
  advanceTime,
  daysToSeconds,
  getNextTimestampDivisibleBy,
  setTimestamp,
} from "../../helpers/utils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  IERC20,
  IPancakeRouter02,
  IWBNB,
  PancakeStrategy,
  StrategyMock,
} from "../../typechain-types";
import NetworkSnapshotter from "../../helpers/NetworkSnapshotter";

const { AddressZero, MaxUint256 } = ethers.constants;

chai.use(solidity);
chai.use(chaiAsPromised);

const week = daysToSeconds(BigNumber.from(7));
const ten = BigNumber.from(10);
const tenPow18 = ten.pow(18);

describe("Strategy", () => {
  let deployer: SignerWithAddress;
  let helioFarming: SignerWithAddress;
  let signer2: SignerWithAddress;
  let strategy: PancakeStrategy;
  let token0: IERC20;
  let token1: IERC20;
  let want: IERC20;
  let cake: IERC20;
  let wbnb: IWBNB;
  let router: IPancakeRouter02;

  const networkSnapshotter = new NetworkSnapshotter();

  const minEarnAmount = ten.pow(5);

  before("setup strategy contract", async () => {
    [deployer, helioFarming, signer2] = await ethers.getSigners();
    // TODO: should be researched
    const pid = BigNumber.from(3);
    const enableAutoHarvest = true;
    const masterChef = "0xa5f8C5Dbd5F286960b9d90548680aE5ebFf07652";
    token0 = await ethers.getContractAt("IERC20", "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c"); // WBNB
    token1 = await ethers.getContractAt("IERC20", "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56"); // BUSD
    want = await ethers.getContractAt("IERC20", "0x58F876857a02D6762E0101bb5C46A8c1ED44Dc16");
    cake = await ethers.getContractAt("IERC20", "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82");
    wbnb = await ethers.getContractAt("IWBNB", "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c");
    router = await ethers.getContractAt(
      "IPancakeRouter02",
      "0x10ED43C718714eb63d5aA57B78B54704E256024E"
    );
    const addresses = [
      masterChef,
      want.address,
      cake.address,
      token0.address,
      token1.address,
      router.address,
      helioFarming.address,
    ];
    const earnedToToken0Path = [cake.address, token0.address];
    const earnedToToken1Path = [cake.address, token1.address];

    const Strategy = await ethers.getContractFactory("PancakeStrategy");
    strategy = (await upgrades.deployProxy(Strategy, [
      pid,
      minEarnAmount,
      enableAutoHarvest,
      addresses,
      earnedToToken0Path,
      earnedToToken1Path,
    ])) as PancakeStrategy;
    await strategy.deployed();
    console.log("local deployments end");
    const amount = BigNumber.from("1000").mul(tenPow18);
    await wbnb.connect(helioFarming).deposit({ value: amount });
    console.log("wbnb deposit end");
    await wbnb.connect(helioFarming).approve(router.address, MaxUint256);
    await token1.connect(helioFarming).approve(router.address, MaxUint256);
    await router
      .connect(helioFarming)
      .swapExactTokensForTokens(
        amount.div(2),
        0,
        [token0.address, token1.address],
        helioFarming.address,
        Math.floor(Date.now() / 1000) + 10000000
      );
    console.log("swap half bnb to busd works");
    await router
      .connect(helioFarming)
      .addLiquidity(
        token0.address,
        token1.address,
        amount.div(2),
        amount.div(2),
        0,
        0,
        helioFarming.address,
        Math.floor(Date.now() / 1000) + 10000000
      );
    console.log("liquidity added");
    const balanceLP = await want.balanceOf(helioFarming.address);
    console.log("balance of lp is", balanceLP.toString());

    // snapshot a network
    await networkSnapshotter.firstSnapshot();
  });

  afterEach("revert", async () => await networkSnapshotter.revert());

  it("deposit", async () => {
    await want.connect(helioFarming).approve(strategy.address, MaxUint256);
    const amount = BigNumber.from(10);
    await strategy.connect(helioFarming).deposit(AddressZero, amount.mul(tenPow18));
    // await advanceBlockAndTime(100, 3600);
    await advanceBlock(100);
    console.log("end advance block");
    await strategy.connect(helioFarming).deposit(AddressZero, amount.mul(tenPow18));
    console.log("end deposit");

    const balanceLPBefore = await want.balanceOf(helioFarming.address);
    console.log("Balance before is", balanceLPBefore.toString());
    await strategy.connect(helioFarming).withdraw(AddressZero, amount.mul(2).mul(tenPow18));
    const balanceLPAfter = await want.balanceOf(helioFarming.address);
    console.log("Balance after is", balanceLPAfter.toString());
  });
});
