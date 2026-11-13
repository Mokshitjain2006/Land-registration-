import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "../components/DashboardLayout";
import { useWallet } from "../context/WalletContext";
import { formatTimestamp } from "../utils/registry";
import { shortenAddress, shortenHash } from "../utils/crypto";

const EVENT_TYPES = [
  "ALL",
  "LandRegistered",
  "TransferRequested",
  "TransferAccepted",
  "OwnershipTransferred",
  "TransferRejected",
  "TransferCancelled",
];

const PAGE_SIZE = 10;

export function TransactionHistoryPage() {
  const { events, loadingData } = useWallet();
  const [searchParams] = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("propertyId") || "");
  const [eventFilter, setEventFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [copiedTx, setCopiedTx] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((ev) => {
      if (eventFilter !== "ALL" && ev.eventType !== eventFilter) return false;
      if (!q) return true;
      return (
        String(ev.propertyId).includes(q) ||
        ev.transactionHash.toLowerCase().includes(q) ||
        ev.previousOwner.toLowerCase().includes(q) ||
        ev.newOwner.toLowerCase().includes(q)
      );
    });
  }, [events, eventFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const copyTxHash = async (hash: string) => {
    await navigator.clipboard.writeText(hash);
    setCopiedTx(hash);
    toast.success("Transaction hash copied");
    setTimeout(() => setCopiedTx(null), 1500);
  };

  return (
    <DashboardLayout title="Blockchain Transaction History" breadcrumb="Transaction Ledger">
      <div className="space-y-6">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1 lg:max-w-md">
              <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Filter by Property ID, Tx Hash, or Wallet..."
                aria-label="Filter blockchain transactions"
                className="w-full rounded-lg border border-slate-300 py-2 pr-3 pl-9 text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {EVENT_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setEventFilter(type);
                    setPage(1);
                  }}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    eventFilter === type
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {type === "ALL" ? "All Events" : type}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Immutable Event Ledger ({filtered.length})
            </h2>
          </div>

          {loadingData ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Querying smart contract event logs...
            </div>
          ) : paginated.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No matching blockchain events found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                  <tr>
                    <th className="px-5 py-3">Property ID</th>
                    <th className="px-5 py-3">Transaction Type</th>
                    <th className="px-5 py-3">Previous / Actor</th>
                    <th className="px-5 py-3">New / Target</th>
                    <th className="px-5 py-3">Tx Hash</th>
                    <th className="px-5 py-3 text-right">Block</th>
                    <th className="px-5 py-3">Timestamp</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {paginated.map((ev, idx) => (
                    <tr key={`${ev.transactionHash}-${ev.eventType}-${idx}`} className="hover:bg-slate-50">
                      <td className="px-5 py-3.5 font-mono font-semibold text-slate-900 tabular-nums">
                        <Link
                          to={`/verify/${ev.propertyId}`}
                          className="text-teal-800 hover:underline"
                        >
                          #{ev.propertyId}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 font-medium text-slate-900">
                        {ev.eventType}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-slate-600">
                        {shortenAddress(ev.previousOwner)}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-slate-600">
                        {shortenAddress(ev.newOwner)}
                      </td>
                      <td className="px-5 py-3.5">
                        <button
                          type="button"
                          onClick={() => copyTxHash(ev.transactionHash)}
                          className="inline-flex items-center gap-1.5 font-mono text-teal-800 hover:underline"
                          title="Copy full transaction hash"
                        >
                          <span>{shortenHash(ev.transactionHash, 6)}</span>
                          {copiedTx === ev.transactionHash ? (
                            <Check className="h-3.5 w-3.5 text-teal-700" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-slate-700 tabular-nums">
                        #{ev.blockNumber}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 tabular-nums whitespace-nowrap">
                        {formatTimestamp(ev.timestamp)}
                      </td>
                      <td className="px-5 py-3.5 font-medium text-slate-800">
                        {ev.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200 px-6 py-3 text-xs text-slate-600">
              <span className="tabular-nums">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-md border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-50 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded-md border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-50 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
