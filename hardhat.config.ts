import "dotenv/config";

import { HardhatUserConfig, task } from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "@openzeppelin/hardhat-upgrades";
import "hardhat-gas-reporter";
import "hardhat-contract-sizer";
import "solidity-coverage";

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (_, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

const apiKey: Record<string, string> = {};
if (process.env.BSC_API_KEY) {
  apiKey.bscTestnet = process.env.BSC_API_KEY;
  apiKey.bsc = process.env.BSC_API_KEY;
}

const pks = [];
if (process.env.DEPLOYER_PK) {
  pks.push(process.env.DEPLOYER_PK);
}
if (process.env.PK_1) {
  pks.push(process.env.PK_1);
}
if (process.env.PK_2) {
  pks.push(process.env.PK_2);
}

let forking;
if (process.env.FORKING_URL) {
  forking = {
    url: process.env.FORKING_URL,
  };
}

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more
const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.15",
    settings: {
      optimizer: {
        enabled: true,
        runs: 201,
      },
    },
  },
  networks: {
    hardhat: {
      forking,
      accounts: {
        mnemonic: "test test test test test test test test test test test test",
        count: 10,
        accountsBalance: "100000000000000000000000000",
      },
    },
    bscTestnet: {
      url: process.env.BSC_TESTNET_URL || "",
      accounts: pks,
    },
    bsc: {
      url: process.env.BSC_URL || "",
      accounts: pks,
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  etherscan: {
    apiKey,
  },
};

export default config;
