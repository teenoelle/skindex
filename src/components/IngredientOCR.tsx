"use client";

import { useEffect, useRef, useState } from "react";

type Phase = "camera" | "processing" | "error";

interface Props {
  onExtracted: (text: string) => void;
  onClose: () => void;
}

export default function IngredientOCR({ onExtracted, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>("camera");
  const [capturedSrc, setCapturedSrc] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [camError, setCamError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let done = false;

    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      })
      .then((s) => {
        if (done) { s.getTracks().forEach((t) => t.stop()); return; }
        stream = s;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = s;
        video.play().catch(() => {});
      })
      .catch(() => {
        if (!done) setCamError("Camera access denied. Allow camera access and try again.");
      });

    return () => {
      done = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function capture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
    setCapturedSrc(dataUrl);
    setPhase("processing");

    // Stop stream now that we have the still
    (video.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop());

    try {
      const res = await fetch("/api/scan/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl.split(",")[1] }),
      });
      const data = await res.json() as { ingredients?: string; error?: string };
      if (data.ingredients) {
        onExtracted(data.ingredients);
      } else {
        setErrorMsg(data.error ?? "Couldn't read the ingredient list. Try a clearer, flatter photo.");
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

    // Restart camera
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } } })
      .then((s) => {
        const video = videoRef.current;
        if (!video) { s.getTracks().forEach((t) => t.stop()); return; }
        video.srcObject = s;
        video.play().catch(() => {});
      })
      .catch(() => setCamError("Camera access denied."));
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-white text-sm font-medium">
          {phase === "camera" && "Frame the ingredient list"}
          {phase === "processing" && "Reading ingredients…"}
          {phase === "error" && "Couldn't read — try again"}
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
              <span className="text-sm">Reading ingredients…</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 relative overflow-hidden">
          <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
          <p className="absolute top-0 left-0 right-0 text-center text-white/50 text-xs pt-3 px-6">
            Keep the label flat and fully in frame
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
