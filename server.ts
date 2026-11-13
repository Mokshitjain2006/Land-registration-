import "dotenv/config";
import fs from "node:fs";
import http from "node:http";
import express from "express";
import cors from "cors";
import path from "node:path";
import { spawn, execSync } from "node:child_process";
import { createServer as createViteServer } from "vite";
import { apiRouter } from "./backend/src/routes/api.ts";
import { RPC_URL, loadContractArtifact, getRpcProvider } from "./backend/src/blockchain.ts";

const rawPort = Number(process.env.PORT || 3000);
const PORT =
  process.env.NGINX_PORT && rawPort === Number(process.env.NGINX_PORT)
    ? Number(process.env.DEFAULT_APP_PORT || 3000)
    : rawPort;
const isProd = process.env.NODE_ENV === "production";

async function ensureLocalBlockchain() {
  const isReachable = async () => {
    try {
      const provider = getRpcProvider();
      await provider.getBlockNumber();
      return true;
    } catch {
      return false;
    }
  };

  if (!(await isReachable())) {
    console.log("Local Hardhat node not detected on 8545. Starting local Hardhat node...");
    const hardhatProc = spawn("npx", ["hardhat", "node", "--hostname", "127.0.0.1", "--port", "8545"], {
      stdio: "ignore",
      detached: true,
    });
    hardhatProc.unref();

    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 500));
      if (await isReachable()) break;
    }
  }

  // Ensure LandRegistry contract is deployed on the live RPC node
  try {
    const provider = getRpcProvider();
    const artifact = loadContractArtifact();
    let needsDeploy = !artifact?.address;
    if (artifact?.address) {
      const code = await provider.getCode(artifact.address);
      if (!code || code === "0x" || code.length <= 2) {
        needsDeploy = true;
      }
    }
    if (needsDeploy) {
      console.log("Deploying LandRegistry smart contract to local Hardhat network...");
      execSync("npx hardhat run scripts/deploy.js --network localhost", {
        stdio: "inherit",
      });
      const deployedJsonPath = path.resolve(process.cwd(), "src", "contracts", "LandRegistry.json");
      if (fs.existsSync(deployedJsonPath)) {
        const deployed = JSON.parse(fs.readFileSync(deployedJsonPath, "utf8")) as {
          address?: string;
          admin?: string;
        };
        if (deployed.address) {
          process.env.CONTRACT_ADDRESS = deployed.address;
          process.env.VITE_CONTRACT_ADDRESS = deployed.address;
        }
        if (deployed.admin) {
          process.env.ADMIN_ADDRESS = deployed.admin;
        }
      }
    }
  } catch (err) {
    console.error("Failed to verify or deploy smart contract on startup:", err);
  }
}

async function ensureDatabaseReady() {
  const dbFile = path.resolve(process.cwd(), "backend", "prisma", "landchain.db");
  if (!fs.existsSync(dbFile)) {
    console.log("Initializing SQLite database from Prisma schema...");
    execSync("npx prisma db push --schema=backend/prisma/schema.prisma", {
      stdio: "inherit",
    });
  }
}

async function startServer() {
  await ensureDatabaseReady();
  await ensureLocalBlockchain();

  const app = express();
  const httpServer = http.createServer(app);
  app.use(cors());
  app.use(express.json({ limit: "2mb" }));

  app.use("/api", apiRouter);

  if (!isProd) {
    const hmrDisabled = process.env.DISABLE_HMR === "true";
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: { server: httpServer },
        hmr: hmrDisabled ? false : true,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), "dist");
    app.use(express.static(distDir));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`LandChain server running at http://localhost:${PORT} (RPC: ${RPC_URL})`);
  });
}

startServer().catch((err) => {
  console.error("Server failed to start:", err);
  process.exit(1);
});
