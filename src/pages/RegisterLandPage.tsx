import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Upload,
  ShieldAlert,
  CheckCircle2,
  QrCode,
  FileText,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "../components/DashboardLayout";
import { QrCodeModal } from "../components/QrCodeModal";
import { useWallet } from "../context/WalletContext";
import {
  computeFileSha256Hex,
  isValidBytes32Hash,
  isValidEthereumAddress,
  shortenAddress,
} from "../utils/crypto";
import { uploadPropertyDocument } from "../services/api";

export function RegisterLandPage() {
  const {
    account,
    isAdmin,
    config,
    properties,
    hardhatAccounts,
    txPending,
    setWalletModalOpen,
    registerLandOnChain,
  } = useWallet();

  const [form, setForm] = useState({
    propertyId: "",
    location: "",
    village: "",
    district: "",
    state: "",
    surveyNumber: "",
    area: "",
    ownerAddress: "",
    description: "",
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentHash, setDocumentHash] = useState("");
  const [hashingFile, setHashingFile] = useState(false);

  const [registeredResult, setRegisteredResult] = useState<{
    propertyId: number;
    surveyNumber: string;
    txHash: string;
    documentHash: string;
  } | null>(null);
  const [qrOpen, setQrOpen] = useState(false);

  const handleFileChange = async (file: File | undefined) => {
    if (!file) return;
    setSelectedFile(file);
    setHashingFile(true);
    try {
      const hash = await computeFileSha256Hex(file);
      setDocumentHash(hash);
      toast.success("SHA-256 document hash computed in browser");
    } catch {
      toast.error("Failed to compute SHA-256 digest");
    } finally {
      setHashingFile(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAdmin) {
      toast.error("Only the smart contract administrator wallet can register properties.");
      return;
    }

    const propertyIdNum = Number(form.propertyId);
    const areaNum = Number(form.area);

    if (!Number.isInteger(propertyIdNum) || propertyIdNum <= 0) {
      toast.error("Property ID must be a positive whole number.");
      return;
    }
    if (!Number.isInteger(areaNum) || areaNum <= 0) {
      toast.error("Land area must be a positive number in square feet.");
      return;
    }
    const trimmedSurvey = form.surveyNumber.trim();
    if (properties.some((p) => p.propertyId === propertyIdNum)) {
      toast.error(`Property ID #${propertyIdNum} is already registered on-chain.`);
      return;
    }
    if (properties.some((p) => p.surveyNumber.toLowerCase() === trimmedSurvey.toLowerCase())) {
      toast.error(`Survey Number "${trimmedSurvey}" is already registered on-chain.`);
      return;
    }
    if (!isValidEthereumAddress(form.ownerAddress)) {
      toast.error("Please enter a valid 42-character Ethereum owner wallet address.");
      return;
    }
    if (!isValidBytes32Hash(documentHash)) {
      toast.error("Please upload a property deed document to generate its SHA-256 hash.");
      return;
    }

    try {
      // Write authoritative land record on-chain FIRST so rejected/reverted txs never orphan off-chain uploads
      const txHash = await registerLandOnChain({
        propertyId: propertyIdNum,
        ownerAddress: form.ownerAddress.trim(),
        location: form.location.trim(),
        village: form.village.trim(),
        district: form.district.trim(),
        state: form.state.trim(),
        surveyNumber: trimmedSurvey,
        area: areaNum,
        documentHash,
      });

      if (selectedFile) {
        try {
          await uploadPropertyDocument(propertyIdNum, selectedFile, form.description, txHash);
        } catch (uploadErr) {
          toast.warning(
            `Property #${propertyIdNum} registered on-chain, but off-chain metadata upload failed: ${
              uploadErr instanceof Error ? uploadErr.message : "Unknown error"
            }`
          );
        }
      }

      setRegisteredResult({
        propertyId: propertyIdNum,
        surveyNumber: trimmedSurvey,
        txHash,
        documentHash,
      });

      toast.success(`Property #${propertyIdNum} registered on blockchain`);
      setForm({
        propertyId: "",
        location: "",
        village: "",
        district: "",
        state: "",
        surveyNumber: "",
        area: "",
        ownerAddress: "",
        description: "",
      });
      setSelectedFile(null);
      setDocumentHash("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    }
  };

  return (
    <DashboardLayout title="Register New Land Parcel" breadcrumb="Admin / Register Land">
      {!isAdmin && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 text-amber-700 shrink-0" />
            <div>
              <p className="font-semibold">Admin Wallet Required</p>
              <p className="mt-0.5 text-xs text-amber-800">
                Connect the contract administrator wallet (
                <span className="font-mono">
                  {config?.adminAddress ? shortenAddress(config.adminAddress, 6) : "Account #0"}
                </span>
                ) to authorize land registration transactions. Connected:{" "}
                <span className="font-mono">{account ? shortenAddress(account, 6) : "None"}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setWalletModalOpen(true)}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap"
          >
            Connect Admin Wallet
          </button>
        </div>
      )}

      {registeredResult && (
        <div className="mb-6 rounded-xl border border-teal-300 bg-teal-50 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-6 w-6 text-teal-700 shrink-0" />
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">
                  Property #{registeredResult.propertyId} Registered Successfully
                </h2>
                <p className="mt-1 text-xs text-slate-700">
                  Transaction confirmed on local Ethereum blockchain (Chain ID 31337).
                </p>
                <p className="mt-2 font-mono text-xs break-all text-slate-800">
                  Tx Hash: {registeredResult.txHash}
                </p>
                <p className="mt-1 font-mono text-xs break-all text-teal-900">
                  SHA-256 Hash: {registeredResult.documentHash}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setQrOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap"
              >
                <QrCode className="h-4 w-4" />
                <span>View &amp; Download QR</span>
              </button>
              <Link
                to={`/verify/${registeredResult.propertyId}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap"
              >
                <span>Verify Record</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 sm:p-8 lg:col-span-8"
        >
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Parcel &amp; Ownership Details
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              All parcel metadata and the SHA-256 deed hash are recorded on-chain; original documents stay off-chain.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="reg-property-id" className="block text-xs font-medium text-slate-700">
                Unique Property ID *
              </label>
              <input
                id="reg-property-id"
                type="number"
                min="1"
                required
                value={form.propertyId}
                onChange={(e) => setForm({ ...form, propertyId: e.target.value })}
                placeholder="e.g. 1005"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none tabular-nums"
              />
            </div>

            <div>
              <label htmlFor="reg-survey" className="block text-xs font-medium text-slate-700">
                Survey Number *
              </label>
              <input
                id="reg-survey"
                type="text"
                required
                value={form.surveyNumber}
                onChange={(e) => setForm({ ...form, surveyNumber: e.target.value })}
                placeholder="e.g. SUR-KA-2026-1005"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="reg-location" className="block text-xs font-medium text-slate-700">
                Property Location / Street Address *
              </label>
              <input
                id="reg-location"
                type="text"
                required
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="e.g. Plot 28, Civic Horizon Layout, Phase II"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="reg-village" className="block text-xs font-medium text-slate-700">
                Village / Locality *
              </label>
              <input
                id="reg-village"
                type="text"
                required
                value={form.village}
                onChange={(e) => setForm({ ...form, village: e.target.value })}
                placeholder="e.g. Whitefield"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="reg-district" className="block text-xs font-medium text-slate-700">
                District *
              </label>
              <input
                id="reg-district"
                type="text"
                required
                value={form.district}
                onChange={(e) => setForm({ ...form, district: e.target.value })}
                placeholder="e.g. Bengaluru Urban"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="reg-state" className="block text-xs font-medium text-slate-700">
                State *
              </label>
              <input
                id="reg-state"
                type="text"
                required
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                placeholder="e.g. Karnataka"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="reg-area" className="block text-xs font-medium text-slate-700">
                Land Area (sq.ft.) *
              </label>
              <input
                id="reg-area"
                type="number"
                min="1"
                required
                value={form.area}
                onChange={(e) => setForm({ ...form, area: e.target.value })}
                placeholder="e.g. 3200"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none tabular-nums"
              />
            </div>

            <div className="sm:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="reg-owner" className="block text-xs font-medium text-slate-700">
                  Owner Wallet Address *
                </label>
                {hardhatAccounts.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, ownerAddress: hardhatAccounts[1] })}
                    className="text-xs font-medium text-teal-700 hover:underline"
                  >
                    Use Sample Owner Wallet (#1)
                  </button>
                )}
              </div>
              <input
                id="reg-owner"
                type="text"
                required
                value={form.ownerAddress}
                onChange={(e) => setForm({ ...form, ownerAddress: e.target.value })}
                placeholder="0x..."
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 font-mono text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="reg-description" className="block text-xs font-medium text-slate-700">
                Off-Chain Description / Notes (Optional)
              </label>
              <input
                id="reg-description"
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Residential corner plot with municipal water connection"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Document Upload & Client-Side SHA-256 Hashing */}
          <div className="border-t border-slate-200 pt-5">
            <label className="block text-xs font-medium text-slate-700">
              Property Title Deed Document (PDF or TXT) *
            </label>
            <p className="mt-0.5 text-xs text-slate-500">
              Your browser computes the SHA-256 digest via Web Crypto API. The file is stored in the access-controlled off-chain vault.
            </p>
            <label className="mt-3 flex cursor-pointer items-center justify-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center transition-colors hover:border-teal-600 hover:bg-teal-50/40">
              <Upload className="h-5 w-5 text-teal-700" />
              <div className="text-xs">
                {selectedFile ? (
                  <span className="font-medium text-slate-900">
                    {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
                  </span>
                ) : (
                  <span className="text-slate-600">
                    Click to select PDF or TXT property document
                  </span>
                )}
              </div>
              <input
                type="file"
                accept=".pdf,.txt,application/pdf,text/plain"
                className="sr-only"
                onChange={(e) => {
                  handleFileChange(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>

            <div className="mt-4">
              <label htmlFor="reg-hash" className="block text-xs font-medium text-slate-700">
                Computed SHA-256 Document Hash (bytes32)
              </label>
              <input
                id="reg-hash"
                type="text"
                readOnly
                value={hashingFile ? "Computing SHA-256..." : documentHash}
                placeholder="0x..."
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-mono text-xs text-teal-900"
              />
            </div>
          </div>

          <div className="flex justify-end border-t border-slate-200 pt-5">
            <button
              type="submit"
              disabled={!isAdmin || txPending || hashingFile}
              className="rounded-lg bg-slate-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
            >
              {txPending ? "Confirming on Blockchain..." : "Register Property on Blockchain"}
            </button>
          </div>
        </form>

        {/* Side Guidance Panel */}
        <aside className="space-y-4 lg:col-span-4">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-teal-700" />
              <h3 className="font-display text-base font-semibold text-slate-900">
                Registration Security Rules
              </h3>
            </div>
            <ul className="mt-4 space-y-2.5 text-xs leading-relaxed text-slate-600">
              <li>1. Only the smart contract admin can invoke registerLand().</li>
              <li>2. Duplicate Property IDs and duplicate Survey Numbers are rejected on-chain.</li>
              <li>3. Sensitive title deed documents are never written to the public ledger.</li>
              <li>4. A unique QR verification code is generated immediately after confirmation.</li>
            </ul>
          </div>
        </aside>
      </div>

      <QrCodeModal
        open={qrOpen}
        propertyId={registeredResult?.propertyId || null}
        surveyNumber={registeredResult?.surveyNumber}
        onClose={() => setQrOpen(false)}
      />
    </DashboardLayout>
  );
}
