"use client";

import { useEffect, useRef, useState } from "react";

// Shape Detection API — available in Chrome/Android and Safari iOS 17+
declare class BarcodeDetector {
  constructor(options?: { formats?: string[] });
  detect(image: HTMLVideoElement): Promise<Array<{ rawValue: string; format: string }>>;
}

interface Props {
  onDetected: (barcode: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("BarcodeDetector" in window)) {
      setError("Barcode scanning isn't supported in this browser. Try Chrome on Android or Safari on iOS 17+.");
      return;
    }

    let stream: MediaStream | null = null;
    let animId: number;
    let done = false;

    const detector = new BarcodeDetector({
      formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"],
    });

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((s) => {
        if (done) { s.getTracks().forEach((t) => t.stop()); return; }
        stream = s;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = s;
        video.play().then(() => setReady(true)).catch(() => {});

        const tick = async () => {
          if (done || !videoRef.current) return;
          try {
            const results = await detector.detect(videoRef.current);
            if (results.length > 0 && !done) {
              done = true;
              stream?.getTracks().forEach((t) => t.stop());
              onDetected(results[0].rawValue);
              return;
            }
          } catch { /* ignore frames that can't be decoded */ }
          animId = requestAnimationFrame(tick);
        };
        animId = requestAnimationFrame(tick);
      })
      .catch(() => {
        if (!done) setError("Camera access denied. Allow camera access and try again.");
      });

    return () => {
      done = true;
      stream?.getTracks().forEach((t) => t.stop());
      cancelAnimationFrame(animId);
    };
  }, [onDetected]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-white text-sm font-medium">
          {ready ? "Point camera at barcode" : "Starting camera…"}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="text-white/70 hover:text-white text-sm underline"
        >
          Cancel
        </button>
      </div>

      {error ? (
        <div className="flex-1 flex items-center justify-center p-8 text-center">
          <p className="text-white/80 text-sm leading-relaxed">{error}</p>
        </div>
      ) : (
        <div className="flex-1 relative overflow-hidden">
          <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-72 h-36 relative">
              <span className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white rounded-tl-sm" />
              <span className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white rounded-tr-sm" />
              <span className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white rounded-bl-sm" />
              <span className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white rounded-br-sm" />
              {ready && <div className="absolute left-2 right-2 top-1/2 h-px bg-red-400/60 animate-pulse" />}
            </div>
          </div>
          <p className="absolute bottom-8 left-0 right-0 text-center text-white/50 text-xs px-4">
            Hold the barcode steady inside the frame
          </p>
        </div>
      )}
    </div>
  );
}
