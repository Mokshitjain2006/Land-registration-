import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import hre from "hardhat";

function sha256Bytes32(text) {
  return "0x" + crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

async function main() {
  const [admin, owner1, owner2, owner3] = await hre.ethers.getSigners();
  console.log("Deploying LandRegistry with admin account:", admin.address);

  const LandRegistry = await hre.ethers.getContractFactory("LandRegistry");
  const contract = await LandRegistry.deploy();
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  console.log("LandRegistry deployed to:", contractAddress);

  // Save contract address & ABI for frontend and backend
  const artifact = await hre.artifacts.readArtifact("LandRegistry");
  const deploymentPayload = {
    contractName: "LandRegistry",
    address: contractAddress,
    admin: admin.address,
    chainId: 31337,
    deployedAt: new Date().toISOString(),
    abi: artifact.abi,
  };

  const outDir = path.resolve(process.cwd(), "src", "contracts");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "LandRegistry.json"),
    JSON.stringify(deploymentPayload, null, 2),
    "utf8"
  );

  // Sync deployed contract address & admin into root .env
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    let envText = fs.readFileSync(envPath, "utf8");
    const upsertVar = (text, key, value) => {
      const regex = new RegExp(`^${key}=.*$`, "m");
      const line = `${key}=${value}`;
      return regex.test(text) ? text.replace(regex, line) : `${text.trimEnd()}\n${line}\n`;
    };
    envText = upsertVar(envText, "CONTRACT_ADDRESS", contractAddress);
    envText = upsertVar(envText, "ADMIN_ADDRESS", admin.address);
    envText = upsertVar(envText, "VITE_CONTRACT_ADDRESS", contractAddress);
    fs.writeFileSync(envPath, envText, "utf8");
  }

  // Seed initial sample academic properties only if registry is empty
  const existingCount = await contract.getLandCount();
  if (existingCount === 0n) {
    console.log("Seeding sample academic land parcels for demonstration...");

    const sampleDocsDir = path.resolve(process.cwd(), "backend", "storage", "samples");
    fs.mkdirSync(sampleDocsDir, { recursive: true });

    const samples = [
      {
        propertyId: 1001,
        owner: owner1.address,
        location: "Plot 14, Greenview Civic Enclave, Sector 8",
        village: "Indiranagar",
        district: "Bengaluru Urban",
        state: "Karnataka",
        surveyNumber: "SUR-KA-2026-1001",
        area: 2400,
        deedContent:
          "LANDCHAIN ACADEMIC SAMPLE TITLE DEED\nProperty ID: 1001\nSurvey Number: SUR-KA-2026-1001\nLocation: Plot 14, Greenview Civic Enclave, Sector 8, Indiranagar, Bengaluru Urban, Karnataka\nArea: 2400 sq.ft.\nNote: Academic prototype test deed for SHA-256 verification.",
      },
      {
        propertyId: 1002,
        owner: owner2.address,
        location: "Parcel 42B, North Riverfront Commercial Zone",
        village: "Baner",
        district: "Pune",
        state: "Maharashtra",
        surveyNumber: "SUR-MH-2026-1002",
        area: 4850,
        deedContent:
          "LANDCHAIN ACADEMIC SAMPLE TITLE DEED\nProperty ID: 1002\nSurvey Number: SUR-MH-2026-1002\nLocation: Parcel 42B, North Riverfront Commercial Zone, Baner, Pune, Maharashtra\nArea: 4850 sq.ft.\nNote: Academic prototype test deed for SHA-256 verification.",
      },
      {
        propertyId: 1003,
        owner: owner1.address,
        location: "Survey Lot 7, Lakeview Agricultural Terrace",
        village: "Kakkanad",
        district: "Ernakulam",
        state: "Kerala",
        surveyNumber: "SUR-KL-2026-1003",
        area: 6200,
        deedContent:
          "LANDCHAIN ACADEMIC SAMPLE TITLE DEED\nProperty ID: 1003\nSurvey Number: SUR-KL-2026-1003\nLocation: Survey Lot 7, Lakeview Agricultural Terrace, Kakkanad, Ernakulam, Kerala\nArea: 6200 sq.ft.\nNote: Academic prototype test deed for SHA-2026 verification.",
      },
      {
        propertyId: 1004,
        owner: owner3.address,
        location: "Block C-19, Heritage Institutional Precinct",
        village: "Gachibowli",
        district: "Rangareddy",
        state: "Telangana",
        surveyNumber: "SUR-TS-2026-1004",
        area: 3150,
        deedContent:
          "LANDCHAIN ACADEMIC SAMPLE TITLE DEED\nProperty ID: 1004\nSurvey Number: SUR-TS-2026-1004\nLocation: Block C-19, Heritage Institutional Precinct, Gachibowli, Rangareddy, Telangana\nArea: 3150 sq.ft.\nNote: Academic prototype test deed for SHA-256 verification.",
      },
    ];

    for (const s of samples) {
      const docHash = sha256Bytes32(s.deedContent);
      const tx = await contract.registerLand(
        s.propertyId,
        s.owner,
        s.location,
        s.village,
        s.district,
        s.state,
        s.surveyNumber,
        s.area,
        docHash
      );
      await tx.wait();
      fs.writeFileSync(
        path.join(sampleDocsDir, `deed_${s.propertyId}.txt`),
        s.deedContent,
        "utf8"
      );
    }

    // Create 1 pending transfer (owner1 -> owner2 for 1003, accepted by owner2 so admin can test approve/reject)
    const txReq = await contract.connect(owner1).requestTransfer(1003, owner2.address);
    await txReq.wait();
    const txAcc = await contract.connect(owner2).acceptTransfer(1003);
    await txAcc.wait();

    console.log("Seeded 4 properties and 1 pending admin-approval transfer on-chain.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
