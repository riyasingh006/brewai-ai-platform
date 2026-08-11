"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Pencil, Plus, RotateCw, Search, Star, Trash2, X } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/dev-auth";
import { Button, Input, Textarea, cn } from "./ui";
import { imageForName } from "./menu-panel";
import type { MenuItem } from "@/lib/types";

const fmtMoney = (n: number) => `$${n.toFixed(2)}`;

type Draft = {
  name: string;
  category: string;
  price: string;
  description: string;
  imageUrl: string;
  available: boolean;
  featured: boolean;
  tags: string;
};

const EMPTY_DRAFT: Draft = {
  name: "",
  category: "Beverages",
  price: "",
  description: "",
  imageUrl: "",
  available: true,
  featured: false,
  tags: "",
};

function toDraft(item: MenuItem): Draft {
  return {
    name: item.name,
    category: item.category,
    price: String(item.price),
    description: item.description ?? "",
    imageUrl: item.imageUrl ?? "",
    available: item.available,
    featured: item.tags?.includes("featured") ?? item.featured ?? false,
    tags: (item.tags ?? []).filter((t) => t !== "featured").join(", "),
  };
}

export function MenuManager({ onNotice }: { onNotice: (t: string) => void }) {
  const { devEmail, user } = useAuth();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [editing, setEditing] = useState<MenuItem | "new" | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      setItems(await api.menu(devEmail));
      setLoaded(true);
    } catch (e) {
      onNotice(e instanceof Error ? e.message : "Could not load the menu.");
    } finally {
      setRefreshing(false);
    }
  }, [user, devEmail, onNotice]);

  useEffect(() => {
    void load();
  }, [load]);

  const categories = useMemo(() => {
    const set = new Set(items.map((i) => i.category));
    return ["All", ...Array.from(set).sort()];
  }, [items]);

  const visible = useMemo(() => {
    return items.filter((i) => {
      const matchQuery = !query || i.name.toLowerCase().includes(query.toLowerCase());
      const matchCat = category === "All" || i.category === category;
      return matchQuery && matchCat;
    });
  }, [items, query, category]);

  const saveItem = useCallback(
    async (draft: Draft) => {
      if (!user) return;
      const price = Number.parseFloat(draft.price);
      if (!draft.name.trim() || Number.isNaN(price) || price <= 0) {
        onNotice("Name and a valid price are required.");
        return;
      }
      setSaving(true);
      try {
        const tags = draft.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
        const payload = {
          name: draft.name.trim(),
          category: draft.category.trim() || "Beverages",
          price,
          description: draft.description.trim(),
          imageUrl: draft.imageUrl.trim() || null,
          available: draft.available,
          featured: draft.featured,
          tags,
        };
        if (editing === "new") {
          await api.adminCreateMenuItem(devEmail, payload);
          onNotice("Menu item created.");
        } else if (editing) {
          await api.adminUpdateMenuItem(devEmail, editing.id, payload);
          onNotice("Menu item updated.");
        }
        setEditing(null);
        void load();
      } catch (e) {
        onNotice(e instanceof Error ? e.message : "Could not save the item.");
      } finally {
        setSaving(false);
      }
    },
    [user, devEmail, editing, load, onNotice],
  );

  const toggleAvailable = useCallback(
    async (item: MenuItem) => {
      if (!user) return;
      try {
        await api.adminUpdateMenuItem(devEmail, item.id, { available: !item.available });
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, available: !i.available } : i)));
      } catch (e) {
        onNotice(e instanceof Error ? e.message : "Could not toggle availability.");
      }
    },
    [user, devEmail, onNotice],
  );

  const toggleFeatured = useCallback(
    async (item: MenuItem) => {
      if (!user) return;
      const featured = !(item.tags?.includes("featured") ?? item.featured ?? false);
      try {
        await api.adminUpdateMenuItem(devEmail, item.id, { featured });
        setItems((prev) =>
          prev.map((i) => {
            if (i.id !== item.id) return i;
            const tags = featured ? [...(i.tags ?? []), "featured"] : (i.tags ?? []).filter((t) => t !== "featured");
            return { ...i, featured, tags };
          }),
        );
      } catch (e) {
        onNotice(e instanceof Error ? e.message : "Could not update the item.");
      }
    },
    [user, devEmail, onNotice],
  );

  const deleteItem = useCallback(
    async (item: MenuItem) => {
      if (!user || deletingId) return;
      if (!window.confirm(`Delete "${item.name}" from the menu?`)) return;
      setDeletingId(item.id);
      try {
        await api.adminDeleteMenuItem(devEmail, item.id);
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        onNotice("Menu item deleted.");
      } catch (e) {
        onNotice(e instanceof Error ? e.message : "Could not delete the item.");
      } finally {
        setDeletingId(null);
      }
    },
    [user, devEmail, deletingId, onNotice],
  );

  return (
    <div className="relative min-w-0 flex-1 overflow-y-auto bg-[#0b0b0d] px-4 py-4">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(70%_100%_at_50%_0%,rgba(216,137,53,0.07),transparent_70%)]" />
      <div className="relative mx-auto max-w-6xl space-y-2.5">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-start justify-between gap-3 pb-1"
        >
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#F5F5F5]">Menu Manager</h1>
            <p className="mt-0.5 text-xs text-[#888]">Create, edit and feature items in the live catalog</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void load()}
              title="Refresh menu"
              className="grid size-8 place-items-center rounded-[10px] border border-[rgba(255,255,255,0.07)] bg-[#151515] text-[#888] transition-all hover:border-[#D88935]/50 hover:text-[#F5F5F5]"
            >
              <RotateCw className={cn("size-3.5", refreshing && "animate-spin")} />
            </button>
            <Button size="sm" onClick={() => setEditing("new")}>
              <Plus className="size-3.5" /> Add item
            </Button>
          </div>
        </motion.div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#555]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the menu…"
              className="h-9 w-full rounded-[10px] border border-[rgba(255,255,255,0.08)] bg-[#151515] pl-9 pr-3 text-sm text-[#F5F5F5] placeholder:text-[#666] focus:border-[#D88935]/50 focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  category === c
                    ? "border-[#D88935]/40 bg-[#D88935]/12 text-[#e89a45]"
                    : "border-[rgba(255,255,255,0.08)] bg-[#151515] text-[#888] hover:border-[#D88935]/30 hover:text-[#F5F5F5]",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {!loaded ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-[12px] border border-[rgba(255,255,255,0.06)] bg-[#151515]" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="grid place-items-center rounded-[12px] border border-[rgba(255,255,255,0.06)] bg-[#151515] py-16 text-center">
            <p className="text-xs text-[#888]">No items match your filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((item, i) => {
              const featured = item.tags?.includes("featured") ?? item.featured ?? false;
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-[12px] border bg-[#151515] p-3",
                    item.available ? "border-[rgba(255,255,255,0.07)]" : "border-[rgba(255,255,255,0.05)] opacity-60",
                  )}
                >
                  <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-gradient-to-br from-[#D88935]/25 to-[#D88935]/5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageForName(item.name)} alt={item.name} loading="lazy" className="size-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-[13px] font-semibold text-[#F5F5F5]">{item.name}</p>
                      {featured && <Star className="size-3 shrink-0 fill-[#F59E0B] text-[#F59E0B]" />}
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-[#888]">
                      {item.category} · {fmtMoney(item.price)}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <Toggle
                        active={item.available}
                        onLabel="Available"
                        offLabel="Hidden"
                        onClick={() => void toggleAvailable(item)}
                      />
                      <button
                        onClick={() => void toggleFeatured(item)}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors",
                          featured
                            ? "border-[#F59E0B]/30 bg-[#F59E0B]/10 text-[#F59E0B]"
                            : "border-[rgba(255,255,255,0.08)] text-[#888] hover:border-[#F59E0B]/30 hover:text-[#F59E0B]",
                        )}
                      >
                        <Star className="size-2.5" />
                        Featured
                      </button>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={() => setEditing(item)}
                        title="Edit item"
                        className="grid size-7 place-items-center rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0f0f0f] text-[#888] transition-colors hover:border-[#D88935]/40 hover:text-[#e89a45]"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        onClick={() => void deleteItem(item)}
                        disabled={deletingId === item.id}
                        title="Delete item"
                        className="grid size-7 place-items-center rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0f0f0f] text-[#888] transition-colors hover:border-red-500/40 hover:text-red-400 disabled:opacity-50"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                    <span className="font-mono text-[10px] text-[#555]">#{item.id}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {editing && (
          <Editor
            item={editing === "new" ? null : editing}
            saving={saving}
            onClose={() => setEditing(null)}
            onSave={saveItem}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function Toggle({ active, onLabel, offLabel, onClick }: { active: boolean; onLabel: string; offLabel: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors",
        active
          ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
          : "border-[rgba(255,255,255,0.08)] text-[#888] hover:text-[#F5F5F5]",
      )}
    >
      <span className={cn("size-1.5 rounded-full", active ? "bg-emerald-400" : "bg-[#555]")} />
      {active ? onLabel : offLabel}
    </button>
  );
}

function Editor({
  item,
  saving,
  onClose,
  onSave,
}: {
  item: MenuItem | null;
  saving: boolean;
  onClose: () => void;
  onSave: (draft: Draft) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => (item ? toDraft(item) : EMPTY_DRAFT));
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 14, scale: 0.98 }}
        transition={{ duration: 0.18 }}
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.1)] bg-[#121212] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] px-5 py-4">
          <h2 className="text-sm font-semibold text-[#F5F5F5]">{item ? `Edit ${item.name}` : "Add menu item"}</h2>
          <button onClick={onClose} className="grid size-7 place-items-center rounded-lg text-[#888] transition-colors hover:bg-[#1a1a1a] hover:text-[#F5F5F5]">
            <X className="size-4" />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-3 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="Name" value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Salted Caramel Latte" />
            <Input label="Category" value={draft.category} onChange={(e) => set("category", e.target.value)} placeholder="Beverages" list="menu-categories" />
          </div>
          <datalist id="menu-categories">
            {["Beverages", "Coffee", "Cold Coffee", "Tea", "Hot Chocolate", "Snacks", "Desserts", "Seasonal"].map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="Price (USD)" type="number" min="0" step="0.01" value={draft.price} onChange={(e) => set("price", e.target.value)} placeholder="4.50" />
            <Input label="Image URL" value={draft.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} placeholder="https://…" />
          </div>
          <div>
            <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Description</span>
            <Textarea
              value={draft.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="What makes this drink special?"
              rows={3}
            />
          </div>
          <Input label="Tags (comma separated)" value={draft.tags} onChange={(e) => set("tags", e.target.value)} placeholder="popular, seasonal" />

          <div className="flex flex-wrap items-center gap-4 pt-1">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-[#d6d6dc]">
              <input type="checkbox" checked={draft.available} onChange={(e) => set("available", e.target.checked)} className="size-3.5 accent-[#D88935]" />
              Available to order
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-[#d6d6dc]">
              <input type="checkbox" checked={draft.featured} onChange={(e) => set("featured", e.target.checked)} className="size-3.5 accent-[#F59E0B]" />
              <Star className={cn("size-3", draft.featured ? "fill-[#F59E0B] text-[#F59E0B]" : "text-[#555]")} />
              Featured
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[rgba(255,255,255,0.06)] px-5 py-4">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" loading={saving} onClick={() => onSave(draft)}>
            {item ? "Save changes" : "Create item"}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
