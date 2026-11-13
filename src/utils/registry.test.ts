import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveUserRole,
  getTransferStatusLabel,
  computeRegistryStats,
  parseQrVerificationPayload,
  type PropertyRecord,
  type BlockchainEventItem,
} from "./registry";
import {
  computeTextSha256Hex,
  isValidEthereumAddress,
  isValidBytes32Hash,
  shortenAddress,
} from "./crypto";

const ADMIN = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const OWNER1 = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const OWNER2 = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";

const sampleProperties: PropertyRecord[] = [
  {
    propertyId: 1001,
    currentOwner: OWNER1,
    location: "Plot 14",
    village: "Indiranagar",
    district: "Bengaluru Urban",
    state: "Karnataka",
    surveyNumber: "SUR-1001",
    area: 2400,
    documentHash: "0x" + "a".repeat(64),
    registeredAt: 1700000000,
    exists: true,
    ownershipHistory: [OWNER1],
    pendingTransfer: {
      propertyId: 1001,
      currentOwner: OWNER1,
      proposedOwner: OWNER2,
      requestTimestamp: 1700000100,
      recipientAccepted: false,
      completed: false,
      rejected: false,
      cancelled: false,
      active: true,
    },
  },
  {
    propertyId: 1002,
    currentOwner: OWNER2,
    location: "Parcel 42",
    village: "Baner",
    district: "Pune",
    state: "Maharashtra",
    surveyNumber: "SUR-1002",
    area: 4850,
    documentHash: "0x" + "b".repeat(64),
    registeredAt: 1700000200,
    exists: true,
    ownershipHistory: [OWNER1, OWNER2],
    pendingTransfer: {
      propertyId: 1002,
      currentOwner: OWNER1,
      proposedOwner: OWNER2,
      requestTimestamp: 1700000250,
      recipientAccepted: true,
      completed: true,
      rejected: false,
      cancelled: false,
      active: false,
    },
  },
];

const sampleEvents: BlockchainEventItem[] = [
  {
    transactionHash: "0x" + "1".repeat(64),
    blockNumber: 1,
    eventType: "LandRegistered",
    propertyId: 1001,
    previousOwner: "0x0000000000000000000000000000000000000000",
    newOwner: OWNER1,
    timestamp: 1700000000,
    status: "Confirmed",
  },
  {
    transactionHash: "0x" + "2".repeat(64),
    blockNumber: 2,
    eventType: "OwnershipTransferred",
    propertyId: 1002,
    previousOwner: OWNER1,
    newOwner: OWNER2,
    timestamp: 1700000300,
    status: "Confirmed",
  },
];

test("deriveUserRole detects ADMIN, OWNER, and PUBLIC accurately from on-chain addresses", () => {
  assert.equal(deriveUserRole(null, ADMIN, sampleProperties), "PUBLIC");
  assert.equal(deriveUserRole(ADMIN.toLowerCase(), ADMIN, sampleProperties), "ADMIN");
  assert.equal(deriveUserRole(OWNER1, ADMIN, sampleProperties), "OWNER");
  assert.equal(
    deriveUserRole("0x90F79bf6EB2c4f870365E785982E1f101E93b906", ADMIN, sampleProperties),
    "PUBLIC"
  );
});

test("getTransferStatusLabel resolves all five transfer states", () => {
  assert.equal(getTransferStatusLabel(sampleProperties[0].pendingTransfer), "Pending Recipient Acceptance");
  assert.equal(
    getTransferStatusLabel({
      ...sampleProperties[0].pendingTransfer,
      recipientAccepted: true,
    }),
    "Pending Admin Approval"
  );
  assert.equal(getTransferStatusLabel(sampleProperties[1].pendingTransfer), "Approved");
  assert.equal(
    getTransferStatusLabel({
      ...sampleProperties[0].pendingTransfer,
      active: false,
      rejected: true,
    }),
    "Rejected"
  );
  assert.equal(
    getTransferStatusLabel({
      ...sampleProperties[0].pendingTransfer,
      active: false,
      cancelled: true,
    }),
    "Cancelled"
  );
});

test("computeRegistryStats aggregates on-chain totals and charts accurately", () => {
  const stats = computeRegistryStats(sampleProperties, sampleEvents);
  assert.equal(stats.totalLands, 2);
  assert.equal(stats.totalOwners, 2);
  assert.equal(stats.pendingTransfers, 1);
  assert.equal(stats.completedTransfers, 1);
  assert.deepEqual(stats.stateDistribution, [
    { state: "Karnataka", count: 1 },
    { state: "Maharashtra", count: 1 },
  ]);
});

test("parseQrVerificationPayload extracts property ID from URLs, JSON, and numeric strings", () => {
  assert.deepEqual(parseQrVerificationPayload("1001"), { propertyId: "1001", url: null });
  assert.deepEqual(parseQrVerificationPayload("https://landchain.example/verify/1004"), {
    propertyId: "1004",
    url: "https://landchain.example/verify/1004",
  });
  assert.deepEqual(
    parseQrVerificationPayload('{"propertyId":1002,"verifyUrl":"http://localhost:3000/verify/1002"}'),
    {
      propertyId: "1002",
      url: "http://localhost:3000/verify/1002",
    }
  );
});

test("crypto helpers validate Ethereum addresses, bytes32 hashes, and compute SHA-256", async () => {
  assert.equal(isValidEthereumAddress(OWNER1), true);
  assert.equal(isValidEthereumAddress("0x123"), false);
  const hash = await computeTextSha256Hex("landchain-test-deed");
  assert.equal(isValidBytes32Hash(hash), true);
  assert.equal(shortenAddress(OWNER1), "0x7099...79C8");
});
