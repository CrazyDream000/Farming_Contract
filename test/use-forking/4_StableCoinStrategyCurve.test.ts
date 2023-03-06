import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { BigNumber } from "ethers";

import { advanceBlock } from "../../helpers/utils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  IERC20,
  IPancakeRouter02,
  IStableSwap,
  IWBNB,
  StableCoinStrategyCurve,
} from "../../typechain-types";
import NetworkSnapshotter from "../../helpers/NetworkSnapshotter";

const { AddressZero, MaxUint256 } = ethers.constants;

const ten = BigNumber.from(10);
const tenPow18 = ten.pow(18);

describe("Strategy", () => {
  let deployer: SignerWithAddress;
  let helioFarming: SignerWithAddress;
  let signer2: SignerWithAddress;
  let strategy: StableCoinStrategyCurve;
  let stableSwap: IStableSwap;
  let token0: IERC20;
  let token1: IERC20;
  let want: IERC20;
  let cake: IERC20;
  let wbnb: IWBNB;
  let router: IPancakeRouter02;

  const networkSnapshotter = new NetworkSnapshotter();

  const minEarnAmount = "1000000000000";

  before("setup strategy contract", async () => {
    [deployer, helioFarming, signer2] = await ethers.getSigners();
    // TODO: should be researched
    const enableAutoHarvest = true;
    const pid = "121";
    const I0 = "0";
    const I1 = "1";
    const masterChef = "0xa5f8C5Dbd5F286960b9d90548680aE5ebFf07652";
    token0 = await ethers.getContractAt("IERC20", "0x0782b6d8c4551B9760e74c0545a9bCD90bdc41E5"); // WBNB
    token1 = await ethers.getContractAt("IERC20", "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56"); // BUSD
    want = await ethers.getContractAt("IERC20", "0xB6040A9F294477dDAdf5543a24E5463B8F2423Ae");
    cake = await ethers.getContractAt("IERC20", "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82");
    wbnb = await ethers.getContractAt("IWBNB", "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c");
    router = await ethers.getContractAt(
      "IPancakeRouter02",
      "0x10ED43C718714eb63d5aA57B78B54704E256024E"
    );
    stableSwap = await ethers.getContractAt(
      "IStableSwap",
      "0x49079D07ef47449aF808A4f36c2a8dEC975594eC"
    );
    const addresses = [
      masterChef,
      want.address,
      cake.address,
      token0.address,
      token1.address,
      router.address,
      stableSwap.address,
      helioFarming.address,
    ];
    const EARNED_TO_TOKEN1_PATH = [cake.address, token1.address];

    const Strategy = await ethers.getContractFactory("StableCoinStrategyCurve");
    strategy = (await upgrades.deployProxy(Strategy, [
      pid,
      I0,
      I1,
      minEarnAmount,
      enableAutoHarvest,
      addresses,
      EARNED_TO_TOKEN1_PATH,
    ])) as StableCoinStrategyCurve;
    await strategy.deployed();
    console.log("local deployments end");

    const amount = tenPow18.mul(200);
    await wbnb.connect(helioFarming).deposit({ value: tenPow18.mul(200) });
    console.log("wbnb deposit end");
    await wbnb.connect(helioFarming).approve(router.address, MaxUint256);
    await token0.connect(helioFarming).approve(router.address, MaxUint256);
    await token1.connect(helioFarming).approve(router.address, MaxUint256);
    await token0.connect(helioFarming).approve(stableSwap.address, MaxUint256);
    await token1.connect(helioFarming).approve(stableSwap.address, MaxUint256);
    await router
      .connect(helioFarming)
      .swapExactTokensForTokens(
        amount,
        0,
        [wbnb.address, token1.address],
        helioFarming.address,
        Math.floor(Date.now() / 1000) + 10000000
      );
    let busdBalance = await token1.balanceOf(helioFarming.address);
    console.log("swap whole amount to busd works");
    await stableSwap.connect(helioFarming).exchange(1, 0, busdBalance.div(2), 0);
    console.log("swap half busd to hay works");
    busdBalance = await token1.balanceOf(helioFarming.address);
    const hayBalance = await token0.balanceOf(helioFarming.address);
    await stableSwap.connect(helioFarming).add_liquidity([hayBalance, busdBalance], 0);
    const balanceLP = await want.balanceOf(helioFarming.address);
    console.log("balance of lp is", balanceLP.toString());

    // snapshot a network
    await networkSnapshotter.firstSnapshot();
  });

  afterEach("revert", async () => await networkSnapshotter.revert());

  it("deposit", async () => {
    console.log("Success!");
    await want.connect(helioFarming).approve(strategy.address, MaxUint256);
    const amount = BigNumber.from(10);
    await strategy.connect(helioFarming).deposit(AddressZero, amount.mul(tenPow18));
    // await advanceBlockAndTime(100, 3600);
    await advanceBlock(10000);
    console.log("end advance block");
    await strategy.connect(helioFarming).deposit(AddressZero, amount.mul(tenPow18));
    console.log("end deposit");

    const balanceLPBefore = await want.balanceOf(helioFarming.address);
    console.log("Balance before is", balanceLPBefore.toString());
    await strategy
      .connect(helioFarming)
      .withdraw(AddressZero, amount.mul(2).mul(tenPow18).add(ten.pow(10)));
    const balanceLPAfter = await want.balanceOf(helioFarming.address);
    console.log("Balance after  is", balanceLPAfter.toString());
  });
});
