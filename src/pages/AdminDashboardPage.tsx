import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  FilePlus2,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Search,
  ExternalLink,
  Copy,
  Check,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "../components/DashboardLayout";
import { PropertyDetailsModal } from "../components/PropertyDetailsModal";
import { ConfirmationModal } from "../components/ConfirmationModal";
import { QrCodeModal } from "../components/QrCodeModal";
import { useWallet } from "../context/WalletContext";
import { fetchContactInquiries, type ContactInquiryItem } from "../services/api";
import {
  computeRegistryStats,
  formatArea,
  formatTimestamp,
  getTransferStatusLabel,
  type PropertyRecord,
} from "../utils/registry";
import { shortenAddress, shortenHash } from "../utils/crypto";

export function AdminDashboardPage() {
  const {
    account,
    isAdmin,
    config,
    properties,
    events,
    loadingData,
    txPending,
    setWalletModalOpen,
    approveTransferOnChain,
    rejectTransferOnChain,
  } = useWallet();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProperty, setSelectedProperty] = useState<PropertyRecord | null>(null);
  const [qrProperty, setQrProperty] = useState<PropertyRecord | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    type: "approve" | "reject";
    property: PropertyRecord;
  } | null>(null);
  const [inquiries, setInquiries] = useState<ContactInquiryItem[]>([]);

  useEffect(() => {
    fetchContactInquiries()
      .then(setInquiries)
      .catch(() => setInquiries([]));
  }, []);

  const stats = useMemo(() => computeRegistryStats(properties, events), [properties, events]);

  const pendingTransfers = useMemo(
    () => properties.filter((p) => p.pendingTransfer?.active),
    [properties]
  );

  const filteredProperties = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return properties;
    return properties.filter(
      (p) =>
        String(p.propertyId).includes(q) ||
        p.surveyNumber.toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q) ||
        p.district.toLowerCase().includes(q) ||
        p.currentOwner.toLowerCase().includes(q)
    );
  }, [properties, searchTerm]);

  const uniqueOwnersList = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of properties) {
      counts.set(p.currentOwner, (counts.get(p.currentOwner) || 0) + 1);
    }
    return Array.from(counts.entries()).map(([address, parcelCount]) => ({
      address,
      parcelCount,
    }));
  }, [properties]);

  const handleCopyHash = async (hash: string) => {
    await navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    toast.success("Transaction hash copied");
    setTimeout(() => setCopiedHash(null), 1500);
  };

  const executePendingDecision = async () => {
    if (!pendingAction) return;
    try {
      const txHash =
        pendingAction.type === "approve"
          ? await approveTransferOnChain(pendingAction.property.propertyId)
          : await rejectTransferOnChain(pendingAction.property.propertyId);

      toast.success(
        pendingAction.type === "approve"
          ? `Transfer approved on-chain (${shortenHash(txHash)})`
          : `Transfer rejected on-chain (${shortenHash(txHash)})`
      );
      setPendingAction(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Transaction failed");
    }
  };

  return (
    <DashboardLayout title="Admin Dashboard" breadcrumb="Admin Console">
      {/* Admin Authorization Banner */}
      {!isAdmin && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 text-amber-700 shrink-0" />
            <div>
              <p className="font-semibold">Admin Wallet Authorization Required for Write Actions</p>
              <p className="mt-0.5 text-xs text-amber-800">
                Smart contract administrator is{" "}
                <span className="font-mono font-medium">
                  {config?.adminAddress ? shortenAddress(config.adminAddress, 6) : "—"}
                </span>
                . Currently connected: <span className="font-mono">{account ? shortenAddress(account, 6) : "None"}</span>.
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

      {/* Top Action Strip */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="text-xs text-slate-600">
          <span className="font-medium text-slate-900">Contract Admin:</span>{" "}
          <span className="font-mono">{config?.adminAddress ? shortenAddress(config.adminAddress, 8) : "—"}</span>
          <span aria-hidden="true" className="mx-2 text-slate-300">·</span>
          <span className="font-medium text-slate-900">Contract:</span>{" "}
          <span className="font-mono">{config?.contractAddress ? shortenAddress(config.contractAddress, 8) : "—"}</span>
        </div>
        <Link
          to="/admin/register"
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-medium text-white transition-colors hover:bg-slate-800 whitespace-nowrap"
        >
          <FilePlus2 className="h-4 w-4" />
          <span>Register New Land</span>
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Total Registered Lands</p>
          {loadingData ? (
            <div className="mt-3 h-8 w-16 animate-pulse rounded bg-slate-200" />
          ) : (
            <p className="mt-2 font-display text-3xl font-bold text-slate-900 tabular-nums">
              {stats.totalLands}
            </p>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Total Property Owners</p>
          {loadingData ? (
            <div className="mt-3 h-8 w-16 animate-pulse rounded bg-slate-200" />
          ) : (
            <p className="mt-2 font-display text-3xl font-bold text-slate-900 tabular-nums">
              {stats.totalOwners}
            </p>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Pending Transfers</p>
          {loadingData ? (
            <div className="mt-3 h-8 w-16 animate-pulse rounded bg-slate-200" />
          ) : (
            <p className="mt-2 font-display text-3xl font-bold text-amber-700 tabular-nums">
              {stats.pendingTransfers}
            </p>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Completed Transfers</p>
          {loadingData ? (
            <div className="mt-3 h-8 w-16 animate-pulse rounded bg-slate-200" />
          ) : (
            <p className="mt-2 font-display text-3xl font-bold text-teal-700 tabular-nums">
              {stats.completedTransfers}
            </p>
          )}
        </div>
      </div>

      {/* Recharts Analytics */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Property Distribution by State
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Derived directly from registered on-chain parcels
          </p>
          <div className="mt-4 h-64">
            {stats.stateDistribution.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-slate-500">
                No registered parcels yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.stateDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="state" tick={{ fontSize: 12, fill: "#475569" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#475569" }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Parcels" fill="#0F172A" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Smart Contract Event Activity
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Live event counts from LandRegistry logs
          </p>
          <div className="mt-4 h-64">
            {events.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-slate-500">
                No smart contract events emitted yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.activityBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#475569" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#475569" }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Events" fill="#0D9488" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Pending Transfer Approvals */}
      <section className="mt-6 rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Pending Ownership Transfer Requests ({pendingTransfers.length})
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Transfers can only be approved after the proposed recipient has accepted on-chain.
          </p>
        </div>

        {pendingTransfers.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No active transfer requests awaiting review.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-6 py-3">Property ID</th>
                  <th className="px-6 py-3">Current Owner</th>
                  <th className="px-6 py-3">Proposed Recipient</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Admin Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {pendingTransfers.map((prop) => {
                  const statusLabel = getTransferStatusLabel(prop.pendingTransfer);
                  const canApprove = isAdmin && prop.pendingTransfer.recipientAccepted;
                  return (
                    <tr key={prop.propertyId} className="hover:bg-slate-50">
                      <td className="px-6 py-3.5 font-mono font-semibold text-slate-900 tabular-nums">
                        #{prop.propertyId}
                      </td>
                      <td className="px-6 py-3.5 font-mono text-xs text-slate-700">
                        {shortenAddress(prop.pendingTransfer.currentOwner, 6)}
                      </td>
                      <td className="px-6 py-3.5 font-mono text-xs text-slate-700">
                        {shortenAddress(prop.pendingTransfer.proposedOwner, 6)}
                      </td>
                      <td className="px-6 py-3.5 text-xs font-medium text-slate-800">
                        {statusLabel}
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            disabled={!canApprove || txPending}
                            onClick={() => setPendingAction({ type: "approve", property: prop })}
                            className="inline-flex items-center gap-1 rounded-md bg-teal-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Approve</span>
                          </button>
                          <button
                            type="button"
                            disabled={!isAdmin || txPending}
                            onClick={() => setPendingAction({ type: "reject", property: prop })}
                            className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            <span>Reject</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* All Registered Properties Search & Table */}
      <section className="mt-6 rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Registered Properties ({filteredProperties.length})
          </h2>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search Property ID, Survey, Owner..."
              aria-label="Search registered properties"
              className="w-full rounded-lg border border-slate-300 py-2 pr-3 pl-9 text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-6 py-3">Property ID</th>
                <th className="px-6 py-3">Survey No.</th>
                <th className="px-6 py-3">Location</th>
                <th className="px-6 py-3 text-right">Area</th>
                <th className="px-6 py-3">Current Owner</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredProperties.map((prop) => (
                <tr key={prop.propertyId} className="hover:bg-slate-50">
                  <td className="px-6 py-3.5 font-mono font-semibold text-slate-900 tabular-nums">
                    #{prop.propertyId}
                  </td>
                  <td className="px-6 py-3.5 font-mono text-xs text-slate-700">
                    {prop.surveyNumber}
                  </td>
                  <td className="px-6 py-3.5 text-xs text-slate-700">
                    {prop.location} · {prop.district}, {prop.state}
                  </td>
                  <td className="px-6 py-3.5 text-right text-xs text-slate-700 tabular-nums">
                    {formatArea(prop.area)}
                  </td>
                  <td className="px-6 py-3.5 font-mono text-xs text-slate-700">
                    {shortenAddress(prop.currentOwner, 6)}
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedProperty(prop)}
                      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Bottom Split: Recent Transactions & Registered Owners */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Recent Blockchain Transactions
            </h2>
            <Link to="/transactions" className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:underline">
              <span>View All</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-slate-200">
            {events.length === 0 ? (
              <div className="px-6 py-8 text-center text-xs text-slate-500">
                No blockchain transactions recorded yet.
              </div>
            ) : (
              events.slice(0, 5).map((ev, i) => (
                <div key={`${ev.transactionHash}-${ev.eventType}-${i}`} className="flex items-center justify-between gap-4 px-6 py-3.5 text-xs">
                  <div>
                    <p className="font-medium text-slate-900">
                      {ev.eventType} · Property #{ev.propertyId}
                    </p>
                    <p className="mt-0.5 text-slate-500 tabular-nums">
                      Block #{ev.blockNumber} · {formatTimestamp(ev.timestamp)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyHash(ev.transactionHash)}
                    className="inline-flex items-center gap-1.5 font-mono text-slate-600 hover:text-slate-900"
                    title="Copy transaction hash"
                  >
                    <span>{shortenHash(ev.transactionHash, 6)}</span>
                    {copiedHash === ev.transactionHash ? (
                      <Check className="h-3.5 w-3.5 text-teal-700" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Registered Property Owners ({uniqueOwnersList.length})
            </h2>
          </div>
          <div className="divide-y divide-slate-200">
            {uniqueOwnersList.length === 0 ? (
              <div className="px-6 py-8 text-center text-xs text-slate-500">
                No registered property owners yet.
              </div>
            ) : (
              uniqueOwnersList.map((owner) => (
                <div key={owner.address} className="flex items-center justify-between gap-3 px-6 py-3.5 text-xs">
                  <span className="truncate font-mono text-slate-800" title={owner.address}>
                    {owner.address}
                  </span>
                  <span className="font-medium text-slate-600 tabular-nums whitespace-nowrap">
                    {owner.parcelCount} {owner.parcelCount === 1 ? "Property" : "Properties"}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Contact Inquiries (SQLite Persistence) */}
      <section className="mt-6 rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-teal-700" aria-hidden="true" />
            <h2 className="font-display text-base font-semibold text-slate-900">
              Public Contact Inquiries ({inquiries.length})
            </h2>
          </div>
          <span className="text-xs text-slate-500">Stored in SQLite (ContactInquiry)</span>
        </div>

        {inquiries.length === 0 ? (
          <div className="px-6 py-8 text-center text-xs text-slate-500">
            No contact inquiries submitted yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {inquiries.slice(0, 10).map((inq) => (
              <div key={inq.id} className="px-6 py-4 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900">
                    {inq.subject}{" "}
                    <span className="font-normal text-slate-500">
                      — {inq.name} ({inq.email})
                    </span>
                  </p>
                  <span className="text-slate-400 tabular-nums">
                    {new Date(inq.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="mt-1.5 leading-relaxed text-slate-600">{inq.message}</p>
              </div>
            ))}
          </div>
        )}
      </section>

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
        open={Boolean(pendingAction)}
        title={
          pendingAction?.type === "approve"
            ? `Approve Transfer for Property #${pendingAction.property.propertyId}`
            : `Reject Transfer for Property #${pendingAction?.property.propertyId}`
        }
        description={
          pendingAction?.type === "approve"
            ? `This will execute approveTransfer() on-chain and permanently transfer ownership to ${pendingAction.property.pendingTransfer.proposedOwner}.`
            : `This will reject the active transfer request for Property #${pendingAction?.property.propertyId} and emit TransferRejected.`
        }
        confirmLabel={pendingAction?.type === "approve" ? "Approve Transfer" : "Reject Transfer"}
        variant={pendingAction?.type === "reject" ? "danger" : "primary"}
        busy={txPending}
        onConfirm={executePendingDecision}
        onCancel={() => setPendingAction(null)}
      />
    </DashboardLayout>
  );
}
