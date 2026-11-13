import { Link } from "react-router-dom";
import { X, ShieldCheck, ExternalLink, QrCode, History } from "lucide-react";
import { formatArea, formatTimestamp, getTransferStatusLabel, type PropertyRecord } from "../utils/registry";
import { shortenAddress } from "../utils/crypto";

interface PropertyDetailsModalProps {
  property: PropertyRecord | null;
  onClose: () => void;
  onOpenQr?: (property: PropertyRecord) => void;
}

export function PropertyDetailsModal({
  property,
  onClose,
  onOpenQr,
}: PropertyDetailsModalProps) {
  if (!property) return null;

  const transferStatus = getTransferStatusLabel(property.pendingTransfer);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="property-details-title"
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <p className="text-xs font-medium text-teal-700">On-Chain Land Parcel Record</p>
            <h2
              id="property-details-title"
              className="font-display text-lg font-semibold text-slate-900 tabular-nums"
            >
              Property ID #{property.propertyId}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close property details"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-slate-500">Survey Number</p>
              <p className="mt-0.5 font-mono text-sm font-medium text-slate-900">
                {property.surveyNumber}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Land Area</p>
              <p className="mt-0.5 text-sm font-medium text-slate-900 tabular-nums">
                {formatArea(property.area)}
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-slate-500">Property Location</p>
              <p className="mt-0.5 text-sm font-medium text-slate-900">{property.location}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Village / Locality</p>
              <p className="mt-0.5 text-sm text-slate-900">{property.village || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">District &amp; State</p>
              <p className="mt-0.5 text-sm text-slate-900">
                {property.district}, {property.state}
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-slate-500">Current Owner Wallet Address</p>
              <p className="mt-0.5 break-all font-mono text-xs text-slate-900">
                {property.currentOwner}
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-slate-500">Registered SHA-256 Document Hash</p>
              <p className="mt-0.5 break-all font-mono text-xs text-teal-800">
                {property.documentHash}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Registered Timestamp</p>
              <p className="mt-0.5 text-xs text-slate-700 tabular-nums">
                {formatTimestamp(property.registeredAt)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Transfer Status</p>
              <p className="mt-0.5 text-xs font-medium text-slate-900">{transferStatus}</p>
            </div>
          </div>

          {property.metadata?.description && (
            <div className="border-t border-slate-200 pt-4">
              <p className="text-xs text-slate-500">Off-Chain Registry Note</p>
              <p className="mt-1 text-sm text-slate-700">{property.metadata.description}</p>
            </div>
          )}

          <div className="border-t border-slate-200 pt-4">
            <div className="mb-2 flex items-center gap-2">
              <History className="h-4 w-4 text-slate-500" />
              <h3 className="text-xs font-semibold text-slate-700">
                On-Chain Ownership Chain ({property.ownershipHistory.length})
              </h3>
            </div>
            <ol className="space-y-1.5">
              {property.ownershipHistory.map((ownerAddr, index) => (
                <li
                  key={`${ownerAddr}-${index}`}
                  className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-xs"
                >
                  <span className="font-medium text-slate-600 tabular-nums">
                    Holder #{index + 1}
                    {index === property.ownershipHistory.length - 1 ? " (Current)" : ""}
                  </span>
                  <span className="font-mono text-slate-900" title={ownerAddr}>
                    {shortenAddress(ownerAddr, 8)}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
            <div className="flex items-center gap-1.5 text-xs text-teal-700">
              <ShieldCheck className="h-4 w-4" />
              <span>Source of Truth: Deployed LandRegistry Contract</span>
            </div>
            <div className="flex items-center gap-2.5">
              {onOpenQr && (
                <button
                  type="button"
                  onClick={() => onOpenQr(property)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                >
                  <QrCode className="h-3.5 w-3.5" />
                  <span>QR Code</span>
                </button>
              )}
              <Link
                to={`/verify/${property.propertyId}`}
                onClick={onClose}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap"
              >
                <span>Open Public Verification</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
