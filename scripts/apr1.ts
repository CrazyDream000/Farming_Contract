import { BigNumber } from "ethers";
import { ethers } from "hardhat";

const ten = BigNumber.from(10);
const tenPow18 = ten.pow(18);

const blocksPerDay = BigNumber.from(28682);
const dayOfYear = BigNumber.from(365);
const hundred = BigNumber.from(100);
const secondsInYear = BigNumber.from(31536000);

const cakePrice = BigNumber.from(486); // you need to get it from some api

const main = async () => {
  const lp = await ethers.getContractAt("IERC20", "0xB6040A9F294477dDAdf5543a24E5463B8F2423Ae");
  const masterChef = await ethers.getContractAt(
    "IPancakeSwapFarm",
    "0xa5f8C5Dbd5F286960b9d90548680aE5ebFf07652"
  );
  const incentiveVoting = await ethers.getContractAt(
    "IncentiveVoting",
    "0xdE1F4c0DD8C22b421851Fb51862F265D7564bEf7"
  );
  const stableStrategy = await ethers.getContractAt(
    "StableCoinStrategyCurve",
    "0x5A2CcC1f8BB9a3048885E5F38bB48463E6314B7C"
  );
  const stableSwap = await ethers.getContractAt(
    "IStable",
    "0x49079D07ef47449aF808A4f36c2a8dEC975594eC"
  );
  // about lp
  const totalSupply = await lp.totalSupply();
  // const totalSupplyNum = Number(totalSupply.toString()) / 10 ** 18;
  // const reserve0Num = Number(reserve0.toString()) / 10 ** 18;
  // const reserve1Num = Number(reserve1.toString()) / 10 ** 18;
  const reserve0 = await stableSwap.balances(0);
  const reserve1 = await stableSwap.balances(1);
  const totalLPPrice = reserve0.add(reserve1);
  const lpPrice = totalLPPrice.mul(tenPow18).div(totalSupply).toString();

  const cakePerBlock = await masterChef.cakePerBlock(true);
  const poolInfo = await masterChef.poolInfo(121);
  const tvl = poolInfo.totalBoostedShare;
  const allocPoint = poolInfo.allocPoint;
  const totalAllocPoint = await masterChef.totalRegularAllocPoint();

  const tvlLpPrice = tvl.mul(lpPrice).div(tenPow18);
  const totalCakeRewardPrice = allocPoint
    .mul(cakePerBlock)
    .mul(blocksPerDay)
    .mul(dayOfYear)
    .mul(cakePrice)
    .div(totalAllocPoint)
    .div(100);

  const cakeApr = totalCakeRewardPrice.mul(tenPow18).mul(hundred).div(tvlLpPrice);

  const currentWeek = await incentiveVoting.getWeek();
  const rewardsPerSecond = await incentiveVoting.getRewardsPerSecond(1, currentWeek);
  const tvlOur = await stableStrategy.wantLockedTotal();
  const tvlOurLpPrice = tvlOur.mul(lpPrice).div(tenPow18);
  const totalHayRewards = rewardsPerSecond.mul(secondsInYear);

  const ourApr = tvlOur.isZero()
    ? BigNumber.from(0)
    : totalHayRewards.mul(tenPow18).mul(hundred).div(tvlOurLpPrice);

  console.log("cake apr is ->", cakeApr.toString());
  console.log("our apr is ->", ourApr.toString());
};

main();
