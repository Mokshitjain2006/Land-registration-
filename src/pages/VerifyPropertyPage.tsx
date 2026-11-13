import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import {
  Search,
  QrCode,
  ShieldCheck,
  ShieldX,
  Upload,
  Download,
  FileCheck2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "../components/DashboardLayout";
import { QrScannerModal } from "../components/QrScannerModal";
import { useWallet } from "../context/WalletContext";
import { fetchPropertyById } from "../services/api";
import {
  formatArea,
  formatTimestamp,
  type PropertyRecord,
} from "../utils/registry";
import { computeFileSha256Hex, shortenAddress } from "../utils/crypto";

export function VerifyPropertyPage() {
  const { propertyId: routePropertyId } = useParams<{ propertyId?: string }>();
  const navigate = useNavigate();
  const { config, verifyDocumentOnChain } = useWallet();

  const [query, setQuery] = useState(routePropertyId || "");
  const [searching, setSearching] = useState(false);
  const [property, setProperty] = useState<PropertyRecord | null>(null);
  const [notFoundMsg, setNotFoundMsg] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);

  // Document SHA-256 verification state
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [computedHash, setComputedHash] = useState<string | null>(null);
  const [docVerificationResult, setDocVerificationResult] = useState<
    "idle" | "verified" | "mismatch"
  >("idle");

  const runLookup = async (target: string) => {
    const trimmed = target.trim();
    if (!trimmed) return;
    setSearching(true);
    setNotFoundMsg(null);
    setUploadedFileName(null);
    setComputedHash(null);
    setDocVerificationResult("idle");

    try {
      const record = await fetchPropertyById(trimmed);
      setProperty(record);
      const url = `${window.location.origin}/verify/${record.propertyId}`;
      const qr = await QRCode.toDataURL(url, { width: 220, margin: 2 });
      setQrDataUrl(qr);
    } catch (err) {
      setProperty(null);
      setQrDataUrl("");
      setNotFoundMsg(
        err instanceof Error ? err.message : "Property record does not exist on the connected blockchain."
      );
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if (routePropertyId) {
      setQuery(routePropertyId);
      runLookup(routePropertyId);
    }
  }, [routePropertyId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    if (trimmed === routePropertyId) {
      runLookup(trimmed);
    } else {
      navigate(`/verify/${encodeURIComponent(trimmed)}`);
    }
  };

  const handleDocumentCheck = async (file: File | undefined) => {
    if (!file || !property) return;
    setUploadedFileName(file.name);
    try {
      const hashHex = await computeFileSha256Hex(file);
      setComputedHash(hashHex);

      // Verify directly against smart contract verifyLand()
      const onChainCheck = await verifyDocumentOnChain(property.propertyId, hashHex);
      if (onChainCheck.exists && onChainCheck.documentMatches) {
        setDocVerificationResult("verified");
        toast.success("VERIFIED: Document SHA-256 matches the blockchain record.");
      } else {
        setDocVerificationResult("mismatch");
        toast.error("DOCUMENT MISMATCH: Uploaded file hash does not match on-chain record.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not verify document");
    }
  };

  const isSampleAvailable =
    property && config?.sampleDeedIds?.includes(property.propertyId);

  return (
    <DashboardLayout title="Public Property & Document Verification" breadcrumb="Verify Property">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Search & QR Scanner Panel */}
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="font-display text-lg font-semibold text-slate-900">
            Search Land Parcel on Ethereum Ledger
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Enter a numeric Property ID (e.g. 1001), a Survey Number (e.g. SUR-KA-2026-1001), or scan a LandChain QR code.
          </p>

          <form onSubmit={handleSearchSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-3 left-3.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter Property ID (e.g. 1001) or Survey Number..."
                aria-label="Property ID or Survey Number"
                className="w-full rounded-lg border border-slate-300 py-2.5 pr-4 pl-10 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={searching}
              className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 whitespace-nowrap"
            >
              {searching ? "Verifying..." : "Verify Property"}
            </button>
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap"
            >
              <QrCode className="h-4 w-4 text-teal-700" />
              <span>Scan QR</span>
            </button>
          </form>

          {/* Quick-Select Seeded Parcels */}
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>Sample Seeded Parcels:</span>
            {(config?.sampleDeedIds?.length ? config.sampleDeedIds : [1001, 1002, 1003, 1004]).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setQuery(String(id));
                  navigate(`/verify/${id}`);
                }}
                className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-xs font-medium text-slate-700 hover:border-teal-600 hover:text-teal-800"
              >
                #{id}
              </button>
            ))}
          </div>
        </section>

        {/* Not Verified State */}
        {notFoundMsg && (
          <div className="rounded-xl border border-red-300 bg-red-50 p-6">
            <div className="flex items-start gap-3">
              <ShieldX className="mt-0.5 h-6 w-6 text-red-700 shrink-0" />
              <div>
                <h3 className="font-display text-base font-semibold text-red-900">
                  NOT VERIFIED
                </h3>
                <p className="mt-1 text-sm text-red-800">{notFoundMsg}</p>
              </div>
            </div>
          </div>
        )}

        {/* Verified On-Chain Property Record */}
        {property && (
          <div className="space-y-6">
            <div className="rounded-xl border border-teal-300 bg-teal-50 p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-6 w-6 text-teal-700 shrink-0" />
                  <div>
                    <p className="font-display text-base font-semibold text-teal-950">
                      VERIFIED — Record Exists on Connected Blockchain
                    </p>
                    <p className="text-xs text-teal-800">
                      Property #{property.propertyId} ({property.surveyNumber}) retrieved directly from LandRegistry smart contract.
                    </p>
                  </div>
                </div>
                <span className="font-mono text-xs text-teal-900">
                  Registered {formatTimestamp(property.registeredAt)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Property Details Sheet */}
              <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-8">
                <h3 className="font-display text-base font-semibold text-slate-900">
                  On-Chain Land Ownership Record
                </h3>
                <dl className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-slate-500">Property ID</dt>
                    <dd className="mt-0.5 font-mono font-semibold text-slate-900 tabular-nums">
                      #{property.propertyId}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Survey Number</dt>
                    <dd className="mt-0.5 font-mono font-medium text-slate-900">
                      {property.surveyNumber}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-slate-500">Location</dt>
                    <dd className="mt-0.5 font-medium text-slate-900">{property.location}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Village / District</dt>
                    <dd className="mt-0.5 text-slate-800">
                      {property.village}, {property.district}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">State &amp; Area</dt>
                    <dd className="mt-0.5 text-slate-800 tabular-nums">
                      {property.state} · {formatArea(property.area)}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-slate-500">Current Owner Wallet Address</dt>
                    <dd className="mt-0.5 break-all font-mono text-xs font-medium text-slate-900">
                      {property.currentOwner}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-slate-500">On-Chain SHA-256 Document Hash</dt>
                    <dd className="mt-0.5 break-all font-mono text-xs text-teal-800">
                      {property.documentHash}
                    </dd>
                  </div>
                </dl>

                {/* Ownership Chain */}
                <div className="mt-6 border-t border-slate-200 pt-4">
                  <h4 className="text-xs font-semibold text-slate-700">
                    Verified Ownership Chain ({property.ownershipHistory.length})
                  </h4>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    {property.ownershipHistory.map((addr, idx) => (
                      <span key={`${addr}-${idx}`} className="font-mono text-slate-700">
                        {idx > 0 ? "→ " : ""}
                        {shortenAddress(addr, 5)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* QR & Sample Deed Panel */}
              <div className="flex flex-col items-center justify-between rounded-xl border border-slate-200 bg-white p-6 text-center lg:col-span-4">
                <div>
                  <h3 className="font-display text-sm font-semibold text-slate-900">
                    Property QR Certificate
                  </h3>
                  {qrDataUrl && (
                    <img
                      src={qrDataUrl}
                      alt={`QR Code for Property ${property.propertyId}`}
                      className="mx-auto mt-3 h-44 w-44 rounded-lg border border-slate-200 p-2"
                    />
                  )}
                </div>

                <div className="mt-4 flex w-full flex-col gap-2">
                  {qrDataUrl && (
                    <a
                      href={qrDataUrl}
                      download={`landchain-property-${property.propertyId}.png`}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50"
                    >
                      <Download className="h-3.5 w-3.5 text-slate-700" />
                      <span>Download QR PNG</span>
                    </a>
                  )}
                  {isSampleAvailable && (
                    <a
                      href={`/api/samples/${property.propertyId}`}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-800 hover:bg-slate-100"
                    >
                      <Download className="h-3.5 w-3.5 text-teal-700" />
                      <span>Download Sample Deed #{property.propertyId}</span>
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* SHA-256 Document Authenticity Checker */}
            <section className="rounded-xl border border-slate-200 bg-white p-6">
              <div className="flex items-start gap-3">
                <FileCheck2 className="mt-0.5 h-5 w-5 text-teal-700 shrink-0" />
                <div>
                  <h3 className="font-display text-base font-semibold text-slate-900">
                    Verify Property Document Authenticity (SHA-256)
                  </h3>
                  <p className="mt-1 text-xs text-slate-600">
                    Select the original property document (PDF or TXT). Your browser computes its SHA-256 digest via Web Crypto API and compares it directly against the smart contract.
                  </p>
                </div>
              </div>

              <label className="mt-4 flex cursor-pointer items-center justify-center gap-2.5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-xs font-medium text-slate-700 transition-colors hover:border-teal-600 hover:bg-teal-50/30">
                <Upload className="h-4 w-4 text-teal-700" />
                <span>
                  {uploadedFileName
                    ? `Checked: ${uploadedFileName} — Click to test another file`
                    : "Select Property Document to Verify Hash"}
                </span>
                <input
                  type="file"
                  accept=".pdf,.txt,application/pdf,text/plain"
                  className="sr-only"
                  onChange={(e) => {
                    handleDocumentCheck(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>

              {computedHash && (
                <div className="mt-4 space-y-3">
                  <div className="rounded-lg bg-slate-50 p-3 text-xs">
                    <p className="text-slate-500">Computed File SHA-256 Digest</p>
                    <p className="mt-0.5 break-all font-mono text-slate-900">{computedHash}</p>
                  </div>

                  {docVerificationResult === "verified" && (
                    <div className="flex items-start gap-2.5 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-xs text-emerald-950">
                      <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-700 shrink-0" />
                      <div>
                        <p className="font-semibold">VERIFIED — Authentic Document Match</p>
                        <p className="mt-0.5 text-emerald-800">
                          The computed SHA-256 digest matches the immutable hash recorded on the LandRegistry smart contract.
                        </p>
                      </div>
                    </div>
                  )}

                  {docVerificationResult === "mismatch" && (
                    <div className="flex items-start gap-2.5 rounded-lg border border-red-300 bg-red-50 p-4 text-xs text-red-950">
                      <ShieldX className="mt-0.5 h-5 w-5 text-red-700 shrink-0" />
                      <div>
                        <p className="font-semibold">DOCUMENT MISMATCH — Not Verified</p>
                        <p className="mt-0.5 text-red-800">
                          The uploaded document does not match the registered SHA-256 hash on-chain. The file may be altered or belong to a different parcel.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Legal Disclaimer */}
            <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-slate-500 shrink-0" />
              <p>
                Academic Prototype Disclaimer: Blockchain verification confirms cryptographic record and hash integrity on this local Ethereum demonstration network and does not replace official government land registries or independently establish legal property ownership.
              </p>
            </div>
          </div>
        )}
      </div>

      <QrScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={(detectedId) => {
          setQuery(detectedId);
          navigate(`/verify/${detectedId}`);
        }}
      />
    </DashboardLayout>
  );
}
