export type UserRole = "ADMIN" | "OWNER" | "PUBLIC";

export interface TransferInfo {
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

export interface PropertyRecord {
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
  ownershipHistory: string[];
  pendingTransfer: TransferInfo;
  metadata?: {
    description: string | null;
    documentStorageReference: string | null;
    originalFileName: string | null;
    fileSizeBytes: number | null;
    createdAt: string;
  } | null;
}

export interface BlockchainEventItem {
  transactionHash: string;
  blockNumber: number;
  eventType: string;
  propertyId: number;
  previousOwner: string;
  newOwner: string;
  timestamp: number;
  status: string;
}

export type TransferStatusLabel =
  | "None"
  | "Pending Recipient Acceptance"
  | "Pending Admin Approval"
  | "Approved"
  | "Rejected"
  | "Cancelled";

export function deriveUserRole(
  connectedAddress: string | null,
  adminAddress: string | null,
  properties: PropertyRecord[]
): UserRole {
  if (!connectedAddress) return "PUBLIC";
  const normalized = connectedAddress.toLowerCase();
  if (adminAddress && normalized === adminAddress.toLowerCase()) {
    return "ADMIN";
  }
  const ownsAny = properties.some((p) => p.currentOwner.toLowerCase() === normalized);
  if (ownsAny) return "OWNER";
  return "PUBLIC";
}

export function getTransferStatusLabel(transfer: TransferInfo | null | undefined): TransferStatusLabel {
  if (!transfer || transfer.propertyId === 0) return "None";
  if (transfer.active) {
    return transfer.recipientAccepted
      ? "Pending Admin Approval"
      : "Pending Recipient Acceptance";
  }
  if (transfer.completed) return "Approved";
  if (transfer.rejected) return "Rejected";
  if (transfer.cancelled) return "Cancelled";
  return "None";
}

export function computeRegistryStats(
  properties: PropertyRecord[],
  events: BlockchainEventItem[]
) {
  const uniqueOwners = new Set(properties.map((p) => p.currentOwner.toLowerCase()));
  const pendingTransfers = properties.filter((p) => p.pendingTransfer?.active).length;
  const completedTransfers = events.filter(
    (e) => e.eventType === "OwnershipTransferred"
  ).length;

  const stateCounts = new Map<string, number>();
  for (const p of properties) {
    stateCounts.set(p.state, (stateCounts.get(p.state) || 0) + 1);
  }
  const stateDistribution = Array.from(stateCounts.entries()).map(([state, count]) => ({
    state,
    count,
  }));

  const eventCounts = new Map<string, number>();
  for (const ev of events) {
    eventCounts.set(ev.eventType, (eventCounts.get(ev.eventType) || 0) + 1);
  }
  const activityBreakdown = [
    { name: "Registered", count: eventCounts.get("LandRegistered") || 0 },
    { name: "Requested", count: eventCounts.get("TransferRequested") || 0 },
    { name: "Accepted", count: eventCounts.get("TransferAccepted") || 0 },
    { name: "Transferred", count: eventCounts.get("OwnershipTransferred") || 0 },
    { name: "Rejected", count: eventCounts.get("TransferRejected") || 0 },
  ];

  return {
    totalLands: properties.length,
    totalOwners: uniqueOwners.size,
    pendingTransfers,
    completedTransfers,
    stateDistribution,
    activityBreakdown,
  };
}

export function parseQrVerificationPayload(rawValue: string): {
  propertyId: string | null;
  url: string | null;
} {
  const trimmed = rawValue.trim();
  if (!trimmed) return { propertyId: null, url: null };

  // Match plain numeric ID
  if (/^\d+$/.test(trimmed)) {
    return { propertyId: trimmed, url: null };
  }

  // Match JSON payload { propertyId, verifyUrl }
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as { propertyId?: string | number; verifyUrl?: string };
      if (parsed.propertyId !== undefined) {
        return {
          propertyId: String(parsed.propertyId),
          url: parsed.verifyUrl || null,
        };
      }
    } catch {
      // fall through
    }
  }

  // Match URL like https://.../verify/1001 or .../verify?propertyId=1001
  try {
    const parsedUrl = new URL(trimmed);
    const paramId = parsedUrl.searchParams.get("propertyId");
    if (paramId && /^\d+$/.test(paramId)) {
      return { propertyId: paramId, url: trimmed };
    }
    const pathMatch = parsedUrl.pathname.match(/\/verify\/(\d+)/);
    if (pathMatch) {
      return { propertyId: pathMatch[1], url: trimmed };
    }
  } catch {
    const inlineMatch = trimmed.match(/\/verify\/(\d+)/);
    if (inlineMatch) {
      return { propertyId: inlineMatch[1], url: null };
    }
  }

  return { propertyId: null, url: null };
}

export function formatTimestamp(unixSeconds: number): string {
  if (!unixSeconds) return "—";
  return new Date(unixSeconds * 1000).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatArea(sqft: number): string {
  return `${sqft.toLocaleString("en-US")} sq.ft.`;
}
