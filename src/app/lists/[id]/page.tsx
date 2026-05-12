"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { Pipette, FlaskConical, Droplet, Droplets, Waves, Sun, Sparkles, Wind, Bandage, Brush } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Ampoule: Pipette, Balm: Sparkles, Blush: Sparkles, "Body Wash": Waves, Chapstick: Pipette,
  Concealer: Brush, Cream: Droplets, Emulsion: Droplets, Extract: FlaskConical, "Face Mask": Sparkles,
  "Face Wash": Droplets, Foundation: Brush, Gel: Droplet, "Makeup Remover": Droplets, Mist: Wind,
  Oil: Droplet, Ointment: Droplets, Serum: Pipette, Shampoo: Waves, "Spot Patches": Bandage,
  "Sun Screen": Sun, Toner: Droplets,
};

function CategoryIcon({ type }: { type?: string | null }) {
  const Icon = (type && CATEGORY_ICONS[type]) ? CATEGORY_ICONS[type] : Droplet;
  return (
    <div className="flex flex-col items-center gap-1">
      <Icon size={18} className="text-gray-300" />
      {type && <span className="text-[9px] text-gray-400 text-center leading-tight px-0.5">{type}</span>}
    </div>
  );
}

type Product = {
  id: string;
  name: string;
  brand: string | null;
  image_url: string | null;
  type: string | null;
};

type ListItem = {
  id: string;
  product_id: string;
  note: string | null;
  position: number;
  added_at: string;
  products: Product | null;
};

type UserList = {
  id: string;
  name: string;
  is_public: boolean;
  created_at: string;
};

function proxyImage(url: string | null | undefined): string | null {
  if (!url) return null;
  return `/api/image-proxy?url=${encodeURIComponent(url)}`;
}

