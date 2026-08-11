"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  ChevronDown,
  DollarSign,
  Gauge,
  RefreshCw,
  RotateCw,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { animate, motion } from "framer-motion";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/dev-auth";
import { Button, cn } from "./ui";
import { imageForName } from "./menu-panel";
import { ORDER_FLOW, STATUS_META, type Status } from "./admin-orders-view";
import type { DashboardAnalytics, DashboardRecentOrder } from "@/lib/types";

type RangeKey = "today" | "yesterday" | "last_7" | "last_30" | "week" | "month" | "custom";

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last_7", label: "Last 7 Days" },
  { key: "last_30", label: "Last 30 Days" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "custom", label: "Custom Range" },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const fmtMoney = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtCount = (n: number) => n.toLocaleString("en-US");

function fmtDay(dateStr: string): string {
  if (dateStr.includes("-W")) return dateStr.replace("W", "Wk ").replace("-", " ");
  const [, m, d] = dateStr.split("-").map(Number);
  return `${String(d).padStart(2, "0")} ${MONTHS[(m || 1) - 1]}`;
}

function fmtWeekday(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][(new Date(y, m - 1, d).getDay() + 6) % 7];
}

function fmtShort(dateStr: string): string {
  const [, m, d] = dateStr.split("-").map(Number);
  return `${MONTHS[(m || 1) - 1]} ${d}`;
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

function xTick(dateStr: string, total: number): string {
  if (dateStr.includes("-W")) return `W${dateStr.slice(dateStr.indexOf("-W") + 2)}`;
  if (total <= 8) return fmtWeekday(dateStr);
  return fmtShort(dateStr);
}

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  if (n <= 1) return pow;
  if (n <= 2) return 2 * pow;
  if (n <= 2.5) return 2.5 * pow;
  if (n <= 5) return 5 * pow;
  return 10 * pow;
}

function fmtAxis(v: number): string {
  if (v >= 1000) return `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`;
  return `$${v}`;
}

function smoothPath(pts: [number, number][]): string {
  if (pts.length < 2) return "";
  let d = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }
  return d;
}

function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

/* ================================================================== view */

export function AdminView({ onNotice }: { onNotice: (t: string) => void }) {
  const { user, devEmail } = useAuth();
  const [range, setRange] = useState<RangeKey>("last_7");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");
  const [data, setData] = useState<DashboardAnalytics | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const params = useMemo(() => {
    if (range === "custom") return { period: "custom", start: customStart, end: customEnd };
    return { period: range };
  }, [range, customStart, customEnd]);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!user) return;
      if (params.period === "custom" && (!params.start || !params.end)) return;
      const silent = opts?.silent ?? false;
      setError(null);
      if (!silent) setStatus("loading");
      setRefreshing(true);
      try {
        const res = await api.dashboardAnalytics(devEmail, params);
        setData(res);
        setStatus("ready");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load dashboard data.");
        setStatus("error");
        if (!silent) onNotice("Could not load dashboard data.");
      } finally {
        setRefreshing(false);
      }
    },
    [user, devEmail, params, onNotice],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void load({ silent: true });
    }, 30_000);
    return () => window.clearInterval(id);
  }, [load]);

  const selectRange = (key: RangeKey) => {
    setRange(key);
    if (key === "custom") {
      const today = new Date();
      setCustomStart(isoLocal(addDays(today, -6)));
      setCustomEnd(isoLocal(today));
    }
  };

  if (!user) {
    return (
      <div className="grid min-w-0 flex-1 place-items-center">
        <p className="text-sm text-[#888]">Sign in to view the dashboard.</p>
      </div>
    );
  }

  if (user.role !== "admin") {
    return (
      <div className="grid min-w-0 flex-1 place-items-center">
        <p className="text-sm text-[#888]">Admin access required. Sign in with admin@coffeeshop.local.</p>
      </div>
    );
  }

  return (
    <div className="relative min-w-0 flex-1 overflow-y-auto bg-[#0b0b0d] px-4 py-4">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(70%_100%_at_50%_0%,rgba(216,137,53,0.07),transparent_70%)]" />
      <div className="relative mx-auto max-w-6xl space-y-2.5">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-start justify-between gap-3 pb-1"
        >
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#F5F5F5]">Dashboard</h1>
            <p className="mt-0.5 text-xs text-[#888]">Overview of your coffee shop</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => void load()}
              title="Refresh dashboard"
              className="grid size-8 place-items-center rounded-[10px] border border-[rgba(255,255,255,0.07)] bg-[#151515] text-[#888] transition-all hover:border-[#D88935]/50 hover:text-[#F5F5F5]"
            >
              <RotateCw className={cn("size-3.5", refreshing && "animate-spin")} />
            </button>
            <RangePicker
              range={range}
              customStart={customStart}
              customEnd={customEnd}
              onSelect={selectRange}
              onCustomStart={(v) => setCustomStart(v)}
              onCustomEnd={(v) => setCustomEnd(v)}
              label={data?.range.label ?? "Last 7 Days"}
            />
          </div>
        </motion.div>

        {status === "error" ? (
          <ErrorCard message={error} onRetry={() => void load()} busy={refreshing} />
        ) : !data ? (
          <DashboardSkeleton />
        ) : (
          <DashboardBody data={data} onNotice={onNotice} onRefresh={() => void load({ silent: true })} />
        )}
      </div>
    </div>
  );
}

