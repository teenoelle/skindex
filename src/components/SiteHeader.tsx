"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useUser, UserButton } from "@clerk/nextjs";

export default function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { isSignedIn, isLoaded } = useUser();
  const [isAdmin, setIsAdmin] = useState(false);
  const [recentCount, setRecentCount] = useState(0);
  const [notifCount, setNotifCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!isSignedIn) return;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.isAdmin) {
          setIsAdmin(true);
          fetch("/api/admin/submissions")
            .then((r) => r.json())
            .then((s) => setRecentCount(s.recentCount ?? 0))
            .catch(() => {});
        }
        fetch("/api/notifications")
          .then((r) => r.json())
          .then((n) => setNotifCount(n.newCount ?? 0))
          .catch(() => {});
      })
      .catch(() => {});
  }, [isSignedIn]);

  function handleLogoClick() {
    window.dispatchEvent(new CustomEvent("skindex:reset"));
    if (pathname !== "/") router.push("/");
  }

  return (
    <>
      {menuOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setMenuOpen(false)}
          aria-hidden
        />
      )}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-6 h-14 flex items-center gap-3">
          {/* Logo */}
          <button
            type="button"
            onClick={handleLogoClick}
            className="tracking-tight select-none shrink-0 text-left"
          >
            <span className="font-black">SKIN</span>
            <span className="font-light text-gray-500">dex</span>
          </button>

          {/* Tagline — always visible on all screen sizes */}
          <span className="text-sm text-gray-400 shrink-0">Scan your skincare</span>

          <div className="flex-1" />

          {/* Desktop nav (sm and up) */}
          <nav className="hidden sm:flex items-center gap-4">
            {isLoaded && isSignedIn && (
              <>
                {isAdmin && (
                  <Link
                    href="/admin"
                    className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-900 transition-colors"
                  >
                    Admin
                    {recentCount > 0 && (
                      <span className="text-xs font-medium bg-indigo-100 text-indigo-600 rounded-full px-1.5 py-0.5 leading-none">
                        {recentCount}
                      </span>
                    )}
                  </Link>
                )}
                <Link
                  href="/notifications"
                  className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-900 transition-colors"
                >
                  Activity
                  {notifCount > 0 && (
                    <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                  )}
                </Link>
                <Link
                  href="/lists"
                  className="text-sm text-gray-400 hover:text-gray-900 transition-colors"
                >
                  My Lists
                </Link>
                <UserButton />
              </>
            )}
            {isLoaded && !isSignedIn && (
              <Link
                href="/sign-in"
                className="text-sm text-gray-400 hover:text-gray-900 transition-colors"
              >
                Sign in
              </Link>
            )}
          </nav>

          {/* Mobile hamburger */}
          <button
            type="button"
            className="sm:hidden p-1.5 text-gray-400 hover:text-gray-700 transition-colors"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menu"
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* Mobile dropdown */}
        {menuOpen && (
          <div className="sm:hidden border-t border-gray-100 bg-white">
            <div className="max-w-2xl mx-auto px-6 py-3 space-y-1">
              {isLoaded && isSignedIn && (
                <>
                  <Link
                    href="/notifications"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-1.5 text-sm text-gray-700 hover:text-gray-900 py-1.5"
                  >
                    Activity
                    {notifCount > 0 && (
                      <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                    )}
                  </Link>
                  <Link
                    href="/lists"
                    onClick={() => setMenuOpen(false)}
                    className="block text-sm text-gray-700 hover:text-gray-900 py-1.5"
                  >
                    My Lists
                  </Link>
                  {isAdmin && (
                    <Link
                      href="/admin"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-1.5 text-sm text-gray-700 hover:text-gray-900 py-1.5"
                    >
                      Admin
                      {recentCount > 0 && (
                        <span className="text-xs font-medium bg-indigo-100 text-indigo-600 rounded-full px-1.5 py-0.5 leading-none">
                          {recentCount}
                        </span>
                      )}
                    </Link>
                  )}
                  <div className="py-1.5">
                    <UserButton />
                  </div>
                </>
              )}
              {isLoaded && !isSignedIn && (
                <Link
                  href="/sign-in"
                  onClick={() => setMenuOpen(false)}
                  className="block text-sm text-gray-700 hover:text-gray-900 py-1.5"
                >
                  Sign in
                </Link>
              )}
            </div>
          </div>
        )}
      </header>
    </>
  );
}
