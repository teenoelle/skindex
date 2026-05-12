"use client";

import Link from "next/link";
import { useUser, SignInButton, UserButton } from "@clerk/nextjs";

export default function NavAuth() {
  const { isSignedIn, isLoaded } = useUser();

  if (!isLoaded) return null;

  if (isSignedIn) return (
    <div className="flex items-center gap-4">
      <Link href="/lists" className="text-sm text-gray-400 hover:text-gray-900 transition-colors">
        My Lists
      </Link>
      <UserButton />
    </div>
  );

  return (
    <SignInButton mode="modal">
      <button className="text-sm text-gray-400 hover:text-gray-900 transition-colors">
        Sign in
      </button>
    </SignInButton>
  );
}
