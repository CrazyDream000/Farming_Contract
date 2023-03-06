import { BigNumber } from "ethers";
import fs from "fs";
import { ethers, network, upgrades } from "hardhat";
import { verifyContract } from "../helpers/utils";
// eslint-disable-next-line node/no-extraneous-import
import { getImplementationAddress } from "@openzeppelin/upgrades-core";

const { AddressZero } = ethers.constants;

const START_TIME = BigNumber.from(Math.floor(Date.now() / 1000) + 100);
const HAY = "0x7adC9A28Fab850586dB99E7234EA2Eb7014950fA";
const MIN_EARN_AMT = "10000000000";
const MASTERCHEF = AddressZero;
const WANT = "0xE041AB7Ea825C06d4BF7eA3182F3d4EC4De7E83E";
const CAKE = AddressZero;
const TOKEN0 = "0x78867BbEeF44f2326bF8DDd1941a4439382EF2A7"; // BUSD
const TOKEN1 = "0x7adC9A28Fab850586dB99E7234EA2Eb7014950fA";
const ROUTER = "0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3";
const EARNED_TO_TOKEN0_PATH: string[] = [];
const EARNED_TO_TOKEN1_PATH: string[] = [];

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
