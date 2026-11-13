import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, ShieldCheck, QrCode, Eye } from "lucide-react";
import { DashboardLayout } from "../components/DashboardLayout";
import { PropertyDetailsModal } from "../components/PropertyDetailsModal";
import { QrCodeModal } from "../components/QrCodeModal";
import { useWallet } from "../context/WalletContext";
import { formatArea, getTransferStatusLabel, type PropertyRecord } from "../utils/registry";
import { shortenAddress } from "../utils/crypto";

export function ExploreRegistryPage() {
  const { properties, loadingData } = useWallet();
  const [search, setSearch] = useState("");
  const [selectedProperty, setSelectedProperty] = useState<PropertyRecord | null>(null);
  const [qrProperty, setQrProperty] = useState<PropertyRecord | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return properties;
    return properties.filter(
      (p) =>
        String(p.propertyId).includes(q) ||
        p.surveyNumber.toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q) ||
        p.village.toLowerCase().includes(q) ||
        p.district.toLowerCase().includes(q) ||
        p.state.toLowerCase().includes(q) ||
        p.currentOwner.toLowerCase().includes(q)
    );
  }, [properties, search]);

  return (
    <DashboardLayout title="Explore Public Land Registry" breadcrumb="Explore Registry">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5">
          <div className="relative w-full sm:max-w-md">
            <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Property ID, Survey Number, District, State..."
              aria-label="Search public land registry"
              className="w-full rounded-lg border border-slate-300 py-2 pr-3 pl-9 text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
            />
          </div>
          <Link
            to="/verify"
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Verify Document Hash</span>
          </Link>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="font-display text-base font-semibold text-slate-900">
              On-Chain Land Parcels ({filtered.length})
            </h2>
          </div>

          {loadingData ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Loading parcels from LandRegistry smart contract...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No land parcels match your search.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                  <tr>
                    <th className="px-5 py-3">Property ID</th>
                    <th className="px-5 py-3">Survey No.</th>
                    <th className="px-5 py-3">Location</th>
                    <th className="px-5 py-3 text-right">Area</th>
                    <th className="px-5 py-3">Current Owner</th>
                    <th className="px-5 py-3">Transfer Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filtered.map((prop) => (
                    <tr key={prop.propertyId} className="hover:bg-slate-50">
                      <td className="px-5 py-3.5 font-mono font-semibold text-slate-900 tabular-nums">
                        #{prop.propertyId}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-slate-700">
                        {prop.surveyNumber}
                      </td>
                      <td className="px-5 py-3.5 text-slate-700">
                        {prop.location} · {prop.district}, {prop.state}
                      </td>
                      <td className="px-5 py-3.5 text-right text-slate-700 tabular-nums">
                        {formatArea(prop.area)}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-slate-700">
                        {shortenAddress(prop.currentOwner, 6)}
                      </td>
                      <td className="px-5 py-3.5 text-slate-700">
                        {getTransferStatusLabel(prop.pendingTransfer)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedProperty(prop)}
                            aria-label={`View details for Property ${prop.propertyId}`}
                            className="rounded-md border border-slate-300 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setQrProperty(prop)}
                            aria-label={`Generate QR code for Property ${prop.propertyId}`}
                            className="rounded-md border border-slate-300 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                          >
                            <QrCode className="h-3.5 w-3.5" />
                          </button>
                          <Link
                            to={`/verify/${prop.propertyId}`}
                            className="rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap"
                          >
                            Verify
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

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
    </DashboardLayout>
  );
}
