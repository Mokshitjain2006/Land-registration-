import express from "express";
import multer from "multer";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "../db.ts";
import {
  RPC_URL,
  EXPECTED_CHAIN_ID,
  loadContractArtifact,
  getRpcProvider,
  fetchAllOnChainProperties,
  fetchOnChainEvents,
  getReadOnlyContract,
} from "../blockchain.ts";

export const apiRouter = express.Router();

const cleanUploadDir = (process.env.UPLOAD_DIR || "backend/storage/uploads")
  .trim()
  .replace(/^["']|["']$/g, "");
const uploadDir = path.resolve(process.cwd(), cleanUploadDir || "backend/storage/uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const allowedMimeTypes = new Set([
  "application/pdf",
  "text/plain",
  "application/octet-stream",
]);

const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

function computeSha256Hex(buffer: Buffer): string {
  return "0x" + crypto.createHash("sha256").update(buffer).digest("hex");
}

apiRouter.get("/health", async (_req, res) => {
  const artifact = loadContractArtifact();
  let blockchainConnected = false;
  let blockNumber = 0;
  let contractDeployed = false;

  try {
    const provider = getRpcProvider();
    blockNumber = await provider.getBlockNumber();
    blockchainConnected = true;
    if (artifact?.address) {
      const code = await provider.getCode(artifact.address);
      contractDeployed = code !== "0x" && code.length > 2;
    }
  } catch {
    blockchainConnected = false;
  }

  let databaseConnected = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    databaseConnected = true;
  } catch {
    databaseConnected = false;
  }

  res.json({
    status: blockchainConnected && databaseConnected ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    blockchain: {
      connected: blockchainConnected,
      chainId: EXPECTED_CHAIN_ID,
      blockNumber,
      contractAddress: artifact?.address || null,
      contractDeployed,
      adminAddress: artifact?.admin || null,
    },
    database: {
      connected: databaseConnected,
      provider: "sqlite",
    },
  });
});

apiRouter.get("/config", async (_req, res) => {
  const artifact = loadContractArtifact();
  const samplesDir = path.resolve(process.cwd(), "backend", "storage", "samples");
  let sampleIds: number[] = [];
  if (fs.existsSync(samplesDir)) {
    sampleIds = fs
      .readdirSync(samplesDir)
      .filter((f) => f.startsWith("deed_") && f.endsWith(".txt"))
      .map((f) => Number(f.replace("deed_", "").replace(".txt", "")))
      .filter((n) => !Number.isNaN(n))
      .sort((a, b) => a - b);
  }

  res.json({
    chainId: EXPECTED_CHAIN_ID,
    rpcUrl: RPC_URL,
    contractAddress: artifact?.address || null,
    adminAddress: artifact?.admin || null,
    abi: artifact?.abi || [],
    sampleDeedIds: sampleIds,
  });
});

apiRouter.post("/rpc", async (req, res) => {
  const body = req.body;
  const isSingle = Boolean(
    body && typeof body === "object" && !Array.isArray(body) && typeof body.method === "string"
  );
  const isBatch = Boolean(
    Array.isArray(body) &&
      body.length > 0 &&
      body.every((item) => item && typeof item === "object" && typeof item.method === "string")
  );
  if (!isSingle && !isBatch) {
    return res.status(400).json({
      jsonrpc: "2.0",
      id: body?.id ?? null,
      error: { code: -32600, message: "Invalid JSON-RPC request payload" },
    });
  }
  try {
    const response = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(503).json({
      jsonrpc: "2.0",
      id: req.body?.id ?? null,
      error: {
        code: -32000,
        message: err instanceof Error ? err.message : "Local Hardhat RPC unavailable",
      },
    });
  }
});

