import type { BlockchainEventItem, PropertyRecord } from "../utils/registry";

export interface HealthResponse {
  status: string;
  timestamp: string;
  blockchain: {
    connected: boolean;
    chainId: number;
    blockNumber: number;
    contractAddress: string | null;
    contractDeployed: boolean;
    adminAddress: string | null;
  };
  database: {
    connected: boolean;
    provider: string;
  };
}

export interface ConfigResponse {
  chainId: number;
  rpcUrl: string;
  contractAddress: string | null;
  adminAddress: string | null;
  abi: unknown[];
  sampleDeedIds: number[];
}

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch("/api/health");
  if (!res.ok) throw new Error("Failed to fetch health status");
  return res.json();
}

export async function fetchAppConfig(): Promise<ConfigResponse> {
  const res = await fetch("/api/config");
  if (!res.ok) throw new Error("Failed to fetch contract configuration");
  return res.json();
}

export async function fetchProperties(query = ""): Promise<PropertyRecord[]> {
  const url = query
    ? `/api/properties?q=${encodeURIComponent(query)}`
    : "/api/properties";
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch on-chain properties");
  const data = await res.json();
  return data.properties || [];
}

export async function fetchPropertyById(idOrSurvey: string): Promise<PropertyRecord> {
  const res = await fetch(`/api/properties/${encodeURIComponent(idOrSurvey)}`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Property not found on blockchain");
  }
  return data;
}

export async function fetchBlockchainEvents(): Promise<BlockchainEventItem[]> {
  const res = await fetch("/api/transfers");
  if (!res.ok) throw new Error("Failed to load blockchain transaction history");
  const data = await res.json();
  return data.events || [];
}

export interface ContactInquiryItem {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  createdAt: string;
}

export async function uploadPropertyDocument(
  propertyId: number,
  file: File,
  description: string,
  txHash?: string
) {
  const form = new FormData();
  form.append("propertyId", String(propertyId));
  form.append("description", description);
  if (txHash) {
    form.append("txHash", txHash);
  }
  form.append("document", file);

  const res = await fetch("/api/documents/upload", {
    method: "POST",
    body: form,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to upload property document");
  }
  return data;
}

export async function recordActivity(
  walletAddress: string,
  action: string,
  details?: string
) {
  try {
    await fetch("/api/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress, action, details }),
    });
  } catch {
    // Non-blocking activity log
  }
}

export async function fetchContactInquiries(): Promise<ContactInquiryItem[]> {
  const res = await fetch("/api/contact");
  if (!res.ok) throw new Error("Failed to fetch contact inquiries");
  const data = await res.json();
  return data.inquiries || [];
}

export async function submitContactInquiry(payload: {
  name: string;
  email: string;
  subject: string;
  message: string;
}) {
  const res = await fetch("/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to send inquiry");
  }
  return data;
}

export async function fetchHardhatRpcAccounts(): Promise<string[]> {
  const res = await fetch("/api/rpc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_accounts",
      params: [],
    }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.result) ? data.result : [];
}