export default function ListDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isSignedIn } = useUser();

  const [list, setList] = useState<UserList | null>(null);
  const [items, setItems] = useState<ListItem[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [renameLoading, setRenameLoading] = useState(false);

  const [togglingPublic, setTogglingPublic] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [noteLoading, setNoteLoading] = useState(false);

  const [removingId, setRemovingId] = useState<string | null>(null);

  const noteInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch(`/api/lists/${id}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); setLoading(false); return null; }
        return r.json();
      })
      .then((d) => {
        if (!d) return;
        setList(d.list);
        setItems(d.items ?? []);
        setIsOwner(d.isOwner);
        setLoading(false);
      });
  }, [id]);

  async function rename() {
    if (!newName.trim() || !list) return;
    setRenameLoading(true);
    const res = await fetch(`/api/lists/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    const data = await res.json();
    setRenameLoading(false);
    if (res.ok) {
      setList((prev) => prev ? { ...prev, name: data.list.name } : prev);
      setRenaming(false);
    }
  }

  async function togglePublic() {
    if (!list) return;
    setTogglingPublic(true);
    const res = await fetch(`/api/lists/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_public: !list.is_public }),
    });
    const data = await res.json();
    setTogglingPublic(false);
    if (res.ok) setList((prev) => prev ? { ...prev, is_public: data.list.is_public } : prev);
  }

  async function deleteList() {
    setDeleting(true);
    await fetch(`/api/lists/${id}`, { method: "DELETE" });
    router.push("/lists");
  }

  async function removeItem(productId: string, itemId: string) {
    setRemovingId(itemId);
    await fetch(`/api/lists/${id}/items`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId }),
    });
    setItems((prev) => prev.filter((it) => it.id !== itemId));
    setRemovingId(null);
  }

  function startEditNote(item: ListItem) {
    setEditingNoteId(item.id);
    setNoteText(item.note ?? "");
    setTimeout(() => noteInputRef.current?.focus(), 50);
  }

  async function saveNote(item: ListItem) {
    setNoteLoading(true);
    const res = await fetch(`/api/lists/${id}/items`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: item.product_id, note: noteText }),
    });
    setNoteLoading(false);
    if (res.ok) {
      setItems((prev) =>
        prev.map((it) => it.id === item.id ? { ...it, note: noteText || null } : it)
      );
      setEditingNoteId(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <main className="max-w-2xl mx-auto px-6 py-16">
          <p className="text-sm text-gray-400">Loading…</p>
        </main>
      </div>
    );
  }

  if (notFound || !list) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <main className="max-w-2xl mx-auto px-6 py-16 text-center">
          <p className="text-gray-400 text-sm">List not found.</p>
          <Link href="/lists" className="text-sm text-gray-700 underline underline-offset-2 mt-4 block">
            Back to My Lists
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="max-w-2xl mx-auto px-6 py-16">
        {/* Back link */}
        <Link href="/lists" className="text-xs text-gray-400 hover:text-gray-700 mb-6 block">
          ← My Lists
        </Link>

        {/* List header */}
        <div className="mb-8">
          {renaming ? (
            <div className="flex gap-2 items-center mb-2">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && rename()}
                className="flex-1 text-2xl font-semibold tracking-tight border-b border-gray-300 focus:outline-none focus:border-gray-600 pb-0.5 bg-transparent"
              />
              <button
                onClick={rename}
                disabled={renameLoading || !newName.trim()}
                className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg disabled:opacity-40"
              >
                {renameLoading ? "Saving…" : "Save"}
              </button>
              <button onClick={() => setRenaming(false)} className="text-xs text-gray-400 hover:text-gray-700">
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-4 mb-2">
              <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{list.name}</h1>
              {isOwner && (
                <button
                  onClick={() => { setRenaming(true); setNewName(list.name); }}
                  className="text-xs text-gray-400 hover:text-gray-700 shrink-0 mt-1"
                >
                  Rename
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-4">
            <p className="text-xs text-gray-400">{items.length} product{items.length !== 1 ? "s" : ""}</p>
            {isOwner && (
              <>
                <button
                  onClick={togglePublic}
                  disabled={togglingPublic}
                  className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-40"
                >
                  {list.is_public ? "Make private" : "Make public"}
                </button>
                {list.is_public && (
                  <span className="text-xs text-gray-400 border border-gray-200 rounded-full px-2 py-0.5">
                    Public
                  </span>
                )}
                {!deleteConfirm ? (
                  <button
                    onClick={() => setDeleteConfirm(true)}
                    className="text-xs text-gray-400 hover:text-rose-600"
                  >
                    Delete list
                  </button>
                ) : (
                  <span className="text-xs flex items-center gap-2">
                    <span className="text-gray-500">Delete this list?</span>
                    <button onClick={deleteList} disabled={deleting} className="text-rose-600 hover:text-rose-800 disabled:opacity-40">
                      {deleting ? "Deleting…" : "Yes, delete"}
                    </button>
                    <button onClick={() => setDeleteConfirm(false)} className="text-gray-400 hover:text-gray-700">
                      Cancel
                    </button>
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Product list */}
        {items.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 text-sm">No products in this list yet.</p>
            <Link href="/" className="text-sm text-gray-700 underline underline-offset-2 mt-4 block">
              Scan a product to add it
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {items.map((item) => {
              const product = item.products;
              if (!product) return null;
              const isEditing = editingNoteId === item.id;

              return (
                <div key={item.id} className="py-4">
                  <div className="flex items-start gap-3">
                    {product.image_url ? (
                      <Image
                        src={proxyImage(product.image_url)!}
                        width={48}
                        height={56}
                        alt=""
                        className="object-contain rounded-lg border border-gray-100 bg-gray-50 shrink-0"
                        unoptimized
                      />
                    ) : (
                      <div className="w-12 h-14 rounded-lg border border-gray-100 bg-gray-50 shrink-0 flex items-center justify-center">
                        <CategoryIcon type={product.type} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 leading-snug">{product.name}</p>
                      {product.brand && <p className="text-xs text-gray-400">{product.brand}</p>}
                      <div className="flex items-center gap-3 mt-1.5">
                        <Link
                          href={`/?scan=${encodeURIComponent(product.id)}`}
                          className="text-xs text-gray-400 underline underline-offset-2 hover:text-gray-700"
                        >
                          Scan
                        </Link>
                        {isOwner && !isEditing && (
                          <button
                            onClick={() => startEditNote(item)}
                            className="text-xs text-gray-400 underline underline-offset-2 hover:text-gray-700"
                          >
                            {item.note ? "Edit note" : "Add note"}
                          </button>
                        )}
                        {isOwner && (
                          <button
                            onClick={() => removeItem(product.id, item.id)}
                            disabled={removingId === item.id}
                            className="text-xs text-gray-400 hover:text-rose-600 disabled:opacity-40"
                          >
                            {removingId === item.id ? "Removing…" : "Remove"}
                          </button>
                        )}
                      </div>

                      {/* Note */}
                      {isEditing ? (
                        <div className="mt-2 flex flex-col gap-1.5">
                          <textarea
                            ref={noteInputRef}
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            placeholder="Add a note about this product…"
                            rows={2}
                            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-gray-400 resize-none"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveNote(item)}
                              disabled={noteLoading}
                              className="text-xs px-2.5 py-1 bg-gray-900 text-white rounded-lg disabled:opacity-40"
                            >
                              {noteLoading ? "Saving…" : "Save"}
                            </button>
                            <button
                              onClick={() => setEditingNoteId(null)}
                              className="text-xs text-gray-400 hover:text-gray-700"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : item.note ? (
                        <p className="mt-1.5 text-xs text-gray-500 leading-relaxed">{item.note}</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function Header() {
  return (
    <header className="border-b border-gray-100 px-6 py-4">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-xl tracking-tight select-none">
          <span className="font-black">SKIN</span>
          <span className="font-light text-gray-500">dex</span>
        </Link>
      </div>
    </header>
  );
}
