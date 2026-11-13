import "dotenv/config";
import "@nomicfoundation/hardhat-toolbox";

const chainId = Number(process.env.CHAIN_ID || 31337);
const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || "http://127.0.0.1:8545";

/** @type import('hardhat/config').HardhatUserConfig */
export default {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      chainId,
    },
    localhost: {
      url: rpcUrl,
      chainId,
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
