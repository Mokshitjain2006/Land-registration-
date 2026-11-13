import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download, Copy, Check, X, QrCode } from "lucide-react";
import { toast } from "sonner";

interface QrCodeModalProps {
  open: boolean;
  propertyId: number | null;
  surveyNumber?: string;
  onClose: () => void;
}

export function QrCodeModal({ open, propertyId, surveyNumber, onClose }: QrCodeModalProps) {
  const [dataUrl, setDataUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const verifyUrl =
    propertyId && typeof window !== "undefined"
      ? `${window.location.origin}/verify/${propertyId}`
      : "";

  useEffect(() => {
    if (!open || !verifyUrl) return;
    QRCode.toDataURL(verifyUrl, {
      width: 320,
      margin: 2,
      color: {
        dark: "#0F172A",
        light: "#FFFFFF",
      },
    })
      .then(setDataUrl)
      .catch(() => toast.error("Failed to generate QR code"));
  }, [open, verifyUrl]);

  if (!open || !propertyId) return null;

  const handleDownload = () => {
    if (!dataUrl) return;
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `landchain-property-${propertyId}.png`;
    link.click();
    toast.success(`Downloaded QR code for Property #${propertyId}`);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(verifyUrl);
    setCopied(true);
    toast.success("Verification URL copied");
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-modal-title"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-teal-700" aria-hidden="true" />
            <h2 id="qr-modal-title" className="font-display text-lg font-semibold text-slate-900">
              Property Verification QR Code
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close QR dialog"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col items-center p-6 text-center">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            {dataUrl ? (
              <img
                src={dataUrl}
                alt={`Verification QR Code for Property ${propertyId}`}
                className="h-56 w-56 object-contain"
              />
            ) : (
              <div className="flex h-56 w-56 items-center justify-center bg-slate-50 text-xs text-slate-500">
                Generating QR...
              </div>
            )}
          </div>

          <div className="mt-4 space-y-1">
            <p className="font-display text-base font-semibold text-slate-900 tabular-nums">
              Property ID #{propertyId}
            </p>
            {surveyNumber && (
              <p className="font-mono text-xs text-slate-500">{surveyNumber}</p>
            )}
            <p className="max-w-xs break-all font-mono text-xs text-slate-500">
              {verifyUrl}
            </p>
          </div>

          <div className="mt-6 flex w-full gap-3">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap"
            >
              {copied ? <Check className="h-4 w-4 text-teal-700" /> : <Copy className="h-4 w-4" />}
              <span>{copied ? "Copied" : "Copy Link"}</span>
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-medium text-white transition-colors hover:bg-slate-800 whitespace-nowrap"
            >
              <Download className="h-4 w-4" />
              <span>Download PNG</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
