import fs from "fs";
import { ethers, network, upgrades } from "hardhat";
import { verifyContract } from "../helpers/utils";
// eslint-disable-next-line node/no-extraneous-import
import { getImplementationAddress } from "@openzeppelin/upgrades-core";

const PID = 121;
const MIN_EARN_AMT = "10000000000";
const FARMING = "0xf0fA2307392e3b0bD742437C6f80C6C56Fd8A37f";
const MASTERCHEF = "0xa5f8C5Dbd5F286960b9d90548680aE5ebFf07652";
const WANT = "0xB6040A9F294477dDAdf5543a24E5463B8F2423Ae";
const CAKE = "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82";
const TOKEN0 = "0x0782b6d8c4551B9760e74c0545a9bCD90bdc41E5";
const TOKEN1 = "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56"; // BUSD
const I0 = 0;
const I1 = 1;
const ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
const STABLE_SWAP = "0x49079D07ef47449aF808A4f36c2a8dEC975594eC";
const EARNED_TO_TOKEN1_PATH = [CAKE, TOKEN1];

const main = async () => {
  const StableStrategy = await ethers.getContractFactory("StableCoinStrategyCurve");

  const stableStrategy = await upgrades.deployProxy(StableStrategy, [
    PID,
    I0,
    I1,
    MIN_EARN_AMT,
    false,
    [MASTERCHEF, WANT, CAKE, TOKEN0, TOKEN1, ROUTER, STABLE_SWAP, FARMING],
    EARNED_TO_TOKEN1_PATH,
  ]);
  await stableStrategy.deployed();

  const currentImplAddress = await getImplementationAddress(
    ethers.provider,
    stableStrategy.address
  );
  const stableStrategyImplementation = currentImplAddress;
  console.log("Strategy address is    ->", stableStrategy.address);
  console.log("Implementation address ->", currentImplAddress);

  const addresses = {
    stableStrategy: stableStrategy.address,
    stableStrategyImplementation,
  };
  const jsonAddresses = JSON.stringify(addresses);
  fs.writeFileSync(`../${network.name}StableCoinStrategyAddresses.json`, jsonAddresses);
  console.log("Addresses saved!");

  await verifyContract(stableStrategyImplementation, []);
};

main()
  .then(() => {
    console.log("Success");
  })
  .catch((err) => {
    console.log(err);
  });