/* ======================================================= range picker */

function RangePicker({
  range,
  customStart,
  customEnd,
  onSelect,
  onCustomStart,
  onCustomEnd,
  label,
}: {
  range: RangeKey;
  customStart: string;
  customEnd: string;
  onSelect: (key: RangeKey) => void;
  onCustomStart: (v: string) => void;
  onCustomEnd: (v: string) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Date range"
        className="flex items-center gap-2 rounded-[10px] border border-[rgba(255,255,255,0.07)] bg-[#151515] px-3 py-2 text-xs font-medium text-[#F5F5F5] transition-colors hover:border-[#D88935]/50"
      >
        <Calendar className="size-3.5 text-[#888]" />
        {label}
        <ChevronDown className={cn("size-3 text-[#888] transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <motion.div
          initial={{ opacity: 0, y: 6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
          className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-[10px] border border-[rgba(255,255,255,0.1)] bg-[#121212] py-1 shadow-2xl shadow-black/60"
        >
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => onSelect(opt.key)}
              className={cn(
                "flex w-full items-center justify-between px-3 py-2 text-left text-xs transition-colors",
                range === opt.key ? "bg-[#D88935]/12 text-[#D88935]" : "text-[#d6d6d6] hover:bg-white/5",
              )}
            >
              {opt.label}
              {range === opt.key && <span className="size-1.5 rounded-full bg-[#D88935]" />}
            </button>
          ))}

          {range === "custom" && (
            <div className="space-y-1.5 border-t border-[rgba(255,255,255,0.06)] px-3 py-2">
              <input
                type="date"
                value={customStart}
                onChange={(e) => onCustomStart(e.target.value)}
                className="h-7 w-full rounded-md border border-[rgba(255,255,255,0.1)] bg-[#0d0d0d] px-2 text-[11px] text-[#F5F5F5] [color-scheme:dark] focus:border-[#D88935]/50 focus:outline-none"
              />
              <input
                type="date"
                value={customEnd}
                onChange={(e) => onCustomEnd(e.target.value)}
                className="h-7 w-full rounded-md border border-[rgba(255,255,255,0.1)] bg-[#0d0d0d] px-2 text-[11px] text-[#F5F5F5] [color-scheme:dark] focus:border-[#D88935]/50 focus:outline-none"
              />
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

/* ============================================================ body */

function DashboardBody({
  data,
  onNotice,
  onRefresh,
}: {
  data: DashboardAnalytics;
  onNotice: (t: string) => void;
  onRefresh: () => void;
}) {
  const s = data.summary;
  const noOrders = s.orders === 0;
  const hasRevenue = data.revenue.some((d) => d.revenue > 0 || d.orders > 0);

  return (
    <div className="space-y-2.5">
      {/* Row 1 — KPI cards */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total Revenue"
          value={fmtMoney(s.revenue)}
          countFrom={s.revenue}
          format={fmtMoney}
          delta={s.revenueDelta}
          icon={<DollarSign className="size-3.5" />}
          tile="bg-[#8B5CF6]/15 text-[#8B5CF6]"
          glow="shadow-[0_0_24px_-12px_rgba(139,92,246,0.45)]"
          delay={0.02}
        />
        <KpiCard
          title="Total Orders"
          value={fmtCount(s.orders)}
          countFrom={s.orders}
          format={fmtCount}
          delta={s.ordersDelta}
          icon={<ShoppingBag className="size-3.5" />}
          tile="bg-[#EF476F]/15 text-[#EF476F]"
          delay={0.06}
        />
        <KpiCard
          title="Total Customers"
          value={fmtCount(s.customers)}
          countFrom={s.customers}
          format={fmtCount}
          delta={s.customersDelta}
          icon={<Users className="size-3.5" />}
          tile="bg-[#35C98A]/15 text-[#35C98A]"
          delay={0.1}
        />
        <KpiCard
          title="Avg. Order Value"
          value={fmtMoney(s.avg)}
          countFrom={s.avg}
          format={fmtMoney}
          delta={s.avgDelta}
          icon={<Gauge className="size-3.5" />}
          tile="bg-[#8B5CF6]/15 text-[#8B5CF6]"
          delay={0.14}
        />
      </div>

      {/* Row 2 — revenue + top items */}
      <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
        <DashCard delay={0.18}>
          <CardHeader title="Revenue Overview" />
          <div className="mt-2">
            {!hasRevenue ? (
              <Empty text="No sales data available." />
            ) : (
              <RevenueChart data={data.revenue} />
            )}
          </div>
        </DashCard>

        <DashCard delay={0.22}>
          <CardHeader title="Top Selling Items" />
          <div className="mt-2">
            {data.topItems.length === 0 ? (
              <Empty text="No sales data available." />
            ) : (
              <TopItems items={data.topItems} />
            )}
          </div>
        </DashCard>
      </div>

      {/* Row 3 — heatmap + donuts */}
      <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-3">
        <DashCard delay={0.26}>
          <CardHeader title="Orders by Time" />
          <div className="mt-3">
            {noOrders ? (
              <Empty text="No order data available for this period." />
            ) : (
              <Heatmap data={data.ordersByTime} />
            )}
          </div>
        </DashCard>

        <DashCard delay={0.3}>
          <CardHeader title="Orders Status" />
          <div className="mt-3">
            {data.orderStatus.length === 0 ? (
              <Empty text="No order data available for this period." />
            ) : (
              <DonutBlock
                centerValue={fmtCount(data.orderStatus.reduce((sum, x) => sum + x.value, 0))}
                centerLabel="Total"
                segments={data.orderStatus}
              />
            )}
          </div>
        </DashCard>

        <DashCard delay={0.34}>
          <CardHeader title="Customers" />
          <div className="mt-3">
            {data.customers.every((x) => x.value === 0) ? (
              <Empty text="No customer data available." />
            ) : (
              <DonutBlock
                centerValue={fmtCount(data.customers.reduce((sum, x) => sum + x.value, 0))}
                centerLabel="Total"
                segments={data.customers}
              />
            )}
          </div>
        </DashCard>
      </div>

      {/* Row 4 — recent orders */}
      <DashCard delay={0.38}>
        <div className="flex items-center justify-between">
          <CardHeader title="Recent Orders" />
          <button
            onClick={onRefresh}
            className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0f0f0f] px-2.5 py-1 text-[11px] font-medium text-[#888] transition-colors hover:border-[#D88935]/40 hover:text-[#F5F5F5]"
          >
            Refresh
          </button>
        </div>
        <div className="mt-2">
          {data.recentOrders.length === 0 ? (
            <Empty text="No orders in this period." />
          ) : (
            <RecentOrdersTable orders={data.recentOrders} onNotice={onNotice} onRefresh={onRefresh} />
          )}
        </div>
      </DashCard>
    </div>
  );
}

function RecentOrdersTable({
  orders,
  onNotice,
  onRefresh,
}: {
  orders: DashboardRecentOrder[];
  onNotice: (t: string) => void;
  onRefresh: () => void;
}) {
  const { devEmail, user } = useAuth();
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  const updateStatus = useCallback(
    async (order: DashboardRecentOrder, status: Status) => {
      if (!user) return;
      setBusyId(order.id);
      try {
        await api.adminUpdateStatus(devEmail, order.id, status);
        onNotice(`${order.orderNumber} marked ${STATUS_META[status].label}.`);
        onRefresh();
      } catch (e) {
        onNotice(e instanceof Error ? e.message : "Could not update status.");
      } finally {
        setBusyId(null);
      }
    },
    [user, devEmail, onNotice, onRefresh],
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] border-collapse text-left">
        <thead>
          <tr className="border-b border-[rgba(255,255,255,0.06)] text-[10px] uppercase tracking-wider text-[#666]">
            <th className="pb-2 pr-3 font-semibold">Order ID</th>
            <th className="pb-2 pr-3 font-semibold">Customer</th>
            <th className="pb-2 pr-3 font-semibold">Items</th>
            <th className="pb-2 pr-3 text-right font-semibold">Amount</th>
            <th className="pb-2 pr-3 font-semibold">Status</th>
            <th className="pb-2 pr-3 font-semibold">Date / Time</th>
            <th className="pb-2 text-right font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => {
            const meta = STATUS_META[o.status as Status] ?? STATUS_META.pending;
            const busy = busyId === o.id;
            return (
              <tr
                key={o.id}
                className="border-b border-[rgba(255,255,255,0.04)] transition-colors last:border-0 hover:bg-white/[0.02]"
              >
                <td className="py-2.5 pr-3">
                  <p className="text-[13px] font-semibold text-[#F5F5F5]">{o.orderNumber}</p>
                </td>
                <td className="py-2.5 pr-3">
                  <p className="max-w-[150px] truncate text-xs text-[#d6d6dc]">{o.customer}</p>
                </td>
                <td className="py-2.5 pr-3">
                  <p className="max-w-[230px] truncate text-xs text-[#888]">
                    {o.items.map((it) => `${it.quantity}× ${it.name}`).join(", ")}
                  </p>
                </td>
                <td className="py-2.5 pr-3 text-right text-[13px] font-bold text-[#F5F5F5]">
                  {fmtMoney(o.total)}
                </td>
                <td className="py-2.5 pr-3">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[9px] font-bold",
                      meta.badge,
                    )}
                  >
                    <span className={cn("size-1.5 rounded-full", meta.dot)} />
                    {meta.label}
                  </span>
                </td>
                <td className="py-2.5 pr-3 text-xs text-[#888]">{fmtTime(o.createdAt)}</td>
                <td className="py-2.5">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => router.push("/admin/orders")}
                      className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0f0f0f] px-2 py-1 text-[11px] font-medium text-[#d6d6dc] transition-colors hover:border-[#D88935]/40 hover:text-[#F5F5F5]"
                    >
                      View
                    </button>
                    <div className="relative">
                      <select
                        value={o.status as Status}
                        disabled={busy}
                        onChange={(e) => void updateStatus(o, e.target.value as Status)}
                        className="h-8 cursor-pointer appearance-none rounded-[9px] border border-[rgba(255,255,255,0.08)] bg-[#0f0f0f] pl-2.5 pr-6 text-[11px] font-medium text-[#d6d6dc] transition-colors hover:border-[#D88935]/40 disabled:opacity-50"
                      >
                        {[...ORDER_FLOW, "cancelled" as const].map((s) => (
                          <option key={s} value={s}>
                            {STATUS_META[s].label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 text-[#888]" />
                    </div>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* =========================================================== pieces */

function CardHeader({ title }: { title: string }) {
  return <h2 className="text-sm font-semibold text-[#F5F5F5]">{title}</h2>;
}

function Empty({ text }: { text: string }) {
  return <p className="py-10 text-center text-xs text-[#888]">{text}</p>;
}

function ErrorCard({
  message,
  onRetry,
  busy,
}: {
  message: string | null;
  onRetry: () => void;
  busy: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto grid place-items-center rounded-[12px] border border-[rgba(239,71,111,0.25)] bg-[#151515] px-6 py-14 text-center"
    >
      <div>
        <p className="text-sm font-semibold text-[#F5F5F5]">Unable to load dashboard data.</p>
        {message && <p className="mt-1 text-xs text-[#888]">{message}</p>}
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry} loading={busy}>
          <RefreshCw className="size-3.5" /> Retry
        </Button>
      </div>
    </motion.div>
  );
}

function DashCard({
  className,
  delay = 0,
  children,
}: {
  className?: string;
  delay?: number;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: "easeOut" }}
      className={cn(
        "rounded-[12px] border border-[rgba(255,255,255,0.07)] bg-[#151515] p-3.5 transition-all duration-200 hover:-translate-y-[2px] hover:border-[rgba(216,137,53,0.35)]",
        className,
      )}
    >
      {children}
    </motion.div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between pb-1">
        <div className="h-6 w-40 animate-pulse rounded-lg bg-[#151515]" />
        <div className="flex gap-2">
          <div className="h-8 w-36 animate-pulse rounded-[10px] bg-[#151515]" />
          <div className="size-8 animate-pulse rounded-[10px] bg-[#151515]" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-[12px] border border-[rgba(255,255,255,0.06)] bg-[#151515]" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
        <div className="h-64 animate-pulse rounded-[12px] border border-[rgba(255,255,255,0.06)] bg-[#151515]" />
        <div className="h-64 animate-pulse rounded-[12px] border border-[rgba(255,255,255,0.06)] bg-[#151515]" />
      </div>
      <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-44 animate-pulse rounded-[12px] border border-[rgba(255,255,255,0.06)] bg-[#151515]" />
        ))}
      </div>
    </div>
  );
}

function useCountUp(target: number | undefined): number {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target === undefined) return;
    const controls = animate(0, target, {
      duration: 1.1,
      ease: "easeOut",
      onUpdate: (v) => setVal(v),
    });
    return () => controls.stop();
  }, [target]);
  return val;
}

function KpiCard({
  title,
  value,
  countFrom,
  format,
  delta,
  icon,
  tile,
  glow,
  delay,
}: {
  title: string;
  value: string;
  countFrom?: number;
  format?: (n: number) => string;
  delta: number | null;
  icon: React.ReactNode;
  tile: string;
  glow?: string;
  delay: number;
}) {
  const animated = useCountUp(countFrom);
  const display = countFrom !== undefined && format ? format(animated) : value;
  return (
    <DashCard delay={delay} className={glow}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-[#888]">{title}</p>
      <div className="mt-1.5 flex items-end justify-between gap-2">
        <div>
          <p className="text-xl font-bold tracking-tight text-[#F5F5F5]">{display}</p>
          <div className="mt-1">
            <Delta value={delta} />
          </div>
        </div>
        <span className={cn("grid size-7 shrink-0 place-items-center rounded-lg", tile)}>{icon}</span>
      </div>
    </DashCard>
  );
}

function Delta({ value }: { value: number | null }) {
  if (value === null || value === undefined) {
    return <span className="text-[11px] font-semibold text-[#888]">—</span>;
  }
  const up = value >= 0;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold", up ? "text-[#35C98A]" : "text-[#EF476F]")}>
      {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

/* =================================================== revenue chart */

function RevenueChart({ data }: { data: { date: string; revenue: number; orders: number }[] }) {
  const [active, setActive] = useState<number | null>(null);
  const w = 640;
  const h = 210;
  const padL = 38;
  const padR = 12;
  const padT = 10;
  const padB = 22;
  const max = niceMax(Math.max(...data.map((d) => d.revenue), 0));
  const step = Math.max(1, Math.ceil(data.length / 7));

  const pts = data.map((d, i) => [
    padL + (i / Math.max(1, data.length - 1)) * (w - padL - padR),
    h - padB - (d.revenue / max) * (h - padT - padB),
  ]) as [number, number][];

  const line = smoothPath(pts);
  const area = `${line} L ${pts[pts.length - 1][0]},${h - padB} L ${pts[0][0]},${h - padB} Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => max * f);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
        <defs>
          <linearGradient id="revArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#D88935" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#D88935" stopOpacity="0" />
          </linearGradient>
          <filter id="revGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {ticks.map((t) => {
          const y = h - padB - (t / max) * (h - padT - padB);
          return (
            <g key={t}>
              <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
              <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#666">
                {fmtAxis(t)}
              </text>
            </g>
          );
        })}

        {data.map((d, i) =>
          i % step === 0 || i === data.length - 1 ? (
            <text key={`x-${d.date}`} x={pts[i][0]} y={h - 8} textAnchor="middle" fontSize="9" fill="#666">
              {xTick(d.date, data.length)}
            </text>
          ) : null,
        )}

        <motion.path
          d={area}
          fill="url(#revArea)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
        />
        <motion.path
          d={line}
          fill="none"
          stroke="#D88935"
          strokeWidth="2"
          strokeLinecap="round"
          filter="url(#revGlow)"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 0.35, duration: 0.9, ease: "easeInOut" }}
        />

        {pts.map((p, i) => (
          <g
            key={`pt-${data[i].date}`}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            className="cursor-pointer"
          >
            <rect x={p[0] - 14} y={padT} width={28} height={h - padT - padB} fill="transparent" />
            <motion.circle
              cx={p[0]}
              cy={p[1]}
              r={active === i ? 4.5 : 3}
              fill="#D88935"
              stroke="#151515"
              strokeWidth="1.5"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.4 + i * 0.05 }}
            />
          </g>
        ))}
      </svg>

      {active !== null && data[active] && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#0d0d0d] px-2.5 py-1.5 text-[11px] shadow-xl"
          style={{
            left: `${Math.min(92, Math.max(8, (pts[active][0] / w) * 100))}%`,
            top: `${Math.max(4, (pts[active][1] / h) * 100 - 6)}%`,
          }}
        >
          <p className="font-semibold text-[#F5F5F5]">{fmtDay(data[active].date)}</p>
          <p className="text-[#D88935]">{fmtMoney(data[active].revenue)}</p>
          <p className="text-[#888]">{data[active].orders} order{data[active].orders === 1 ? "" : "s"}</p>
        </motion.div>
      )}
    </div>
  );
}

/* =================================================== top items */

function TopItems({ items }: { items: { name: string; count: number; revenue: number }[] }) {
  const maxTop = Math.max(1, ...items.map((t) => t.count));
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <motion.div
          key={item.name}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.26 + i * 0.05 }}
          className="group relative flex items-center gap-2.5"
        >
          <div className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-gradient-to-br from-[#D88935]/25 to-[#D88935]/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageForName(item.name)}
              alt={item.name}
              loading="lazy"
              className="size-full object-cover"
            />
          </div>
          <span className="w-0 min-w-0 flex-1 truncate text-[13px] font-medium text-[#F5F5F5]">
            {item.name}
          </span>
          <span className="shrink-0 text-xs font-semibold text-[#888]">{fmtCount(item.count)}</span>
          <div className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(4, (item.count / maxTop) * 100)}%` }}
              transition={{ delay: 0.3 + i * 0.05, duration: 0.5 }}
              className="h-full rounded-full bg-gradient-to-r from-[#b96a24] to-[#D88935]"
            />
          </div>
          <span className="w-14 shrink-0 text-right text-xs font-semibold text-[#F5F5F5]">
            {fmtMoney(item.revenue)}
          </span>
          <div className="pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#0d0d0d] px-2.5 py-1.5 text-[11px] opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100">
            <p className="font-semibold text-[#F5F5F5]">{item.name}</p>
            <p className="text-[#888]">{fmtCount(item.count)} units · {fmtMoney(item.revenue)}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/* =================================================== heatmap */

function Heatmap({
  data,
}: {
  data: { rows: string[]; columns: string[]; matrix: number[][]; max: number };
}) {
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);
  const max = Math.max(1, data.max);

  return (
    <div className="relative">
      <div className="grid grid-cols-[auto_repeat(7,1fr)] gap-1">
        <div />
        {data.columns.map((d) => (
          <div key={d} className="pb-1 text-center text-[9px] font-medium text-[#666]">
            {d}
          </div>
        ))}
        {data.rows.map((rowLabel, r) => (
          <div key={rowLabel} className="contents">
            <div className="flex items-center pr-1.5 text-[9px] text-[#666]">{rowLabel}</div>
            {data.columns.map((colLabel, c) => {
              const count = data.matrix[r]?.[c] ?? 0;
              const intensity = count / max;
              return (
                <motion.div
                  key={c}
                  onMouseEnter={() => setHover({ r, c })}
                  onMouseLeave={() => setHover(null)}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.35 + r * 0.05 + c * 0.03 }}
                  className="h-5 cursor-pointer rounded-[5px] transition-colors"
                  style={{
                    background:
                      count === 0
                        ? "rgba(255,255,255,0.05)"
                        : `rgba(216,137,53,${0.14 + 0.8 * intensity})`,
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>

      {hover && (
        <div className="pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#0d0d0d] px-2.5 py-1.5 text-[11px] shadow-xl">
          <p className="font-semibold text-[#F5F5F5]">
            {data.rows[hover.r]} · {data.columns[hover.c]}
          </p>
          <p className="text-[#D88935]">
            {data.matrix[hover.r]?.[hover.c] ?? 0} order{(data.matrix[hover.r]?.[hover.c] ?? 0) === 1 ? "" : "s"}
          </p>
        </div>
      )}

      <div className="mt-2.5 flex items-center justify-end gap-1.5 text-[9px] text-[#666]">
        Less
        <span className="h-2 w-2 rounded-[3px] bg-[rgba(255,255,255,0.05)]" />
        <span className="h-2 w-2 rounded-[3px] bg-[rgba(216,137,53,0.3)]" />
        <span className="h-2 w-2 rounded-[3px] bg-[rgba(216,137,53,0.6)]" />
        <span className="h-2 w-2 rounded-[3px] bg-[rgba(216,137,53,0.94)]" />
        More
      </div>
    </div>
  );
}

/* =================================================== donut */

function DonutBlock({
  centerValue,
  centerLabel,
  segments,
}: {
  centerValue: string;
  centerLabel: string;
  segments: { label: string; value: number; color: string }[];
}) {
  return (
    <div className="flex items-center justify-center gap-4">
      <Donut centerValue={centerValue} centerLabel={centerLabel} segments={segments} />
      <div className="space-y-2">
        {segments.map((s) => (
          <LegendItem key={s.label} color={s.color} label={s.label} value={s.value} />
        ))}
      </div>
    </div>
  );
}

function LegendItem({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />
      <span className="flex-1 text-[#888]">{label}</span>
      <span className="font-semibold text-[#F5F5F5]">{fmtCount(value)}</span>
    </div>
  );
}

function Donut({
  centerValue,
  centerLabel,
  segments,
}: {
  centerValue: string;
  centerLabel: string;
  segments: { label: string; value: number; color: string }[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const size = 108;
  const stroke = 13;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  const arcs = segments.reduce(
    (list, seg, i) => {
      const len = (seg.value / total) * c;
      const offset = i === 0 ? 0 : list[i - 1].offset + list[i - 1].len;
      list.push({ ...seg, len, offset });
      return list;
    },
    [] as ({ label: string; value: number; color: string } & { len: number; offset: number })[],
  );

  const hovered = hover !== null ? segments[hover] : null;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <motion.g
          style={{ transformOrigin: "center" }}
          initial={{ opacity: 0, rotate: -100, scale: 0.85 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          transition={{ delay: 0.4, duration: 0.7, ease: "easeOut" }}
        >
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={stroke} />
          {arcs.map((seg, i) => (
            <circle
              key={seg.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={hover === i ? stroke + 2 : stroke}
              strokeDasharray={`${seg.len} ${c - seg.len}`}
              strokeDashoffset={-seg.offset}
              strokeLinecap="butt"
              className="cursor-pointer transition-[stroke-width] duration-150"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </motion.g>
      </svg>

      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="text-center">
          <p className="text-lg font-bold leading-none text-[#F5F5F5]">{centerValue}</p>
          <p className="mt-0.5 text-[9px] uppercase tracking-wide text-[#888]">{centerLabel}</p>
        </div>
      </div>

      {hovered && (
        <div className="pointer-events-none absolute -top-7 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#0d0d0d] px-2.5 py-1.5 text-[11px] shadow-xl">
          <p className="font-semibold text-[#F5F5F5]">{hovered.label}</p>
          <p className="text-[#888]">
            {fmtCount(hovered.value)} · {total > 0 ? ((hovered.value / total) * 100).toFixed(1) : 0}%
          </p>
        </div>
      )}
    </div>
  );
}
