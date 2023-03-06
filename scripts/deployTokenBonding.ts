import { BigNumber } from "ethers";
import { ethers, upgrades } from "hardhat";
import { verifyContract } from "../helpers/utils";

const ten = BigNumber.from(10);
const tenPow18 = ten.pow(18);

const HELIO = "0x1119022D7831430632c729AFF1F16FA23a1C8CfE";

const main = async () => {
  const TokenBondingFactory = await ethers.getContractFactory("TokenBonding");
  const tokenBonding = await upgrades.deployProxy(TokenBondingFactory, [[HELIO], [tenPow18]]);
  await tokenBonding.deployed();
  const impl = await upgrades.erc1967.getImplementationAddress(tokenBonding.address);
  console.log("TokenBonding proxy address is ->", tokenBonding.address);
  console.log("TokenBonding impl  address is ->", impl);
  await verifyContract(impl, []);
};
main();
