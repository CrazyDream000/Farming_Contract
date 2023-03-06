import fs from "fs";
import { ethers, network, upgrades } from "hardhat";
import { verifyContract } from "../helpers/utils";
// eslint-disable-next-line node/no-extraneous-import
import { getImplementationAddress } from "@openzeppelin/upgrades-core";

if (!process.env.START_TIME) {
  throw new Error("START_TIME is not setted in .env");
}

const START_TIME = process.env.START_TIME;
const HAY = "0x0782b6d8c4551B9760e74c0545a9bCD90bdc41E5";
const MIN_EARN_AMT = "10000000000";
const MASTERCHEF = "0xa5f8C5Dbd5F286960b9d90548680aE5ebFf07652";
const WANT = "0x70c26e9805ec5Df3d4aB0b2a3dF86BBA2231B6c1";
const CAKE = "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82";
const TOKEN0 = "0x0782b6d8c4551B9760e74c0545a9bCD90bdc41E5";
const TOKEN1 = "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56"; // BUSD
const ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
const EARNED_TO_TOKEN0_PATH = [CAKE, TOKEN1, HAY];
const EARNED_TO_TOKEN1_PATH = [CAKE, TOKEN1];

const main = async () => {
  const FarmingFactory = await ethers.getContractFactory("Farming");
  const IncentiveVotingFactory = await ethers.getContractFactory("IncentiveVoting");
  const PancakeStrategyFactory = await ethers.getContractFactory("PancakeStrategy");
  const PancakeProxyForDepositFactory = await ethers.getContractFactory("PancakeProxyForDeposit");

  console.log(START_TIME.toString());
  console.log("Start");
  const incentiveVoting = await upgrades.deployProxy(IncentiveVotingFactory, [START_TIME]);
  await incentiveVoting.deployed();
  let currentImplAddress = await getImplementationAddress(ethers.provider, incentiveVoting.address);
  const incentiveVotingImpl = currentImplAddress;

  const farming = await upgrades.deployProxy(FarmingFactory, [HAY, incentiveVoting.address]);
  await farming.deployed();
  currentImplAddress = await getImplementationAddress(ethers.provider, farming.address);
  const farmingImpl = currentImplAddress;

  const pancakeStrategy = await upgrades.deployProxy(PancakeStrategyFactory, [
    MIN_EARN_AMT,
    false,
    [MASTERCHEF, WANT, CAKE, TOKEN0, TOKEN1, ROUTER, farming.address],
    EARNED_TO_TOKEN0_PATH,
    EARNED_TO_TOKEN1_PATH,
  ]);
  await pancakeStrategy.deployed();
  currentImplAddress = await getImplementationAddress(ethers.provider, pancakeStrategy.address);
  const pancakeStrategyImpl = currentImplAddress;

  const pancakeProxyForDeposit = await upgrades.deployProxy(PancakeProxyForDepositFactory, [
    farming.address,
    ROUTER,
  ]);
  await pancakeProxyForDeposit.deployed();
  currentImplAddress = await getImplementationAddress(
    ethers.provider,
    pancakeProxyForDeposit.address
  );
  const pancakeProxyForDepositImpl = currentImplAddress;

  const addresses = {
    hay: HAY,
    incentiveVoting: incentiveVoting.address,
    incentiveVotingImplementation: incentiveVotingImpl,
    farming: farming.address,
    farmingImplementation: farmingImpl,
    pancakeProxyForDeposit: pancakeProxyForDeposit.address,
    pancakeProxyForDepositImplementation: pancakeProxyForDepositImpl,
    pancakeStrategy: pancakeStrategy.address,
    pancakeStrategyImplementation: pancakeStrategyImpl,
  };
  const jsonAddresses = JSON.stringify(addresses);
  fs.writeFileSync(`./addresses/${network.name}Addresses.json`, jsonAddresses);
  console.log("Addresses saved!");

  // set Farming
  await incentiveVoting.setFarming(farming.address, [WANT], [pancakeStrategy.address]);
  console.log("farming setted");
  // set supported token to proxy for farming
  await pancakeProxyForDeposit.addSupportedTokens(TOKEN0, TOKEN1, 0);
  console.log("proxy for farming config competed");

  await verifyContract(farmingImpl, []);
  await verifyContract(incentiveVotingImpl, []);
  await verifyContract(pancakeStrategyImpl, []);
  await verifyContract(pancakeProxyForDepositImpl, []);
};

main()
  .then(() => {
    console.log("Success");
  })
  .catch((err) => {
    console.log(err);
  });
