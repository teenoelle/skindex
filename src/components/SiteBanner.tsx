"use client";

import { useEffect, useState } from "react";

type BannerData = { id: string; message: string; dismissible: boolean };

export default function SiteBanner() {
  const [banner, setBanner] = useState<BannerData | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch("/api/banner")
      .then((r) => r.json())
      .then((d) => {
        if (d.banner) {
          const key = `banner-dismissed-${d.banner.id}`;
          if (sessionStorage.getItem(key)) return;
          setBanner(d.banner);
        }
      })
      .catch(() => {});
  }, []);

  function dismiss() {
    if (banner) sessionStorage.setItem(`banner-dismissed-${banner.id}`, "1");
    setDismissed(true);
  }

  if (!banner || dismissed) return null;

  return (
    <div className="bg-indigo-600 text-white px-6 py-2.5">
      <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
        <p className="text-sm">{banner.message}</p>
        {banner.dismissible && (
          <button
            type="button"
            onClick={dismiss}
            className="text-indigo-200 hover:text-white shrink-0 text-lg leading-none"
            aria-label="Dismiss"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
