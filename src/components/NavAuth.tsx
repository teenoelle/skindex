"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser, UserButton } from "@clerk/nextjs";

export default function NavAuth() {
  const { isSignedIn, isLoaded } = useUser();
  const [isAdmin, setIsAdmin] = useState(false);
  const [recentCount, setRecentCount] = useState(0);

  useEffect(() => {
    if (!isSignedIn) return;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (!d.isAdmin) return;
        setIsAdmin(true);
        fetch("/api/admin/submissions")
          .then((r) => r.json())
          .then((s) => setRecentCount(s.recentCount ?? 0))
          .catch(() => {});
      })
      .catch(() => {});
  }, [isSignedIn]);

  if (isLoaded && isSignedIn) return (
    <div className="flex items-center gap-4">
      {isAdmin && (
        <Link href="/admin" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-900 transition-colors">
          Admin
          {recentCount > 0 && (
            <span className="text-xs font-medium bg-indigo-100 text-indigo-600 rounded-full px-1.5 py-0.5 leading-none">
              {recentCount}
            </span>
          )}
        </Link>
      )}
      <Link href="/lists" className="text-sm text-gray-400 hover:text-gray-900 transition-colors">
        My Lists
      </Link>
      <UserButton />
    </div>
  );

  return (
    <Link href="/sign-in" className="text-sm text-gray-400 hover:text-gray-900 transition-colors">
      Sign in
    </Link>
  );
}
