import fs from "fs";
import { ethers, network, upgrades } from "hardhat";
import { verifyContract } from "../helpers/utils";
// eslint-disable-next-line node/no-extraneous-import
import { getImplementationAddress } from "@openzeppelin/upgrades-core";
import { CurveProxyForDeposit } from "../typechain-types";

const FARMING = "0xf0fA2307392e3b0bD742437C6f80C6C56Fd8A37f";
const TOKEN0 = "0x0782b6d8c4551B9760e74c0545a9bCD90bdc41E5";
const TOKEN1 = "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56"; // BUSD
const STABLE_SWAP = "0x49079D07ef47449aF808A4f36c2a8dEC975594eC";
const PID = 1;

const NEW_OWNER = "0x8d388136d578dCD791D081c6042284CED6d9B0c6";

const main = async () => {
  const CurveProxy = await ethers.getContractFactory("CurveProxyForDeposit");
  const curveProxy = (await upgrades.deployProxy(CurveProxy, [FARMING])) as CurveProxyForDeposit;
  await curveProxy.deployed();
  const currentImplAddress = await getImplementationAddress(ethers.provider, curveProxy.address);
  console.log("curveProxyForDeposit address is    ->", curveProxy.address);
  console.log("Implementation address ->", currentImplAddress);
  const addresses = {
    curveProxyForDeposit: curveProxy.address,
    curveProxyForDepositImpl: currentImplAddress,
  };
  const jsonAddresses = JSON.stringify(addresses);
  fs.writeFileSync(`../${network.name}CurveProxyForDeposit.json`, jsonAddresses);
  console.log("Addresses saved!");

  await curveProxy.addSupportedTokens(STABLE_SWAP, TOKEN0, TOKEN1, PID);
  await curveProxy.transferOwnership(NEW_OWNER);

  await verifyContract(currentImplAddress, []);
};

main();
