import { ethers } from "hardhat";

const strategyAddress = "0xe8baC331FaF2f65eA1db5425Cf3Ee9dB59C8e3cd";
const newOwnerAddress = "0x8d388136d578dCD791D081c6042284CED6d9B0c6";

const main = async () => {
  const strategy = await ethers.getContractAt("Ownable", strategyAddress);
  await strategy.transferOwnership(newOwnerAddress);
};

main();
