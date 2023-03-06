import { ethers, upgrades } from "hardhat";
import { verifyContract } from "../../helpers/utils";

if (!process.env.PANCAKE_STRAT) {
  throw new Error("Pancake strategy address is not setted to .env");
}
if (!process.env.MASTERCHEF_PID) {
  throw new Error("Masterchef pid is not setted to .env");
}

const PANCAKE_STRAT = process.env.PANCAKE_STRAT;
const MASTERCHEF_PID = process.env.MASTERCHEF_PID;

const main = async () => {
  const PancakeStrategyV2Factory = await ethers.getContractFactory("PancakeStrategyV2");
  console.log("upgrading the strategy");
  const pancakeStratV2 = await upgrades.upgradeProxy(PANCAKE_STRAT, PancakeStrategyV2Factory);
  await pancakeStratV2.deployed();
  console.log("Successfully upgraded!");

  console.log("Set the pid for the Masterchef");
  await pancakeStratV2.setPid(MASTERCHEF_PID);

  const pancakeStratV2Impl = await pancakeStratV2.erc1967.getImplementation();
  await verifyContract(pancakeStratV2Impl, []);
};

main()
  .then(() => {
    console.log("Success");
  })
  .catch((err) => {
    console.log(err);
  });
