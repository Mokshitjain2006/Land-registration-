import fs from "node:fs";
import path from "node:path";
import { ethers } from "ethers";

function cleanEnv(val: string | undefined): string {
  return (val || "").trim().replace(/^["']|["']$/g, "").trim();
}

export const RPC_URL = cleanEnv(process.env.BLOCKCHAIN_RPC_URL) || "http://127.0.0.1:8545";
export const EXPECTED_CHAIN_ID = Number(cleanEnv(process.env.CHAIN_ID) || 31337);

export interface ContractArtifact {
  contractName: string;
  address: string;
  admin: string;
  chainId: number;
  deployedAt: string;
  abi: ethers.InterfaceAbi;
}

export function loadContractArtifact(): ContractArtifact | null {
  const artifactPath = path.resolve(process.cwd(), "src", "contracts", "LandRegistry.json");
  if (!fs.existsSync(artifactPath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(artifactPath, "utf8");
    const parsed = JSON.parse(raw) as ContractArtifact;
    return {
      ...parsed,
      address: cleanEnv(process.env.CONTRACT_ADDRESS) || parsed.address,
      admin: cleanEnv(process.env.ADMIN_ADDRESS) || parsed.admin,
    };
  } catch {
    return null;
  }
}

export function getRpcProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(RPC_URL);
}

export function getReadOnlyContract(): {
  contract: ethers.Contract;
  artifact: ContractArtifact;
  provider: ethers.JsonRpcProvider;
} | null {
  const artifact = loadContractArtifact();
  if (!artifact || !artifact.address) return null;
  const provider = getRpcProvider();
  const contract = new ethers.Contract(artifact.address, artifact.abi, provider);
  return { contract, artifact, provider };
}

export interface OnChainLand {
  propertyId: number;
  currentOwner: string;
  location: string;
  village: string;
  district: string;
  state: string;
  surveyNumber: string;
  area: number;
  documentHash: string;
  registeredAt: number;
  exists: boolean;
}

export interface OnChainTransfer {
  propertyId: number;
  currentOwner: string;
  proposedOwner: string;
  requestTimestamp: number;
  recipientAccepted: boolean;
  completed: boolean;
  rejected: boolean;
  cancelled: boolean;
  active: boolean;
}

export async function fetchAllOnChainProperties() {
  const ctx = getReadOnlyContract();
  if (!ctx) return [];
  const { contract } = ctx;
  const ids: bigint[] = await contract.getAllPropertyIds();
  const items = await Promise.all(
    ids.map(async (id) => {
      const land = await contract.getLandDetails(id);
      const pending = await contract.getPendingTransfer(id);
      const history: string[] = await contract.getOwnershipHistory(id);
      return {
        propertyId: Number(land.propertyId),
        currentOwner: land.currentOwner as string,
        location: land.location as string,
        village: land.village as string,
        district: land.district as string,
        state: land.state as string,
        surveyNumber: land.surveyNumber as string,
        area: Number(land.area),
        documentHash: land.documentHash as string,
        registeredAt: Number(land.registeredAt),
        exists: Boolean(land.exists),
        ownershipHistory: history,
        pendingTransfer: {
          propertyId: Number(pending.propertyId),
          currentOwner: pending.currentOwner as string,
          proposedOwner: pending.proposedOwner as string,
          requestTimestamp: Number(pending.requestTimestamp),
          recipientAccepted: Boolean(pending.recipientAccepted),
          completed: Boolean(pending.completed),
          rejected: Boolean(pending.rejected),
          cancelled: Boolean(pending.cancelled),
          active: Boolean(pending.active),
        },
      };
    })
  );
  return items;
}

export interface OnChainEventRecord {
  transactionHash: string;
  blockNumber: number;
  eventType: string;
  propertyId: number;
  previousOwner: string;
  newOwner: string;
  timestamp: number;
  status: string;
}

export async function fetchOnChainEvents(): Promise<OnChainEventRecord[]> {
  const ctx = getReadOnlyContract();
  if (!ctx) return [];
  const { contract, provider } = ctx;
  const latestBlock = await provider.getBlockNumber();

  const [
    registered,
    requested,
    accepted,
    transferred,
    rejected,
    cancelled,
  ] = await Promise.all([
    contract.queryFilter(contract.filters.LandRegistered(), 0, latestBlock),
    contract.queryFilter(contract.filters.TransferRequested(), 0, latestBlock),
    contract.queryFilter(contract.filters.TransferAccepted(), 0, latestBlock),
    contract.queryFilter(contract.filters.OwnershipTransferred(), 0, latestBlock),
    contract.queryFilter(contract.filters.TransferRejected(), 0, latestBlock),
    contract.queryFilter(contract.filters.TransferCancelled(), 0, latestBlock),
  ]);

  const records: OnChainEventRecord[] = [];

  for (const ev of registered) {
    const log = ev as ethers.EventLog;
    records.push({
      transactionHash: log.transactionHash,
      blockNumber: log.blockNumber,
      eventType: "LandRegistered",
      propertyId: Number(log.args[0]),
      previousOwner: ethers.ZeroAddress,
      newOwner: String(log.args[1]),
      timestamp: Number(log.args[4]),
      status: "Confirmed",
    });
  }

  for (const ev of requested) {
    const log = ev as ethers.EventLog;
    records.push({
      transactionHash: log.transactionHash,
      blockNumber: log.blockNumber,
      eventType: "TransferRequested",
      propertyId: Number(log.args[0]),
      previousOwner: String(log.args[1]),
      newOwner: String(log.args[2]),
      timestamp: Number(log.args[3]),
      status: "Confirmed",
    });
  }

  for (const ev of accepted) {
    const log = ev as ethers.EventLog;
    records.push({
      transactionHash: log.transactionHash,
      blockNumber: log.blockNumber,
      eventType: "TransferAccepted",
      propertyId: Number(log.args[0]),
      previousOwner: "",
      newOwner: String(log.args[1]),
      timestamp: Number(log.args[2]),
      status: "Confirmed",
    });
  }

  for (const ev of transferred) {
    const log = ev as ethers.EventLog;
    records.push({
      transactionHash: log.transactionHash,
      blockNumber: log.blockNumber,
      eventType: "OwnershipTransferred",
      propertyId: Number(log.args[0]),
      previousOwner: String(log.args[1]),
      newOwner: String(log.args[2]),
      timestamp: Number(log.args[3]),
      status: "Confirmed",
    });
  }

  for (const ev of rejected) {
    const log = ev as ethers.EventLog;
    records.push({
      transactionHash: log.transactionHash,
      blockNumber: log.blockNumber,
      eventType: "TransferRejected",
      propertyId: Number(log.args[0]),
      previousOwner: String(log.args[2]),
      newOwner: String(log.args[1]),
      timestamp: Number(log.args[3]),
      status: "Rejected",
    });
  }

  for (const ev of cancelled) {
    const log = ev as ethers.EventLog;
    records.push({
      transactionHash: log.transactionHash,
      blockNumber: log.blockNumber,
      eventType: "TransferCancelled",
      propertyId: Number(log.args[0]),
      previousOwner: String(log.args[1]),
      newOwner: "",
      timestamp: Number(log.args[2]),
      status: "Cancelled",
    });
  }

  records.sort((a, b) => b.blockNumber - a.blockNumber || b.timestamp - a.timestamp);
  return records;
}
