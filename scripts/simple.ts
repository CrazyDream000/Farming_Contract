import { ethers } from "hardhat";
import { sleep, verifyContract } from "../helpers/utils";

const main = async () => {
  const MintERC20 = await ethers.getContractFactory("MintERC20");
  const token = await MintERC20.deploy();
  await token.deployed();
  console.log("new implementation address ->", token.address);

  await sleep(16000);

  await verifyContract(token.address, []);
};

main();
