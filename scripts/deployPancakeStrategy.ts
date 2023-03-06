import { ethers } from "hardhat";
import { sleep, verifyContract } from "../helpers/utils";

const main = async () => {
  const Strategy = await ethers.getContractFactory("PancakeStrategyV2");
  const strategy = await Strategy.deploy();
  await strategy.deployed();
  console.log("new implementation address ->", strategy.address);

  await sleep(16000);

  await verifyContract(strategy.address, []);
};

main();
