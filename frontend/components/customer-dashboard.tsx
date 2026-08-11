"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Coffee,
  Gift,
  MapPin,
  ShoppingBag,
  Sparkles,
  Timer,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/dev-auth";
import { Button, cn } from "./ui";
import type { CustomerDashboard as DashboardData, DashboardOrder } from "@/lib/types";

const STATUS_META: Record<string, { label: string; badge: string; dot: string }> = {
  pending: { label: "PENDING", badge: "border-amber-500/25 bg-amber-500/10 text-amber-300", dot: "bg-amber-400" },
  confirmed: { label: "CONFIRMED", badge: "border-sky-400/30 bg-sky-500/10 text-sky-300", dot: "bg-sky-400" },
  preparing: { label: "PREPARING", badge: "border-[#D8892F]/30 bg-[#D8892F]/12 text-[#e89a45]", dot: "bg-[#D8892F]" },
  ready: { label: "ON THE WAY", badge: "border-cyan-400/30 bg-cyan-500/10 text-cyan-300", dot: "bg-cyan-400" },
  completed: { label: "COMPLETED", badge: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300", dot: "bg-emerald-400" },
  cancelled: { label: "CANCELLED", badge: "border-red-500/25 bg-red-500/10 text-red-400/90", dot: "bg-red-400/70" },
};

const fmtMoney = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtShort = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });

