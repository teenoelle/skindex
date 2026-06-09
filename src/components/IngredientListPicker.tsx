"use client";
import { useState, useRef, useEffect } from "react";

type ListOption = { id: string; name: string };

type Props = {
  ingredientName: string;
  lists: ListOption[];
  onAdd: (listId: string, listName: string) => void;
};

export default function IngredientListPicker({ ingredientName: _ingredientName, lists, onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  if (lists.length === 0) return null;

  function handlePick(listId: string, listName: string) {
    onAdd(listId, listName);
    setJustAdded(listName);
    setOpen(false);
    setTimeout(() => setJustAdded(null), 2000);
  }

  return (
    <div className="relative inline-block" ref={ref}>
      {justAdded ? (
        <span className="text-[10px] text-teal-600 whitespace-nowrap">Added to {justAdded}</span>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="text-[10px] text-gray-400 hover:text-gray-700 border border-gray-200 rounded px-1.5 py-0.5 transition-colors whitespace-nowrap"
        >
          + Save to list
        </button>
      )}
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-md z-30 min-w-[140px] py-1 overflow-hidden">
          {lists.map(l => (
            <button
              key={l.id}
              type="button"
              onClick={() => handlePick(l.id, l.name)}
              className="w-full text-left text-xs px-3 py-2 hover:bg-gray-50 truncate block"
            >
              {l.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
