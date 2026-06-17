"use client";

import { useEffect, useRef, useState } from "react";

type Phase = "camera" | "processing" | "error";

interface Props {
  mode?: "ingredients" | "product";
  onExtracted: (text: string) => void;
  onClose: () => void;
}

const LABELS = {
  ingredients: {
    camera: "Frame the ingredient list",
    processing: "Reading ingredients…",
    error: "Couldn't read — try again",
    hint: "Keep the label flat and fully in frame",
    fallbackError: "Couldn't read the ingredient list. Try a clearer, flatter photo.",
    spinner: "Reading ingredients…",
  },
  product: {
    camera: "Frame the front of the product",
    processing: "Identifying product…",
    error: "Couldn't identify — try again",
    hint: "Frame the product name and brand clearly",
    fallbackError: "Couldn't identify the product. Try a clearer photo of the front label.",
    spinner: "Identifying product…",
  },
};

// Max longest-side dimension before encoding — keeps payload under ~300 KB
const MAX_PX = 1600;

export default function IngredientOCR({ mode = "ingredients", onExtracted, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>("camera");
  const [capturedSrc, setCapturedSrc] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const labels = LABELS[mode];

  function startCamera(video: HTMLVideoElement, onStream: (s: MediaStream) => void, onErr: () => void) {
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } } })
      .then((s) => { onStream(s); video.srcObject = s; video.play().catch(() => {}); })
      .catch(onErr);
  }

  useEffect(() => {
    let stream: MediaStream | null = null;
    let done = false;
    const video = videoRef.current;
    if (!video) return;

    startCamera(
      video,
      (s) => { if (done) { s.getTracks().forEach((t) => t.stop()); return; } stream = s; },
      () => { if (!done) setCamError("Camera access denied. Allow camera access and try again."); }
    );

    return () => {
      done = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function capture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    // Resize to MAX_PX on longest side before encoding to keep payload manageable
    const scale = Math.min(1, MAX_PX / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
    setCapturedSrc(dataUrl);
    setPhase("processing");

    (video.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop());

    try {
      const res = await fetch("/api/scan/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl.split(",")[1], mode }),
      });
      const data = await res.json() as { ingredients?: string; name?: string; error?: string };
      const result = mode === "product" ? data.name : data.ingredients;
      if (result) {
        onExtracted(result);
      } else {
        setErrorMsg(data.error ?? labels.fallbackError);
        setPhase("error");
      }
    } catch {
      setErrorMsg("Something went wrong. Try again.");
      setPhase("error");
    }
  }

  function retry() {
    setErrorMsg(null);
    setCapturedSrc(null);
    setPhase("camera");
    const video = videoRef.current;
    if (!video) return;
    startCamera(video, () => {}, () => setCamError("Camera access denied."));
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-white text-sm font-medium">
          {phase === "camera" && labels.camera}
          {phase === "processing" && labels.processing}
          {phase === "error" && labels.error}
        </p>
        <button type="button" onClick={onClose} className="text-white/70 hover:text-white text-sm underline">
          Cancel
        </button>
      </div>

      <canvas ref={canvasRef} className="hidden" />

      {camError ? (
        <div className="flex-1 flex items-center justify-center p-8 text-center">
          <p className="text-white/80 text-sm leading-relaxed">{camError}</p>
        </div>
      ) : phase === "error" ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
          {capturedSrc && (
            <img src={capturedSrc} alt="Captured" className="max-h-52 rounded-lg object-contain opacity-60" />
          )}
          <p className="text-white/80 text-sm text-center leading-relaxed">{errorMsg}</p>
          <button
            type="button"
            onClick={retry}
            className="text-sm text-white border border-white/40 rounded-full px-5 py-2 hover:border-white/80 transition-colors"
          >
            Try again
          </button>
        </div>
      ) : phase === "processing" ? (
        <div className="flex-1 relative flex items-center justify-center bg-black">
          {capturedSrc && (
            <img src={capturedSrc} alt="Captured" className="w-full h-full object-contain" />
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="flex items-center gap-3 text-white">
              <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" className="opacity-25" />
                <path d="M4 12a8 8 0 018-8" className="opacity-75" />
              </svg>
              <span className="text-sm">{labels.spinner}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 relative overflow-hidden">
          <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
          <p className="absolute top-0 left-0 right-0 text-center text-white/50 text-xs pt-3 px-6">
            {labels.hint}
          </p>
          <div className="absolute bottom-10 left-0 right-0 flex justify-center">
            <button
              type="button"
              onClick={capture}
              aria-label="Capture"
              className="w-16 h-16 rounded-full bg-white border-4 border-white/30 shadow-lg active:scale-95 transition-transform"
            />
          </div>
        </div>
      )}
    </div>
  );
}