export function CustomerDashboard({
  onNotice,
  onOpenMenu,
  onOpenOrders,
}: {
  onNotice: (t: string) => void;
  onOpenMenu: () => void;
  onOpenOrders: () => void;
}) {
  const { devEmail, user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setData(await api.meDashboard(devEmail));
      setStatus("ready");
    } catch {
      setStatus("error");
      onNotice("Could not load your dashboard.");
    }
  }, [user, devEmail, onNotice]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 30_000);
    return () => window.clearInterval(id);
  }, [load]);

  const displayName = user?.name?.trim() || "Coffee Lover";
  const firstName = displayName.split(" ")[0];

  if (status === "error") {
    return (
      <div className="grid min-w-0 flex-1 place-items-center">
        <div className="text-center">
          <p className="text-sm text-[#d6d6dc]">Could not load your dashboard.</p>
          <Button variant="secondary" size="sm" className="mt-4" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="grid min-w-0 flex-1 place-items-center">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-[12px] border border-[rgba(255,255,255,0.06)] bg-[#151515]" />
          ))}
        </div>
      </div>
    );
  }

  const s = data.stats;
  const active = data.activeOrder;

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
            <h1 className="text-xl font-bold tracking-tight text-[#F5F5F5]">Welcome back, {firstName}</h1>
            <p className="mt-0.5 text-xs text-[#888]">A look at your coffee journey so far</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#8B5CF6]/25 bg-[#8B5CF6]/10 px-3 py-1.5 text-xs font-semibold text-[#a78bfa]">
              <Sparkles className="size-3" />
              {data.loyalty.tier} member
            </span>
            <Button variant="secondary" size="sm" onClick={onOpenMenu}>
              <Coffee className="size-3.5" /> Order now
            </Button>
          </div>
        </motion.div>

        {active && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[12px] border border-[rgba(216,137,53,0.3)] bg-gradient-to-r from-[#D88935]/12 to-transparent p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-[#D88935]/15 text-[#e89a45]">
                  <Timer className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-[#F5F5F5]">Order {active.orderNumber} in progress</p>
                  <p className="mt-0.5 text-xs text-[#888]">
                    {active.items.map((i) => `${i.quantity}× ${i.name}`).join(" · ")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold", STATUS_META[active.status]?.badge ?? STATUS_META.pending.badge)}>
                  <span className={cn("size-1.5 animate-pulse rounded-full", STATUS_META[active.status]?.dot ?? STATUS_META.pending.dot)} />
                  {STATUS_META[active.status]?.label ?? active.status}
                </span>
                <Button variant="ghost" size="sm" onClick={onOpenOrders}>
                  Track <ArrowRight className="size-3.5" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={<ShoppingBag className="size-3.5" />} tile="bg-[#8B5CF6]/15 text-[#8B5CF6]" label="Total Orders" value={String(s.totalOrders)} />
          <StatCard icon={<Wallet className="size-3.5" />} tile="bg-[#35C98A]/15 text-[#35C98A]" label="Total Spend" value={fmtMoney(s.totalSpend)} />
          <StatCard icon={<Coffee className="size-3.5" />} tile="bg-[#EF476F]/15 text-[#EF476F]" label="Favorite Drink" value={s.favoriteDrink ?? "—"} />
          <StatCard icon={<TrendingUp className="size-3.5" />} tile="bg-[#F59E0B]/15 text-[#F59E0B]" label="Visits · last 30d" value={String(s.visits30d)} />
        </div>

        <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader title="Loyalty Rewards" />
            <div className="mt-3">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-2xl font-bold tracking-tight text-[#F5F5F5]">{data.user.loyaltyPoints}</p>
                  <p className="text-[11px] text-[#888]">points</p>
                </div>
                <span className="text-[11px] font-semibold text-[#a78bfa]">{data.loyalty.tier}</span>
              </div>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
                <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#a78bfa]" />
              </div>
              <p className="mt-2 text-xs text-[#888]">
                {data.loyalty.nextTier
                  ? `${data.loyalty.pointsToNext} pts to ${data.loyalty.nextTier}`
                  : "Top tier unlocked — keep enjoying the perks"}
              </p>
              <div className="mt-4 space-y-2 border-t border-[rgba(255,255,255,0.06)] pt-3 text-xs">
                <p className="flex items-center justify-between text-[#888]">
                  <span>Rewards per order</span>
                  <span className="font-semibold text-[#F5F5F5]">+{data.loyalty.rewardsPerOrder} pts</span>
                </p>
                <p className="flex items-center justify-between text-[#888]">
                  <span>Referral bonus</span>
                  <span className="font-semibold text-[#F5F5F5]">+{data.loyalty.referralReward} pts</span>
                </p>
                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="flex items-center gap-1.5 text-[#888]">
                    <Gift className="size-3" /> Referral code
                  </span>
                  <button
                    onClick={() => {
                      void navigator.clipboard?.writeText(data.user.referralCode ?? "");
                      onNotice("Referral code copied!");
                    }}
                    className="rounded-md border border-[#D88935]/30 bg-[#D88935]/10 px-2 py-1 font-mono text-[11px] font-semibold text-[#e89a45] transition-colors hover:bg-[#D88935]/20"
                  >
                    {data.user.referralCode}
                  </button>
                </div>
              </div>
            </div>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader title="Recent Orders" />
            <div className="mt-2">
              {data.recentOrders.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-xs text-[#888]">No orders yet.</p>
                  <Button size="sm" className="mt-4" onClick={onOpenMenu}>
                    <MapPin className="size-3.5" /> Browse the menu
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-[rgba(255,255,255,0.06)]">
                  {data.recentOrders.map((o) => (
                    <OrderRow key={o.id} order={o} onClick={onOpenOrders} />
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, tile, label, value }: { icon: React.ReactNode; tile: string; label: string; value: string }) {
  return (
    <div className="rounded-[12px] border border-[rgba(255,255,255,0.07)] bg-[#151515] p-3.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[#888]">{label}</p>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <p className="truncate text-lg font-bold tracking-tight text-[#F5F5F5]">{value}</p>
        <span className={cn("grid size-7 shrink-0 place-items-center rounded-lg", tile)}>{icon}</span>
      </div>
    </div>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-[12px] border border-[rgba(255,255,255,0.07)] bg-[#151515] p-3.5", className)}>
      {children}
    </div>
  );
}

function CardHeader({ title }: { title: string }) {
  return <h2 className="text-sm font-semibold text-[#F5F5F5]">{title}</h2>;
}

function OrderRow({ order, onClick }: { order: DashboardOrder; onClick: () => void }) {
  const meta = STATUS_META[order.status] ?? STATUS_META.pending;
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 py-2.5 text-left transition-colors hover:bg-[rgba(255,255,255,0.02)]"
    >
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium text-[#F5F5F5]">
          {order.orderNumber}
          <span className="ml-2 hidden text-xs font-normal text-[#888] sm:inline">
            {order.items.map((i) => `${i.quantity}× ${i.name}`).join(" · ")}
          </span>
        </p>
        <p className="mt-0.5 text-[11px] text-[#888]">{fmtShort(order.createdAt)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="text-sm font-semibold text-[#F5F5F5]">{fmtMoney(order.total)}</span>
        <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold", meta.badge)}>
          <span className={cn("size-1.5 rounded-full", meta.dot)} />
          {meta.label}
        </span>
      </div>
    </button>
  );
}
