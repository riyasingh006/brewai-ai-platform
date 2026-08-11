"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Award,
  Check,
  Coffee,
  Flame,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { motion } from "framer-motion";
import { api, getDevEmail } from "@/lib/api";
import type { MenuItem } from "@/lib/types";
import { Button, Input, cn } from "./ui";

const REFERENCE_CATEGORIES = [
  "All",
  "Coffee",
  "Cold Coffee",
  "Tea",
  "Sandwiches",
  "Desserts",
];

const GENERIC_IMAGE = "/images/menu/generic.svg";

const LEGACY_PHOTOS: Record<string, string> = {
  "Caramel Macchiato": "/images/menu/caramel-macchiato.png",
};

const PHOTO_NAMES = new Set([
  "Americano",
  "Avocado Toast",
  "Bacon BBQ Burger",
  "Butter Croissant",
  "Buttermilk Pancakes",
  "Cappuccino",
  "Caprese Sandwich",
  "Caramel Frappe",
  "Chai Latte",
  "Chicken Alfredo Pasta",
  "Chicken Pesto Sandwich",
  "Classic Cheeseburger",
  "Cold Brew",
  "Cortado",
  "Double Chocolate Brownie",
  "Earl Grey",
  "Egg & Bacon Bagel",
  "Espresso",
  "Flat White",
  "Green Detox Smoothie",
  "Green Tea",
  "Iced Americano",
  "Iced Latte",
  "Jasmine Tea",
  "Java Chip Frappe",
  "Latte",
  "Mango Dragonfruit Refresher",
  "Mango Smoothie",
  "Margherita Pizza",
  "Matcha Latte",
  "Mocha Frappe",
  "New York Cheesecake",
  "Nitro Cold Brew",
  "Passion Tango Refresher",
  "Pesto Penne",
  "Spaghetti Bolognese",
  "Strawberry Acai Refresher",
  "Strawberry Banana Smoothie",
  "Turkey & Swiss Sandwich",
  "Veggie Burger",
  "Veggie Delight Sandwich",
  "Veggie Supreme Pizza",
  "Vanilla Bean Frappe",
]);

const IMAGE_MAP: Record<string, string> = {
  Espresso: "/images/menu/espresso.svg",
  Cortado: "/images/menu/espresso.svg",
  Americano: "/images/menu/espresso.svg",
  Cappuccino: "/images/menu/cappuccino.svg",
  Latte: "/images/menu/latte.svg",
  "Flat White": "/images/menu/latte.svg",
  "Cold Brew": "/images/menu/cold-brew.svg",
  "Iced Americano": "/images/menu/cold-brew.svg",
  "Iced Latte": "/images/menu/cold-brew.svg",
  "Nitro Cold Brew": "/images/menu/cold-brew.svg",
  "Mango Dragonfruit Refresher": "/images/menu/cold-brew.svg",
  "Strawberry Acai Refresher": "/images/menu/cold-brew.svg",
  "Passion Tango Refresher": "/images/menu/cold-brew.svg",
  "Strawberry Banana Smoothie": "/images/menu/cold-brew.svg",
  "Mango Smoothie": "/images/menu/cold-brew.svg",
  "Green Detox Smoothie": "/images/menu/cold-brew.svg",
  "Mocha Frappe": "/images/menu/mocha-frappe.svg",
  "Caramel Frappe": "/images/menu/mocha-frappe.svg",
  "Java Chip Frappe": "/images/menu/mocha-frappe.svg",
  "Vanilla Bean Frappe": "/images/menu/mocha-frappe.svg",
  "Caramel Macchiato": "/images/menu/caramel-macchiato.svg",
  "Matcha Latte": "/images/menu/matcha-latte.svg",
  "Green Tea": "/images/menu/matcha-latte.svg",
  "Jasmine Tea": "/images/menu/matcha-latte.svg",
  "Earl Grey": "/images/menu/tea.svg",
  "Peppermint Tea": "/images/menu/tea.svg",
  "Chai Latte": "/images/menu/tea.svg",
  "Double Chocolate Brownie": "/images/menu/dessert.svg",
  "New York Cheesecake": "/images/menu/dessert.svg",
  "Butter Croissant": "/images/menu/dessert.svg",
  "Blueberry Muffin": "/images/menu/dessert.svg",
  "Turkey & Swiss Sandwich": "/images/menu/sandwich.svg",
  "Chicken Pesto Sandwich": "/images/menu/sandwich.svg",
  "Caprese Sandwich": "/images/menu/sandwich.svg",
  "Veggie Delight Sandwich": "/images/menu/sandwich.svg",
  "Margherita Pizza": "/images/menu/sandwich.svg",
  "Pepperoni Pizza": "/images/menu/sandwich.svg",
  "Veggie Supreme Pizza": "/images/menu/sandwich.svg",
  "Classic Cheeseburger": "/images/menu/sandwich.svg",
  "Bacon BBQ Burger": "/images/menu/sandwich.svg",
  "Veggie Burger": "/images/menu/sandwich.svg",
  "Chicken Alfredo Pasta": "/images/menu/sandwich.svg",
  "Spaghetti Bolognese": "/images/menu/sandwich.svg",
  "Pesto Penne": "/images/menu/sandwich.svg",
  "Buttermilk Pancakes": "/images/menu/sandwich.svg",
  "Avocado Toast": "/images/menu/sandwich.svg",
  "Egg & Bacon Bagel": "/images/menu/sandwich.svg",
};

