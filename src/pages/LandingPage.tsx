import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck,
  FileCheck2,
  ArrowRightLeft,
  History,
  QrCode,
  Landmark,
  ArrowRight,
  CheckCircle2,
  Menu,
  X,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import { useWallet } from "../context/WalletContext";
import { computeRegistryStats } from "../utils/registry";
import { shortenAddress } from "../utils/crypto";
import { submitContactInquiry } from "../services/api";
import HERO_IMG from "../assets/images/hero_land_registry_1794589429897.jpg";
import ARCHIVE_IMG from "../assets/images/civic_archive_atrium_1794589430376.jpg";

export function LandingPage() {
  const { account, isAdmin, role, config, properties, events, setWalletModalOpen } = useWallet();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [contactForm, setContactForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [submittingContact, setSubmittingContact] = useState(false);
  const [contactSuccess, setContactSuccess] = useState(false);

  const stats = useMemo(() => computeRegistryStats(properties, events), [properties, events]);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingContact(true);
    try {
      await submitContactInquiry(contactForm);
      setContactSuccess(true);
      setContactForm({ name: "", email: "", subject: "", message: "" });
      toast.success("Inquiry saved to registry database");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send message");
    } finally {
      setSubmittingContact(false);
    }
  };

  const features = [
    {
      num: "01",
      title: "Secure Land Registration",
      desc: "Only the smart contract-verified registry administrator can register new land parcels with unique Property IDs and Survey Numbers.",
      icon: Landmark,
      span: "lg:col-span-2",
    },
    {
      num: "02",
      title: "Document Authentication",
      desc: "Property deeds are hashed client-side using SHA-256 via the Web Crypto API. Only the cryptographic digest is written on-chain while original files remain off-chain.",
      icon: FileCheck2,
      span: "lg:col-span-1",
    },
    {
      num: "03",
      title: "Multi-Party Ownership Transfer",
      desc: "Transfers follow a three-party protocol: current owner initiates, proposed recipient accepts, and the registry administrator finalizes.",
      icon: ArrowRightLeft,
      span: "lg:col-span-1",
    },
    {
      num: "04",
      title: "Blockchain Verification",
      desc: "Public citizens can verify parcel ownership, survey identifiers, and deed integrity directly against the Ethereum smart contract.",
      icon: ShieldCheck,
      span: "lg:col-span-1",
    },
    {
      num: "05",
      title: "Transparent Ownership History",
      desc: "Every registration, transfer request, acceptance, rejection, and completion emits an immutable event with block number and transaction hash.",
      icon: History,
      span: "lg:col-span-1",
    },
    {
      num: "06",
      title: "QR Code Verification",
      desc: "Each registered property generates a downloadable PNG QR code linking directly to its live on-chain verification record.",
      icon: QrCode,
      span: "lg:col-span-3",
    },
  ];

  const steps = [
    {
      step: "01",
      title: "Admin Registers Parcel & Deed Hash",
      body: "The authorized registrar enters parcel coordinates, computes the SHA-256 fingerprint of the deed PDF in the browser, and writes the immutable record to Ethereum.",
    },
    {
      step: "02",
      title: "Owner Requests Ownership Transfer",
      body: "A verified parcel owner connects their wallet, specifies the recipient wallet address, and submits a transfer request transaction.",
    },
    {
      step: "03",
      title: "Recipient Accepts & Admin Approves",
      body: "The proposed recipient confirms acceptance on-chain, after which the registry administrator reviews and finalizes the transfer.",
    },
    {
      step: "04",
      title: "Public & QR Verification",
      body: "Anyone can scan the parcel QR code or upload a property deed to verify whether the document hash matches the blockchain ledger.",
    },
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Strict 3-Zone Top Bar */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 py-4 sm:px-6 lg:px-8">
          {/* Zone 1: Brand Wordmark */}
          <Link
            to="/"
            className="font-display text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            LandChain
          </Link>

          {/* Zone 2: 5 concise single-line links */}
          <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex" aria-label="Primary Navigation">
            <a href="#home" className="transition-colors hover:text-slate-900 whitespace-nowrap shrink-0">
              Home
            </a>
            <a href="#about" className="transition-colors hover:text-slate-900 whitespace-nowrap shrink-0">
              About
            </a>
            <a href="#features" className="transition-colors hover:text-slate-900 whitespace-nowrap shrink-0">
              Features
            </a>
            <a href="#how-it-works" className="transition-colors hover:text-slate-900 whitespace-nowrap shrink-0">
              How It Works
            </a>
            <a href="#technology" className="transition-colors hover:text-slate-900 whitespace-nowrap shrink-0">
              Technology
            </a>
            <a href="#contact" className="transition-colors hover:text-slate-900 whitespace-nowrap shrink-0">
              Contact
            </a>
          </nav>

          {/* Zone 3: Primary CTA */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setWalletModalOpen(true)}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              {account ? shortenAddress(account) : "Connect Wallet"}
            </button>
            <button
              type="button"
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              aria-label="Toggle mobile menu"
              className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 md:hidden"
            >
              {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileNavOpen && (
          <nav className="border-t border-slate-200 bg-white px-4 py-3 md:hidden">
            <div className="flex flex-col space-y-2 text-sm font-medium text-slate-700">
              <a href="#home" onClick={() => setMobileNavOpen(false)} className="py-1.5">Home</a>
              <a href="#about" onClick={() => setMobileNavOpen(false)} className="py-1.5">About</a>
              <a href="#features" onClick={() => setMobileNavOpen(false)} className="py-1.5">Features</a>
              <a href="#how-it-works" onClick={() => setMobileNavOpen(false)} className="py-1.5">How It Works</a>
              <a href="#technology" onClick={() => setMobileNavOpen(false)} className="py-1.5">Technology</a>
              <a href="#contact" onClick={() => setMobileNavOpen(false)} className="py-1.5">Contact</a>
            </div>
          </nav>
        )}
      </header>

      {/* Hero Section */}
      <section id="home" className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="grid grid-cols-1 items-stretch gap-10 lg:grid-cols-12">
            <div className="flex flex-col justify-center lg:col-span-6">
              <p className="text-xs font-semibold tracking-wide text-teal-700">
                Ethereum Smart Contract Registry · Academic Prototype
              </p>
              <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-slate-900 text-balance sm:text-5xl lg:text-[3.5rem] lg:leading-[1.08]">
                Secure Land Ownership. Powered by Blockchain.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
                A transparent and tamper-resistant digital land registry platform.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3.5">
                <Link
                  to="/registry"
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-800 whitespace-nowrap"
                >
                  <span>Explore Land Registry</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/verify"
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-100 whitespace-nowrap"
                >
                  <ShieldCheck className="h-4 w-4 text-teal-700" />
                  <span>Verify Property</span>
                </Link>
              </div>

              {/* Portal Shortcuts for Authenticated / Demo Users */}
              <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-slate-200 pt-6 text-xs text-slate-600">
                <span className="font-medium text-slate-900">Portals:</span>
                <Link to="/admin" className="font-medium text-teal-700 hover:underline whitespace-nowrap">
                  Admin Console {isAdmin ? "(Authorized)" : ""}
                </Link>
                <span aria-hidden="true" className="text-slate-300">·</span>
                <Link to="/owner" className="font-medium text-teal-700 hover:underline whitespace-nowrap">
                  Owner Dashboard {role === "OWNER" ? "(Active)" : ""}
                </Link>
                <span aria-hidden="true" className="text-slate-300">·</span>
                <Link to="/transactions" className="font-medium text-teal-700 hover:underline whitespace-nowrap">
                  Transaction Ledger
                </Link>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="relative h-72 overflow-hidden rounded-xl border border-slate-200 bg-slate-900 sm:h-96 lg:h-full lg:min-h-[420px]">
                <img
                  src={HERO_IMG}
                  alt="Planned urban land parcels and civic architecture representing digital cadastral records"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/65 via-slate-950/10 to-transparent" />
                <div className="absolute right-5 bottom-5 left-5 flex flex-wrap items-center justify-between gap-2 text-xs text-white">
                  <span className="font-medium">On-Chain Parcel &amp; Document Hash Verification</span>
                  <span className="font-mono text-slate-200">Solidity ^0.8.24 · Chain 31337</span>
                </div>
              </div>
            </div>
          </div>

          {/* Live On-Chain Telemetry Strip */}
          <div className="mt-10 grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-4">
            <div>
              <p className="text-xs text-slate-500">Registered Land Parcels</p>
              <p className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
                {stats.totalLands}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Verified Property Owners</p>
              <p className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
                {stats.totalOwners}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Completed Transfers</p>
              <p className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
                {stats.completedTransfers}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Local Hardhat Network</p>
              <p className="mt-1 font-mono text-lg font-semibold text-teal-700 tabular-nums">
                Chain ID {config?.chainId || 31337}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* About / Problem & Solution */}
      <section id="about" className="border-b border-slate-200 bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 aspect-4/3">
                <img
                  src={ARCHIVE_IMG}
                  alt="Modern civic land registry archive with architectural survey plans"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
            <div className="lg:col-span-7">
              <p className="text-xs font-semibold text-teal-700">Why LandChain Exists</p>
              <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-900 text-balance">
                Eliminating Duplicate Registrations and Document Tampering
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-600">
                Paper-led and siloed land registries remain vulnerable to forged title deeds, unauthorized record alterations, duplicate survey assignments, and opaque ownership chains.
              </p>
              <div className="mt-6 grid grid-cols-1 gap-4 border-t border-slate-200 pt-6 sm:grid-cols-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Cryptographic Deed Integrity</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">
                    Each deed is fingerprinted with SHA-256 before registration, enabling instant verification without exposing sensitive files on a public ledger.
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Three-Party Transfer Safeguard</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">
                    Ownership only changes after owner initiation, recipient acceptance, and final administrator approval on-chain.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Bento */}
      <section id="features" className="border-b border-slate-200 bg-slate-50 py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold text-teal-700">Platform Capabilities</p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-900 text-balance">
              Core Modules Built on Smart Contract Guarantees
            </h2>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-3">
            {features.map((feat) => {
              const Icon = feat.icon;
              return (
                <div
                  key={feat.num}
                  className={`flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 ${feat.span}`}
                >
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="font-mono font-medium text-teal-700">{feat.num}</span>
                      <Icon className="h-5 w-5 text-slate-700" aria-hidden="true" />
                    </div>
                    <h3 className="mt-4 font-display text-lg font-semibold text-slate-900">
                      {feat.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{feat.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="border-b border-slate-200 bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold text-teal-700">End-to-End Workflow</p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-900">
              How LandChain Operates in Four Steps
            </h2>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((s) => (
              <div key={s.step} className="rounded-xl border border-slate-200 bg-slate-50 p-6">
                <p className="font-mono text-sm font-semibold text-teal-700">{s.step}.</p>
                <h3 className="mt-3 font-display text-base font-semibold text-slate-900">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Blockchain Technology & MetaMask Config */}
      <section id="technology" className="border-b border-slate-200 bg-slate-900 py-16 text-white lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
            <div className="lg:col-span-6">
              <p className="text-xs font-semibold text-teal-400">Blockchain Architecture</p>
              <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-white text-balance">
                On-Chain Source of Truth with Off-Chain Metadata Cache
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-300">
                Ownership records, document SHA-256 digests, and multi-party transfer approvals execute inside the LandRegistry Solidity contract. Express and SQLite/Prisma provide supplementary off-chain deed indexing without ever overriding blockchain ownership.
              </p>

              <ul className="mt-6 space-y-3 text-sm text-slate-200">
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-teal-400 shrink-0" />
                  <span>Solidity ^0.8.24 smart contract compiled &amp; tested with Hardhat</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-teal-400 shrink-0" />
                  <span>Ethers.js v6 MetaMask signing and event log indexing</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-teal-400 shrink-0" />
                  <span>Client-side Web Crypto API SHA-256 hashing (zero raw deed bytes on-chain)</span>
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 lg:col-span-6">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <Building2 className="h-4 w-4 text-teal-400" />
                <h3 className="font-display text-sm font-semibold text-white">
                  MetaMask Local Network Parameters
                </h3>
              </div>
              <dl className="mt-4 space-y-3 text-xs">
                <div className="flex flex-wrap justify-between gap-2 border-b border-slate-800/80 pb-2">
                  <dt className="text-slate-400">Network Name</dt>
                  <dd className="font-mono text-slate-100">Hardhat Localhost 8545</dd>
                </div>
                <div className="flex flex-wrap justify-between gap-2 border-b border-slate-800/80 pb-2">
                  <dt className="text-slate-400">RPC URL</dt>
                  <dd className="font-mono text-slate-100">http://127.0.0.1:8545</dd>
                </div>
                <div className="flex flex-wrap justify-between gap-2 border-b border-slate-800/80 pb-2">
                  <dt className="text-slate-400">Chain ID</dt>
                  <dd className="font-mono text-teal-400 tabular-nums">31337</dd>
                </div>
                <div className="flex flex-wrap justify-between gap-2 border-b border-slate-800/80 pb-2">
                  <dt className="text-slate-400">Deployed Contract</dt>
                  <dd className="break-all font-mono text-slate-100">
                    {config?.contractAddress || "Deploying..."}
                  </dd>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-slate-400">Contract Admin</dt>
                  <dd className="break-all font-mono text-slate-100">
                    {config?.adminAddress || "—"}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="border-b border-slate-200 bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-xs font-semibold text-teal-700">Project Inquiries</p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-900">
              Contact Registry Administration
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Submit questions regarding property verification, smart contract architecture, or academic demonstration feedback.
            </p>
          </div>

          <form onSubmit={handleContactSubmit} className="mt-8 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-6 sm:p-8">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="contact-name" className="block text-xs font-medium text-slate-700">
                  Full Name
                </label>
                <input
                  id="contact-name"
                  type="text"
                  required
                  value={contactForm.name}
                  onChange={(e) => {
                    setContactSuccess(false);
                    setContactForm({ ...contactForm, name: e.target.value });
                  }}
                  placeholder="Aarav Mehta"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="contact-email" className="block text-xs font-medium text-slate-700">
                  Email Address
                </label>
                <input
                  id="contact-email"
                  type="email"
                  required
                  value={contactForm.email}
                  onChange={(e) => {
                    setContactSuccess(false);
                    setContactForm({ ...contactForm, email: e.target.value });
                  }}
                  placeholder="name@university.edu"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="contact-subject" className="block text-xs font-medium text-slate-700">
                Subject
              </label>
              <input
                id="contact-subject"
                type="text"
                required
                value={contactForm.subject}
                onChange={(e) => {
                  setContactSuccess(false);
                  setContactForm({ ...contactForm, subject: e.target.value });
                }}
                placeholder="Property verification inquiry"
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="contact-message" className="block text-xs font-medium text-slate-700">
                Message
              </label>
              <textarea
                id="contact-message"
                rows={4}
                required
                value={contactForm.message}
                onChange={(e) => {
                  setContactSuccess(false);
                  setContactForm({ ...contactForm, message: e.target.value });
                }}
                placeholder="Enter your message or parcel verification question..."
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              {contactSuccess ? (
                <p className="text-xs font-medium text-teal-700">
                  Inquiry recorded successfully in SQLite database.
                </p>
              ) : (
                <span className="text-xs text-slate-500">Stored via Express &amp; Prisma SQLite</span>
              )}
              <button
                type="submit"
                disabled={submittingContact}
                className="rounded-lg bg-slate-900 px-5 py-2.5 text-xs font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-60 whitespace-nowrap"
              >
                {submittingContact ? "Sending..." : "Submit Inquiry"}
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* Quiet Academic Footer */}
      <footer className="bg-slate-950 py-10 text-slate-400">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-6 border-b border-slate-800 pb-8 md:flex-row md:items-center">
            <div>
              <p className="font-display text-lg font-bold text-white">LandChain</p>
              <p className="mt-1 text-xs text-slate-400">
                Blockchain-Based Land Registry Management System · Academic Demonstration Project
              </p>
            </div>
            <div className="flex flex-wrap gap-5 text-xs">
              <Link to="/registry" className="hover:text-white">Explore Registry</Link>
              <Link to="/verify" className="hover:text-white">Verify Property</Link>
              <Link to="/owner" className="hover:text-white">Owner Dashboard</Link>
              <Link to="/admin" className="hover:text-white">Admin Console</Link>
              <Link to="/transactions" className="hover:text-white">Transactions</Link>
            </div>
          </div>

          <p className="mt-6 text-xs leading-relaxed text-slate-500">
            Academic Disclaimer: LandChain is an academic prototype built to demonstrate smart contract integrity, SHA-256 document verification, and multi-party approval workflows. It does not replace official government land registries or legally establish property ownership.
          </p>
        </div>
      </footer>
    </div>
  );
}
