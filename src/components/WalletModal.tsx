import { useEffect } from "react";
import { X, Wallet, ShieldCheck, KeyRound, ArrowRight, Network, Sparkles } from "lucide-react";
import { useWallet } from "../context/WalletContext";
import { shortenAddress } from "../utils/crypto";

export function WalletModal() {
  const {
    walletModalOpen,
    setWalletModalOpen,
    hasMetaMask,
    connectMetaMask,
    connectHardhatAccount,
    switchToLocalNetwork,
    hardhatAccounts,
    config,
    properties,
    account,
    disconnectWallet,
  } = useWallet();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && walletModalOpen) setWalletModalOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [walletModalOpen, setWalletModalOpen]);

  if (!walletModalOpen) return null;

  const describeAccountRole = (addr: string, idx: number) => {
    const lower = addr.toLowerCase();
    if (config?.adminAddress && lower === config.adminAddress.toLowerCase()) {
      return {
        label: "Registry Admin",
        hint: "Register new land parcels, approve or reject ownership transfers",
      };
    }
    const ownedCount = properties.filter(
      (p) => p.currentOwner.toLowerCase() === lower
    ).length;
    if (ownedCount > 0) {
      return {
        label: `Land Owner · ${ownedCount} ${ownedCount === 1 ? "Parcel" : "Parcels"}`,
        hint: "View owned properties, initiate transfers, or accept incoming requests",
      };
    }
    if (idx === 1 || idx === 2) {
      return {
        label: "Owner / Recipient Account",
        hint: "Receive property transfers or test owner dashboard flows",
      };
    }
    return {
      label: "Public / Buyer Account",
      hint: "Receive transfers and verify property records on-chain",
    };
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wallet-modal-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <Wallet className="h-5 w-5 text-teal-700" aria-hidden="true" />
            <h2 id="wallet-modal-title" className="font-display text-lg font-semibold text-slate-900">
              Connect Blockchain Wallet
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setWalletModalOpen(false)}
            aria-label="Close wallet dialog"
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-6">
          {account && (
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <div>
                <p className="text-xs font-medium text-slate-500">Currently Connected</p>
                <p className="font-mono text-sm font-medium text-slate-900">{shortenAddress(account, 6)}</p>
              </div>
              <button
                type="button"
                onClick={disconnectWallet}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0"
              >
                Disconnect
              </button>
            </div>
          )}

          {/* One-Click Local Hardhat Accounts (Zero Manual Setup) */}
          <div className="rounded-lg border border-teal-200 bg-teal-50/40 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  Instant Local Test Accounts (No Setup Required)
                </h3>
                <p className="mt-0.5 text-xs text-slate-600">
                  Everything is pre-configured on the local Hardhat network (Chain ID 31337). Click any role below to connect immediately.
                </p>
              </div>
              <KeyRound className="h-4 w-4 text-teal-700 shrink-0" />
            </div>

            {hardhatAccounts.length === 0 ? (
              <p className="rounded-md bg-white px-3 py-2.5 text-xs text-slate-500">
                Local Hardhat accounts are starting up. Please wait a moment and reopen.
              </p>
            ) : (
              <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
                {hardhatAccounts.slice(0, 5).map((addr, idx) => {
                  const isSelected = account?.toLowerCase() === addr.toLowerCase();
                  const roleInfo = describeAccountRole(addr, idx);
                  return (
                    <button
                      key={addr}
                      type="button"
                      onClick={() => connectHardhatAccount(addr)}
                      className={`flex w-full items-center justify-between rounded-lg border px-3.5 py-2.5 text-left transition-colors ${
                        isSelected
                          ? "border-teal-600 bg-white ring-1 ring-teal-600"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                          <span>Account #{idx}</span>
                          <span aria-hidden="true" className="text-slate-300">·</span>
                          <span className="text-teal-700">{roleInfo.label}</span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">{roleInfo.hint}</p>
                        <p className="mt-0.5 truncate font-mono text-[11px] text-slate-400">
                          {addr}
                        </p>
                      </div>
                      <span className="ml-3 rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white whitespace-nowrap shrink-0">
                        {isSelected ? "Active" : "Use"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Optional: MetaMask Browser Extension */}
          <div className="rounded-lg border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  MetaMask Browser Extension (Optional)
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  Prefer MetaMask? Connect your extension and click below to add Hardhat Local (31337) automatically.
                </p>
              </div>
              <button
                type="button"
                onClick={connectMetaMask}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-900 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0"
              >
                <span>{hasMetaMask ? "Connect MetaMask" : "Check MetaMask"}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
            {hasMetaMask ? (
              <button
                type="button"
                onClick={switchToLocalNetwork}
                className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-200"
              >
                <Sparkles className="h-3.5 w-3.5 text-teal-700" />
                <span>Auto-Add Hardhat Network (Chain ID 31337) to MetaMask</span>
              </button>
            ) : (
              <div className="mt-3 flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <Network className="h-4 w-4 text-slate-500 shrink-0" />
                <span>
                  MetaMask is not required here — use the Instant Local Test Accounts above for full real blockchain transactions.
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="h-4 w-4 text-teal-700 shrink-0" />
            <span>
              Roles are verified strictly from the deployed LandRegistry smart contract, never from client selections.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