function imageFor(item: MenuItem): string {
  if (item.imageUrl) return item.imageUrl;
  return imageForName(item.name);
}

export function imageForName(name: string): string {
  if (PHOTO_NAMES.has(name))
    return `/images/menu/${encodeURIComponent(name)}.jpg`;
  if (LEGACY_PHOTOS[name]) return LEGACY_PHOTOS[name];
  return IMAGE_MAP[name] ?? GENERIC_IMAGE;
}

type SortMode = "featured" | "price-asc" | "price-desc";

function MenuItemImage({ item }: { item: MenuItem }) {
  const [src, setSrc] = useState<string>(() => imageFor(item));
  const [failed, setFailed] = useState(false);

  return (
    <div className="relative aspect-[3/4] overflow-hidden bg-[#0d0c0e]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(70% 70% at 50% 42%, rgba(216,155,92,0.18), transparent 72%)",
        }}
        aria-hidden
      />
      {!failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={item.name}
          loading="lazy"
          onError={() => {
            if (src !== GENERIC_IMAGE) setSrc(GENERIC_IMAGE);
            else setFailed(true);
          }}
          className="relative h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04]"
        />
      )}
    </div>
  );
}

export function MenuPanel({
  menu,
  onAdd,
}: {
  menu: MenuItem[];
  onAdd: (item: MenuItem) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState<SortMode>("featured");
  const [onlyBest, setOnlyBest] = useState(false);
  const [onlyNew, setOnlyNew] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [added, setAdded] = useState<Record<number, boolean>>({});
  const [spotlight, setSpotlight] = useState<number | null>(null);
  const [bestSellers, setBestSellers] = useState<Set<string>>(new Set());
  const [newItems, setNewItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    const email = getDevEmail();
    if (!email) return;
    api
      .trending(email)
      .then((t) => {
        setBestSellers(new Set(t.bestSellers.map((i) => i.name)));
        setNewItems(new Set(t.new.map((i) => i.name)));
      })
      .catch(() => {});
  }, []);

  const pills = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const label of REFERENCE_CATEGORIES) {
      list.push(label);
      seen.add(label);
    }
    for (const item of menu) {
      if (!seen.has(item.category)) {
        seen.add(item.category);
        list.push(item.category);
      }
    }
    return list;
  }, [menu]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = menu.filter((item) => {
      if (
        category !== "All" &&
        item.category.toLowerCase() !== category.toLowerCase()
      ) {
        return false;
      }
      if (
        q &&
        !item.name.toLowerCase().includes(q) &&
        !item.description.toLowerCase().includes(q)
      ) {
        return false;
      }
      if (!item.available) return false;
      if (onlyBest && !bestSellers.has(item.name)) return false;
      if (
        onlyNew &&
        !(newItems.has(item.name) || item.tags.includes("new"))
      ) {
        return false;
      }
      return true;
    });
    if (sort === "price-asc") list = [...list].sort((a, b) => a.price - b.price);
    else if (sort === "price-desc")
      list = [...list].sort((a, b) => b.price - a.price);
    return list;
  }, [menu, query, category, sort, onlyBest, onlyNew, bestSellers, newItems]);

  const featured = useMemo(
    () => menu.find((i) => i.available && i.tags.includes("popular")) ?? menu[0],
    [menu],
  );

  const add = (item: MenuItem) => {
    onAdd(item);
    setAdded((p) => ({ ...p, [item.id]: true }));
    setTimeout(() => setAdded((p) => ({ ...p, [item.id]: false })), 1200);
  };

  const focusFeatured = () => {
    setCategory("All");
    setQuery("");
    setSort("featured");
    setOnlyBest(false);
    setOnlyNew(false);
    setFilterOpen(false);
    setSpotlight(featured?.id ?? null);
    if (featured) setTimeout(() => setSpotlight(null), 1800);
    requestAnimationFrame(() => {
      document
        .getElementById(`menu-item-${featured?.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  const badge = (item: MenuItem) => {
    if (bestSellers.has(item.name)) return { label: "Bestseller", icon: Award };
    if (item.tags.includes("popular")) return { label: "Popular", icon: Flame };
    if (item.tags.includes("new") || newItems.has(item.name))
      return { label: "New", icon: Sparkles };
    return null;
  };

  const resetFilters = () => {
    setQuery("");
    setCategory("All");
    setSort("featured");
    setOnlyBest(false);
    setOnlyNew(false);
  };

  const filtersActive =
    query !== "" ||
    category !== "All" ||
    sort !== "featured" ||
    onlyBest ||
    onlyNew;

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="border-b border-[var(--border)] px-5 py-5 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">Menu</h1>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Discover your perfect brew
              </p>
            </div>
            {featured && (
              <button
                onClick={focusFeatured}
                className="flex shrink-0 items-center gap-2.5 rounded-full border border-[#8a5a2a]/50 bg-gradient-to-br from-[#3a2a18] to-[#221910] py-1.5 pl-3 pr-2 shadow-[0_0_22px_rgba(216,155,92,0.22)] transition-all hover:border-[#c98642]/70 hover:shadow-[0_0_28px_rgba(216,155,92,0.4)]"
              >
                <Coffee className="size-4 text-[#e0a25a]" />
                <span className="flex flex-col items-start">
                  <span className="text-[11px] font-bold tracking-wide text-[#e0a25a]">
                    Today&apos;s Special
                  </span>
                  <span className="text-[10px] text-[var(--muted)]">
                    {featured.name}
                  </span>
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/menu/Espresso.jpg"
                  alt=""
                  aria-hidden
                  className="size-8 rounded-full object-cover ring-1 ring-[#8a5a2a]/60"
                />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <div className="relative w-full sm:w-[320px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]" />
              <Input
                placeholder="Search drinks, pastries, meals…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-10 bg-[#151518]/90 pl-10 pr-4"
              />
            </div>
            <Button
              variant="secondary"
              aria-label="Toggle menu filters"
              aria-pressed={filterOpen}
              onClick={() => setFilterOpen((v) => !v)}
              className={cn(
                "size-10 shrink-0 p-0",
                filterOpen &&
                  "border-[var(--brand)]/50 text-[var(--brand-hover)]",
              )}
            >
              <SlidersHorizontal className="size-4" />
            </Button>
          </div>

          {filterOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-[var(--border)] bg-[var(--panel)]/70 p-3.5"
            >
              <label className="text-xs text-[var(--muted)]">Sort</label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortMode)}
                className="h-8 rounded-lg border border-[var(--border)] bg-[#151518] px-2 text-xs text-[var(--fg)] focus:border-[var(--brand)]/50 focus:outline-none"
              >
                <option value="featured">Featured</option>
                <option value="price-asc">Price: low to high</option>
                <option value="price-desc">Price: high to low</option>
              </select>
              <div className="mx-1 hidden h-5 w-px bg-[var(--border)] sm:block" />
              <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--muted)]">
                <input
                  type="checkbox"
                  checked={onlyBest}
                  onChange={(e) => setOnlyBest(e.target.checked)}
                  className="accent-[#c98642]"
                />
                Bestsellers
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--muted)]">
                <input
                  type="checkbox"
                  checked={onlyNew}
                  onChange={(e) => setOnlyNew(e.target.checked)}
                  className="accent-[#c98642]"
                />
                New arrivals
              </label>
              {filtersActive && (
                <Button variant="ghost" size="sm" onClick={resetFilters}>
                  Reset
                </Button>
              )}
            </motion.div>
          )}

          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 no-scrollbar">
            {pills.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                aria-pressed={category === cat}
                className={cn(
                  "shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-all",
                  category === cat
                    ? "bg-gradient-to-br from-[#d89b5c] to-[#a96a2e] text-white shadow-md shadow-[#c98642]/40"
                    : "border border-[var(--border)] bg-[#151518]/70 text-[var(--muted)] hover:border-[#c98642]/30 hover:text-[var(--secondary)]",
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="relative flex-1 overflow-y-auto px-5 py-6 sm:px-6">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-80"
          style={{
            background:
              "radial-gradient(60% 90% at 50% 0%, rgba(201,134,66,0.10), transparent 70%)",
          }}
          aria-hidden
        />
        <div className="relative mx-auto grid max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item, i) => {
            const b = badge(item);
            return (
              <motion.div
                key={item.id}
                id={`menu-item-${item.id}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.35) }}
                className={cn(
                  "group overflow-hidden rounded-2xl border border-[#3a2c1c]/60 bg-gradient-to-b from-[#1c1814] to-[#14120f] shadow-[0_14px_40px_-20px_rgba(0,0,0,0.9)] transition-all duration-300 hover:-translate-y-1 hover:border-[#c98642]/40 hover:shadow-[0_22px_50px_-20px_rgba(201,134,66,0.45)]",
                  spotlight === item.id &&
                    "ring-2 ring-[#e0a25a] shadow-[0_0_30px_rgba(216,155,92,0.5)]",
                )}
              >
                <div className="relative">
                  <MenuItemImage item={item} />
                  {b && (
                    <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-[#8a5a2a]/50 bg-[#2a1d10]/90 px-2.5 py-1 text-[10px] font-bold text-[#e0a25a] shadow-[0_0_14px_rgba(216,155,92,0.35)]">
                      <b.icon className="size-3" /> {b.label}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-1 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="truncate text-[15px] font-bold text-[#f4ede3]">
                      {item.name}
                    </h3>
                    <p className="shrink-0 text-[15px] font-bold text-[#e0a25a]">
                      ${item.price.toFixed(2)}
                    </p>
                  </div>
                  <p className="line-clamp-1 text-xs text-[var(--muted)]">
                    {item.description}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[11px] text-[var(--muted)]">
                      {item.category}
                    </span>
                    <button
                      onClick={() => add(item)}
                      className={cn(
                        "inline-flex h-8 items-center gap-1 rounded-lg px-3 text-xs font-semibold transition-all duration-300 active:scale-95",
                        added[item.id]
                          ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                          : "border border-[#3a2c1c] bg-[#241b13] text-[#e0a25a] hover:border-[#8a5a2a] hover:bg-[#2f2215] hover:text-[#eab475] hover:shadow-[0_0_16px_rgba(216,155,92,0.35)]",
                      )}
                    >
                      {added[item.id] ? (
                        <>
                          <Check className="size-3.5" /> Added
                        </>
                      ) : (
                        <>
                          <Plus className="size-3.5" /> Add
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
          {!filtered.length && (
            <p className="col-span-full py-16 text-center text-sm text-[var(--muted)]">
              No menu items match your filters.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
