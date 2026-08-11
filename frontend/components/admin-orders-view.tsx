"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, RotateCw, ShoppingBag } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/dev-auth";
import { Button, cn } from "./ui";
import type { AdminOrder } from "@/lib/types";

export const ORDER_FLOW = ["pending", "confirmed", "preparing", "ready", "completed"] as const;
export type Status = (typeof ORDER_FLOW)[number] | "cancelled";

export const STATUS_META: Record<Status, { label: string; badge: string; dot: string }> = {
  pending: { label: "PENDING", badge: "border-amber-500/25 bg-amber-500/10 text-amber-300", dot: "bg-amber-400" },
  confirmed: { label: "CONFIRMED", badge: "border-sky-400/30 bg-sky-500/10 text-sky-300", dot: "bg-sky-400" },
  preparing: { label: "PREPARING", badge: "border-[#D8892F]/30 bg-[#D8892F]/12 text-[#e89a45]", dot: "bg-[#D8892F]" },
  ready: { label: "READY", badge: "border-cyan-400/30 bg-cyan-500/10 text-cyan-300", dot: "bg-cyan-400" },
  completed: { label: "COMPLETED", badge: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300", dot: "bg-emerald-400" },
  cancelled: { label: "CANCELLED", badge: "border-red-500/25 bg-red-500/10 text-red-400/90", dot: "bg-red-400/70" },
};

const FILTERS: { key: Status | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "preparing", label: "Preparing" },
  { key: "ready", label: "Ready" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

const fmtMoney = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: true });

export function AdminOrdersView({ onNotice }: { onNotice: (t: string) => void }) {
  const { devEmail, user } = useAuth();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [filter, setFilter] = useState<Status | "all">("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!user) return;
      setRefreshing(true);
      try {
        setOrders(await api.adminOrders(devEmail));
        setLoaded(true);
      } catch (e) {
        if (!opts?.silent) onNotice(e instanceof Error ? e.message : "Could not load orders.");
      } finally {
        setRefreshing(false);
      }
    },
    [user, devEmail, onNotice],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void load({ silent: true });
    }, 15_000);
    return () => window.clearInterval(id);
  }, [load]);

  const updateStatus = useCallback(
    async (order: AdminOrder, status: Status) => {
      if (!user) return;
      setBusyId(order.id);
      try {
        await api.adminUpdateStatus(devEmail, order.id, status);
        setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status } : o)));
      } catch (e) {
        onNotice(e instanceof Error ? e.message : "Could not update status.");
      } finally {
        setBusyId(null);
      }
    },
    [user, devEmail, onNotice],
  );

  const visible = useMemo(
    () => (filter === "all" ? orders : orders.filter((o) => o.status === filter)),
    [orders, filter],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: orders.length };
    for (const o of orders) c[o.status] = (c[o.status] ?? 0) + 1;
    return c;
  }, [orders]);

  const nextStatus = (s: Status): Status => {
    const idx = ORDER_FLOW.indexOf(s as (typeof ORDER_FLOW)[number]);
    if (idx >= 0 && idx < ORDER_FLOW.length - 1) return ORDER_FLOW[idx + 1];
    return s;
  };

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
            <h1 className="text-xl font-bold tracking-tight text-[#F5F5F5]">Orders</h1>
            <p className="mt-0.5 text-xs text-[#888]">Live order queue · auto-refreshes</p>
          </div>
          <button
            onClick={() => void load()}
            title="Refresh orders"
            className="grid size-8 place-items-center rounded-[10px] border border-[rgba(255,255,255,0.07)] bg-[#151515] text-[#888] transition-all hover:border-[#D88935]/50 hover:text-[#F5F5F5]"
          >
            <RotateCw className={cn("size-3.5", refreshing && "animate-spin")} />
          </button>
        </motion.div>

        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                filter === f.key
                  ? "border-[#D88935]/40 bg-[#D88935]/12 text-[#e89a45]"
                  : "border-[rgba(255,255,255,0.08)] bg-[#151515] text-[#888] hover:border-[#D88935]/30 hover:text-[#F5F5F5]",
              )}
            >
              {f.label}
              <span className="ml-1.5 font-mono text-[10px] opacity-70">{counts[f.key] ?? 0}</span>
            </button>
          ))}
        </div>

        {!loaded ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-[12px] border border-[rgba(255,255,255,0.06)] bg-[#151515]" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="grid place-items-center rounded-[12px] border border-[rgba(255,255,255,0.06)] bg-[#151515] py-16 text-center">
            <ShoppingBag className="mx-auto size-6 text-[#555]" />
            <p className="mt-2 text-xs text-[#888]">No orders{filter !== "all" ? ` with status "${filter}"` : ""}.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {visible.map((o, i) => {
              const meta = STATUS_META[o.status as Status] ?? STATUS_META.pending;
              const next = nextStatus(o.status as Status);
              const busy = busyId === o.id;
              return (
                <motion.div
                  key={o.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[rgba(255,255,255,0.07)] bg-[#151515] px-3.5 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="hidden size-9 shrink-0 place-items-center rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0f0f0f] text-xs font-bold text-[#e89a45] sm:grid">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-[13px] font-semibold text-[#F5F5F5]">
                        {o.orderNumber}
                        {o.invoice && <span className="hidden rounded border border-[rgba(255,255,255,0.08)] px-1.5 py-0.5 font-mono text-[9px] text-[#888] md:inline">{o.invoice}</span>}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-[#888]">
                        {o.customer ?? "Guest"} · {o.itemCount} item{o.itemCount === 1 ? "" : "s"} · {fmtTime(o.createdAt)}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[9px] font-bold", meta.badge)}>
                          <span className={cn("size-1.5 rounded-full", meta.dot)} />
                          {meta.label}
                        </span>
                        <span className="text-[10px] uppercase tracking-wide text-[#555]">{o.paymentMethod} · {o.paymentStatus}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2.5">
                    <span className="text-sm font-bold text-[#F5F5F5]">{fmtMoney(o.total)}</span>
                    <StatusSelect
                      value={o.status as Status}
                      disabled={busy}
                      onChange={(s) => void updateStatus(o, s)}
                    />
                    {o.status !== "cancelled" && o.status !== "completed" && (
                      <Button variant="secondary" size="sm" loading={busy} onClick={() => void updateStatus(o, next)}>
                        <ChevronDown className="size-3 rotate-[-90deg]" />
                        {STATUS_META[next].label}
                      </Button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusSelect({
  value,
  disabled,
  onChange,
}: {
  value: Status;
  disabled?: boolean;
  onChange: (s: Status) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as Status)}
        className="h-9 cursor-pointer appearance-none rounded-[9px] border border-[rgba(255,255,255,0.08)] bg-[#0f0f0f] pl-3 pr-8 text-xs font-medium text-[#d6d6dc] transition-colors hover:border-[#D88935]/40 disabled:opacity-50"
      >
        {[...ORDER_FLOW, "cancelled" as const].map((s) => (
          <option key={s} value={s}>
            {STATUS_META[s].label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3 -translate-y-1/2 text-[#888]" />
    </div>
  );
}
