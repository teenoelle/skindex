"use client";

import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import {
  Smile, Palette, Heart, PersonStanding, Scissors,
  FlaskConical, Sparkles, Eye, Shield, BrushCleaning,
  Eraser, Droplets, Droplet, Layers, Moon, Pill, Sun,
  GlassWater, Pencil, Brush, Pen, Wind, Footprints,
  Hand, Pipette, Waves,
  type LucideIcon,
} from "lucide-react";

type Submission = {
  id: string;
  name: string;
  brand: string | null;
  type: string | null;
  submitted_at: string;
  ingredient_count: number;
};

type AllProduct = {
  id: string;
  name: string;
  brand: string | null;
  type: string | null;
  image_url: string | null;
  iherb_url: string | null;
  source_url: string | null;
  source: string | null;
  created_at: string | null;
  ingredient_list: string | null;
};

type ArchivedProduct = {
  id: string;
  name: string;
  brand: string | null;
  type: string | null;
  source: string | null;
  created_at: string | null;
};

type AllEditState = {
  name: string;
  brand: string;
  type: string;
  source_url: string;
  image_url: string;
  iherb_url: string;
  ingredient_list: string;
};

type ProductType = { id: string; name: string; body_area: string };

type SiteStats = {
  totalProducts: number;
  archivedCount: number;
  classifiedIngredients: number;
  queueLength: number;
  pendingSubmissions: number;
};

type AuditEntry = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  detail: Record<string, unknown>;
  created_at: string;
};

const BODY_AREAS = ["Face", "Makeup", "Lips", "Body", "Hair"];

const BODY_AREA_ICON: Record<string, LucideIcon> = {
  Face: Smile,
  Makeup: Palette,
  Lips: Heart,
  Body: PersonStanding,
  Hair: Scissors,
};

const PRODUCT_TYPE_ICON: Record<string, LucideIcon> = {
  // Face
  Concentrate: FlaskConical,
  Exfoliant: Sparkles,
  "Eye Cream": Eye,
  "Eye Primer": Eye,
  "Face Mask": Shield,
  "Face Wash": BrushCleaning,
  "Makeup Remover": Eraser,
  Mist: Droplets,
  Moisturizer: Droplet,
  Oil: Droplet,
  Ointment: Layers,
  Primer: Layers,
  Serum: Pipette,
  "Sleeping Mask": Moon,
  "Spot Patches": Pill,
  "Sun Screen": Sun,
  Toner: GlassWater,
  // Makeup
  "BB Cream": Layers,
  Blush: Heart,
  "Brow Gel": Pencil,
  "CC Cream": Layers,
  Concealer: Brush,
  Eyeliner: Pen,
  Eyeshadow: Eye,
  Foundation: Layers,
  Mascara: Eye,
  "Setting Spray": Wind,
  // Lips
  "Lip Balm": Heart,
  "Lip Treatment": Heart,
  // Body
  "Body Lotion": Droplets,
  "Body Wash": BrushCleaning,
  Deodorant: Wind,
  "Foot Cream": Footprints,
  "Hand Cream": Hand,
  // Hair
  Conditioner: Droplets,
  "Hair Styler": Wind,
  "Hair Treatment": Sparkles,
  "Scalp Treatment": Pipette,
  Shampoo: Waves,
};

const PRODUCT_TYPE_GROUPS: { label: string; types: string[] }[] = [
  { label: "Face", types: ["Concentrate", "Exfoliant", "Eye Cream", "Eye Primer", "Face Mask", "Face Wash", "Makeup Remover", "Mist", "Moisturizer", "Oil", "Ointment", "Primer", "Serum", "Sleeping Mask", "Spot Patches", "Sun Screen", "Toner"].sort() },
  { label: "Makeup", types: ["BB Cream", "Blush", "Brow Gel", "CC Cream", "Concealer", "Eyeliner", "Eyeshadow", "Foundation", "Mascara", "Setting Spray"].sort() },
  { label: "Lips", types: ["Lip Balm", "Lip Treatment"] },
  { label: "Body", types: ["Body Lotion", "Body Wash", "Deodorant", "Foot Cream", "Hand Cream"].sort() },
  { label: "Hair", types: ["Conditioner", "Hair Styler", "Hair Treatment", "Scalp Treatment", "Shampoo"].sort() },
];

const FALLBACK_TYPES_SET = new Set(PRODUCT_TYPE_GROUPS.flatMap((g) => g.types));

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function describeAction(entry: AuditEntry): string {
  const d = entry.detail;
  switch (entry.action) {
    case "add_type":
      return `Added type "${d.name}" (${d.body_area})`;
    case "edit_type": {
      const before = d.before as { name: string; body_area: string };
      const after = d.after as { name: string; body_area: string };
      if (before.name !== after.name && before.body_area !== after.body_area)
        return `Renamed "${before.name}" → "${after.name}" · moved to ${after.body_area}`;
      if (before.name !== after.name)
        return `Renamed type "${before.name}" → "${after.name}"`;
      return `Moved "${after.name}" to ${after.body_area}`;
    }
    case "delete_type":
      return `Deleted type "${d.name}"`;
    case "merge_types": {
      const sources = (d.sources as string[]).map((s) => `"${s}"`).join(", ");
      const target = d.target as { name: string };
      return `Merged ${sources} → "${target.name}"`;
    }
    case "update_product": {
      const changes = Object.entries(d.changes as Record<string, string | null>)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ");
      return `Updated "${d.name}"${changes ? ` — ${changes}` : ""}`;
    }
    case "delete_product":
      return `Deleted product "${d.name}"`;
    case "archive_submission":
      return `Archived submission "${d.name}"`;
    case "archive_product":
      return `Archived product "${d.name}"`;
    case "restore_product":
      return `Restored product "${d.name}"`;
    default:
      return entry.action;
  }
}

function actionColor(action: string): string {
  if (action.startsWith("delete")) return "text-rose-500";
  if (action.startsWith("archive")) return "text-gray-400";
  if (action.startsWith("restore")) return "text-teal-600";
  if (action === "merge_types") return "text-indigo-600";
  if (action === "add_type") return "text-teal-600";
  return "text-gray-700";
}

const ACTION_GROUPS: Record<string, string[]> = {
  Products: ["update_product", "delete_product", "restore_product"],
  Types: ["add_type", "edit_type", "delete_type", "merge_types"],
  Archive: ["archive_product", "archive_submission"],
};

function BodyAreaPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const isKnown = BODY_AREAS.includes(value);
  const [showCustom, setShowCustom] = useState(!isKnown && value !== "");

  function selectKnown(a: string) {
    onChange(a);
    setShowCustom(false);
  }

  function openCustom() {
    setShowCustom(true);
    if (isKnown) onChange("");
  }

  return (
    <div className="flex flex-wrap gap-1 items-center">
      {BODY_AREAS.map((a) => (
        <button
          key={a}
          type="button"
          onClick={() => selectKnown(a)}
          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
            value === a && !showCustom
              ? "bg-indigo-600 text-white border-indigo-600"
              : "border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700"
          }`}
        >
          {a}
        </button>
      ))}
      {showCustom ? (
        <input
          type="text"
          value={!isKnown ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Area name…"
          autoFocus
          className="text-xs border border-indigo-200 rounded-full px-2.5 py-1 focus:outline-none focus:border-indigo-400 w-28"
        />
      ) : (
        <button
          type="button"
          onClick={openCustom}
          className="text-xs px-2.5 py-1 rounded-full border border-dashed border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors"
        >
          + custom
        </button>
      )}
    </div>
  );
}

function initEdit(p: AllProduct, validTypes: Set<string>): AllEditState {
  return {
    name: p.name ?? "",
    brand: p.brand ?? "",
    type: validTypes.has(p.type ?? "") ? (p.type ?? "") : "",
    source_url: p.source_url ?? "",
    image_url: p.image_url ?? "",
    iherb_url: p.iherb_url ?? "",
    ingredient_list: p.ingredient_list ?? "",
  };
}

export default function AdminPage() {
  const { isSignedIn, isLoaded } = useUser();

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [recentCount, setRecentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [archiving, setArchiving] = useState<string | null>(null);

  const [allProducts, setAllProducts] = useState<AllProduct[]>([]);
  const [allProductsLoading, setAllProductsLoading] = useState(false);
  const [allSearch, setAllSearch] = useState("");
  const [allSort, setAllSort] = useState<"newest" | "oldest" | "az" | "za">("newest");
  const [allPage, setAllPage] = useState(1);
  const [allBrands, setAllBrands] = useState<string[]>([]);
  const [allBrandInput, setAllBrandInput] = useState("");
  const [allBrandFilter, setAllBrandFilter] = useState("");
  const [allBrandComboOpen, setAllBrandComboOpen] = useState(false);
  const [filterMissingSource, setFilterMissingSource] = useState(false);
  const [filterMissingIherb, setFilterMissingIherb] = useState(false);
  const [filterMissingImage, setFilterMissingImage] = useState(false);
  const [filterMissingType, setFilterMissingType] = useState(false);
  const [filterMissingIngredients, setFilterMissingIngredients] = useState(false);
  const [allEdits, setAllEdits] = useState<Record<string, AllEditState>>({});
  const [allSaving, setAllSaving] = useState<string | null>(null);
  const [allSaved, setAllSaved] = useState<Set<string>>(new Set());
  const [allSaveError, setAllSaveError] = useState<Record<string, string>>({});
  const [clearConfirming, setClearConfirming] = useState<Record<string, string | null>>({});
  const [clearMarked, setClearMarked] = useState<Record<string, Set<string>>>({});
  const [archivingProduct, setArchivingProduct] = useState<string | null>(null);
  const [archivedProducts, setArchivedProducts] = useState<ArchivedProduct[]>([]);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [restoringProduct, setRestoringProduct] = useState<string | null>(null);
  const [archivedDeleteConfirming, setArchivedDeleteConfirming] = useState<string | null>(null);
  const [archivedDeleteNameInput, setArchivedDeleteNameInput] = useState<Record<string, string>>({});
  const [archivedDeleting, setArchivedDeleting] = useState<string | null>(null);

  const [siteStats, setSiteStats] = useState<SiteStats | null>(null);

  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [typesLoading, setTypesLoading] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeBodyArea, setNewTypeBodyArea] = useState("Face");
  const [typeAdding, setTypeAdding] = useState(false);
  const [typeAddError, setTypeAddError] = useState<string | null>(null);
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [editTypeName, setEditTypeName] = useState("");
  const [editTypeBodyArea, setEditTypeBodyArea] = useState("Face");
  const [typeSaving, setTypeSaving] = useState<string | null>(null);
  const [typeDeleting, setTypeDeleting] = useState<string | null>(null);
  const [typeOpError, setTypeOpError] = useState<string | null>(null);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditExpanded, setAuditExpanded] = useState(false);
  const [auditRange, setAuditRange] = useState<"7d" | "30d" | "all">("7d");
  const [auditActionFilter, setAuditActionFilter] = useState<string | null>(null);
  const [submissionsOpen, setSubmissionsOpen] = useState(true);
  const [allProductsOpen, setAllProductsOpen] = useState(false);
  const [typesOpen, setTypesOpen] = useState(false);
  const [typeFormOpen, setTypeFormOpen] = useState(false);

  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [selectedTypeIds, setSelectedTypeIds] = useState<Set<string>>(new Set());
  const [mergeTargetName, setMergeTargetName] = useState("");
  const [mergeTargetArea, setMergeTargetArea] = useState("Face");
  const [merging, setMerging] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);

  const activeTypesSet = productTypes.length > 0
    ? new Set(productTypes.map((t) => t.name))
    : FALLBACK_TYPES_SET;

  const typeGroups = useMemo(() => {
    if (productTypes.length === 0) return [];
    const byArea: Record<string, ProductType[]> = {};
    for (const t of productTypes) {
      if (!byArea[t.body_area]) byArea[t.body_area] = [];
      byArea[t.body_area].push(t);
    }
    const areas = [
      ...BODY_AREAS.filter((a) => byArea[a]),
      ...Object.keys(byArea).filter((a) => !BODY_AREAS.includes(a)).sort(),
    ];
    return areas.map((a) => ({
      label: a,
      types: byArea[a].sort((x, y) => x.name.localeCompare(y.name)),
    }));
  }, [productTypes]);

  const dropdownGroups = typeGroups.length > 0
    ? typeGroups.map((g) => ({ label: g.label, types: g.types.map((t) => t.name) }))
    : PRODUCT_TYPE_GROUPS;

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { setLoading(false); return; }
    fetch("/api/admin/submissions")
      .then((r) => {
        if (r.status === 403) { setForbidden(true); setLoading(false); return null; }
        return r.json();
      })
      .then((d) => {
        if (!d) return;
        setSubmissions(d.submissions ?? []);
        setRecentCount(d.recentCount ?? 0);
        setLoading(false);
        loadAllProducts();
        loadBrands();
        loadTypes();
        loadAuditLog();
        loadStats();
      })
      .catch(() => setLoading(false));
  }, [isLoaded, isSignedIn]);

  async function loadStats() {
    try {
      const res = await fetch("/api/admin/stats");
      if (res.ok) {
        const data = await res.json();
        setSiteStats(data);
      }
    } catch {
      // ignore
    }
  }

  async function loadAllProducts() {
    setAllProductsLoading(true);
    try {
      const res = await fetch("/api/admin/all-products");
      const data = await res.json();
      const products: AllProduct[] = data.products ?? [];
      setAllProducts(products);
      const initEdits: Record<string, AllEditState> = {};
      for (const p of products) initEdits[p.id] = initEdit(p, FALLBACK_TYPES_SET);
      setAllEdits(initEdits);
    } catch {
      // ignore
    }
    setAllProductsLoading(false);
  }

  async function loadBrands() {
    try {
      const res = await fetch("/api/admin/brands");
      const data = await res.json();
      setAllBrands(data.brands ?? []);
    } catch {
      // ignore
    }
  }

  async function loadAuditLog(range: "7d" | "30d" | "all" = "7d") {
    setAuditLoading(true);
    try {
      const res = await fetch(`/api/admin/audit-log?range=${range}`);
      if (res.ok) {
        const data = await res.json();
        setAuditLog(data.entries ?? []);
      }
    } catch {
      // ignore
    }
    setAuditLoading(false);
  }

  async function loadTypes() {
    setTypesLoading(true);
    try {
      const res = await fetch("/api/admin/product-types");
      if (res.ok) {
        const data = await res.json();
        setProductTypes(data.types ?? []);
      }
    } catch {
      // stay with fallback
    }
    setTypesLoading(false);
  }

  function updateAllEdit(id: string, field: keyof AllEditState, value: string) {
    setAllEdits((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
    setAllSaved((prev) => { const next = new Set(prev); next.delete(id); return next; });
    setAllSaveError((prev) => { const next = { ...prev }; delete next[id]; return next; });
  }

  function productHasChanges(p: AllProduct): boolean {
    const edit = allEdits[p.id];
    if (!edit) return false;
    if (clearMarked[p.id]?.size) return true;
    const base = initEdit(p, FALLBACK_TYPES_SET);
    return (
      edit.name !== base.name ||
      edit.brand !== base.brand ||
      edit.type !== base.type ||
      edit.source_url !== base.source_url ||
      edit.image_url !== base.image_url ||
      edit.iherb_url !== base.iherb_url ||
      edit.ingredient_list !== base.ingredient_list
    );
  }

  async function saveAllProduct(p: AllProduct) {
    const edit = allEdits[p.id];
    if (!edit) return;
    const marked = clearMarked[p.id] ?? new Set<string>();
    setAllSaving(p.id);
    setAllSaveError((prev) => { const next = { ...prev }; delete next[p.id]; return next; });
    try {
      const urlVal = (field: "source_url" | "image_url" | "iherb_url") =>
        marked.has(field) ? "" : (edit[field] || undefined);
      const res = await fetch("/api/admin/update-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: p.id,
          name: edit.name || undefined,
          brand: edit.brand || undefined,
          type: edit.type || undefined,
          source_url: urlVal("source_url"),
          image_url: urlVal("image_url"),
          iherb_url: urlVal("iherb_url"),
          ingredient_list: edit.ingredient_list || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      const updated: AllProduct = {
        ...p,
        name: edit.name || p.name,
        brand: edit.brand || p.brand,
        type: edit.type || p.type,
        source_url: marked.has("source_url") ? null : (edit.source_url || p.source_url),
        image_url: marked.has("image_url") ? null : (edit.image_url || p.image_url),
        iherb_url: marked.has("iherb_url") ? null : (edit.iherb_url || p.iherb_url),
        ingredient_list: edit.ingredient_list || p.ingredient_list,
      };
      setAllProducts((prev) => prev.map((q) => q.id === p.id ? updated : q));
      setAllEdits((prev) => ({ ...prev, [p.id]: initEdit(updated, activeTypesSet) }));
      setClearMarked((prev) => { const next = { ...prev }; delete next[p.id]; return next; });
      setClearConfirming((prev) => { const next = { ...prev }; delete next[p.id]; return next; });
      setAllSaved((prev) => new Set([...prev, p.id]));
    } catch (e) {
      setAllSaveError((prev) => ({ ...prev, [p.id]: (e as Error).message }));
    }
    setAllSaving(null);
  }

  async function handleArchiveAllProduct(p: AllProduct) {
    setArchivingProduct(p.id);
    const res = await fetch("/api/admin/archive-product", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: p.id }),
    });
    if (res.ok) {
      setAllProducts((prev) => prev.filter((q) => q.id !== p.id));
      if (archivedOpen) {
        setArchivedProducts((prev) => [
          { id: p.id, name: p.name, brand: p.brand, type: p.type, source: p.source, created_at: p.created_at },
          ...prev,
        ]);
      }
    }
    setArchivingProduct(null);
  }

  async function loadArchivedProducts() {
    setArchivedLoading(true);
    try {
      const res = await fetch("/api/admin/archived-products");
      const data = await res.json();
      setArchivedProducts(data.products ?? []);
    } catch { }
    setArchivedLoading(false);
  }

  async function handleRestoreProduct(id: string) {
    setRestoringProduct(id);
    const res = await fetch("/api/admin/restore-product", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: id }),
    });
    if (res.ok) setArchivedProducts((prev) => prev.filter((p) => p.id !== id));
    setRestoringProduct(null);
  }

  async function handleDeleteArchivedProduct(id: string) {
    setArchivedDeleting(id);
    const res = await fetch("/api/admin/delete-product", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: id }),
    });
    if (res.ok) {
      setArchivedProducts((prev) => prev.filter((p) => p.id !== id));
      setArchivedDeleteConfirming(null);
      setArchivedDeleteNameInput((prev) => { const next = { ...prev }; delete next[id]; return next; });
    }
    setArchivedDeleting(null);
  }

  async function handleArchive(id: string) {
    setArchiving(id);
    const res = await fetch("/api/admin/mark-reviewed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: id }),
    });
    if (res.ok) setSubmissions((prev) => prev.filter((s) => s.id !== id));
    setArchiving(null);
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeleting(id);
    const res = await fetch("/api/admin/delete-product", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: id }),
    });
    if (res.ok) setSubmissions((prev) => prev.filter((s) => s.id !== id));
    setDeleting(null);
  }

  async function addType() {
    if (!newTypeName.trim()) return;
    setTypeAdding(true);
    setTypeAddError(null);
    try {
      const res = await fetch("/api/admin/product-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTypeName.trim(), body_area: newTypeBodyArea }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setProductTypes((prev) => [...prev, data.type]);
      setNewTypeName("");
    } catch (e) {
      setTypeAddError((e as Error).message);
    }
    setTypeAdding(false);
  }

  function startEditType(t: ProductType) {
    setEditingTypeId(t.id);
    setEditTypeName(t.name);
    setEditTypeBodyArea(t.body_area);
    setTypeOpError(null);
  }

  async function saveTypeEdit(t: ProductType) {
    setTypeSaving(t.id);
    setTypeOpError(null);
    try {
      const res = await fetch(`/api/admin/product-types/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editTypeName.trim() || t.name, body_area: editTypeBodyArea }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setProductTypes((prev) => prev.map((x) => x.id === t.id ? data.type : x));
      setEditingTypeId(null);
    } catch (e) {
      setTypeOpError((e as Error).message);
    }
    setTypeSaving(null);
  }

  async function deleteType(t: ProductType) {
    if (!confirm(`Delete type "${t.name}"?`)) return;
    setTypeDeleting(t.id);
    setTypeOpError(null);
    try {
      const res = await fetch(`/api/admin/product-types/${t.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setProductTypes((prev) => prev.filter((x) => x.id !== t.id));
    } catch (e) {
      setTypeOpError((e as Error).message);
    }
    setTypeDeleting(null);
  }

  function toggleGroup(label: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });
  }

  function toggleTypeSelection(id: string, name: string, bodyArea: string) {
    setSelectedTypeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (next.size === 0) { setMergeTargetName(""); setMergeTargetArea("Face"); }
      } else {
        next.add(id);
        if (next.size === 1) { setMergeTargetName(name); setMergeTargetArea(bodyArea); }
      }
      return next;
    });
  }

  function clearSelection() {
    setSelectedTypeIds(new Set());
    setMergeTargetName("");
    setMergeError(null);
  }

  async function mergeTypes() {
    if (selectedTypeIds.size < 2 || !mergeTargetName.trim()) return;
    setMerging(true);
    setMergeError(null);
    try {
      const res = await fetch("/api/admin/product-types/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          typeIds: Array.from(selectedTypeIds),
          targetName: mergeTargetName.trim(),
          targetBodyArea: mergeTargetArea,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Merge failed");
      setProductTypes((prev) => {
        const filtered = prev.filter((t) => !selectedTypeIds.has(t.id));
        return [...filtered, data.type];
      });
      clearSelection();
    } catch (e) {
      setMergeError((e as Error).message);
    }
    setMerging(false);
  }

  const PAGE_SIZE = 100;

  const allStats = {
    total: allProducts.length,
    missingSource: allProducts.filter((p) => !p.source_url).length,
    missingIherb: allProducts.filter((p) => !p.iherb_url).length,
    missingImage: allProducts.filter((p) => !p.image_url).length,
    missingType: allProducts.filter((p) => !p.type || !activeTypesSet.has(p.type)).length,
    missingIngredients: allProducts.filter((p) => !p.ingredient_list).length,
  };

  const sortedAllProducts = useMemo(() => [...allProducts].sort((a, b) => {
    switch (allSort) {
      case "newest": return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
      case "oldest": return new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime();
      case "az": return a.name.localeCompare(b.name);
      case "za": return b.name.localeCompare(a.name);
      default: return 0;
    }
  }), [allProducts, allSort]);

  const filteredAllProducts = useMemo(() => sortedAllProducts
    .filter((p) =>
      !allSearch ||
      p.name.toLowerCase().includes(allSearch.toLowerCase()) ||
      (p.brand ?? "").toLowerCase().includes(allSearch.toLowerCase())
    )
    .filter((p) => !allBrandFilter || p.brand === allBrandFilter)
    .filter((p) => !filterMissingSource || !p.source_url)
    .filter((p) => !filterMissingIherb || !p.iherb_url)
    .filter((p) => !filterMissingImage || !p.image_url)
    .filter((p) => !filterMissingType || !p.type || !activeTypesSet.has(p.type))
    .filter((p) => !filterMissingIngredients || !p.ingredient_list),
  [sortedAllProducts, allSearch, allBrandFilter, filterMissingSource, filterMissingIherb, filterMissingImage, filterMissingType, filterMissingIngredients, activeTypesSet]);

  const totalPages = Math.max(1, Math.ceil(filteredAllProducts.length / PAGE_SIZE));
  const displayedAllProducts = filteredAllProducts.slice((allPage - 1) * PAGE_SIZE, allPage * PAGE_SIZE);

  const header = (
    <header className="border-b border-gray-100 px-6 py-4">
      <div className="max-w-3xl mx-auto flex items-center justify-between">
        <Link href="/" className="text-xl tracking-tight select-none">
          <span className="font-black">SKIN</span>
          <span className="font-light text-gray-500">dex</span>
        </Link>
        <Link href="/" className="text-sm text-gray-400 hover:text-gray-900 transition-colors">
          ← Scanner
        </Link>
      </div>
    </header>
  );

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-white">
        {header}
        <main className="max-w-3xl mx-auto px-6 py-16">
          <p className="text-sm text-gray-400">Loading…</p>
        </main>
      </div>
    );
  }

  if (!isSignedIn || forbidden) {
    return (
      <div className="min-h-screen bg-white">
        {header}
        <main className="max-w-3xl mx-auto px-6 py-16 text-center">
          <p className="text-sm text-gray-500">You don&apos;t have access to this page.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {header}
      <main className="max-w-3xl mx-auto px-6 py-8 space-y-8">

        {/* Stats */}
        {siteStats && (
          <section>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {([
                ["Products", siteStats.totalProducts, "text-gray-900"],
                ["Ingredients", siteStats.classifiedIngredients, "text-gray-900"],
                ["Queue", siteStats.queueLength, siteStats.queueLength > 0 ? "text-amber-600" : "text-gray-900"],
                ["Archived", siteStats.archivedCount, "text-gray-400"],
                ["Pending review", siteStats.pendingSubmissions, siteStats.pendingSubmissions > 0 ? "text-indigo-600" : "text-gray-400"],
              ] as [string, number, string][]).map(([label, value, color]) => (
                <div key={label} className="border border-gray-100 rounded-xl px-4 py-3">
                  <p className={`text-2xl font-semibold tabular-nums ${color}`}>{value.toLocaleString()}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Submissions */}
        <section>
          <button
            type="button"
            onClick={() => setSubmissionsOpen((v) => !v)}
            className="flex items-center gap-3 mb-4 group"
          >
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Submissions</h1>
            {recentCount > 0 && (
              <span className="text-xs font-medium bg-indigo-100 text-indigo-700 rounded-full px-2.5 py-0.5">
                {recentCount} this week
              </span>
            )}
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${submissionsOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {submissionsOpen && (submissions.length === 0 ? (
            <p className="text-sm text-gray-400">No user-submitted products yet.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {submissions.map((s) => (
                <div key={s.id} className="py-4 flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900 truncate">{s.name}</span>
                      {s.brand && <span className="text-xs text-gray-400 shrink-0">{s.brand}</span>}
                      {s.type && (
                        <span className="text-xs text-gray-400 border border-gray-200 rounded-full px-2 py-0.5 shrink-0">
                          {s.type}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400">
                        {s.ingredient_count > 0 ? `${s.ingredient_count} ingredients` : "No ingredients"}
                      </span>
                      <span className="text-gray-200 text-xs">·</span>
                      <span className="text-xs text-gray-400">{relativeTime(s.submitted_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Link
                      href={`/?scan=${s.id}`}
                      className="text-xs text-indigo-600 hover:text-indigo-800 underline underline-offset-2"
                    >
                      Scan
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleArchive(s.id)}
                      disabled={archiving === s.id}
                      className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-40"
                    >
                      {archiving === s.id ? "Archiving…" : "Archive"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(s.id, s.name)}
                      disabled={deleting === s.id}
                      className="text-xs text-rose-500 hover:text-rose-700 disabled:opacity-40"
                    >
                      {deleting === s.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </section>

        {/* All Products */}
        <section>
          <button
            type="button"
            onClick={() => setAllProductsOpen((v) => !v)}
            className="flex items-center gap-3 mb-2 group"
          >
            <h2 className="text-xl font-semibold tracking-tight text-gray-900">All Products</h2>
            {!allProductsLoading && (
              <span className="text-xs font-medium bg-gray-100 text-gray-600 rounded-full px-2.5 py-0.5">
                {allStats.total}
              </span>
            )}
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${allProductsOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {allProductsOpen && (<>
          {/* Filter bar */}
          {!allProductsLoading && (
            <div className="space-y-3 mb-6">
              {/* Search + sort + brand */}
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={allSearch}
                  onChange={(e) => setAllSearch(e.target.value)}
                  placeholder="Search by name or brand…"
                  className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-gray-400 w-52"
                />
                <select
                  value={allSort}
                  onChange={(e) => setAllSort(e.target.value as typeof allSort)}
                  className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-gray-400 bg-white"
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="az">A → Z</option>
                  <option value="za">Z → A</option>
                </select>
                <div className="relative">
                  <div className="flex items-center">
                    <input
                      type="text"
                      value={allBrandInput}
                      onChange={(e) => { setAllBrandInput(e.target.value); setAllBrandFilter(""); }}
                      onFocus={() => setAllBrandComboOpen(true)}
                      onBlur={() => setTimeout(() => setAllBrandComboOpen(false), 150)}
                      placeholder="Brand…"
                      className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 pr-6 focus:outline-none focus:border-gray-400 w-36"
                    />
                    {allBrandFilter && (
                      <button
                        type="button"
                        onMouseDown={() => { setAllBrandFilter(""); setAllBrandInput(""); }}
                        className="absolute right-2 text-gray-300 hover:text-gray-600 text-sm leading-none"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  {allBrandComboOpen && (() => {
                    const opts = allBrandInput && !allBrandFilter
                      ? allBrands.filter((b) => b.toLowerCase().includes(allBrandInput.toLowerCase()))
                      : allBrands;
                    return opts.length > 0 ? (
                      <div className="absolute z-10 top-full mt-1 left-0 w-52 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-sm">
                        {opts.map((b) => (
                          <button
                            key={b}
                            type="button"
                            onMouseDown={() => { setAllBrandFilter(b); setAllBrandInput(b); setAllBrandComboOpen(false); }}
                            className={`w-full text-left text-xs px-3 py-1.5 hover:bg-gray-50 transition-colors ${allBrandFilter === b ? "bg-indigo-50 text-indigo-700" : "text-gray-700"}`}
                          >
                            {b}
                          </button>
                        ))}
                      </div>
                    ) : null;
                  })()}
                </div>
              </div>
              {/* Missing field chips — label + count badge */}
              {allStats.total > 0 && (
              <div className="flex flex-wrap gap-2">
                {([
                  ["Missing source", filterMissingSource, setFilterMissingSource, allStats.missingSource],
                  ["Missing iHerb", filterMissingIherb, setFilterMissingIherb, allStats.missingIherb],
                  ["Missing image", filterMissingImage, setFilterMissingImage, allStats.missingImage],
                  ["No type", filterMissingType, setFilterMissingType, allStats.missingType],
                  ["No ingredients", filterMissingIngredients, setFilterMissingIngredients, allStats.missingIngredients],
                ] as [string, boolean, (v: (p: boolean) => boolean) => void, number][]).map(([label, value, set, count]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => set((v) => !v)}
                    className={`text-xs rounded-lg px-3 py-1.5 border transition-colors flex items-center gap-1.5 ${
                      value ? "bg-amber-100 text-amber-800 border-amber-200" : "border-gray-200 text-gray-500 hover:border-gray-400"
                    }`}
                  >
                    {label}
                    {count > 0 && (
                      <span className={`text-xs font-medium rounded-full px-1.5 py-0 leading-5 ${
                        value ? "bg-amber-200 text-amber-900" : "bg-amber-100 text-amber-700"
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              )}
            </div>
          )}

          {allProductsLoading && <p className="text-sm text-gray-400">Loading…</p>}
          {!allProductsLoading && allStats.total === 0 && <p className="text-sm text-gray-400">No products yet.</p>}
          {!allProductsLoading && allStats.total > 0 && filteredAllProducts.length === 0 && (
            <p className="text-sm text-gray-400">No products match.</p>
          )}

          {!allProductsLoading && displayedAllProducts.length > 0 && (
            <div className="space-y-2">
              {displayedAllProducts.map((p) => {
                const edit = allEdits[p.id] ?? initEdit(p, activeTypesSet);
                const isSaving = allSaving === p.id;
                const isSaved = allSaved.has(p.id);
                const error = allSaveError[p.id];
                const hasChanges = productHasChanges(p);
                const typeIsNonCanonical = p.type && !activeTypesSet.has(p.type);
                const previewImage = edit.image_url || p.image_url;
                const confirming = clearConfirming[p.id] ?? null;
                const marked = clearMarked[p.id] ?? new Set<string>();

                const UrlField = ({ field, placeholder, href, alwaysEnabled, btnLabel, rowLabel }: {
                  field: "source_url" | "image_url" | "iherb_url";
                  placeholder: string;
                  href: string | undefined;
                  alwaysEnabled: boolean;
                  btnLabel: string;
                  rowLabel: string;
                }) => {
                  const isMarked = marked.has(field);
                  const storedValue = p[field];
                  const editValue = edit[field];
                  const isConfirming = confirming === field;
                  const showClear = !isMarked && !isConfirming && (!!storedValue || !!editValue);
                  const btnDisabled = !alwaysEnabled && !href;
                  return (
                    <div className="flex gap-2">
                      <span className="text-xs text-gray-400 w-14 shrink-0 pt-1.5">{rowLabel}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex gap-1 items-center">
                          <a
                            href={btnDisabled ? undefined : href}
                            target="_blank"
                            rel="noopener noreferrer"
                            tabIndex={btnDisabled ? -1 : undefined}
                            className={`text-xs px-2 py-1.5 rounded-lg border flex items-center justify-center shrink-0 transition-colors whitespace-nowrap ${
                              btnDisabled ? "border-gray-100 text-gray-300 cursor-not-allowed pointer-events-none" : "border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700"
                            }`}
                          >
                            {btnLabel} ↗
                          </a>
                          <input
                            type="url"
                            value={isMarked ? "" : editValue}
                            disabled={isMarked}
                            onChange={(e) => updateAllEdit(p.id, field, e.target.value)}
                            placeholder={placeholder}
                            className={`flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-400 min-w-0 ${isMarked ? "opacity-40 bg-gray-50" : ""}`}
                          />
                          {showClear && (
                            <button
                              type="button"
                              onClick={() => setClearConfirming((prev) => ({ ...prev, [p.id]: field }))}
                              className="text-xs text-gray-300 hover:text-rose-400 shrink-0 px-1"
                            >
                              Clear
                            </button>
                          )}
                          {isMarked && (
                            <button
                              type="button"
                              onClick={() => {
                                setClearMarked((prev) => {
                                  const next = new Set(prev[p.id] ?? []);
                                  next.delete(field);
                                  return { ...prev, [p.id]: next };
                                });
                                updateAllEdit(p.id, field, storedValue ?? "");
                              }}
                              className="text-xs text-gray-400 hover:text-gray-700 shrink-0 px-1"
                            >
                              Undo
                            </button>
                          )}
                        </div>
                        {isConfirming && (
                          <div className="mt-1 flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-gray-400 line-through">{storedValue || editValue}</span>
                            <span className="text-xs text-gray-400">— Are you sure?</span>
                            <button
                              type="button"
                              onClick={() => {
                                setClearMarked((prev) => ({ ...prev, [p.id]: new Set([...(prev[p.id] ?? []), field]) }));
                                updateAllEdit(p.id, field, "");
                                setClearConfirming((prev) => ({ ...prev, [p.id]: null }));
                              }}
                              className="text-xs text-rose-600 hover:text-rose-800"
                            >
                              Yes, clear
                            </button>
                            <button
                              type="button"
                              onClick={() => setClearConfirming((prev) => ({ ...prev, [p.id]: null }))}
                              className="text-xs text-gray-400 hover:text-gray-700"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                };

                const sourceHref = edit.source_url || p.source_url || undefined;
                const imageHref = (edit.image_url || p.image_url)
                  ? (edit.image_url || p.image_url || undefined)
                  : `https://www.google.com/search?q=${encodeURIComponent([p.brand, p.name].filter(Boolean).join(" "))}&tbm=isch`;
                const iherbHref = (edit.iherb_url || p.iherb_url)
                  ? (edit.iherb_url || p.iherb_url || undefined)
                  : `https://www.iherb.com/search?kw=${encodeURIComponent([p.brand, p.name].filter(Boolean).join(" "))}&rcode=DYT4743`;

                return (
                  <div key={p.id} className="border border-gray-300 rounded-xl p-4 space-y-3">
                    {/* Header */}
                    <div className="flex items-start gap-3">
                      {previewImage && (
                        <img
                          src={`/api/image-proxy?url=${encodeURIComponent(previewImage)}`}
                          alt={p.name}
                          className="w-10 h-12 object-contain rounded border border-gray-100 bg-gray-50 shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate" title={p.name}>{p.name}</p>
                        <div className="flex items-center gap-2 flex-wrap mt-0.5">
                          {p.brand && <span className="text-xs text-gray-400">{p.brand}</span>}
                          {p.type && (
                            <span className={`text-xs border rounded-full px-2 py-0.5 shrink-0 ${typeIsNonCanonical ? "text-amber-700 bg-amber-50 border-amber-100" : "text-gray-400 border-gray-200"}`}>
                              {p.type}
                            </span>
                          )}
                          {!p.type && (
                            <span className="text-xs text-rose-500 border border-rose-100 bg-rose-50 rounded-full px-2 py-0.5 shrink-0">no type</span>
                          )}
                          {p.source && <span className="text-xs text-gray-300">{p.source}</span>}
                        </div>
                      </div>
                    </div>

                    {/* Edit fields */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-14 shrink-0">Brand</span>
                        <input
                          type="text"
                          value={edit.brand}
                          onChange={(e) => updateAllEdit(p.id, "brand", e.target.value)}
                          placeholder="Brand"
                          className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-400 min-w-0"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-14 shrink-0">Name</span>
                        <input
                          type="text"
                          value={edit.name}
                          onChange={(e) => updateAllEdit(p.id, "name", e.target.value)}
                          placeholder="Product name"
                          className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-400 min-w-0"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-14 shrink-0">Type</span>
                        <select
                          value={edit.type}
                          onChange={(e) => updateAllEdit(p.id, "type", e.target.value)}
                          className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-400 bg-white min-w-0"
                        >
                          <option value="">Type…</option>
                          {dropdownGroups.map(({ label, types }) => (
                            <optgroup key={label} label={label}>
                              {types.map((t) => <option key={t} value={t}>{t}</option>)}
                            </optgroup>
                          ))}
                        </select>
                      </div>
                      <UrlField field="source_url" rowLabel="Source" placeholder="Source URL" href={sourceHref} alwaysEnabled={false} btnLabel="INCIDecoder" />
                      <UrlField field="image_url" rowLabel="Image" placeholder="Image URL" href={imageHref} alwaysEnabled={true} btnLabel="Image" />
                      <UrlField field="iherb_url" rowLabel="iHerb" placeholder="iHerb URL" href={iherbHref} alwaysEnabled={true} btnLabel="iHerb" />
                      <div>
                        <span className="text-xs text-gray-400 block mb-1">Ingredients</span>
                        <textarea
                          value={edit.ingredient_list}
                          onChange={(e) => updateAllEdit(p.id, "ingredient_list", e.target.value)}
                          placeholder="Ingredient list…"
                          rows={3}
                          className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-400 resize-none font-mono leading-relaxed"
                        />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <button
                        type="button"
                        onClick={() => saveAllProduct(p)}
                        disabled={isSaving || !hasChanges}
                        className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors"
                      >
                        {isSaving ? "Saving…" : "Save"}
                      </button>
                      {isSaved && <span className="text-xs text-teal-600">Saved.</span>}
                      {error && <span className="text-xs text-rose-600">{error}</span>}
                      <Link
                        href={`/?scan=${p.id}`}
                        target="_blank"
                        className="text-xs text-gray-400 underline underline-offset-2 hover:text-gray-700"
                      >
                        Scan ↗
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleArchiveAllProduct(p)}
                        disabled={archivingProduct === p.id}
                        className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-40"
                      >
                        {archivingProduct === p.id ? "Archiving…" : "Archive"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {!allProductsLoading && totalPages > 1 && (
            <div className="flex items-center gap-3 mt-4">
              <button
                type="button"
                disabled={allPage === 1}
                onClick={() => setAllPage((p) => p - 1)}
                className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:border-gray-400 transition-colors"
              >
                ← Prev
              </button>
              <span className="text-xs text-gray-500">Page {allPage} of {totalPages}</span>
              <button
                type="button"
                disabled={allPage === totalPages}
                onClick={() => setAllPage((p) => p + 1)}
                className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:border-gray-400 transition-colors"
              >
                Next →
              </button>
              <span className="text-xs text-gray-400">{filteredAllProducts.length} products</span>
            </div>
          )}
          </>)}
        </section>

        {/* Archived Products */}
        <section>
          <button
            type="button"
            onClick={() => {
              const opening = !archivedOpen;
              setArchivedOpen(opening);
              if (opening && archivedProducts.length === 0) loadArchivedProducts();
            }}
            className="flex items-center gap-3 mb-4 group"
          >
            <h2 className="text-xl font-semibold tracking-tight text-gray-400">Archived</h2>
            {archivedProducts.length > 0 && (
              <span className="text-xs font-medium bg-gray-100 text-gray-400 rounded-full px-2.5 py-0.5">
                {archivedProducts.length}
              </span>
            )}
            <svg className={`w-4 h-4 text-gray-300 transition-transform ${archivedOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {archivedOpen && (
            archivedLoading ? (
              <p className="text-sm text-gray-400">Loading…</p>
            ) : archivedProducts.length === 0 ? (
              <p className="text-sm text-gray-400">No archived products.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {archivedProducts.map((p) => (
                  <div key={p.id} className="py-3 flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-500 truncate">{p.name}</p>
                      <div className="flex items-center gap-2 flex-wrap mt-0.5">
                        {p.brand && <span className="text-xs text-gray-400">{p.brand}</span>}
                        {p.type && <span className="text-xs text-gray-300 border border-gray-100 rounded-full px-2 py-0.5">{p.type}</span>}
                        {p.created_at && <span className="text-xs text-gray-300">{relativeTime(p.created_at)}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleRestoreProduct(p.id)}
                        disabled={restoringProduct === p.id}
                        className="text-xs text-indigo-500 hover:text-indigo-700 disabled:opacity-40"
                      >
                        {restoringProduct === p.id ? "Restoring…" : "Restore"}
                      </button>
                      {archivedDeleteConfirming === p.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={archivedDeleteNameInput[p.id] ?? ""}
                            onChange={(e) => setArchivedDeleteNameInput((prev) => ({ ...prev, [p.id]: e.target.value }))}
                            placeholder={p.name}
                            className="text-xs border border-rose-200 rounded px-2 py-1 w-36 focus:outline-none focus:border-rose-400"
                          />
                          <button
                            type="button"
                            disabled={archivedDeleting === p.id || (archivedDeleteNameInput[p.id] ?? "") !== p.name}
                            onClick={() => handleDeleteArchivedProduct(p.id)}
                            className="text-xs px-2 py-1 bg-rose-600 text-white rounded disabled:opacity-40 hover:bg-rose-700 transition-colors"
                          >
                            {archivedDeleting === p.id ? "Deleting…" : "Delete"}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setArchivedDeleteConfirming(null); setArchivedDeleteNameInput((prev) => ({ ...prev, [p.id]: "" })); }}
                            className="text-xs text-gray-400 hover:text-gray-700"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setArchivedDeleteConfirming(p.id)}
                          className="text-xs text-rose-400 hover:text-rose-600"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </section>

        {/* Product Types */}
        <section>
          <button
            type="button"
            onClick={() => setTypesOpen((v) => !v)}
            className="flex items-center gap-3 mb-4 group"
          >
            <h2 className="text-xl font-semibold tracking-tight text-gray-900">Product Types</h2>
            {!typesLoading && productTypes.length > 0 && (
              <span className="text-xs font-medium bg-gray-100 text-gray-600 rounded-full px-2.5 py-0.5">
                {productTypes.length}
              </span>
            )}
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${typesOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {typesOpen && (<>
          <div className="mb-4">
            {typeFormOpen ? (
              <div className="space-y-2">
                <div className="flex gap-2 flex-wrap items-center">
                  <input
                    type="text"
                    value={newTypeName}
                    onChange={(e) => { setNewTypeName(e.target.value); setTypeAddError(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter") addType(); if (e.key === "Escape") { setTypeFormOpen(false); setNewTypeName(""); } }}
                    placeholder="Type name…"
                    autoFocus
                    className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-gray-400 w-40"
                  />
                  <button
                    type="button"
                    onClick={addType}
                    disabled={typeAdding || !newTypeName.trim()}
                    className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors"
                  >
                    {typeAdding ? "Adding…" : "Add"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setTypeFormOpen(false); setNewTypeName(""); setTypeAddError(null); }}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Cancel
                  </button>
                  {typeAddError && <span className="text-xs text-rose-600">{typeAddError}</span>}
                </div>
                <BodyAreaPicker value={newTypeBodyArea} onChange={setNewTypeBodyArea} />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setTypeFormOpen(true)}
                className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                + Add type
              </button>
            )}
          </div>

          {typesLoading && <p className="text-sm text-gray-400">Loading…</p>}

          {!typesLoading && typeGroups.length > 0 && (
            <>
              <div className="border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-100">
                {typeGroups.map(({ label, types: groupTypes }) => {
                  const isOpen = openGroups.has(label);
                  const selectedInGroup = groupTypes.filter((t) => selectedTypeIds.has(t.id)).length;
                  const AreaIcon = BODY_AREA_ICON[label] ?? null;
                  return (
                    <div key={label}>
                      <button
                        type="button"
                        onClick={() => toggleGroup(label)}
                        className="w-full flex items-center justify-between px-4 py-2 text-left hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {AreaIcon && <AreaIcon size={15} className="text-gray-500 shrink-0" />}
                          <span className="text-sm font-medium text-gray-700">{label}</span>
                          <span className="text-xs text-gray-400">({groupTypes.length})</span>
                          {selectedInGroup > 0 && (
                            <span className="text-xs bg-indigo-100 text-indigo-700 rounded-full px-1.5 py-0.5 font-medium">
                              {selectedInGroup} selected
                            </span>
                          )}
                        </div>
                        <svg className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {isOpen && (
                        <div className="border-t border-gray-100 divide-y divide-gray-50">
                          {groupTypes.map((t) => {
                            const isEditing = editingTypeId === t.id;
                            const isSaving = typeSaving === t.id;
                            const isDeleting = typeDeleting === t.id;
                            const isSelected = selectedTypeIds.has(t.id);
                            const TypeIcon = PRODUCT_TYPE_ICON[t.name] ?? BODY_AREA_ICON[t.body_area] ?? null;
                            return (
                              <div key={t.id} className={`px-4 ${isEditing ? "py-2 bg-indigo-50/40" : "py-1"} ${isSelected && !isEditing ? "bg-indigo-50/30" : ""}`}>
                                {isEditing ? (
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <input
                                        value={editTypeName}
                                        onChange={(e) => setEditTypeName(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === "Enter") saveTypeEdit(t); if (e.key === "Escape") setEditingTypeId(null); }}
                                        className="text-xs border border-indigo-200 rounded px-2 py-1 focus:outline-none focus:border-indigo-400 w-40"
                                        autoFocus
                                      />
                                      <button type="button" onClick={() => saveTypeEdit(t)} disabled={isSaving} className="text-xs text-indigo-600 hover:text-indigo-800 disabled:opacity-40">
                                        {isSaving ? "Saving…" : "Save"}
                                      </button>
                                      <button type="button" onClick={() => setEditingTypeId(null)} className="text-xs text-gray-400 hover:text-gray-600">
                                        Cancel
                                      </button>
                                    </div>
                                    <BodyAreaPicker value={editTypeBodyArea} onChange={setEditTypeBodyArea} />
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-3 group">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => toggleTypeSelection(t.id, t.name, t.body_area)}
                                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0"
                                    />
                                    {TypeIcon && <TypeIcon size={12} className="text-gray-400 shrink-0" />}
                                    <span className="text-sm text-gray-800 flex-1">{t.name}</span>
                                    <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button type="button" onClick={() => startEditType(t)} className="text-xs text-gray-400 hover:text-gray-700">
                                        Edit
                                      </button>
                                      <button type="button" onClick={() => deleteType(t)} disabled={isDeleting} className="text-xs text-rose-400 hover:text-rose-600 disabled:opacity-40">
                                        {isDeleting ? "Deleting…" : "Delete"}
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {typeOpError && <p className="text-xs text-rose-600 mt-3">{typeOpError}</p>}

              {selectedTypeIds.size >= 2 && (
                <div className="mt-4 p-4 bg-indigo-50 border border-indigo-100 rounded-xl space-y-3">
                  <div className="flex flex-wrap gap-1 items-center">
                    <span className="text-xs font-medium text-indigo-800 mr-1">Merging:</span>
                    {Array.from(selectedTypeIds).map((id) => {
                      const t = productTypes.find((x) => x.id === id);
                      return t ? (
                        <span key={id} className="text-xs bg-white border border-indigo-200 rounded-full px-2 py-0.5 text-indigo-700">
                          {t.name}
                        </span>
                      ) : null;
                    })}
                  </div>
                  <div className="flex gap-2 flex-wrap items-center">
                    <input
                      type="text"
                      value={mergeTargetName}
                      onChange={(e) => { setMergeTargetName(e.target.value); setMergeError(null); }}
                      onKeyDown={(e) => { if (e.key === "Enter") mergeTypes(); }}
                      placeholder="Merged name…"
                      className="text-xs border border-indigo-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-400 w-44"
                    />
                    <button type="button" onClick={mergeTypes} disabled={merging || !mergeTargetName.trim()} className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors">
                      {merging ? "Merging…" : "Merge"}
                    </button>
                    <button type="button" onClick={clearSelection} className="text-xs text-gray-500 hover:text-gray-700">
                      Cancel
                    </button>
                    {mergeError && <span className="text-xs text-rose-600">{mergeError}</span>}
                  </div>
                  <BodyAreaPicker value={mergeTargetArea} onChange={setMergeTargetArea} />
                </div>
              )}
            </>
          )}
          </>)}
        </section>

        {/* Activity */}
        <section>
          <button
            type="button"
            onClick={() => setAuditExpanded((v) => !v)}
            className="flex items-center gap-3 mb-4 group"
          >
            <h2 className="text-xl font-semibold tracking-tight text-gray-900">Activity</h2>
            {!auditLoading && auditLog.length > 0 && (
              <span className="text-xs font-medium bg-gray-100 text-gray-600 rounded-full px-2.5 py-0.5">
                {auditLog.length}
              </span>
            )}
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${auditExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {auditExpanded && (
            <>
              {/* Controls */}
              <div className="flex flex-wrap gap-2 mb-4">
                {(["7d", "30d", "all"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      setAuditRange(r);
                      loadAuditLog(r);
                    }}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                      auditRange === r
                        ? "bg-gray-900 text-white border-gray-900"
                        : "border-gray-200 text-gray-500 hover:border-gray-400"
                    }`}
                  >
                    {r === "7d" ? "Last 7 days" : r === "30d" ? "Last 30 days" : "All time"}
                  </button>
                ))}
                <div className="w-px bg-gray-100 self-stretch mx-1" />
                <button
                  type="button"
                  onClick={() => setAuditActionFilter(null)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    !auditActionFilter
                      ? "bg-gray-100 text-gray-800 border-gray-200"
                      : "border-gray-200 text-gray-400 hover:border-gray-400"
                  }`}
                >
                  All
                </button>
                {Object.keys(ACTION_GROUPS).map((group) => (
                  <button
                    key={group}
                    type="button"
                    onClick={() => setAuditActionFilter(auditActionFilter === group ? null : group)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                      auditActionFilter === group
                        ? "bg-gray-100 text-gray-800 border-gray-200"
                        : "border-gray-200 text-gray-400 hover:border-gray-400"
                    }`}
                  >
                    {group}
                  </button>
                ))}
              </div>

              {auditLoading && <p className="text-sm text-gray-400">Loading…</p>}
              {!auditLoading && (() => {
                const filtered = auditActionFilter
                  ? auditLog.filter((e) => ACTION_GROUPS[auditActionFilter]?.includes(e.action))
                  : auditLog;
                if (filtered.length === 0) return <p className="text-sm text-gray-400">No activity in this range.</p>;
                return (
                  <div className="border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-50">
                    {filtered.map((entry) => {
                      const isProduct = entry.action === "update_product" && entry.entity_id;
                      return (
                        <div key={entry.id} className="flex items-baseline justify-between px-4 py-2.5 gap-4">
                          <span className={`text-sm ${actionColor(entry.action)} min-w-0`}>
                            {describeAction(entry)}
                            {isProduct && (
                              <Link
                                href={`/?scan=${entry.entity_id}`}
                                target="_blank"
                                className="ml-2 text-xs text-indigo-400 hover:text-indigo-600 underline underline-offset-2 shrink-0"
                              >
                                Scan ↗
                              </Link>
                            )}
                          </span>
                          <span className="text-xs text-gray-400 shrink-0">
                            {relativeTime(entry.created_at)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </>
          )}
        </section>

      </main>
    </div>
  );
}
