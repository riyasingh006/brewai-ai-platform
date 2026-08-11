"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, RotateCw, Search, Users } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/dev-auth";
import { cn } from "./ui";
import type { AdminCustomer } from "@/lib/types";

const TIER_META: Record<AdminCustomer["tier"], { label: string; badge: string }> = {
  new: { label: "NEW", badge: "border-sky-400/25 bg-sky-500/10 text-sky-300" },
  active: { label: "ACTIVE", badge: "border-emerald-400/25 bg-emerald-500/10 text-emerald-300" },
  returning: { label: "RETURNING", badge: "border-[#8B5CF6]/30 bg-[#8B5CF6]/10 text-[#a78bfa]" },
};

const STATUS_FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "new", label: "New" },
];

const SORT_OPTIONS: { key: string; label: string }[] = [
  { key: "recent", label: "Most recent" },
  { key: "spend", label: "Highest spend" },
  { key: "points", label: "Most points" },
];

const fmtMoney = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

export function AdminCustomers({ onNotice }: { onNotice: (t: string) => void }) {
  const { devEmail, user } = useAuth();
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("recent");
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!user) return;
      setRefreshing(true);
      try {
        setCustomers(await api.adminCustomers(devEmail, { search, status, sort }));
        setLoaded(true);
      } catch (e) {
        if (!opts?.silent) onNotice(e instanceof Error ? e.message : "Could not load customers.");
      } finally {
        setRefreshing(false);
      }
    },
    [user, devEmail, search, status, sort, onNotice],
  );

  useEffect(() => {
    const id = window.setTimeout(() => void load(), search ? 250 : 0);
    return () => window.clearTimeout(id);
  }, [load, search]);

  useEffect(() => {
    void load({ silent: true });
  }, [status, sort]); // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => {
    if (!loaded) return null;
    const active = customers.filter((c) => c.tier === "active").length;
    const spend = customers.reduce((s, c) => s + c.totalSpend, 0);
    return { count: customers.length, active, spend };
  }, [customers, loaded]);

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
            <h1 className="text-xl font-bold tracking-tight text-[#F5F5F5]">Customers</h1>
            <p className="mt-0.5 text-xs text-[#888]">
              {stats ? `${stats.count} customer${stats.count === 1 ? "" : "s"} · ${stats.active} active · ${fmtMoney(stats.spend)} lifetime` : "Customer insights"}
            </p>
          </div>
          <button
            onClick={() => void load()}
            title="Refresh customers"
            className="grid size-8 place-items-center rounded-[10px] border border-[rgba(255,255,255,0.07)] bg-[#151515] text-[#888] transition-all hover:border-[#D88935]/50 hover:text-[#F5F5F5]"
          >
            <RotateCw className={cn("size-3.5", refreshing && "animate-spin")} />
          </button>
        </motion.div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#555]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email or phone…"
              className="h-9 w-full rounded-[10px] border border-[rgba(255,255,255,0.08)] bg-[#151515] pl-9 pr-3 text-sm text-[#F5F5F5] placeholder:text-[#666] focus:border-[#D88935]/50 focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setStatus(f.key)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  status === f.key
                    ? "border-[#D88935]/40 bg-[#D88935]/12 text-[#e89a45]"
                    : "border-[rgba(255,255,255,0.08)] bg-[#151515] text-[#888] hover:border-[#D88935]/30 hover:text-[#F5F5F5]",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="h-9 cursor-pointer appearance-none rounded-[10px] border border-[rgba(255,255,255,0.08)] bg-[#151515] pl-3 pr-8 text-xs font-medium text-[#d6d6dc] transition-colors hover:border-[#D88935]/40"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3 -translate-y-1/2 text-[#888]" />
          </div>
        </div>

        {!loaded ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-[12px] border border-[rgba(255,255,255,0.06)] bg-[#151515]" />
            ))}
          </div>
        ) : customers.length === 0 ? (
          <div className="grid place-items-center rounded-[12px] border border-[rgba(255,255,255,0.06)] bg-[#151515] py-16 text-center">
            <Users className="mx-auto size-6 text-[#555]" />
            <p className="mt-2 text-xs text-[#888]">No customers found.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[12px] border border-[rgba(255,255,255,0.07)] bg-[#151515]">
            <div className="hidden grid-cols-[1.6fr_0.8fr_0.8fr_0.8fr_0.7fr_0.8fr_0.9fr] gap-3 border-b border-[rgba(255,255,255,0.06)] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[#666] lg:grid">
              <span>Customer</span>
              <span>Tier</span>
              <span>Orders</span>
              <span>Total spend</span>
              <span>AOV</span>
              <span>Points</span>
              <span>Last order</span>
            </div>
            <div className="divide-y divide-[rgba(255,255,255,0.05)]">
              {customers.map((c, i) => {
                const tier = TIER_META[c.tier];
                const initials = (c.name?.trim() || c.email)[0].toUpperCase();
                return (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.3) }}
                    className="grid grid-cols-1 items-center gap-2 px-4 py-3 transition-colors hover:bg-[rgba(255,255,255,0.02)] sm:grid-cols-2 lg:grid-cols-[1.6fr_0.8fr_0.8fr_0.8fr_0.7fr_0.8fr_0.9fr]"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-gradient-to-br from-[#d89b5c] to-[#8a4f1f] text-xs font-bold text-white">
                        {c.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.imageUrl} alt="" className="size-full object-cover" />
                        ) : (
                          initials
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-[#F5F5F5]">{c.name || "—"}</p>
                        <p className="truncate text-[11px] text-[#888]">{c.email}</p>
                      </div>
                    </div>
                    <div>
                      <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[9px] font-bold", tier.badge)}>{tier.label}</span>
                    </div>
                    <div className="text-[13px] font-medium text-[#d6d6dc]">{c.orderCount}</div>
                    <div className="text-[13px] font-semibold text-[#F5F5F5]">{fmtMoney(c.totalSpend)}</div>
                    <div className="hidden text-[13px] text-[#888] lg:block">{fmtMoney(c.avgOrderValue)}</div>
                    <div className="hidden text-[13px] font-semibold text-[#e89a45] lg:block">{c.loyaltyPoints}</div>
                    <div className="hidden text-[11px] text-[#888] lg:block">{fmtDate(c.lastOrderAt)}</div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
