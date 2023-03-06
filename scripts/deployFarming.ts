import { ethers } from "hardhat";
import { sleep, verifyContract } from "../helpers/utils";

const main = async () => {
  const Farming = await ethers.getContractFactory("Farming");
  const farming = await Farming.deploy();
  await farming.deployed();
  console.log("new implementation address ->", farming.address);

  await sleep(16000);

  await verifyContract(farming.address, []);
};

main();
