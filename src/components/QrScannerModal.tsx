import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Camera, Upload, X, ScanLine, AlertCircle } from "lucide-react";
import { parseQrVerificationPayload } from "../utils/registry";

interface QrScannerModalProps {
  open: boolean;
  onClose: () => void;
  onDetected: (propertyId: string) => void;
}

export function QrScannerModal({ open, onClose, onDetected }: QrScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    if (!open) {
      stopCamera();
      setError(null);
    }
    return () => stopCamera();
  }, [open]);

  useEffect(() => {
    if (!open || !cameraActive) return;
    let rafId = 0;

    const scanFrame = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code?.data) {
            const parsed = parseQrVerificationPayload(code.data);
            if (parsed.propertyId) {
              stopCamera();
              onDetected(parsed.propertyId);
              onClose();
              return;
            }
          }
        }
      }
      rafId = requestAnimationFrame(scanFrame);
    };

    rafId = requestAnimationFrame(scanFrame);
    return () => cancelAnimationFrame(rafId);
  }, [open, cameraActive, onDetected, onClose]);

  const startCamera = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera access is not supported in this browser. Upload a QR PNG image below instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch {
      setError("Camera permission denied or no camera available. Upload a QR PNG image below.");
    }
  };

  const handleImageUpload = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          setError("Could not read image canvas.");
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        URL.revokeObjectURL(objectUrl);

        if (!code?.data) {
          setError("No valid LandChain QR code detected in that image.");
          return;
        }
        const parsed = parseQrVerificationPayload(code.data);
        if (!parsed.propertyId) {
          setError("QR code decoded, but it does not contain a LandChain Property ID.");
          return;
        }
        onDetected(parsed.propertyId);
        onClose();
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        setError("Unable to load the selected image file.");
      };
      img.src = objectUrl;
    } catch {
      setError("Failed to decode QR image.");
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-scanner-title"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-teal-700" aria-hidden="true" />
            <h2 id="qr-scanner-title" className="font-display text-lg font-semibold text-slate-900">
              Scan Property QR Code
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close QR scanner"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-900">
            {cameraActive ? (
              <video ref={videoRef} className="h-56 w-full object-cover" muted playsInline />
            ) : (
              <div className="flex h-48 flex-col items-center justify-center gap-3 px-4 text-center text-slate-300">
                <Camera className="h-8 w-8 text-teal-400" />
                <p className="text-xs">
                  Use your device camera to scan a LandChain property QR code, or upload a downloaded QR PNG image.
                </p>
                <button
                  type="button"
                  onClick={startCamera}
                  className="rounded-lg bg-teal-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-teal-500"
                >
                  Enable Camera Scanner
                </button>
              </div>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {cameraActive && (
            <button
              type="button"
              onClick={stopCamera}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Stop Camera
            </button>
          )}

          <div className="border-t border-slate-200 pt-4">
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-xs font-medium text-slate-700 transition-colors hover:border-teal-600 hover:bg-teal-50/40">
              <Upload className="h-4 w-4 text-teal-700" />
              <span>Upload QR Code Image (PNG / JPG)</span>
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  handleImageUpload(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
