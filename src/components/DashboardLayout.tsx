import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  FilePlus2,
  Building2,
  ShieldCheck,
  History,
  Menu,
  X,
  Wallet,
  Globe,
  AlertTriangle,
  Landmark,
} from "lucide-react";
import { useWallet } from "../context/WalletContext";
import { shortenAddress } from "../utils/crypto";

interface DashboardLayoutProps {
  title: string;
  breadcrumb: string;
  children: React.ReactNode;
}

export function DashboardLayout({ title, breadcrumb, children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const {
    account,
    role,
    isAdmin,
    isWrongNetwork,
    switchToLocalNetwork,
    setWalletModalOpen,
  } = useWallet();

  const navItems = [
    { to: "/registry", label: "Explore Registry", icon: Globe },
    { to: "/verify", label: "Verify Property", icon: ShieldCheck },
    { to: "/owner", label: "Owner Portal", icon: Building2 },
    { to: "/transactions", label: "Transaction History", icon: History },
    { to: "/admin", label: "Admin Dashboard", icon: LayoutDashboard },
    { to: "/admin/register", label: "Register Land", icon: FilePlus2 },
  ];

  const isActive = (path: string) =>
    path === "/verify"
      ? location.pathname.startsWith("/verify")
      : location.pathname === path;

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col bg-slate-900 text-slate-100 lg:flex">
        <div className="flex h-16 items-center gap-2.5 border-b border-slate-800 px-6">
          <Landmark className="h-5 w-5 text-teal-400" aria-hidden="true" />
          <Link to="/" className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap">
            LandChain
          </Link>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-5" aria-label="Workspace Navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? "bg-teal-600 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-800 p-4 text-xs text-slate-400">
          <p className="font-medium text-slate-200">Academic Prototype</p>
          <p className="mt-1 leading-relaxed">
            Chain ID 31337 · Local Ethereum Node. Does not legally establish property title.
          </p>
        </div>
      </aside>

      {/* Mobile Sidebar Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/60"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative z-10 flex w-72 max-w-[85vw] flex-col bg-slate-900 text-slate-100">
            <div className="flex h-16 items-center justify-between border-b border-slate-800 px-5">
              <Link
                to="/"
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-2 font-display text-lg font-bold text-white"
              >
                <Landmark className="h-5 w-5 text-teal-400" />
                <span>LandChain</span>
              </Link>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                aria-label="Close navigation menu"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 px-3 py-4">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium ${
                      active
                        ? "bg-teal-600 text-white"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation menu"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <p className="truncate text-xs text-slate-500">
                <Link to="/" className="hover:text-slate-900">Home</Link>
                <span aria-hidden="true"> / </span>
                <span>{breadcrumb}</span>
              </p>
              <h1 className="truncate font-display text-base font-semibold text-slate-900 sm:text-lg">
                {title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {account && (
              <div className="hidden items-center gap-2 text-xs text-slate-600 md:flex">
                <span className="font-medium text-slate-800">
                  {isAdmin ? "Admin" : role === "OWNER" ? "Owner" : "Public"}
                </span>
                <span aria-hidden="true" className="text-slate-300">·</span>
                <span className="font-mono text-slate-600">{shortenAddress(account)}</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => setWalletModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{account ? "Switch Wallet" : "Connect Wallet"}</span>
            </button>
          </div>
        </header>

        {isWrongNetwork && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-6 py-2.5 text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0" />
              <span>
                MetaMask is on another network. Switch MetaMask to Chain ID 31337, or use an Instant Local Test Account instead.
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={switchToLocalNetwork}
                className="rounded-md bg-amber-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-800 whitespace-nowrap"
              >
                Switch MetaMask to 31337
              </button>
              <button
                type="button"
                onClick={() => setWalletModalOpen(true)}
                className="rounded-md border border-amber-700 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 whitespace-nowrap"
              >
                Use Local Test Account
              </button>
            </div>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
