"use client";

import { useUser, SignInButton, UserButton } from "@clerk/nextjs";

export default function NavAuth() {
  const { isSignedIn, isLoaded } = useUser();

  if (!isLoaded) return null;

  if (isSignedIn) return <UserButton />;

  return (
    <SignInButton mode="modal">
      <button className="text-sm text-gray-400 hover:text-gray-900 transition-colors">
        Sign in
      </button>
    </SignInButton>
  );
}
