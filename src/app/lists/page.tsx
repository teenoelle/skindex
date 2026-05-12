"use client";

import { useEffect, useState } from "react";
import { useUser, SignInButton } from "@clerk/nextjs";
import Link from "next/link";

type UserList = {
  id: string;
  name: string;
  is_public: boolean;
  itemCount: number;
  created_at: string;
};

export default function ListsPage() {
  const { isSignedIn, isLoaded } = useUser();
  const [lists, setLists] = useState<UserList[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) { setLoading(false); return; }
    fetch("/api/lists")
      .then((r) => r.json())
      .then((d) => { setLists(d.lists ?? []); setLoading(false); });
  }, [isLoaded, isSignedIn]);

  async function createList() {
    if (!newName.trim()) return;
    setCreating(true);
    const res = await fetch("/api/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    const data = await res.json();
    setCreating(false);
    if (res.ok) {
      setLists((prev) => [data.list, ...prev]);
      setNewName("");
      setCreateOpen(false);
    }
  }

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-white">
        <header className="border-b border-gray-100 px-6 py-4">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <Link href="/" className="text-xl tracking-tight select-none">
              <span className="font-black">SKIN</span>
              <span className="font-light text-gray-500">dex</span>
            </Link>
          </div>
        </header>
        <main className="max-w-2xl mx-auto px-6 py-16">
          <p className="text-sm text-gray-400">Loading…</p>
        </main>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-white">
        <header className="border-b border-gray-100 px-6 py-4">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <Link href="/" className="text-xl tracking-tight select-none">
              <span className="font-black">SKIN</span>
              <span className="font-light text-gray-500">dex</span>
            </Link>
          </div>
        </header>
        <main className="max-w-2xl mx-auto px-6 py-16 text-center">
          <p className="text-gray-500 mb-4">Sign in to create and view your lists.</p>
          <SignInButton mode="modal">
            <button className="text-sm text-gray-900 border border-gray-300 rounded-xl px-4 py-2 hover:border-gray-500 transition-colors">
              Sign in
            </button>
          </SignInButton>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl tracking-tight select-none">
            <span className="font-black">SKIN</span>
            <span className="font-light text-gray-500">dex</span>
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-16">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">My Lists</h1>
          {!createOpen && (
            <button
              onClick={() => setCreateOpen(true)}
              className="text-sm text-gray-600 border border-gray-200 rounded-xl px-3 py-1.5 hover:border-gray-400 hover:text-gray-900 transition-colors"
            >
              + New list
            </button>
          )}
        </div>

        {createOpen && (
          <div className="mb-6 flex gap-2">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createList()}
              placeholder="List name"
              className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-gray-400"
            />
            <button
              onClick={createList}
              disabled={creating || !newName.trim()}
              className="text-sm px-4 py-2.5 bg-gray-900 text-white rounded-xl disabled:opacity-40"
            >
              {creating ? "Creating…" : "Create"}
            </button>
            <button
              onClick={() => { setCreateOpen(false); setNewName(""); }}
              className="text-sm text-gray-400 hover:text-gray-700 px-2"
            >
              Cancel
            </button>
          </div>
        )}

        {lists.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 text-sm mb-4">No lists yet.</p>
            {!createOpen && (
              <button
                onClick={() => setCreateOpen(true)}
                className="text-sm text-gray-700 underline underline-offset-2"
              >
                Create your first list
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {lists.map((list) => (
              <Link
                key={list.id}
                href={`/lists/${list.id}`}
                className="flex items-center justify-between py-4 hover:bg-gray-50 -mx-2 px-2 rounded-xl transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{list.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {list.itemCount} product{list.itemCount !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {list.is_public && (
                    <span className="text-xs text-gray-400 border border-gray-200 rounded-full px-2 py-0.5">
                      Public
                    </span>
                  )}
                  <span className="text-gray-300">›</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
