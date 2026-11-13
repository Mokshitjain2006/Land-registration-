import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Wallet,
  ArrowRightLeft,
  QrCode,
  Eye,
  History,
  CheckCircle2,
  XCircle,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "../components/DashboardLayout";
import { PropertyDetailsModal } from "../components/PropertyDetailsModal";
import { QrCodeModal } from "../components/QrCodeModal";
import { ConfirmationModal } from "../components/ConfirmationModal";
import { useWallet } from "../context/WalletContext";
import {
  formatArea,
  formatTimestamp,
  getTransferStatusLabel,
  type PropertyRecord,
} from "../utils/registry";
import { isValidEthereumAddress, shortenAddress, shortenHash } from "../utils/crypto";

export function OwnerDashboardPage() {
  const {
    account,
    properties,
    hardhatAccounts,
    loadingData,
    txPending,
    setWalletModalOpen,
    requestTransferOnChain,
    acceptTransferOnChain,
    cancelTransferOnChain,
  } = useWallet();

  const [selectedProperty, setSelectedProperty] = useState<PropertyRecord | null>(null);
  const [qrProperty, setQrProperty] = useState<PropertyRecord | null>(null);
  const [transferTarget, setTransferTarget] = useState<PropertyRecord | null>(null);
  const [recipientAddress, setRecipientAddress] = useState("");
  const [cancelTarget, setCancelTarget] = useState<PropertyRecord | null>(null);

  const ownedProperties = useMemo(() => {
    if (!account) return [];
    const lower = account.toLowerCase();
    return properties.filter((p) => p.currentOwner.toLowerCase() === lower);
  }, [account, properties]);

  const incomingTransfers = useMemo(() => {
    if (!account) return [];
    const lower = account.toLowerCase();
    return properties.filter(
      (p) =>
        p.pendingTransfer?.active &&
        p.pendingTransfer.proposedOwner.toLowerCase() === lower
    );
  }, [account, properties]);

  const handleRequestTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferTarget) return;
    if (!isValidEthereumAddress(recipientAddress)) {
      toast.error("Please enter a valid 42-character recipient Ethereum wallet address.");
      return;
    }
    if (account && recipientAddress.trim().toLowerCase() === account.toLowerCase()) {
      toast.error("Cannot transfer a property to the current owner's own wallet address.");
      return;
    }
    try {
      const txHash = await requestTransferOnChain(
        transferTarget.propertyId,
        recipientAddress.trim()
      );
      toast.success(`Transfer requested on-chain (${shortenHash(txHash)})`);
      setTransferTarget(null);
      setRecipientAddress("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Transfer request failed");
    }
  };

  const handleAcceptTransfer = async (propertyId: number) => {
    try {
      const txHash = await acceptTransferOnChain(propertyId);
      toast.success(`Transfer accepted on-chain (${shortenHash(txHash)}). Awaiting admin approval.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Accept transfer failed");
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    try {
      const txHash = await cancelTransferOnChain(cancelTarget.propertyId);
      toast.success(`Transfer cancelled on-chain (${shortenHash(txHash)})`);
      setCancelTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cancel transfer failed");
    }
  };

  return (
    <DashboardLayout title="Land Owner Portal" breadcrumb="Owner Dashboard">
      {!account ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
          <Wallet className="mx-auto h-10 w-10 text-teal-700" />
          <h2 className="mt-4 font-display text-lg font-semibold text-slate-900">
            Connect Your Wallet to Manage Owned Properties
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
            Connect your MetaMask wallet or a local Hardhat owner account to view registered parcels, initiate transfers, or accept incoming ownership transfers.
          </p>
          <button
            type="button"
            onClick={() => setWalletModalOpen(true)}
            className="mt-6 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Connect Wallet
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Owner Summary Strip */}
          <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-3">
            <div>
              <p className="text-xs text-slate-500">Connected Owner Wallet</p>
              <p className="mt-1 truncate font-mono text-sm font-semibold text-slate-900" title={account}>
                {account}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Total Owned Properties</p>
              <p className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
                {ownedProperties.length}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Incoming Transfer Offers</p>
              <p className="mt-1 font-display text-2xl font-bold text-teal-700 tabular-nums">
                {incomingTransfers.length}
              </p>
            </div>
          </div>

          {/* Incoming Transfers Awaiting Recipient Acceptance */}
          {incomingTransfers.length > 0 && (
            <section className="rounded-xl border border-teal-200 bg-teal-50/50 p-6">
              <h2 className="font-display text-base font-semibold text-slate-900">
                Incoming Ownership Transfer Requests ({incomingTransfers.length})
              </h2>
              <p className="mt-1 text-xs text-slate-600">
                Accepting a transfer confirms your consent on-chain so the registry administrator can finalize ownership.
              </p>

              <div className="mt-4 space-y-3">
                {incomingTransfers.map((prop) => (
                  <div
                    key={prop.propertyId}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4"
                  >
                    <div>
                      <p className="font-display text-sm font-semibold text-slate-900 tabular-nums">
                        Property #{prop.propertyId} · {prop.surveyNumber}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-600">
                        {prop.location}, {prop.district}, {prop.state} ({formatArea(prop.area)})
                      </p>
                      <p className="mt-1 font-mono text-xs text-slate-500">
                        From: {shortenAddress(prop.currentOwner, 8)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {prop.pendingTransfer.recipientAccepted ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700">
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Accepted · Pending Admin Approval</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={txPending}
                          onClick={() => handleAcceptTransfer(prop.propertyId)}
                          className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-medium text-white hover:bg-teal-800 disabled:opacity-50 whitespace-nowrap"
                        >
                          {txPending ? "Confirming..." : "Accept Transfer"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Owned Properties Grid */}
          <section>
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Your Registered Properties ({ownedProperties.length})
            </h2>

            {loadingData ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                Loading owned parcels from LandRegistry smart contract...
              </div>
            ) : ownedProperties.length === 0 ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-8 text-center">
                <p className="text-sm text-slate-600">
                  No land parcels are currently owned by {shortenAddress(account, 6)}.
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Switch to Account #1 or #2 in the Wallet Switcher to inspect sample owned properties, or register a new parcel as Admin.
                </p>
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-2">
                {ownedProperties.map((prop) => {
                  const status = getTransferStatusLabel(prop.pendingTransfer);
                  const hasActiveTransfer = prop.pendingTransfer?.active;
                  return (
                    <article
                      key={prop.propertyId}
                      className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6"
                    >
                      <div>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-mono text-xs font-medium text-teal-700">
                              {prop.surveyNumber}
                            </p>
                            <h3 className="mt-0.5 font-display text-lg font-semibold text-slate-900 tabular-nums">
                              Property #{prop.propertyId}
                            </h3>
                          </div>
                          <span className="text-xs font-medium text-slate-600">
                            {hasActiveTransfer ? status : "Verified Owner"}
                          </span>
                        </div>

                        <p className="mt-3 text-sm text-slate-700">{prop.location}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {prop.village}, {prop.district}, {prop.state}
                        </p>

                        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-xs">
                          <div>
                            <dt className="text-slate-500">Area</dt>
                            <dd className="mt-0.5 font-medium text-slate-900 tabular-nums">
                              {formatArea(prop.area)}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-slate-500">Registered Date</dt>
                            <dd className="mt-0.5 font-medium text-slate-900 tabular-nums">
                              {formatTimestamp(prop.registeredAt)}
                            </dd>
                          </div>
                          <div className="col-span-2">
                            <dt className="text-slate-500">Transfer Status</dt>
                            <dd className="mt-0.5 font-medium text-slate-800">
                              {status}
                              {hasActiveTransfer && (
                                <span className="ml-2 font-mono text-slate-500">
                                  ({shortenAddress(prop.pendingTransfer.proposedOwner)})
                                </span>
                              )}
                            </dd>
                          </div>
                        </dl>
                      </div>

                      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                        <button
                          type="button"
                          onClick={() => setSelectedProperty(prop)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>View Details</span>
                        </button>

                        {!hasActiveTransfer ? (
                          <button
                            type="button"
                            onClick={() => {
                              setTransferTarget(prop);
                              setRecipientAddress("");
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap"
                          >
                            <ArrowRightLeft className="h-3.5 w-3.5" />
                            <span>Request Transfer</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setCancelTarget(prop)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 whitespace-nowrap"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            <span>Cancel Transfer</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setQrProperty(prop)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                        >
                          <QrCode className="h-3.5 w-3.5" />
                          <span>Generate QR</span>
                        </button>

                        <Link
                          to={`/transactions?propertyId=${prop.propertyId}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                        >
                          <History className="h-3.5 w-3.5" />
                          <span>View History</span>
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Request Ownership Transfer Modal */}
      {transferTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="transfer-modal-title"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 id="transfer-modal-title" className="font-display text-base font-semibold text-slate-900">
                Request Transfer · Property #{transferTarget.propertyId}
              </h2>
              <button
                type="button"
                onClick={() => setTransferTarget(null)}
                aria-label="Close transfer modal"
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleRequestTransfer} className="space-y-4 p-6">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="recipient-addr" className="block text-xs font-medium text-slate-700">
                    Proposed Recipient Wallet Address *
                  </label>
                  {hardhatAccounts.length > 2 && (
                    <button
                      type="button"
                      onClick={() => {
                        const candidate = hardhatAccounts.find(
                          (a) => a.toLowerCase() !== account?.toLowerCase() && hardhatAccounts.indexOf(a) > 0
                        );
                        if (candidate) setRecipientAddress(candidate);
                      }}
                      className="text-xs font-medium text-teal-700 hover:underline"
                    >
                      Use Sample Recipient
                    </button>
                  )}
                </div>
                <input
                  id="recipient-addr"
                  type="text"
                  required
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                  placeholder="0x..."
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 font-mono text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
                />
              </div>

              <p className="text-xs leading-relaxed text-slate-500">
                Ownership will NOT change until the recipient accepts this request AND the registry administrator approves it on-chain.
              </p>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setTransferTarget(null)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={txPending}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {txPending ? "Submitting..." : "Initiate Transfer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <PropertyDetailsModal
        property={selectedProperty}
        onClose={() => setSelectedProperty(null)}
        onOpenQr={(p) => {
          setSelectedProperty(null);
          setQrProperty(p);
        }}
      />

      <QrCodeModal
        open={Boolean(qrProperty)}
        propertyId={qrProperty?.propertyId || null}
        surveyNumber={qrProperty?.surveyNumber}
        onClose={() => setQrProperty(null)}
      />

      <ConfirmationModal
        open={Boolean(cancelTarget)}
        title={`Cancel Transfer · Property #${cancelTarget?.propertyId}`}
        description="Are you sure you want to cancel the active transfer request? This writes a cancelTransfer() transaction to the blockchain."
        confirmLabel="Cancel Transfer"
        variant="danger"
        busy={txPending}
        onConfirm={handleConfirmCancel}
        onCancel={() => setCancelTarget(null)}
      />
    </DashboardLayout>
  );
}
