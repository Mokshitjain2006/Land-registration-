# LandChain — Blockchain-Based Land Registry Management System

LandChain is an academic full-stack web application demonstrating tamper-resistant land parcel registration, SHA-256 deed verification, QR code validation, and multi-party ownership transfers on a local Ethereum blockchain.

> **Academic Disclaimer:** LandChain is an academic prototype built for demonstration and educational evaluation. It does not replace official government land registries or legally establish property ownership.

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                        React + Vite Frontend (Port 3000)               │
│  Landing · Admin Console · Register Land · Owner Portal · Verify · Tx  │
│  Web Crypto SHA-256 · QRCode PNG + jsQR Scanner · Ethers.js v6         │
└───────────────┬─────────────────────────────────────────┬──────────────┘
                │ REST API (/api/*) + JSON-RPC Proxy      │ MetaMask (BrowserProvider)
                ▼                                         │ or Local Hardhat Signer
┌─────────────────────────────────────────┐               │
│   Node.js + Express Backend (server.ts) │               │
│   Off-Chain Metadata · Upload Vault     │               │
│   Prisma ORM ──► SQLite (landchain.db)  │               │
└───────────────┬─────────────────────────┘               │
                │ Read-Only RPC & Event Cache             │
                ▼                                         ▼
┌────────────────────────────────────────────────────────────────────────┐
│               Local Hardhat Ethereum Node (127.0.0.1:8545)             │
│               Chain ID: 31337 · LandRegistry.sol (^0.8.24)             │
│               Authoritative Source of Truth for Ownership & Events     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

- **Smart Contract & Blockchain:** Solidity `^0.8.24`, Hardhat, Ethers.js v6, MetaMask
- **Frontend:** React 19, Vite, Tailwind CSS v4, React Router DOM, Lucide React, Recharts, Sonner
- **Backend & Database:** Node.js, Express.js, Prisma ORM, SQLite, Multer
- **Document & QR Processing:** Browser Web Crypto API (SHA-256), Node `crypto`, `qrcode`, `jsqr`

---

## Running Commands (4-Terminal Workflow & Single-Command Dev)

### Single-Command Start (Integrated Mode)
The root `server.ts` starts Express + Vite middleware on port `3000` and automatically ensures the local Hardhat node (`8545`) and `LandRegistry` deployment are running:

```bash
npm run db:push
npm run dev
```

### Explicit 4-Terminal Workflow

- **Terminal 1 — Start Hardhat Local Blockchain (`127.0.0.1:8545`, Chain ID `31337`)**
  ```bash
  npx hardhat node --hostname 127.0.0.1 --port 8545
  ```
- **Terminal 2 — Compile & Deploy Smart Contract**
  ```bash
  npx hardhat compile
  npx hardhat run scripts/deploy.js --network localhost
  ```
- **Terminal 3 — Initialize SQLite Database & Start Express + Vite Server**
  ```bash
  npm run db:push
  npm run dev
  ```
- **Terminal 4 — Run Automated Smart Contract & Pure Logic Tests**
  ```bash
  npx hardhat test
  npm run test:unit
  ```

---

## MetaMask Local Network Setup

1. Open MetaMask → **Settings → Networks → Add a network manually**.
2. Enter:
   - **Network Name:** `Hardhat Localhost 8545`
   - **New RPC URL:** `http://127.0.0.1:8545`
   - **Chain ID:** `31337`
   - **Currency Symbol:** `ETH`
3. Import any Hardhat local test account displayed in Terminal 1 for local testing only (never use test keys on mainnet).

---

## Key Endpoints

- `GET /api/health` — Live blockchain node, contract deployment, and SQLite status
- `GET /api/config` — Contract address, admin address, Chain ID, and ABI
- `GET /api/properties` — Live on-chain land parcels enriched with off-chain metadata
- `GET /api/properties/:id` — Lookup by Property ID or Survey Number
- `GET /api/transfers` — Live blockchain event logs cached into SQLite
- `POST /api/documents/hash` — Compute SHA-256 digest for uploaded file
- `POST /api/documents/upload` — Store document in access-controlled off-chain vault and save reference in SQLite
- `GET /api/samples/:propertyId` — Download seeded academic sample deed for verification testing

---

## Known Limitations & Future Scope

- Runs on an ephemeral local Hardhat node (`Chain ID 31337`); restarting a fresh Hardhat process requires re-deploying the contract (`scripts/deploy.js`).
- Original property deeds are stored in a local access-controlled directory (`backend/storage/uploads/`) for academic testing; production deployment would use encrypted IPFS/Arweave or government document vaults with zero-knowledge or role-gated decryption.
- Future enhancements include GIS/GeoJSON parcel boundary polygon mapping, multi-sig registrar governance, and Aadhaar/e-KYC identity attestation adapters.