apiRouter.get("/properties", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim().toLowerCase();
    const ownerFilter = String(req.query.owner || "").trim().toLowerCase();

    const onChainProperties = await fetchAllOnChainProperties();
    const metadataRows = await prisma.propertyMetadata.findMany();
    const metaMap = new Map(metadataRows.map((m) => [m.propertyId, m]));

    let combined = onChainProperties.map((prop) => {
      const meta = metaMap.get(prop.propertyId);
      return {
        ...prop,
        metadata: meta
          ? {
              description: meta.description,
              documentStorageReference: meta.documentStorageReference,
              originalFileName: meta.originalFileName,
              fileSizeBytes: meta.fileSizeBytes,
              createdAt: meta.createdAt,
            }
          : null,
      };
    });

    if (ownerFilter) {
      combined = combined.filter(
        (p) => p.currentOwner.toLowerCase() === ownerFilter
      );
    }

    if (q) {
      combined = combined.filter(
        (p) =>
          String(p.propertyId).includes(q) ||
          p.surveyNumber.toLowerCase().includes(q) ||
          p.location.toLowerCase().includes(q) ||
          p.district.toLowerCase().includes(q) ||
          p.state.toLowerCase().includes(q) ||
          p.village.toLowerCase().includes(q) ||
          p.currentOwner.toLowerCase().includes(q)
      );
    }

    res.json({
      sourceOfTruth: "blockchain",
      count: combined.length,
      properties: combined,
    });
  } catch (err) {
    res.status(500).json({
      error: "Failed to read properties from blockchain",
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

apiRouter.get("/properties/:id", async (req, res) => {
  try {
    const rawId = req.params.id.trim();
    if (!rawId) {
      return res.status(400).json({ error: "Property ID or survey number is required" });
    }
    const ctx = getReadOnlyContract();
    if (!ctx) {
      return res.status(503).json({ error: "Smart contract is not deployed yet" });
    }
    const { contract } = ctx;

    let propertyIdNum = /^\d+$/.test(rawId) ? Number(rawId) : NaN;
    if (!Number.isInteger(propertyIdNum) || propertyIdNum <= 0) {
      // Allow lookup by survey number as fallback
      const resolvedId = await contract.getPropertyIdBySurveyNumber(rawId);
      propertyIdNum = Number(resolvedId);
      if (!propertyIdNum) {
        return res.status(404).json({ error: "Property not found on blockchain" });
      }
    }

    const land = await contract.getLandDetails(propertyIdNum);
    if (!land.exists) {
      return res.status(404).json({ error: "Property not found on blockchain" });
    }

    const [pending, history, metadata] = await Promise.all([
      contract.getPendingTransfer(propertyIdNum),
      contract.getOwnershipHistory(propertyIdNum),
      prisma.propertyMetadata.findUnique({ where: { propertyId: propertyIdNum } }),
    ]);

    res.json({
      propertyId: Number(land.propertyId),
      currentOwner: land.currentOwner,
      location: land.location,
      village: land.village,
      district: land.district,
      state: land.state,
      surveyNumber: land.surveyNumber,
      area: Number(land.area),
      documentHash: land.documentHash,
      registeredAt: Number(land.registeredAt),
      exists: Boolean(land.exists),
      ownershipHistory: history,
      pendingTransfer: {
        propertyId: Number(pending.propertyId),
        currentOwner: pending.currentOwner,
        proposedOwner: pending.proposedOwner,
        requestTimestamp: Number(pending.requestTimestamp),
        recipientAccepted: Boolean(pending.recipientAccepted),
        completed: Boolean(pending.completed),
        rejected: Boolean(pending.rejected),
        cancelled: Boolean(pending.cancelled),
        active: Boolean(pending.active),
      },
      metadata: metadata || null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("Property does not exist")) {
      return res.status(404).json({ error: "Property does not exist on blockchain" });
    }
    res.status(500).json({ error: "Failed to query property details", details: message });
  }
});

apiRouter.get("/transfers", async (_req, res) => {
  try {
    const events = await fetchOnChainEvents();

    // Sync event cache to SQLite idempotently (non-fatal on concurrent reads)
    try {
      for (const ev of events) {
        await prisma.transactionCache.upsert({
          where: {
            transactionHash_eventType_propertyId: {
              transactionHash: ev.transactionHash,
              eventType: ev.eventType,
              propertyId: ev.propertyId,
            },
          },
          update: {},
          create: {
            transactionHash: ev.transactionHash,
            propertyId: ev.propertyId,
            eventType: ev.eventType,
            blockNumber: ev.blockNumber,
            previousOwner: ev.previousOwner || null,
            newOwner: ev.newOwner || null,
            timestamp: ev.timestamp,
          },
        });
      }
    } catch {
      // Cache sync skipped if SQLite is briefly busy; live blockchain events still returned
    }

    res.json({
      sourceOfTruth: "blockchain",
      count: events.length,
      events,
    });
  } catch (err) {
    res.status(500).json({
      error: "Failed to load blockchain events",
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

apiRouter.post("/documents/hash", uploadMemory.single("document"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No document file provided" });
  }
  const hash = computeSha256Hex(req.file.buffer);
  res.json({
    fileName: req.file.originalname,
    mimeType: req.file.mimetype,
    sizeBytes: req.file.size,
    documentHash: hash,
  });
});

apiRouter.post("/documents/upload", uploadMemory.single("document"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Property document file is required" });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    if (!allowedMimeTypes.has(req.file.mimetype) && ext !== ".pdf" && ext !== ".txt") {
      return res.status(400).json({
        error: "Unsupported file format. Please upload a PDF or TXT property deed.",
      });
    }

    const propertyId = Number(req.body.propertyId);
    if (!Number.isInteger(propertyId) || propertyId <= 0) {
      return res.status(400).json({ error: "Valid positive integer propertyId is required" });
    }

    const ctx = getReadOnlyContract();
    if (!ctx) {
      return res.status(503).json({ error: "Smart contract is not deployed yet" });
    }

    const documentHash = computeSha256Hex(req.file.buffer);

    // Verify property exists on-chain and uploaded deed SHA-256 matches immutable on-chain documentHash
    let onChainLand;
    try {
      onChainLand = await ctx.contract.getLandDetails(propertyId);
    } catch {
      return res.status(404).json({
        error: `Property #${propertyId} is not registered on the blockchain yet.`,
      });
    }

    if (!onChainLand?.exists) {
      return res.status(404).json({
        error: `Property #${propertyId} does not exist on the blockchain.`,
      });
    }

    if (String(onChainLand.documentHash).toLowerCase() !== documentHash.toLowerCase()) {
      return res.status(403).json({
        error: "Document SHA-256 hash does not match the on-chain LandRegistry record.",
      });
    }

    const txHash = typeof req.body.txHash === "string" ? req.body.txHash.trim() : "";
    if (txHash) {
      if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
        return res.status(400).json({ error: "Invalid transaction hash format" });
      }
      const receipt = await ctx.provider.getTransactionReceipt(txHash);
      if (!receipt || receipt.status !== 1) {
        return res.status(400).json({ error: "On-chain transaction receipt is invalid or unconfirmed" });
      }
      if (receipt.from.toLowerCase() !== ctx.artifact.admin.toLowerCase()) {
        return res.status(403).json({ error: "Only the registry admin transaction may attach deed metadata" });
      }
    }

    const storageId = `${uuidv4()}${ext === ".txt" ? ".txt" : ".pdf"}`;
    const storagePath = path.join(uploadDir, storageId);
    fs.writeFileSync(storagePath, req.file.buffer);

    const description = String(req.body.description || "").trim().slice(0, 500) || null;

    const record = await prisma.propertyMetadata.upsert({
      where: { propertyId },
      update: {
        description,
        documentStorageReference: storageId,
        originalFileName: req.file.originalname,
        fileSizeBytes: req.file.size,
        documentHash,
      },
      create: {
        propertyId,
        description,
        documentStorageReference: storageId,
        originalFileName: req.file.originalname,
        fileSizeBytes: req.file.size,
        documentHash,
      },
    });

    res.status(201).json({
      message: "Document stored off-chain in access-controlled vault",
      documentHash,
      metadata: record,
    });
  } catch (err) {
    res.status(500).json({
      error: "Failed to process document upload",
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

apiRouter.get("/samples/:propertyId", (req, res) => {
  const id = Number(req.params.propertyId);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid property ID" });
  }
  const samplePath = path.resolve(
    process.cwd(),
    "backend",
    "storage",
    "samples",
    `deed_${id}.txt`
  );
  if (!fs.existsSync(samplePath)) {
    return res.status(404).json({ error: "Sample deed not available for this property" });
  }
  res.download(samplePath, `landchain_sample_deed_${id}.txt`);
});

apiRouter.get("/activity", async (_req, res) => {
  try {
    const items = await prisma.applicationActivity.findMany({
      orderBy: { timestamp: "desc" },
      take: 30,
    });
    res.json({ activities: items });
  } catch (err) {
    res.status(500).json({
      error: "Failed to read activity log",
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

apiRouter.post("/activity", async (req, res) => {
  try {
    const walletAddress = String(req.body.walletAddress || "").trim();
    const action = String(req.body.action || "").trim().slice(0, 100);
    const details = req.body.details ? String(req.body.details).trim().slice(0, 500) : null;

    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress) || !action) {
      return res.status(400).json({ error: "Valid walletAddress and action are required" });
    }

    const item = await prisma.applicationActivity.create({
      data: { walletAddress, action, details },
    });
    res.status(201).json({ activity: item });
  } catch (err) {
    res.status(500).json({
      error: "Failed to record activity",
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

apiRouter.get("/contact", async (_req, res) => {
  try {
    const inquiries = await prisma.contactInquiry.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json({ count: inquiries.length, inquiries });
  } catch (err) {
    res.status(500).json({
      error: "Failed to load contact inquiries",
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

apiRouter.post("/contact", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim();
    const subject = String(req.body.subject || "").trim();
    const message = String(req.body.message || "").trim();

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: "All contact form fields are required" });
    }
    if (name.length > 120 || subject.length > 200 || message.length > 2000) {
      return res.status(400).json({ error: "Contact form field exceeds maximum length" });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Please provide a valid email address" });
    }

    const inquiry = await prisma.contactInquiry.create({
      data: { name, email, subject, message },
    });
    res.status(201).json({
      message: "Inquiry recorded. Thank you for contacting LandChain.",
      inquiryId: inquiry.id,
    });
  } catch (err) {
    res.status(500).json({
      error: "Failed to save contact inquiry",
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

apiRouter.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "File exceeds the 10 MB maximum upload limit." });
    }
    return res.status(400).json({ error: err.message });
  }
  return res.status(500).json({
    error: err instanceof Error ? err.message : "Unexpected backend error",
  });
});

apiRouter.use((_req, res) => {
  res.status(404).json({ error: "API endpoint not found" });
});
