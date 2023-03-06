import { ethers, upgrades } from "hardhat";
import { verifyContract } from "../../helpers/utils";

const IncentiveVotingProxy = "0x6cD66ca25b90A739D270588543B9c36980444888";

const main = async () => {
  const IncentiveVotingFactory = await ethers.getContractFactory("IncentiveVotingV2");
  const incentiveVoting = await IncentiveVotingFactory.deploy();
  await incentiveVoting.deployed();
  console.log("new implementation was deployed on ->", incentiveVoting.address);

  const proxyAdminAddress = await upgrades.erc1967.getAdminAddress(IncentiveVotingProxy);
  const proxyAdmin = await ethers.getContractAt("ProxyAdmin", proxyAdminAddress);
  await proxyAdmin.upgrade(IncentiveVotingProxy, incentiveVoting.address);
  await verifyContract(incentiveVoting.address, []);
};

main();
