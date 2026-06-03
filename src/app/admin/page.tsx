"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { tokenFuzzyFilter } from "@/lib/search";
import { splitIngredientList } from "@/lib/scanner";
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, rectSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import {
  Smile, Palette, Heart, PersonStanding, Scissors,
  FlaskConical, Sparkles, Eye, Shield, BrushCleaning,
  Eraser, Droplets, Droplet, Layers, Moon, Pill, Sun,
  GlassWater, Pencil, Brush, Pen, Wind, Footprints,
  Hand, Pipette, Waves, Home, Fingerprint,
  type LucideIcon,
} from "lucide-react";

type Submission = {
  id: string;
  name: string;
  brand: string | null;
  type: string | null;
  submitted_at: string;
  ingredient_list: string | null;
  ingredient_count: number;
  image_url: string | null;
  iherb_url: string | null;
  source_url: string | null;
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

type ProductType = { id: string; name: string; body_area: string; is_rinse_off: boolean };

type AdminUser = {
  clerk_id: string; email: string | null; name: string | null;
  granted_by: string | null; granted_by_email: string | null;
  granted_at: string | null; activity_count: number; is_self: boolean;
};
type AdminInvite = {
  id: string; code: string; expires_at: string; is_expired: boolean;
  claimed_by: string | null; claimed_by_email: string | null; claimed_at: string | null;
  created_by: string; created_by_email: string | null; created_at: string;
};
type LookupResult = { found: boolean; clerk_id?: string; email?: string; name?: string | null; role?: string | null };

type AuditEntry = {
  id: string; action: string; entity_type: string; entity_id: string | null;
  detail: Record<string, unknown>; created_at: string;
  admin_clerk_id: string; admin_email: string | null; admin_name: string | null;
};

type Banner = {
  id: string;
  message: string;
  status: "draft" | "scheduled" | "active" | "expired";
  dismissible: boolean;
  expiry_mode: "none" | "datetime" | "on_next";
  expires_at: string | null;
  scheduled_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type QueueItem = {
  id: string;
  name: string;
  times_seen: number;
  found_in: string | null;
  last_seen: string | null;
};

type SearchMiss = {
  id: string;
  query: string;
  kind: "search" | "url";
  failure: string;
  times_seen: number;
  last_seen: string | null;
};

type SiteStats = {
  totalProducts: number;
  archivedCount: number;
  classifiedIngredients: number;
  queueLength: number;
  pendingSubmissions: number;
};


const BODY_AREAS = ["Face", "Makeup", "Lip", "Hands", "Nails", "Hair", "Body", "Home"];

const BODY_AREA_ICON: Record<string, LucideIcon> = {
  Face: Smile,
  Makeup: Palette,
  Lip: Heart,
  Hands: Hand,
  Nails: Fingerprint,
  Hair: Scissors,
  Body: PersonStanding,
  Home: Home,
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
  "Dish Soap": Droplets,
  // Nails
  "Nail Polish": Sparkles,
  "Nail Treatment": Sparkles,
  // Hair
  Conditioner: Droplets,
  "Hair Styler": Wind,
  "Hair Treatment": Sparkles,
  "Scalp Treatment": Pipette,
  Shampoo: Waves,
  // Home
  "Laundry Detergent": Waves,
  "Fabric Softener": Wind,
};

const PRODUCT_TYPE_GROUPS: { label: string; types: string[] }[] = [
  { label: "Face", types: ["Concentrate", "Exfoliant", "Eye Cream", "Eye Primer", "Face Mask", "Face Wash", "Makeup Remover", "Mist", "Moisturizer", "Oil", "Ointment", "Primer", "Serum", "Sleeping Mask", "Spot Patches", "Sun Screen", "Toner"].sort() },
  { label: "Makeup", types: ["BB Cream", "Blush", "Brow Gel", "CC Cream", "Concealer", "Eyeliner", "Eyeshadow", "Foundation", "Mascara", "Setting Spray"].sort() },
  { label: "Lip", types: ["Lip Balm", "Lip Treatment"] },
  { label: "Hands", types: ["Dish Soap", "Hand Cream"].sort() },
  { label: "Nails", types: ["Nail Polish", "Nail Treatment"].sort() },
  { label: "Hair", types: ["Conditioner", "Hair Styler", "Hair Treatment", "Scalp Treatment", "Shampoo"].sort() },
  { label: "Body", types: ["Body Lotion", "Body Wash", "Deodorant", "Foot Cream"].sort() },
  { label: "Home", types: ["Fabric Softener", "Laundry Detergent"].sort() },
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
    case "add_product":
      return `Added product "${d.name}"`;
    case "delete_product":
      return `Deleted product "${d.name}"`;
    case "archive_submission":
    case "reject_submission":
      return `Rejected submission "${d.name}"`;
    case "approve_submission":
      return `Approved submission "${d.name}"`;
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
  Products: ["add_product", "update_product", "delete_product", "restore_product"],
  Types: ["add_type", "edit_type", "delete_type", "merge_types"],
  Archive: ["archive_product", "archive_submission", "reject_submission"],
  Approve: ["approve_submission"],
};

const JUNK_KEYWORDS = /\b(directions?|warnings?|contains|apply|rinse|massage|avoid|consult|keep out|active ingredient|inactive ingredient|drug facts|other information|flush|store at|tamper|expir|for external use|do not|if swallowed|see package|serving|amount per|calories|sodium|total fat)\b/i;

function isJunkIngredient(item: string): boolean {
  if (item.length > 80) return true;
  if (JUNK_KEYWORDS.test(item)) return true;
  if (/\.\s+[A-Z]/.test(item)) return true;
  if (/\d{5,}/.test(item)) return true;
  return false;
}

function hasSuspiciousIngredients(ingredientList: string | null): boolean {
  if (!ingredientList) return false;
  return splitIngredientList(ingredientList).some((item) => isJunkIngredient(item));
}

function SortableIngredientChip({ id, item, onRemove }: { id: string; item: string; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const junk = isJunkIngredient(item);
  return (
    <span
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      title={item}
      className={`inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 border ${
        junk ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-gray-50 border-gray-200 text-gray-700"
      }`}
    >
      <span
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 leading-none select-none"
        aria-label="Drag to reorder"
      >
        ⠿
      </span>
      {item.length > 40 ? item.slice(0, 40) + "…" : item}
      <button
        type="button"
        onClick={onRemove}
        className="text-gray-400 hover:text-rose-500 leading-none ml-0.5 shrink-0"
      >
        ×
      </button>
    </span>
  );
}

function IngredientChipEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const items = splitIngredientList(value);
  const ids = items.map((item, i) => `${i}::${item}`);
  const [addInput, setAddInput] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = ids.indexOf(active.id as string);
      const newIndex = ids.indexOf(over.id as string);
      onChange(arrayMove(items, oldIndex, newIndex).join(", "));
    }
  }

  function removeItem(idx: number) {
    onChange(items.filter((_, i) => i !== idx).join(", "));
  }

  function addItem() {
    const trimmed = addInput.trim();
    if (!trimmed) return;
    onChange([...items, trimmed].join(", "));
    setAddInput("");
  }

  return (
    <div className="space-y-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ids} strategy={rectSortingStrategy}>
          <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-1">
            {items.map((item, i) => (
              <SortableIngredientChip key={ids[i]} id={ids[i]} item={item} onRemove={() => removeItem(i)} />
            ))}
            {items.length === 0 && <span className="text-xs text-gray-400 italic">No ingredients</span>}
          </div>
        </SortableContext>
      </DndContext>
      <div className="flex gap-1.5">
        <input
          type="text"
          value={addInput}
          onChange={(e) => setAddInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }}
          placeholder="Add ingredient…"
          className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-indigo-400 flex-1"
        />
        <button
          type="button"
          onClick={addItem}
          disabled={!addInput.trim()}
          className="text-xs px-2.5 py-1 border border-gray-200 rounded-lg text-gray-500 hover:border-gray-400 disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </div>
  );
}

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
  const [approving, setApproving] = useState<string | null>(null);
  const [editingSubmission, setEditingSubmission] = useState<string | null>(null);
  const [submissionEdits, setSubmissionEdits] = useState<Record<string, { name: string; brand: string; type: string; ingredient_list: string; image_url: string; iherb_url: string; source_url: string }>>({});
  const [submissionSaving, setSubmissionSaving] = useState<string | null>(null);
  const [submissionSaved, setSubmissionSaved] = useState<Set<string>>(new Set());

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

  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<"all" | "queue" | "submitted" | "suspicious">("all");
  const [reviewSort, setReviewSort] = useState<"priority" | "date" | "name">("priority");
  const [reviewSelected, setReviewSelected] = useState<Set<string>>(new Set());
  const [searchMisses, setSearchMisses] = useState<SearchMiss[]>([]);
  const [searchMissesLoading, setSearchMissesLoading] = useState(false);
  const [searchMissesOpen, setSearchMissesOpen] = useState(false);
  const [filterSuspicious, setFilterSuspicious] = useState(false);
  const [classifyingOne, setClassifyingOne] = useState<string | null>(null);
  const [classifyingAll, setClassifyingAll] = useState(false);
  const [removingFromQueue, setRemovingFromQueue] = useState<string | null>(null);
  const [classifyAllResult, setClassifyAllResult] = useState<{ classified: number; skipped: number } | null>(null);
  const [queueSelected, setQueueSelected] = useState<Set<string>>(new Set());
  const [removingMany, setRemovingMany] = useState(false);
  const [editingQueueId, setEditingQueueId] = useState<string | null>(null);
  const [editingQueueName, setEditingQueueName] = useState("");
  const [savingQueueName, setSavingQueueName] = useState(false);
  const [submissionsLoading, setSubmissionsLoading] = useState(true);
  const [upgradeStats, setUpgradeStats] = useState<{ weak: number; needsProfile: number; total: number } | null>(null);
  const [flagsOpen, setFlagsOpen] = useState(false);
  const [flagsLoading, setFlagsLoading] = useState(false);
  const [flags, setFlags] = useState<{ ingredient_id: string; ingredient_name: string; explanation_source: string | null; flag_count: number; reasons: string[]; latest_flag: string }[]>([]);
  const [actioning, setActioning] = useState<string | null>(null);

  const [banners, setBanners] = useState<Banner[]>([]);
  const [bannersLoading, setBannersLoading] = useState(false);
  const [bannersOpen, setBannersOpen] = useState(false);
  const [bannerForm, setBannerForm] = useState<{
    message: string;
    status: "draft" | "scheduled" | "active";
    dismissible: boolean;
    expiry_mode: "none" | "datetime" | "on_next";
    expires_at: string;
    scheduled_at: string;
  }>({ message: "", status: "draft", dismissible: true, expiry_mode: "none", expires_at: "", scheduled_at: "" });
  const [bannerFormOpen, setBannerFormOpen] = useState(false);
  const [bannerSaving, setBannerSaving] = useState(false);
  const [bannerSaveError, setBannerSaveError] = useState<string | null>(null);
  const [bannerUpdating, setBannerUpdating] = useState<string | null>(null);
  const [bannerDeleting, setBannerDeleting] = useState<string | null>(null);

  const [adminsOpen, setAdminsOpen] = useState(false);
  const [adminsList, setAdminsList] = useState<AdminUser[]>([]);
  const [invites, setInvites] = useState<AdminInvite[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [adminMenuOpen, setAdminMenuOpen] = useState<string | null>(null);
  const [inviteHistoryOpen, setInviteHistoryOpen] = useState(false);
  const [lookupEmail, setLookupEmail] = useState("");
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [grantingAdmin, setGrantingAdmin] = useState(false);
  const [revokingAdmin, setRevokingAdmin] = useState<string | null>(null);
  const [inviteExpiry, setInviteExpiry] = useState("7d");
  const [inviteCustomDate, setInviteCustomDate] = useState("");
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [newInviteCode, setNewInviteCode] = useState<string | null>(null);
  const [revokingInvite, setRevokingInvite] = useState<string | null>(null);

  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [typesLoading, setTypesLoading] = useState(false);
  const [dragOverTypeId, setDragOverTypeId] = useState<string | null>(null);
  const dragTypeIdRef = useRef<string | null>(null);
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeBodyArea, setNewTypeBodyArea] = useState("Face");
  const [typeAdding, setTypeAdding] = useState(false);
  const [typeAddError, setTypeAddError] = useState<string | null>(null);
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [editTypeName, setEditTypeName] = useState("");
  const [editTypeBodyArea, setEditTypeBodyArea] = useState("Face");
  const [editTypeRinseOff, setEditTypeRinseOff] = useState(false);
  const [newTypeRinseOff, setNewTypeRinseOff] = useState(false);
  const [typeSaving, setTypeSaving] = useState<string | null>(null);
  const [typeDeleting, setTypeDeleting] = useState<string | null>(null);
  const [typeOpError, setTypeOpError] = useState<string | null>(null);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditExpanded, setAuditExpanded] = useState(false);
  const [auditRange, setAuditRange] = useState<"7d" | "30d" | "all">("7d");
  const [auditActionFilter, setAuditActionFilter] = useState<string | null>(null);
  const [auditSearch, setAuditSearch] = useState("");
  const [auditAdminFilter, setAuditAdminFilter] = useState<string | null>(null);
  const [auditAdminFilterEmail, setAuditAdminFilterEmail] = useState<string | null>(null);
  const [auditEntityFilter, setAuditEntityFilter] = useState<string | null>(null);
  const [auditEntityFilterName, setAuditEntityFilterName] = useState<string | null>(null);
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const [revertingEntryId, setRevertingEntryId] = useState<string | null>(null);
  const [submissionsOpen, setSubmissionsOpen] = useState(true);
  const [allProductsOpen, setAllProductsOpen] = useState(false);
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [addProductFields, setAddProductFields] = useState({ name: "", brand: "", type: "", ingredient_list: "", image_url: "", iherb_url: "", source_url: "" });
  const [addProductSaving, setAddProductSaving] = useState(false);
  const [addProductError, setAddProductError] = useState<string | null>(null);
  const [addProductSaved, setAddProductSaved] = useState(false);
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
        if (r.status === 403) { setForbidden(true); setLoading(false); setSubmissionsLoading(false); return null; }
        return r.json();
      })
      .then((d) => {
        if (!d) return;
        setSubmissions(d.submissions ?? []);
        setRecentCount(d.recentCount ?? 0);
        setLoading(false);
        setSubmissionsLoading(false);
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

  async function loadQueue() {
    setQueueLoading(true);
    try {
      const res = await fetch("/api/admin/queue");
      if (res.ok) {
        const data = await res.json();
        setQueueItems(data.items ?? []);
      }
    } catch { }
    setQueueLoading(false);
  }

  async function loadSearchMisses() {
    setSearchMissesLoading(true);
    try {
      const res = await fetch("/api/admin/search-misses");
      if (res.ok) {
        const data = await res.json();
        setSearchMisses(data.items ?? []);
      }
    } catch { }
    setSearchMissesLoading(false);
  }

  async function dismissMiss(id: string) {
    await fetch("/api/admin/search-misses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "dismiss", id }),
    });
    setSearchMisses((prev) => prev.filter((m) => m.id !== id));
  }

  async function dismissAllMisses() {
    await fetch("/api/admin/search-misses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "dismiss-all" }),
    });
    setSearchMisses([]);
  }

  async function classifyQueueOne(item: QueueItem) {
    setClassifyingOne(item.id);
    try {
      await fetch("/api/admin/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "classify-one", queueId: item.id }),
      });
      setQueueItems((prev) => prev.filter((q) => q.id !== item.id));
      setSiteStats((prev) => prev ? {
        ...prev,
        classifiedIngredients: prev.classifiedIngredients + 1,
        queueLength: Math.max(0, prev.queueLength - 1),
      } : prev);
    } catch { }
    setClassifyingOne(null);
  }

  async function classifyQueueAll() {
    setClassifyingAll(true);
    setClassifyAllResult(null);
    try {
      const res = await fetch("/api/admin/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "classify-all" }),
      });
      const data = await res.json();
      setClassifyAllResult({ classified: data.classified ?? 0, skipped: data.skipped ?? 0 });
      setQueueItems([]);
      setSiteStats((prev) => prev ? {
        ...prev,
        classifiedIngredients: prev.classifiedIngredients + (data.classified ?? 0),
        queueLength: 0,
      } : prev);
    } catch { }
    setClassifyingAll(false);
  }

  async function loadUpgradeStats() {
    try {
      const res = await fetch("/api/admin/ingredient-stats");
      const data = await res.json();
      setUpgradeStats({ weak: data.weak ?? 0, needsProfile: data.needsProfile ?? 0, total: data.total ?? 0 });
    } catch { }
  }

  async function loadFlags() {
    setFlagsLoading(true);
    try {
      const res = await fetch("/api/admin/ingredient-flags");
      const data = await res.json();
      setFlags(data.flags ?? []);
    } catch { }
    setFlagsLoading(false);
  }

  async function actOnFlag(ingredientId: string, action: "reclassify" | "regenerate" | "dismiss") {
    setActioning(ingredientId);
    try {
      await fetch("/api/admin/ingredient-flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredientId, action }),
      });
      setFlags((prev) => prev.filter((f) => f.ingredient_id !== ingredientId));
    } catch { }
    setActioning(null);
  }


  async function removeFromQueue(item: QueueItem) {
    setRemovingFromQueue(item.id);
    try {
      await fetch("/api/admin/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", queueId: item.id }),
      });
      setQueueItems((prev) => prev.filter((q) => q.id !== item.id));
      setSiteStats((prev) => prev ? { ...prev, queueLength: Math.max(0, prev.queueLength - 1) } : prev);
    } catch { }
    setRemovingFromQueue(null);
  }

  async function removeSelectedFromQueue() {
    if (queueSelected.size === 0) return;
    setRemovingMany(true);
    const ids = [...queueSelected];
    try {
      await fetch("/api/admin/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove-many", ids }),
      });
      setQueueItems((prev) => prev.filter((q) => !queueSelected.has(q.id)));
      setSiteStats((prev) => prev ? { ...prev, queueLength: Math.max(0, prev.queueLength - ids.length) } : prev);
      setQueueSelected(new Set());
    } catch { }
    setRemovingMany(false);
  }

  async function saveQueueName(item: QueueItem) {
    if (!editingQueueName.trim() || editingQueueName.trim() === item.name) {
      setEditingQueueId(null);
      return;
    }
    setSavingQueueName(true);
    try {
      const res = await fetch("/api/admin/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rename", queueId: item.id, newName: editingQueueName.trim() }),
      });
      const data = await res.json();
      if (res.ok) setQueueItems((prev) => prev.map((q) => q.id === item.id ? { ...q, name: data.name } : q));
    } catch { }
    setSavingQueueName(false);
    setEditingQueueId(null);
  }

  async function loadBanners() {
    setBannersLoading(true);
    try {
      const res = await fetch("/api/admin/banners");
      if (res.ok) {
        const data = await res.json();
        setBanners(data.banners ?? []);
      }
    } catch { }
    setBannersLoading(false);
  }

  async function saveBanner() {
    if (!bannerForm.message.trim()) return;
    setBannerSaving(true);
    setBannerSaveError(null);
    try {
      const res = await fetch("/api/admin/banners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bannerForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setBanners((prev) => [data.banner, ...prev.filter((b) => b.status !== "active" || data.banner.status !== "active" ? true : b.id !== data.banner.id)]);
      setBannerForm({ message: "", status: "draft", dismissible: true, expiry_mode: "none", expires_at: "", scheduled_at: "" });
      setBannerFormOpen(false);
      // Refresh to get updated statuses after activation
      if (bannerForm.status === "active") loadBanners();
    } catch (e) {
      setBannerSaveError((e as Error).message);
    }
    setBannerSaving(false);
  }

  async function updateBannerStatus(banner: Banner, newStatus: "draft" | "active" | "expired") {
    setBannerUpdating(banner.id);
    try {
      const res = await fetch(`/api/admin/banners/${banner.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        if (newStatus === "active") {
          // Expire other active banners in local state
          setBanners((prev) => prev.map((b) =>
            b.id === banner.id ? { ...b, status: "active" } :
            b.status === "active" ? { ...b, status: "expired" } : b
          ));
        } else {
          setBanners((prev) => prev.map((b) => b.id === banner.id ? { ...b, status: newStatus } : b));
        }
      }
    } catch { }
    setBannerUpdating(null);
  }

  async function deleteBanner(id: string) {
    setBannerDeleting(id);
    try {
      await fetch(`/api/admin/banners/${id}`, { method: "DELETE" });
      setBanners((prev) => prev.filter((b) => b.id !== id));
    } catch { }
    setBannerDeleting(null);
  }

  async function loadAdmins() {
    setAdminsLoading(true);
    try {
      const res = await fetch("/api/admin/admins");
      if (res.ok) {
        const data = await res.json();
        setAdminsList(data.admins ?? []);
        setInvites(data.invites ?? []);
      }
    } catch { }
    setAdminsLoading(false);
  }

  async function lookupUser() {
    if (!lookupEmail.trim()) return;
    setLookupLoading(true);
    setLookupResult(null);
    try {
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "lookup", email: lookupEmail.trim() }),
      });
      const data = await res.json();
      setLookupResult(data);
    } catch { }
    setLookupLoading(false);
  }

  async function grantAdmin(clerkId: string, email: string | null, name: string | null) {
    setGrantingAdmin(true);
    try {
      await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "grant", clerk_id: clerkId }),
      });
      setAdminsList((prev) => prev.some((a) => a.clerk_id === clerkId) ? prev : [
        ...prev,
        { clerk_id: clerkId, email, name, granted_by: null, granted_by_email: null, granted_at: new Date().toISOString(), activity_count: 0, is_self: false },
      ]);
      setLookupResult((prev) => prev ? { ...prev, role: "admin" } : null);
    } catch { }
    setGrantingAdmin(false);
  }

  async function revokeAdmin(clerkId: string) {
    setRevokingAdmin(clerkId);
    try {
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke", clerk_id: clerkId }),
      });
      if (res.ok) {
        setAdminsList((prev) => prev.filter((a) => a.clerk_id !== clerkId));
        setLookupResult((prev) => prev?.clerk_id === clerkId ? { ...prev, role: null } : prev);
      }
    } catch { }
    setRevokingAdmin(null);
  }

  async function createInvite() {
    const expiresAt = inviteExpiry === "custom"
      ? new Date(inviteCustomDate).toISOString()
      : new Date(Date.now() + (
          inviteExpiry === "24h" ? 24 * 3600 * 1000 :
          inviteExpiry === "7d" ? 7 * 24 * 3600 * 1000 :
          30 * 24 * 3600 * 1000
        )).toISOString();

    setCreatingInvite(true);
    setNewInviteCode(null);
    try {
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create-invite", expires_at: expiresAt }),
      });
      const data = await res.json();
      if (data.invite) {
        const claimUrl = `${window.location.origin}/claim-invite?code=${data.invite.code}`;
        setNewInviteCode(claimUrl);
        setInvites((prev) => [data.invite, ...prev]);
      }
    } catch { }
    setCreatingInvite(false);
  }

  async function revokeInvite(id: string) {
    setRevokingInvite(id);
    try {
      await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke-invite", inviteId: id }),
      });
      setInvites((prev) => prev.filter((i) => i.id !== id));
      if (newInviteCode) {
        const removed = invites.find((i) => i.id === id);
        if (removed && newInviteCode.includes(removed.code)) setNewInviteCode(null);
      }
    } catch { }
    setRevokingInvite(null);
  }

  async function handleRevertEntry(entryId: string) {
    setRevertingEntryId(entryId);
    try {
      const res = await fetch("/api/admin/undo-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId }),
      });
      if (res.ok) {
        setExpandedEntryId(null);
        loadAuditLog(auditRange);
      }
    } catch { }
    setRevertingEntryId(null);
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

  async function handleApprove(id: string) {
    setApproving(id);
    const res = await fetch("/api/admin/approve-submission", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: id }),
    });
    if (res.ok) setSubmissions((prev) => prev.filter((s) => s.id !== id));
    setApproving(null);
  }

  async function handleAddProduct() {
    setAddProductSaving(true);
    setAddProductError(null);
    const res = await fetch("/api/admin/add-product", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(addProductFields),
    });
    const data = await res.json();
    setAddProductSaving(false);
    if (res.status === 409) {
      setAddProductError("A product with this name already exists.");
      return;
    }
    if (!res.ok) {
      setAddProductError(data.error ?? "Failed to add product");
      return;
    }
    const newProduct: AllProduct = {
      ...data.product,
      ingredient_list: data.product.ingredient_list ?? null,
      is_archived: false,
    };
    setAllProducts((prev) => [newProduct, ...prev]);
    setAllEdits((prev) => ({ ...prev, [newProduct.id]: initEdit(newProduct, activeTypesSet) }));
    setAddProductFields({ name: "", brand: "", type: "", ingredient_list: "", image_url: "", iherb_url: "", source_url: "" });
    setAddProductOpen(false);
    setAddProductSaved(true);
    setTimeout(() => setAddProductSaved(false), 3000);
  }

  async function handleSaveSubmission(id: string) {
    const edits = submissionEdits[id];
    if (!edits) return;
    setSubmissionSaving(id);
    const res = await fetch("/api/admin/update-product", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: id,
        name: edits.name,
        brand: edits.brand,
        type: edits.type,
        ingredient_list: edits.ingredient_list,
        image_url: edits.image_url,
        iherb_url: edits.iherb_url,
        source_url: edits.source_url,
      }),
    });
    if (res.ok) {
      setSubmissions((prev) => prev.map((s) => s.id === id ? {
        ...s,
        name: edits.name || s.name,
        brand: edits.brand || null,
        type: edits.type || null,
        image_url: edits.image_url || s.image_url,
        iherb_url: edits.iherb_url || s.iherb_url,
        source_url: edits.source_url || s.source_url,
        ingredient_count: edits.ingredient_list ? splitIngredientList(edits.ingredient_list).length : s.ingredient_count,
      } : s));
      setSubmissionSaved((prev) => new Set([...prev, id]));
      setTimeout(() => setSubmissionSaved((prev) => { const n = new Set(prev); n.delete(id); return n; }), 2000);
      setEditingSubmission(null);
    }
    setSubmissionSaving(null);
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
        body: JSON.stringify({ name: newTypeName.trim(), body_area: newTypeBodyArea, is_rinse_off: newTypeRinseOff }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setProductTypes((prev) => [...prev, data.type]);
      setNewTypeName("");
      setNewTypeRinseOff(false);
    } catch (e) {
      setTypeAddError((e as Error).message);
    }
    setTypeAdding(false);
  }

  function startEditType(t: ProductType) {
    setEditingTypeId(t.id);
    setEditTypeName(t.name);
    setEditTypeBodyArea(t.body_area);
    setEditTypeRinseOff(t.is_rinse_off);
    setTypeOpError(null);
  }

  async function saveTypeEdit(t: ProductType) {
    setTypeSaving(t.id);
    setTypeOpError(null);
    try {
      const res = await fetch(`/api/admin/product-types/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editTypeName.trim() || t.name, body_area: editTypeBodyArea, is_rinse_off: editTypeRinseOff }),
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

  async function saveTypeOrder(reordered: ProductType[]) {
    const positions = reordered.map((t, i) => ({ id: t.id, position: i + 1 }));
    try {
      await fetch("/api/admin/product-types", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positions }),
      });
    } catch { }
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

  function adminInitials(a: { email: string | null; name: string | null }): string {
    if (a.name) return a.name.split(" ").map((p) => p[0] ?? "").join("").slice(0, 2).toUpperCase();
    return (a.email?.[0] ?? "?").toUpperCase();
  }

  function dateGroup(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    const weekAgo = new Date(today.getTime() - 6 * 86400000);
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (day.getTime() === today.getTime()) return "Today";
    if (day.getTime() === yesterday.getTime()) return "Yesterday";
    if (day >= weekAgo) return "This week";
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }

  function renderEntryDetail(entry: AuditEntry): React.ReactNode {
    if (entry.action === "update_product") {
      const changes = (entry.detail.changes ?? {}) as Record<string, { before: string | null; after: string | null } | string | null>;
      const pairs = Object.entries(changes)
        .map(([field, v]) => ({ field, v }))
        .filter(({ v }) => typeof v === "object" && v !== null && "before" in v) as { field: string; v: { before: string | null; after: string | null } }[];
      if (pairs.length === 0) return <p className="text-xs text-gray-400 italic">No detail available — edit predates before-state tracking.</p>;
      const hasChanges = pairs.some(({ v }) => v.before !== v.after);
      return (
        <div className="space-y-1">
          {pairs.map(({ field, v }) => (
            <div key={field} className="flex items-center gap-2 text-xs">
              <span className="text-gray-400 w-20 shrink-0 font-mono">{field}</span>
              <span className="text-rose-500">{v.before ?? "—"}</span>
              <span className="text-gray-300">→</span>
              <span className="text-teal-600">{v.after ?? "—"}</span>
            </div>
          ))}
          {hasChanges && (
            <button
              type="button"
              onClick={() => handleRevertEntry(entry.id)}
              disabled={revertingEntryId === entry.id}
              className="mt-2 text-xs text-rose-500 hover:text-rose-700 disabled:opacity-40"
            >
              {revertingEntryId === entry.id ? "Reverting…" : "Revert to previous values"}
            </button>
          )}
        </div>
      );
    }
    return null;
  }

  const PAGE_SIZE = 100;

  const allStats = {
    total: allProducts.length,
    missingSource: allProducts.filter((p) => !p.source_url).length,
    missingIherb: allProducts.filter((p) => !p.iherb_url).length,
    missingImage: allProducts.filter((p) => !p.image_url).length,
    missingType: allProducts.filter((p) => !p.type || !activeTypesSet.has(p.type)).length,
    missingIngredients: allProducts.filter((p) => !p.ingredient_list).length,
    suspicious: allProducts.filter((p) => hasSuspiciousIngredients(p.ingredient_list)).length,
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

  const filteredAllProducts = useMemo(() => (
    allSearch
      ? tokenFuzzyFilter(sortedAllProducts, allSearch, ["name", "brand", "type"])
      : sortedAllProducts
  )
    .filter((p) => !allBrandFilter || p.brand === allBrandFilter)
    .filter((p) => !filterMissingSource || !p.source_url)
    .filter((p) => !filterMissingIherb || !p.iherb_url)
    .filter((p) => !filterMissingImage || !p.image_url)
    .filter((p) => !filterMissingType || !p.type || !activeTypesSet.has(p.type))
    .filter((p) => !filterMissingIngredients || !p.ingredient_list)
    .filter((p) => !filterSuspicious || hasSuspiciousIngredients(p.ingredient_list)),
  [sortedAllProducts, allSearch, allBrandFilter, filterMissingSource, filterMissingIherb, filterMissingImage, filterMissingType, filterMissingIngredients, filterSuspicious, activeTypesSet]);

  const filteredAuditLog = useMemo(() => {
    const search = auditSearch.toLowerCase();
    return auditLog
      .filter((e) => !auditActionFilter || ACTION_GROUPS[auditActionFilter]?.includes(e.action))
      .filter((e) => !auditAdminFilter || e.admin_clerk_id === auditAdminFilter)
      .filter((e) => !auditEntityFilter || e.entity_id === auditEntityFilter)
      .filter((e) => !search || describeAction(e).toLowerCase().includes(search) || (e.admin_email ?? "").toLowerCase().includes(search));
  }, [auditLog, auditActionFilter, auditAdminFilter, auditEntityFilter, auditSearch]);

  const groupedAuditLog = useMemo(() => {
    const groups: { label: string; entries: AuditEntry[] }[] = [];
    for (const entry of filteredAuditLog) {
      const label = dateGroup(entry.created_at);
      const last = groups[groups.length - 1];
      if (last?.label === label) last.entries.push(entry);
      else groups.push({ label, entries: [entry] });
    }
    return groups;
  }, [filteredAuditLog]);

  const totalPages = Math.max(1, Math.ceil(filteredAllProducts.length / PAGE_SIZE));
  const displayedAllProducts = filteredAllProducts.slice((allPage - 1) * PAGE_SIZE, allPage * PAGE_SIZE);


  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-white">
        <SiteHeader />
        <main className="max-w-3xl mx-auto px-6 pt-[4.5rem] pb-16">
          <p className="text-sm text-gray-400">Loading…</p>
        </main>
      </div>
    );
  }

  if (!isSignedIn || forbidden) {
    return (
      <div className="min-h-screen bg-white">
        <SiteHeader />
        <main className="max-w-3xl mx-auto px-6 pt-[4.5rem] pb-16 text-center">
          <p className="text-sm text-gray-500">You don&apos;t have access to this page.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <main className="max-w-3xl mx-auto px-6 pt-[4.5rem] pb-8 space-y-8">

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

        {/* Review New Ingredients */}
        <section>
          <button
            type="button"
            onClick={() => {
              const opening = !reviewOpen;
              setReviewOpen(opening);
              if (opening && queueItems.length === 0) loadQueue();
            }}
            className="flex items-center gap-3 mb-4 group"
          >
            <h2 className="text-xl font-semibold tracking-tight text-gray-900">Review New Ingredients</h2>
            {(() => {
              const total = (siteStats?.queueLength ?? 0) + (siteStats?.pendingSubmissions ?? 0);
              return total > 0 ? (
                <span className="text-xs font-medium bg-indigo-100 text-indigo-700 rounded-full px-2.5 py-0.5">{total}</span>
              ) : null;
            })()}
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${reviewOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {reviewOpen && (() => {
            type ReviewRow =
              | { kind: "queue"; id: string; item: QueueItem }
              | { kind: "submission"; id: string; item: Submission };

            const allRows: ReviewRow[] = [
              ...queueItems.map((q) => ({ kind: "queue" as const, id: `q:${q.id}`, item: q })),
              ...submissions.map((s) => ({ kind: "submission" as const, id: `s:${s.id}`, item: s })),
            ];

            const filtered = allRows.filter((r) => {
              if (reviewFilter === "queue") return r.kind === "queue";
              if (reviewFilter === "submitted") return r.kind === "submission";
              if (reviewFilter === "suspicious") return r.kind === "submission" && hasSuspiciousIngredients((r.item as Submission).ingredient_list ?? null);
              return true;
            });

            const sorted = [...filtered].sort((a, b) => {
              if (reviewSort === "priority") {
                const ap = a.kind === "queue" ? (a.item as QueueItem).times_seen : (a.item as Submission).ingredient_count;
                const bp = b.kind === "queue" ? (b.item as QueueItem).times_seen : (b.item as Submission).ingredient_count;
                return bp - ap;
              }
              if (reviewSort === "date") {
                const ad = a.kind === "queue" ? ((a.item as QueueItem).last_seen ?? "") : (a.item as Submission).submitted_at;
                const bd = b.kind === "queue" ? ((b.item as QueueItem).last_seen ?? "") : (b.item as Submission).submitted_at;
                return bd.localeCompare(ad);
              }
              return a.item.name.localeCompare(b.item.name);
            });

            const selectedQueueIds = [...reviewSelected].filter(id => id.startsWith("q:")).map(id => id.slice(2));
            const selectedSubmissionIds = [...reviewSelected].filter(id => id.startsWith("s:")).map(id => id.slice(2));

            return (
              <div className="space-y-3">
                {/* Controls */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Filter chips */}
                  <div className="flex gap-1">
                    {(["all", "queue", "submitted", "suspicious"] as const).map((f) => (
                      <button key={f} type="button" onClick={() => setReviewFilter(f)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${reviewFilter === f ? "bg-gray-900 text-white border-gray-900" : "text-gray-500 border-gray-200 hover:border-gray-400"}`}>
                        {f === "all" ? `All (${allRows.length})` : f === "queue" ? `Queue (${queueItems.length})` : f === "submitted" ? `Submitted (${submissions.length})` : "Suspicious"}
                      </button>
                    ))}
                  </div>
                  {/* Sort */}
                  <div className="flex gap-1 ml-auto">
                    <span className="text-xs text-gray-400 self-center">Sort:</span>
                    {(["priority", "date", "name"] as const).map((s) => (
                      <button key={s} type="button" onClick={() => setReviewSort(s)}
                        className={`text-xs px-2 py-0.5 rounded border transition-colors ${reviewSort === s ? "bg-gray-100 text-gray-800 border-gray-300" : "text-gray-400 border-gray-100 hover:border-gray-300"}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Batch actions */}
                {reviewSelected.size > 0 && (
                  <div className="flex items-center gap-3 px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-xl text-xs">
                    <span className="text-indigo-700 font-medium">{reviewSelected.size} selected</span>
                    {selectedQueueIds.length > 0 && (
                      <button type="button" disabled={classifyingAll}
                        onClick={async () => {
                          for (const qid of selectedQueueIds) {
                            const item = queueItems.find((q) => q.id === qid);
                            if (item) await classifyQueueOne(item);
                          }
                          setReviewSelected(new Set());
                        }}
                        className="text-indigo-700 underline underline-offset-2 hover:text-indigo-900">
                        Classify {selectedQueueIds.length} queued
                      </button>
                    )}
                    {selectedQueueIds.length > 0 && (
                      <button type="button" disabled={removingMany}
                        onClick={async () => {
                          setQueueSelected(new Set(selectedQueueIds));
                          await removeSelectedFromQueue();
                          setReviewSelected(new Set());
                        }}
                        className="text-rose-600 underline underline-offset-2 hover:text-rose-800">
                        Remove {selectedQueueIds.length} queued
                      </button>
                    )}
                    {selectedSubmissionIds.length > 0 && (
                      <button type="button"
                        onClick={async () => {
                          for (const sid of selectedSubmissionIds) {
                            await handleArchive(sid);
                          }
                          setReviewSelected(new Set());
                        }}
                        className="text-gray-500 underline underline-offset-2 hover:text-gray-700">
                        Archive {selectedSubmissionIds.length} submitted
                      </button>
                    )}
                    <button type="button" onClick={() => setReviewSelected(new Set())} className="text-gray-400 hover:text-gray-600 ml-auto">Clear</button>
                  </div>
                )}

                {/* Loading states */}
                {(queueLoading || submissionsLoading) && <p className="text-sm text-gray-400">Loading…</p>}

                {/* Empty state */}
                {!queueLoading && !submissionsLoading && sorted.length === 0 && (
                  <p className="text-sm text-gray-400">Nothing to review — all clear.</p>
                )}

                {/* Combined list */}
                {sorted.length > 0 && (
                  <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
                    {sorted.map((row) => {
                      const isChecked = reviewSelected.has(row.id);
                      const toggleCheck = () => setReviewSelected((prev) => {
                        const next = new Set(prev);
                        if (next.has(row.id)) next.delete(row.id); else next.add(row.id);
                        return next;
                      });

                      if (row.kind === "queue") {
                        const item = row.item as QueueItem;
                        return (
                          <div key={row.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors">
                            <input type="checkbox" checked={isChecked} onChange={toggleCheck} className="shrink-0 accent-indigo-600" />
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium shrink-0">Q</span>
                            <div className="flex-1 min-w-0">
                              {editingQueueId === item.id ? (
                                <form onSubmit={(e) => { e.preventDefault(); saveQueueName(item); }} className="flex gap-1.5">
                                  <input autoFocus value={editingQueueName} onChange={(e) => setEditingQueueName(e.target.value)}
                                    className="flex-1 text-xs border border-gray-200 rounded px-2 py-0.5 focus:outline-none focus:border-indigo-400" />
                                  <button type="submit" disabled={savingQueueName} className="text-xs text-indigo-600 hover:underline">{savingQueueName ? "…" : "Save"}</button>
                                  <button type="button" onClick={() => setEditingQueueId(null)} className="text-xs text-gray-400 hover:underline">Cancel</button>
                                </form>
                              ) : (
                                <button type="button" onClick={() => { setEditingQueueId(item.id); setEditingQueueName(item.name); }}
                                  className="text-sm text-gray-800 hover:underline truncate max-w-xs text-left">
                                  {item.name}
                                </button>
                              )}
                              <p className="text-xs text-gray-400">
                                ×{item.times_seen}{item.found_in ? ` · found in ${item.found_in}` : ""}
                                {item.last_seen ? ` · ${new Date(item.last_seen).toLocaleDateString()}` : ""}
                              </p>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <button type="button" disabled={classifyingOne === item.id} onClick={() => classifyQueueOne(item)}
                                className="text-xs text-indigo-600 hover:underline disabled:opacity-50">
                                {classifyingOne === item.id ? "…" : "Classify"}
                              </button>
                              <button type="button" disabled={removingFromQueue === item.id} onClick={async () => {
                                setRemovingFromQueue(item.id);
                                try {
                                  await fetch("/api/admin/queue", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "remove", queueId: item.id }) });
                                  setQueueItems((prev) => prev.filter((q) => q.id !== item.id));
                                  setSiteStats((prev) => prev ? { ...prev, queueLength: Math.max(0, prev.queueLength - 1) } : prev);
                                } catch { }
                                setRemovingFromQueue(null);
                              }} className="text-xs text-rose-500 hover:underline disabled:opacity-50">
                                {removingFromQueue === item.id ? "…" : "Remove"}
                              </button>
                            </div>
                          </div>
                        );
                      }

                      // submission row
                      const item = row.item as Submission;
                      return (
                        <div key={row.id} className="flex items-start gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors">
                          <input type="checkbox" checked={isChecked} onChange={toggleCheck} className="shrink-0 accent-indigo-600 mt-0.5" />
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium shrink-0 mt-0.5">S</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-800 truncate">{item.name}</p>
                            <p className="text-xs text-gray-400">
                              {item.brand && <>{item.brand} · </>}
                              {item.type && <>{item.type} · </>}
                              {item.ingredient_count} ingredient{item.ingredient_count !== 1 ? "s" : ""}
                              {hasSuspiciousIngredients((item as unknown as { ingredient_list?: string | null }).ingredient_list ?? null) && (
                                <span className="ml-1.5 text-amber-600">⚠ suspicious</span>
                              )}
                              {" · "}{new Date(item.submitted_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex gap-2 shrink-0 mt-0.5">
                            <Link href={`/?q=${encodeURIComponent(item.name)}`} target="_blank" className="text-xs text-gray-500 hover:underline">Scan</Link>
                            <button type="button" disabled={archiving === item.id} onClick={() => handleArchive(item.id)}
                              className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-50">
                              {archiving === item.id ? "…" : "Archive"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Classify all queued */}
                {queueItems.length > 0 && (
                  <div className="flex items-center gap-3 pt-1">
                    <button type="button" disabled={classifyingAll} onClick={classifyQueueAll}
                      className="text-xs text-indigo-600 hover:underline disabled:opacity-40">
                      {classifyingAll ? "Classifying all…" : `Classify all ${queueItems.length} queued`}
                    </button>
                    {classifyAllResult && (
                      <span className="text-xs text-teal-600">{classifyAllResult.classified} classified, {classifyAllResult.skipped} skipped</span>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </section>

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

          {submissionsOpen && (submissionsLoading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : submissions.length === 0 ? (
            <p className="text-sm text-gray-400">No user-submitted products yet.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {submissions.map((s) => (
                <div key={s.id} className="py-4 border-b border-gray-100 last:border-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900 truncate">{s.name}</span>
                        {s.brand && <span className="text-xs text-gray-400 shrink-0">{s.brand}</span>}
                        {s.type && (
                          <span className="text-xs text-gray-400 border border-gray-200 rounded-full px-2 py-0.5 shrink-0">
                            {s.type}
                          </span>
                        )}
                        {submissionSaved.has(s.id) && <span className="text-xs text-teal-600 shrink-0">Saved</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-gray-400">
                          {s.ingredient_count > 0 ? `${s.ingredient_count} ingredients` : "No ingredients"}
                        </span>
                        <span className="text-gray-200 text-xs">·</span>
                        <span className="text-xs text-gray-400">{relativeTime(s.submitted_at)}</span>
                        {s.iherb_url && (
                          <>
                            <span className="text-gray-200 text-xs">·</span>
                            <a href={s.iherb_url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-500 hover:underline">iHerb</a>
                          </>
                        )}
                        {s.source_url && (
                          <>
                            <span className="text-gray-200 text-xs">·</span>
                            <a href={s.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-500 hover:underline">Product page</a>
                          </>
                        )}
                        {s.image_url && (
                          <>
                            <span className="text-gray-200 text-xs">·</span>
                            <a href={s.image_url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-500 hover:underline">Image</a>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleApprove(s.id)}
                        disabled={approving === s.id}
                        className="text-xs font-medium bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200 rounded-md px-2.5 py-1 disabled:opacity-40"
                      >
                        {approving === s.id ? "Approving…" : "Approve"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (editingSubmission === s.id) {
                            setEditingSubmission(null);
                          } else {
                            setEditingSubmission(s.id);
                            setSubmissionEdits((prev) => ({
                              ...prev,
                              [s.id]: { name: s.name, brand: s.brand ?? "", type: s.type ?? "", ingredient_list: "", image_url: s.image_url ?? "", iherb_url: s.iherb_url ?? "", source_url: s.source_url ?? "" },
                            }));
                          }
                        }}
                        className="text-xs text-gray-500 hover:text-gray-800"
                      >
                        {editingSubmission === s.id ? "Cancel" : "Edit"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleArchive(s.id)}
                        disabled={archiving === s.id}
                        className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-40"
                      >
                        {archiving === s.id ? "Rejecting…" : "Reject"}
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
                  {editingSubmission === s.id && submissionEdits[s.id] && (
                    <div className="mt-3 space-y-2 pl-0">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-gray-400 block mb-0.5">Name</label>
                          <input
                            type="text"
                            value={submissionEdits[s.id].name}
                            onChange={(e) => setSubmissionEdits((prev) => ({ ...prev, [s.id]: { ...prev[s.id], name: e.target.value } }))}
                            className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 block mb-0.5">Brand</label>
                          <input
                            type="text"
                            value={submissionEdits[s.id].brand}
                            onChange={(e) => setSubmissionEdits((prev) => ({ ...prev, [s.id]: { ...prev[s.id], brand: e.target.value } }))}
                            className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-0.5">Type</label>
                        <select
                          value={submissionEdits[s.id].type}
                          onChange={(e) => setSubmissionEdits((prev) => ({ ...prev, [s.id]: { ...prev[s.id], type: e.target.value } }))}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm bg-white"
                        >
                          <option value="">— select type —</option>
                          {productTypes.map((pt) => (
                            <option key={pt.id} value={pt.name}>{pt.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-0.5">Ingredients (leave blank to keep existing)</label>
                        <textarea
                          value={submissionEdits[s.id].ingredient_list}
                          onChange={(e) => setSubmissionEdits((prev) => ({ ...prev, [s.id]: { ...prev[s.id], ingredient_list: e.target.value } }))}
                          placeholder="Paste ingredient list…"
                          rows={3}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm resize-y"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-0.5">Image URL</label>
                        <input
                          type="url"
                          value={submissionEdits[s.id].image_url}
                          onChange={(e) => setSubmissionEdits((prev) => ({ ...prev, [s.id]: { ...prev[s.id], image_url: e.target.value } }))}
                          placeholder="https://…"
                          className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-gray-400 block mb-0.5">iHerb URL</label>
                          <input
                            type="url"
                            value={submissionEdits[s.id].iherb_url}
                            onChange={(e) => setSubmissionEdits((prev) => ({ ...prev, [s.id]: { ...prev[s.id], iherb_url: e.target.value } }))}
                            placeholder="https://www.iherb.com/…"
                            className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 block mb-0.5">Product page URL</label>
                          <input
                            type="url"
                            value={submissionEdits[s.id].source_url}
                            onChange={(e) => setSubmissionEdits((prev) => ({ ...prev, [s.id]: { ...prev[s.id], source_url: e.target.value } }))}
                            placeholder="https://…"
                            className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSaveSubmission(s.id)}
                        disabled={submissionSaving === s.id}
                        className="text-xs bg-gray-800 text-white rounded-lg px-3 py-1.5 disabled:opacity-40"
                      >
                        {submissionSaving === s.id ? "Saving…" : "Save changes"}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </section>

        {/* All Products */}
        <section>
          <div className="flex items-center gap-3 mb-2">
            <button
              type="button"
              onClick={() => setAllProductsOpen((v) => !v)}
              className="flex items-center gap-3 group"
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
            <button
              type="button"
              onClick={() => { setAddProductOpen((v) => !v); setAddProductError(null); }}
              className="ml-auto text-xs font-medium border border-gray-300 rounded-lg px-3 py-1.5 text-gray-600 hover:border-gray-500 hover:text-gray-900 transition-colors"
            >
              {addProductOpen ? "Cancel" : "+ Add product"}
            </button>
            {addProductSaved && <span className="text-xs text-teal-600">Product added.</span>}
          </div>

          {addProductOpen && (
            <div className="border border-gray-300 rounded-xl p-4 space-y-3 mb-4">
              <p className="text-sm font-semibold text-gray-800">New product</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-14 shrink-0">Name</span>
                  <input
                    type="text"
                    value={addProductFields.name}
                    onChange={(e) => setAddProductFields((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Product name"
                    className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-400 min-w-0"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-14 shrink-0">Brand</span>
                  <input
                    type="text"
                    value={addProductFields.brand}
                    onChange={(e) => setAddProductFields((f) => ({ ...f, brand: e.target.value }))}
                    placeholder="Brand"
                    className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-400 min-w-0"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-14 shrink-0">Type</span>
                  <select
                    value={addProductFields.type}
                    onChange={(e) => setAddProductFields((f) => ({ ...f, type: e.target.value }))}
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
                <div className="flex gap-2">
                  <span className="text-xs text-gray-400 w-14 shrink-0 pt-1.5">Source</span>
                  <input
                    type="url"
                    value={addProductFields.source_url}
                    onChange={(e) => setAddProductFields((f) => ({ ...f, source_url: e.target.value }))}
                    placeholder="Source URL (INCIDecoder, Sephora, etc.)"
                    className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-400 min-w-0"
                  />
                </div>
                <div className="flex gap-2">
                  <span className="text-xs text-gray-400 w-14 shrink-0 pt-1.5">Image</span>
                  <input
                    type="url"
                    value={addProductFields.image_url}
                    onChange={(e) => setAddProductFields((f) => ({ ...f, image_url: e.target.value }))}
                    placeholder="Image URL"
                    className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-400 min-w-0"
                  />
                </div>
                <div className="flex gap-2">
                  <span className="text-xs text-gray-400 w-14 shrink-0 pt-1.5">iHerb</span>
                  <input
                    type="url"
                    value={addProductFields.iherb_url}
                    onChange={(e) => setAddProductFields((f) => ({ ...f, iherb_url: e.target.value }))}
                    placeholder="iHerb URL"
                    className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-400 min-w-0"
                  />
                </div>
                <div>
                  <span className="text-xs text-gray-400 block mb-1">Ingredients</span>
                  <IngredientChipEditor
                    value={addProductFields.ingredient_list}
                    onChange={(v) => setAddProductFields((f) => ({ ...f, ingredient_list: v }))}
                  />
                </div>
              </div>
              {addProductError && <p className="text-xs text-rose-600">{addProductError}</p>}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleAddProduct}
                  disabled={addProductSaving || !addProductFields.name.trim() || !addProductFields.ingredient_list.trim()}
                  className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors"
                >
                  {addProductSaving ? "Adding…" : "Add product"}
                </button>
                <span className="text-xs text-gray-400">Goes live immediately</span>
              </div>
            </div>
          )}

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
                  ["Suspicious", filterSuspicious, setFilterSuspicious, allStats.suspicious],
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
                        <IngredientChipEditor
                          value={edit.ingredient_list}
                          onChange={(v) => updateAllEdit(p.id, "ingredient_list", v)}
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

        {/* Ingredient Queue */}
        <section>
          <button
            type="button"
            onClick={() => {
              const opening = !queueOpen;
              setQueueOpen(opening);
              if (opening && queueItems.length === 0) loadQueue();
            }}
            className="flex items-center gap-3 mb-4 group"
          >
            <h2 className="text-xl font-semibold tracking-tight text-gray-900">Ingredient Queue</h2>
            {siteStats && siteStats.queueLength > 0 && (
              <span className="text-xs font-medium bg-amber-100 text-amber-700 rounded-full px-2.5 py-0.5">
                {siteStats.queueLength}
              </span>
            )}
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${queueOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {queueOpen && (
            <>
              {queueLoading && <p className="text-sm text-gray-400">Loading…</p>}
              {!queueLoading && queueItems.length === 0 && !classifyAllResult && (
                <p className="text-sm text-gray-400">Queue is empty — all ingredients classified.</p>
              )}
              {!queueLoading && classifyAllResult && (
                <p className="text-sm text-teal-600 mb-4">
                  Done — {classifyAllResult.classified} classified
                  {classifyAllResult.skipped > 0 ? `, ${classifyAllResult.skipped} already in DB` : ""}.
                </p>
              )}
              {!queueLoading && queueItems.length > 0 && (
                <>
                  <div className="flex items-center gap-3 mb-4 flex-wrap">
                    <button
                      type="button"
                      onClick={classifyQueueAll}
                      disabled={classifyingAll}
                      className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg disabled:opacity-40 hover:bg-indigo-700 transition-colors"
                    >
                      {classifyingAll ? "Classifying…" : `Classify all (${queueItems.length})`}
                    </button>
                    {queueSelected.size > 0 && (
                      <button
                        type="button"
                        onClick={removeSelectedFromQueue}
                        disabled={removingMany}
                        className="text-xs px-3 py-1.5 border border-rose-200 text-rose-600 rounded-lg hover:bg-rose-50 disabled:opacity-40"
                      >
                        {removingMany ? "Removing…" : `Remove ${queueSelected.size} selected`}
                      </button>
                    )}
                    {queueSelected.size > 0 && (
                      <button type="button" onClick={() => setQueueSelected(new Set())} className="text-xs text-gray-400 hover:text-gray-700">
                        Clear selection
                      </button>
                    )}
                  </div>
                  <div className="border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-50">
                    {queueItems.map((item) => (
                      <div key={item.id} className={`flex items-center justify-between px-4 py-2.5 gap-4 ${queueSelected.has(item.id) ? "bg-indigo-50" : ""}`}>
                        <input
                          type="checkbox"
                          checked={queueSelected.has(item.id)}
                          onChange={() => setQueueSelected((prev) => {
                            const next = new Set(prev);
                            if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
                            return next;
                          })}
                          className="shrink-0 accent-indigo-600"
                        />
                        <div className="min-w-0 flex-1">
                          {editingQueueId === item.id ? (
                            <form onSubmit={(e) => { e.preventDefault(); saveQueueName(item); }} className="flex gap-1.5">
                              <input
                                autoFocus
                                value={editingQueueName}
                                onChange={(e) => setEditingQueueName(e.target.value)}
                                className="text-sm font-mono border border-indigo-300 rounded px-1.5 py-0.5 focus:outline-none flex-1 min-w-0"
                              />
                              <button type="submit" disabled={savingQueueName} className="text-xs text-indigo-600 hover:text-indigo-800 disabled:opacity-40 shrink-0">
                                {savingQueueName ? "…" : "Save"}
                              </button>
                              <button type="button" onClick={() => setEditingQueueId(null)} className="text-xs text-gray-400 hover:text-gray-700 shrink-0">Cancel</button>
                            </form>
                          ) : (
                            <button
                              type="button"
                              onClick={() => { setEditingQueueId(item.id); setEditingQueueName(item.name); }}
                              className="text-sm text-gray-900 font-mono hover:text-indigo-700 text-left"
                              title="Click to edit name"
                            >
                              {item.name}
                            </button>
                          )}
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-amber-600 font-medium">×{item.times_seen}</span>
                            {item.found_in && <span className="text-xs text-gray-400 truncate">{item.found_in}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <button
                            type="button"
                            onClick={() => classifyQueueOne(item)}
                            disabled={classifyingOne === item.id}
                            className="text-xs text-indigo-600 hover:text-indigo-800 disabled:opacity-40"
                          >
                            {classifyingOne === item.id ? "Classifying…" : "Classify"}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeFromQueue(item)}
                            disabled={removingFromQueue === item.id}
                            className="text-xs text-gray-400 hover:text-rose-500 disabled:opacity-40"
                          >
                            {removingFromQueue === item.id ? "Removing…" : "Remove"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {/* Explanation upgrade stats */}
              {!queueLoading && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      type="button"
                      onClick={loadUpgradeStats}
                      className="text-xs text-gray-500 hover:text-gray-700 underline underline-offset-2"
                    >
                      Check explanation coverage
                    </button>
                    {upgradeStats && (
                      <>
                        <span className={`text-xs ${upgradeStats.weak > 0 ? "text-amber-600" : "text-teal-600"}`}>
                          {upgradeStats.weak > 0
                            ? `${upgradeStats.weak} of ${upgradeStats.total} need curated explanation`
                            : `All ${upgradeStats.total} explanations are curated`}
                        </span>
                        {upgradeStats.needsProfile > 0 && (
                          <span className="text-xs text-amber-600">{upgradeStats.needsProfile} need fatty acid profile</span>
                        )}
                        {(upgradeStats.weak > 0 || upgradeStats.needsProfile > 0) && (
                          <code className="text-xs text-indigo-600 bg-indigo-50 border border-indigo-100 rounded px-2 py-0.5 select-all">generate-explanations</code>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        {/* Flagged Explanations */}
        <section>
          <button
            type="button"
            onClick={() => {
              const opening = !flagsOpen;
              setFlagsOpen(opening);
              if (opening && flags.length === 0) loadFlags();
            }}
            className="flex items-center gap-3 mb-4 group"
          >
            <h2 className="text-xl font-semibold tracking-tight text-gray-900">Flagged Explanations</h2>
            {flags.length > 0 && (
              <span className="text-xs font-medium bg-rose-100 text-rose-700 rounded-full px-2.5 py-0.5">
                {flags.length}
              </span>
            )}
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${flagsOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {flagsOpen && (
            <div className="space-y-3">
              {flagsLoading ? (
                <p className="text-sm text-gray-400">Loading…</p>
              ) : flags.length === 0 ? (
                <p className="text-sm text-gray-400">No flagged explanations.</p>
              ) : flags.map((f) => (
                <div key={f.ingredient_id} className="border border-gray-200 rounded-xl px-4 py-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{f.ingredient_name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {f.flag_count === 1 ? "1 report" : `${f.flag_count} reports`}
                        {f.explanation_source ? ` · src: ${f.explanation_source}` : ""}
                        {" · "}{new Date(f.latest_flag).toLocaleDateString()}
                      </p>
                      {f.reasons.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {f.reasons.map((r, i) => (
                            <p key={i} className="text-xs text-gray-500 italic">"{r}"</p>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={actioning === f.ingredient_id}
                        onClick={() => actOnFlag(f.ingredient_id, "reclassify")}
                        className="text-xs px-2.5 py-1 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 disabled:opacity-40 transition-colors"
                      >
                        Re-classify
                      </button>
                      <button
                        type="button"
                        disabled={actioning === f.ingredient_id}
                        onClick={() => actOnFlag(f.ingredient_id, "regenerate")}
                        className="text-xs px-2.5 py-1 rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50 disabled:opacity-40 transition-colors"
                      >
                        Regenerate
                      </button>
                      <button
                        type="button"
                        disabled={actioning === f.ingredient_id}
                        onClick={() => actOnFlag(f.ingredient_id, "dismiss")}
                        className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Search Misses */}
        <section>
          <button
            type="button"
            onClick={() => {
              const opening = !searchMissesOpen;
              setSearchMissesOpen(opening);
              if (opening && searchMisses.length === 0) loadSearchMisses();
            }}
            className="flex items-center gap-3 mb-4 group"
          >
            <h2 className="text-xl font-semibold tracking-tight text-gray-900">Search Misses</h2>
            {searchMisses.length > 0 && (
              <span className="text-xs font-medium bg-rose-100 text-rose-700 rounded-full px-2.5 py-0.5">
                {searchMisses.length}
              </span>
            )}
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${searchMissesOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {searchMissesOpen && (
            <>
              {searchMissesLoading && <p className="text-sm text-gray-400">Loading…</p>}
              {!searchMissesLoading && searchMisses.length === 0 && (
                <p className="text-sm text-gray-400">No search misses recorded yet.</p>
              )}
              {!searchMissesLoading && searchMisses.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-gray-400">{searchMisses.length} unique {searchMisses.length === 1 ? "miss" : "misses"}</p>
                    <button
                      type="button"
                      onClick={dismissAllMisses}
                      className="text-xs text-rose-500 hover:text-rose-700"
                    >
                      Dismiss all
                    </button>
                  </div>
                  {searchMisses.map((miss) => (
                    <div key={miss.id} className="flex items-start justify-between gap-3 py-2 border-b border-gray-100 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{miss.query}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {miss.kind === "url" ? "URL import" : "Search"} · {miss.failure.replace(/_/g, " ")} · {miss.times_seen}× · {miss.last_seen ? new Date(miss.last_seen).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => dismissMiss(miss.id)}
                        className="text-xs text-gray-400 hover:text-rose-600 shrink-0 pt-0.5"
                      >
                        Dismiss
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
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
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newTypeRinseOff}
                    onChange={(e) => setNewTypeRinseOff(e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0"
                  />
                  <span className="text-xs text-gray-600">Rinse-off by default</span>
                </label>
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
                                    <label className="flex items-center gap-2 cursor-pointer select-none">
                                      <input
                                        type="checkbox"
                                        checked={editTypeRinseOff}
                                        onChange={(e) => setEditTypeRinseOff(e.target.checked)}
                                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0"
                                      />
                                      <span className="text-xs text-gray-600">Rinse-off by default</span>
                                    </label>
                                  </div>
                                ) : (
                                  <div
                                    className={`flex items-center gap-3 group rounded-lg transition-colors ${dragOverTypeId === t.id ? "bg-indigo-50" : ""}`}
                                    draggable
                                    onDragStart={() => { dragTypeIdRef.current = t.id; }}
                                    onDragOver={(e) => { e.preventDefault(); setDragOverTypeId(t.id); }}
                                    onDragLeave={() => setDragOverTypeId(null)}
                                    onDrop={(e) => {
                                      e.preventDefault();
                                      const fromId = dragTypeIdRef.current;
                                      if (!fromId || fromId === t.id) { setDragOverTypeId(null); return; }
                                      const fromIdx = productTypes.findIndex((x) => x.id === fromId);
                                      const toIdx = productTypes.findIndex((x) => x.id === t.id);
                                      const reordered = [...productTypes];
                                      const [moved] = reordered.splice(fromIdx, 1);
                                      reordered.splice(toIdx, 0, moved);
                                      setProductTypes(reordered);
                                      setDragOverTypeId(null);
                                      dragTypeIdRef.current = null;
                                      saveTypeOrder(reordered);
                                    }}
                                  >
                                    <span className="text-gray-300 cursor-grab active:cursor-grabbing select-none shrink-0" title="Drag to reorder">⠿</span>
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => toggleTypeSelection(t.id, t.name, t.body_area)}
                                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0"
                                    />
                                    {TypeIcon && <TypeIcon size={12} className="text-gray-400 shrink-0" />}
                                    <span className="text-sm text-gray-800 flex-1">{t.name}</span>
                                    {t.is_rinse_off && (
                                      <span className="text-xs text-blue-500 border border-blue-200 rounded-full px-1.5 py-0.5">rinse-off</span>
                                    )}
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

        {/* Site Banner */}
        <section>
          <button
            type="button"
            onClick={() => {
              const opening = !bannersOpen;
              setBannersOpen(opening);
              if (opening && banners.length === 0) loadBanners();
            }}
            className="flex items-center gap-3 mb-4 group"
          >
            <h2 className="text-xl font-semibold tracking-tight text-gray-900">Site Banner</h2>
            {banners.some((b) => b.status === "active") && (
              <span className="text-xs font-medium bg-teal-100 text-teal-700 rounded-full px-2.5 py-0.5">Live</span>
            )}
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${bannersOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {bannersOpen && (
            <>
              {bannersLoading && <p className="text-sm text-gray-400">Loading…</p>}
              {!bannersLoading && (
                <>
                  {!bannerFormOpen ? (
                    <button
                      type="button"
                      onClick={() => setBannerFormOpen(true)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 mb-4"
                    >
                      + New banner
                    </button>
                  ) : (
                    <div className="border border-gray-200 rounded-xl p-4 space-y-3 mb-4">
                      <textarea
                        value={bannerForm.message}
                        onChange={(e) => setBannerForm((f) => ({ ...f, message: e.target.value }))}
                        placeholder="Banner message…"
                        rows={2}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-400 resize-none"
                      />
                      <div className="flex flex-wrap gap-3 items-center">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Status:</span>
                          {(["draft", "scheduled", "active"] as const).map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setBannerForm((f) => ({ ...f, status: s }))}
                              className={`text-xs px-2.5 py-1 rounded-full border transition-colors capitalize ${
                                bannerForm.status === s ? "bg-indigo-600 text-white border-indigo-600" : "border-gray-200 text-gray-500 hover:border-gray-400"
                              }`}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                        <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={bannerForm.dismissible}
                            onChange={(e) => setBannerForm((f) => ({ ...f, dismissible: e.target.checked }))}
                            className="rounded border-gray-300 text-indigo-600"
                          />
                          Dismissible
                        </label>
                      </div>
                      <div className="flex flex-wrap gap-3 items-center">
                        <span className="text-xs text-gray-500">Expires:</span>
                        {(["none", "datetime", "on_next"] as const).map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setBannerForm((f) => ({ ...f, expiry_mode: m }))}
                            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                              bannerForm.expiry_mode === m ? "bg-indigo-600 text-white border-indigo-600" : "border-gray-200 text-gray-500 hover:border-gray-400"
                            }`}
                          >
                            {m === "none" ? "Never" : m === "datetime" ? "At date" : "When next goes live"}
                          </button>
                        ))}
                      </div>
                      {bannerForm.expiry_mode === "datetime" && (
                        <input
                          type="datetime-local"
                          value={bannerForm.expires_at}
                          onChange={(e) => setBannerForm((f) => ({ ...f, expires_at: e.target.value }))}
                          className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-400"
                        />
                      )}
                      {bannerForm.status === "scheduled" && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Go live at:</span>
                          <input
                            type="datetime-local"
                            value={bannerForm.scheduled_at}
                            onChange={(e) => setBannerForm((f) => ({ ...f, scheduled_at: e.target.value }))}
                            className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-400"
                          />
                        </div>
                      )}
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={saveBanner}
                          disabled={bannerSaving || !bannerForm.message.trim()}
                          className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg disabled:opacity-40 hover:bg-indigo-700 transition-colors"
                        >
                          {bannerSaving ? "Saving…" : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setBannerFormOpen(false); setBannerSaveError(null); }}
                          className="text-xs text-gray-400 hover:text-gray-700"
                        >
                          Cancel
                        </button>
                        {bannerSaveError && <span className="text-xs text-rose-600">{bannerSaveError}</span>}
                      </div>
                    </div>
                  )}

                  {banners.length === 0 && <p className="text-sm text-gray-400">No banners yet.</p>}
                  {banners.length > 0 && (
                    <div className="border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-50">
                      {banners.map((b) => (
                        <div key={b.id} className="px-4 py-3 space-y-1">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm text-gray-900 flex-1">{b.message}</p>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`text-xs rounded-full px-2 py-0.5 ${
                                b.status === "active" ? "bg-teal-100 text-teal-700" :
                                b.status === "scheduled" ? "bg-indigo-100 text-indigo-600" :
                                b.status === "draft" ? "bg-gray-100 text-gray-500" :
                                "bg-gray-50 text-gray-300"
                              }`}>
                                {b.status}
                              </span>
                              {!b.dismissible && <span className="text-xs text-gray-400">persistent</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-wrap">
                            {b.status !== "active" && b.status !== "expired" && (
                              <button
                                type="button"
                                onClick={() => updateBannerStatus(b, "active")}
                                disabled={bannerUpdating === b.id}
                                className="text-xs text-teal-600 hover:text-teal-800 disabled:opacity-40"
                              >
                                {bannerUpdating === b.id ? "Activating…" : "Go live"}
                              </button>
                            )}
                            {b.status === "active" && (
                              <button
                                type="button"
                                onClick={() => updateBannerStatus(b, "expired")}
                                disabled={bannerUpdating === b.id}
                                className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-40"
                              >
                                {bannerUpdating === b.id ? "Deactivating…" : "Deactivate"}
                              </button>
                            )}
                            {b.status === "expired" && (
                              <button
                                type="button"
                                onClick={() => updateBannerStatus(b, "active")}
                                disabled={bannerUpdating === b.id}
                                className="text-xs text-indigo-500 hover:text-indigo-700 disabled:opacity-40"
                              >
                                {bannerUpdating === b.id ? "Activating…" : "Reactivate"}
                              </button>
                            )}
                            {b.expiry_mode === "datetime" && b.expires_at && (
                              <span className="text-xs text-gray-400">
                                Expires {new Date(b.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                              </span>
                            )}
                            {b.expiry_mode === "on_next" && (
                              <span className="text-xs text-gray-400">Expires when next goes live</span>
                            )}
                            {b.scheduled_at && b.status === "scheduled" && (
                              <span className="text-xs text-gray-400">
                                Scheduled {new Date(b.scheduled_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => deleteBanner(b.id)}
                              disabled={bannerDeleting === b.id}
                              className="text-xs text-rose-400 hover:text-rose-600 disabled:opacity-40 ml-auto"
                            >
                              {bannerDeleting === b.id ? "Deleting…" : "Delete"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </section>

        {/* Admin Management */}
        <section>
          <button
            type="button"
            onClick={() => { const o = !adminsOpen; setAdminsOpen(o); if (o && adminsList.length === 0) loadAdmins(); }}
            className="flex items-center gap-3 mb-4 group"
          >
            <h2 className="text-xl font-semibold tracking-tight text-gray-900">Admin Management</h2>
            {adminsList.length > 0 && <span className="text-xs font-medium bg-gray-100 text-gray-600 rounded-full px-2.5 py-0.5">{adminsList.length}</span>}
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${adminsOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
          </button>

          {adminsOpen && (
            <>
              {adminsLoading && <p className="text-sm text-gray-400">Loading…</p>}
              {!adminsLoading && (
                <div className="space-y-6">
                  {/* Unified access list */}
                  {(adminsList.length > 0 || invites.filter((i) => !i.is_expired && !i.claimed_by).length > 0) && (
                    <div className="border border-gray-100 rounded-xl overflow-visible divide-y divide-gray-50">
                      {adminsList.map((a) => (
                        <div key={a.clerk_id} className="flex items-center gap-3 px-4 py-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-semibold shrink-0 select-none">
                            {adminInitials(a)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm text-gray-900 font-medium truncate">{a.email ?? a.clerk_id}</span>
                              {a.is_self && <span className="text-xs text-gray-400 shrink-0">You</span>}
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                              {a.granted_at && (
                                <span className="text-xs text-gray-400">Admin since {new Date(a.granted_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                              )}
                              {a.granted_by_email && (
                                <span className="text-xs text-gray-300">· Added by {a.granted_by_email}</span>
                              )}
                            </div>
                          </div>
                          {a.activity_count > 0 && (
                            <button
                              type="button"
                              onClick={() => { setAuditAdminFilter(a.clerk_id); setAuditAdminFilterEmail(a.email); setAuditExpanded(true); }}
                              className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 hover:bg-indigo-100 hover:text-indigo-700 transition-colors shrink-0"
                              title="View activity"
                            >
                              {a.activity_count} actions
                            </button>
                          )}
                          <div className="relative shrink-0">
                            <button
                              type="button"
                              onClick={() => setAdminMenuOpen(adminMenuOpen === a.clerk_id ? null : a.clerk_id)}
                              className="text-gray-400 hover:text-gray-700 px-1 py-0.5 text-lg leading-none"
                            >
                              ⋯
                            </button>
                            {adminMenuOpen === a.clerk_id && (
                              <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden">
                                <button
                                  type="button"
                                  onClick={() => { setAuditAdminFilter(a.clerk_id); setAuditAdminFilterEmail(a.email); setAuditExpanded(true); setAdminMenuOpen(null); }}
                                  className="w-full text-left text-xs px-3 py-2 hover:bg-gray-50 text-gray-700"
                                >
                                  View activity
                                </button>
                                {!a.is_self && (
                                  <button
                                    type="button"
                                    onClick={() => { if (!confirm(`Revoke admin access for ${a.email ?? a.clerk_id}?`)) return; revokeAdmin(a.clerk_id); setAdminMenuOpen(null); }}
                                    disabled={revokingAdmin === a.clerk_id}
                                    className="w-full text-left text-xs px-3 py-2 hover:bg-rose-50 text-rose-600 disabled:opacity-40"
                                  >
                                    {revokingAdmin === a.clerk_id ? "Revoking…" : "Revoke access"}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}

                      {invites.filter((i) => !i.is_expired && !i.claimed_by).map((inv) => (
                        <div key={inv.id} className="flex items-center gap-3 px-4 py-3">
                          <div className="w-8 h-8 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-400 shrink-0 text-xs">✉</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-500">Pending invite</p>
                            <p className="text-xs text-gray-400">Expires {relativeTime(inv.expires_at)}{inv.created_by_email ? ` · from ${inv.created_by_email}` : ""}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => revokeInvite(inv.id)}
                            disabled={revokingInvite === inv.id}
                            className="text-xs text-gray-400 hover:text-rose-500 disabled:opacity-40 shrink-0"
                          >
                            {revokingInvite === inv.id ? "Revoking…" : "Revoke"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Invite history */}
                  {invites.filter((i) => i.is_expired || i.claimed_by).length > 0 && (
                    <div>
                      <button type="button" onClick={() => setInviteHistoryOpen((v) => !v)} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                        {inviteHistoryOpen ? "Hide" : "Show"} invite history ({invites.filter((i) => i.is_expired || i.claimed_by).length})
                      </button>
                      {inviteHistoryOpen && (
                        <div className="mt-2 border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-50">
                          {invites.filter((i) => i.is_expired || i.claimed_by).map((inv) => (
                            <div key={inv.id} className="flex items-center gap-3 px-4 py-2.5">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <code className="text-xs font-mono text-gray-400">{inv.code.slice(0, 8)}…</code>
                                  <span className={`text-xs rounded-full px-2 py-0.5 ${inv.claimed_by ? "bg-teal-50 text-teal-600" : "bg-gray-50 text-gray-400"}`}>
                                    {inv.claimed_by ? "Claimed" : "Expired"}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-400 mt-0.5">
                                  {inv.claimed_by_email ? `by ${inv.claimed_by_email}` : ""}
                                  {inv.claimed_at ? ` · ${relativeTime(inv.claimed_at)}` : ""}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Add by email */}
                  <div>
                    <p className="text-xs text-gray-400 mb-2 font-medium">Add by email</p>
                    <div className="flex gap-2">
                      <input type="email" value={lookupEmail} onChange={(e) => { setLookupEmail(e.target.value); setLookupResult(null); }} onKeyDown={(e) => { if (e.key === "Enter") lookupUser(); }} placeholder="Email address…" className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-gray-400 min-w-0" />
                      <button type="button" onClick={lookupUser} disabled={lookupLoading || !lookupEmail.trim()} className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:border-gray-400 transition-colors disabled:opacity-40">
                        {lookupLoading ? "Looking…" : "Look up"}
                      </button>
                    </div>
                    {lookupResult && !lookupResult.found && <p className="text-xs text-gray-400 mt-2">No account found for that email.</p>}
                    {lookupResult?.found && (
                      <div className="mt-2 flex items-center justify-between gap-4 border border-gray-100 rounded-lg px-3 py-2">
                        <div>
                          <p className="text-sm text-gray-900">{lookupResult.email}</p>
                          {lookupResult.name && <p className="text-xs text-gray-400">{lookupResult.name}</p>}
                        </div>
                        {lookupResult.role === "admin" ? (
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-teal-600">Already admin</span>
                            <button type="button" onClick={() => { if (!confirm(`Revoke admin access for ${lookupResult.email}?`)) return; revokeAdmin(lookupResult.clerk_id!); }} disabled={revokingAdmin === lookupResult.clerk_id} className="text-xs text-rose-400 hover:text-rose-600 disabled:opacity-40">Revoke</button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => grantAdmin(lookupResult.clerk_id!, lookupResult.email ?? null, lookupResult.name ?? null)} disabled={grantingAdmin} className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors">
                            {grantingAdmin ? "Granting…" : "Make admin"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Invite link */}
                  <div>
                    <p className="text-xs text-gray-400 mb-2 font-medium">Generate invite link</p>
                    <div className="flex flex-wrap gap-2 items-center">
                      {(["24h", "7d", "30d", "custom"] as const).map((preset) => (
                        <button key={preset} type="button" onClick={() => setInviteExpiry(preset)} className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${inviteExpiry === preset ? "bg-indigo-600 text-white border-indigo-600" : "border-gray-200 text-gray-500 hover:border-gray-400"}`}>
                          {preset === "24h" ? "24 hours" : preset === "7d" ? "7 days" : preset === "30d" ? "30 days" : "Custom"}
                        </button>
                      ))}
                      {inviteExpiry === "custom" && <input type="datetime-local" value={inviteCustomDate} onChange={(e) => setInviteCustomDate(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-indigo-400" />}
                      <button type="button" onClick={createInvite} disabled={creatingInvite || (inviteExpiry === "custom" && !inviteCustomDate)} className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:border-indigo-400 hover:text-indigo-600 disabled:opacity-40 transition-colors">
                        {creatingInvite ? "Creating…" : "Generate link"}
                      </button>
                    </div>
                    {newInviteCode && (
                      <div className="mt-2 flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
                        <code className="text-xs text-indigo-800 flex-1 break-all">{newInviteCode}</code>
                        <button type="button" onClick={() => navigator.clipboard.writeText(newInviteCode)} className="text-xs text-indigo-500 hover:text-indigo-700 shrink-0">Copy</button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        {/* Activity */}
        <section>
          <button
            type="button"
            onClick={() => setAuditExpanded((v) => !v)}
            className="flex items-center gap-3 mb-4 group"
          >
            <h2 className="text-xl font-semibold tracking-tight text-gray-900">Activity</h2>
            {!auditLoading && auditLog.length > 0 && <span className="text-xs font-medium bg-gray-100 text-gray-600 rounded-full px-2.5 py-0.5">{auditLog.length}</span>}
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${auditExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
          </button>

          {auditExpanded && (
            <>
              {/* Range + action filters */}
              <div className="flex flex-wrap gap-2 mb-3">
                {(["7d", "30d", "all"] as const).map((r) => (
                  <button key={r} type="button" onClick={() => { setAuditRange(r); loadAuditLog(r); }} className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${auditRange === r ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 text-gray-500 hover:border-gray-400"}`}>
                    {r === "7d" ? "Last 7 days" : r === "30d" ? "Last 30 days" : "All time"}
                  </button>
                ))}
                <div className="w-px bg-gray-100 self-stretch mx-1" />
                <button type="button" onClick={() => setAuditActionFilter(null)} className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${!auditActionFilter ? "bg-gray-100 text-gray-800 border-gray-200" : "border-gray-200 text-gray-400 hover:border-gray-400"}`}>All</button>
                {Object.keys(ACTION_GROUPS).map((group) => (
                  <button key={group} type="button" onClick={() => setAuditActionFilter(auditActionFilter === group ? null : group)} className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${auditActionFilter === group ? "bg-gray-100 text-gray-800 border-gray-200" : "border-gray-200 text-gray-400 hover:border-gray-400"}`}>{group}</button>
                ))}
              </div>

              {/* Active filters + search */}
              <div className="flex flex-wrap gap-2 mb-4">
                <input type="text" value={auditSearch} onChange={(e) => setAuditSearch(e.target.value)} placeholder="Search…" className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-gray-400 w-44" />
                {auditAdminFilter && (
                  <span className="flex items-center gap-1.5 text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full px-2.5 py-1">
                    {auditAdminFilterEmail ?? auditAdminFilter}
                    <button type="button" onClick={() => { setAuditAdminFilter(null); setAuditAdminFilterEmail(null); }} className="text-indigo-400 hover:text-indigo-700 leading-none">×</button>
                  </span>
                )}
                {auditEntityFilter && (
                  <span className="flex items-center gap-1.5 text-xs bg-gray-100 text-gray-700 border border-gray-200 rounded-full px-2.5 py-1">
                    {auditEntityFilterName ?? auditEntityFilter}
                    <button type="button" onClick={() => { setAuditEntityFilter(null); setAuditEntityFilterName(null); }} className="text-gray-400 hover:text-gray-700 leading-none">×</button>
                  </span>
                )}
              </div>

              {auditLoading && <p className="text-sm text-gray-400">Loading…</p>}
              {!auditLoading && filteredAuditLog.length === 0 && <p className="text-sm text-gray-400">No activity in this range.</p>}
              {!auditLoading && filteredAuditLog.length > 0 && (
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  {groupedAuditLog.map(({ label, entries }) => (
                    <div key={label}>
                      <p className="text-xs text-gray-400 font-medium px-4 py-1.5 bg-gray-50 border-b border-gray-100">{label}</p>
                      <div className="divide-y divide-gray-50">
                        {entries.map((entry) => {
                          const isExpanded = expandedEntryId === entry.id;
                          const detail = renderEntryDetail(entry);
                          const entryName = (entry.detail.name as string | undefined) ?? null;
                          return (
                            <div key={entry.id}>
                              <div
                                className={`flex items-start gap-2.5 px-4 py-2.5 ${detail ? "cursor-pointer hover:bg-gray-50" : ""} transition-colors`}
                                onClick={() => detail && setExpandedEntryId(isExpanded ? null : entry.id)}
                              >
                                {/* Admin chip */}
                                <button
                                  type="button"
                                  title={entry.admin_email ?? entry.admin_clerk_id}
                                  onClick={(e) => { e.stopPropagation(); setAuditAdminFilter(entry.admin_clerk_id); setAuditAdminFilterEmail(entry.admin_email); }}
                                  className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-semibold flex items-center justify-center shrink-0 mt-0.5 hover:bg-indigo-200 transition-colors"
                                >
                                  {adminInitials({ email: entry.admin_email, name: entry.admin_name })}
                                </button>
                                <span className={`text-sm ${actionColor(entry.action)} flex-1 min-w-0`}>
                                  {describeAction(entry)}
                                  {entry.action === "update_product" && entry.entity_id && (
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); setAuditEntityFilter(entry.entity_id); setAuditEntityFilterName(entryName); }}
                                      className="ml-1.5 text-xs text-gray-300 hover:text-indigo-500 transition-colors"
                                      title="Filter to this product"
                                    >
                                      ⊙
                                    </button>
                                  )}
                                  {entry.action === "update_product" && entry.entity_id && (
                                    <Link href={`/?scan=${entry.entity_id}`} target="_blank" onClick={(e) => e.stopPropagation()} className="ml-1.5 text-xs text-indigo-400 hover:text-indigo-600">↗</Link>
                                  )}
                                </span>
                                <span title={new Date(entry.created_at).toLocaleString()} className="text-xs text-gray-400 shrink-0 mt-0.5">
                                  {relativeTime(entry.created_at)}
                                </span>
                                {detail && <span className="text-gray-300 text-xs mt-0.5 shrink-0">{isExpanded ? "▲" : "▼"}</span>}
                              </div>
                              {isExpanded && detail && (
                                <div className="px-4 pb-3 ml-9 border-t border-gray-50">
                                  {detail}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

      </main>
    </div>
  );
}
