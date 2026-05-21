"use client";

export default function LogoButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("skindex:reset"))}
      className="tracking-tight select-none text-left"
    >
      <span className="text-xl font-black">SKIN</span>
      <span className="text-xl font-light text-gray-500">dex</span>
      <span className="hidden sm:inline font-light text-gray-300 mx-2">·</span>
      <span className="hidden sm:inline text-sm font-light text-gray-400">Scan your skincare</span>
    </button>
  );
}
