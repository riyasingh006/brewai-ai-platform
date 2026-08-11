"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  Banknote,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Coffee,
  CreditCard,
  Eye,
  Flame,
  Headphones,
  PackageCheck,
  Receipt,
  RotateCcw,
  Search,
  ShoppingBag,
  Smartphone,
  Star,
  Wallet,
  X,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { API_URL, api } from "@/lib/api";
import { useAuth } from "@/lib/dev-auth";
import type { MenuItem, Order, OrderItem } from "@/lib/types";
import { Spinner, cn } from "./ui";
import { imageForName } from "./menu-panel";

type FilterKey = "all" | "preparing" | "on-the-way" | "completed" | "cancelled";
type SortKey = "newest" | "oldest" | "amount-desc" | "amount-asc";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All Orders" },
  { key: "preparing", label: "Preparing" },
  { key: "on-the-way", label: "On the Way" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "newest", label: "Newest First" },
  { key: "oldest", label: "Oldest First" },
  { key: "amount-desc", label: "Highest Amount" },
  { key: "amount-asc", label: "Lowest Amount" },
];

const STATUS_META: Record<
  string,
  { label: string; badge: string; dot: string }
> = {
  pending: {
    label: "PENDING",
    badge: "border-amber-500/25 bg-amber-500/10 text-amber-300",
    dot: "bg-amber-400",
  },
  confirmed: {
    label: "CONFIRMED",
    badge: "border-sky-400/30 bg-sky-500/10 text-sky-300",
    dot: "bg-sky-400",
  },
  preparing: {
    label: "PREPARING",
    badge: "border-[#D8892F]/30 bg-[#D8892F]/12 text-[#e89a45]",
    dot: "bg-[#D8892F]",
  },
  ready: {
    label: "ON THE WAY",
    badge: "border-cyan-400/30 bg-cyan-500/10 text-cyan-300",
    dot: "bg-cyan-400",
  },
  completed: {
    label: "COMPLETED",
    badge: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
    dot: "bg-emerald-400",
  },
  cancelled: {
    label: "CANCELLED",
    badge: "border-red-500/25 bg-red-500/10 text-red-400/90",
    dot: "bg-red-400/70",
  },
};

const PAYMENT_META: Record<string, { label: string; Icon: LucideIcon }> = {
  card: { label: "Card", Icon: CreditCard },
  upi: { label: "UPI", Icon: Smartphone },
  wallet: { label: "Wallet", Icon: Wallet },
  cash: { label: "Cash", Icon: Banknote },
};

const btnGhost =
  "inline-flex h-9 items-center gap-2 rounded-[9px] border border-white/10 bg-[#151416] px-3 text-[13px] font-medium text-[#d6d6dc] transition-all hover:border-[#D8892F]/45 hover:text-[#e89a45] disabled:pointer-events-none disabled:opacity-50";

const fmtMoney = (n: number) => `$${n.toFixed(2)}`;
const fmtCount = (n: number) => n.toLocaleString("en-US");

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

const fmtTimeline = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

const capitalize = (s: string | null | undefined) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1) : "";

export function OrdersView({
  onNotice,
  onSupport,
  refreshKey = 0,
}: {
  onNotice: (t: string) => void;
  onSupport?: () => void;
  refreshKey?: number;
}) {
  const { devEmail, user } = useAuth();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reorderBusy, setReorderBusy] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      setOrders(await api.orders(devEmail));
    } catch (e) {
      setOrders([]);
      onNotice(e instanceof Error ? e.message : "Could not load orders.");
    }
  }, [user, devEmail, onNotice]);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshKey]);

  useEffect(() => {
    if (!user) return;
    const timer = setInterval(() => {
      api
        .orders(devEmail)
        .then(setOrders)
        .catch(() => {});
    }, 12000);
    return () => clearInterval(timer);
  }, [user, devEmail]);

  useEffect(() => {
    if (!user) return;
    api
      .menu(devEmail)
      .then(setMenuItems)
      .catch(() => {});
  }, [user, devEmail]);

  useEffect(() => {
    if (orders && orders.length > 0 && selectedId === null) {
      setSelectedId(orders[0].id);
    }
  }, [orders, selectedId]);

  const menuIdByName = useMemo(
    () => new Map(menuItems.map((m) => [m.name, m.id])),
    [menuItems],
  );

  const filtered = useMemo(() => {
    let list = orders ?? [];
    if (filter === "preparing")
      list = list.filter((o) =>
        ["pending", "confirmed", "preparing"].includes(o.status),
      );
    else if (filter === "on-the-way") list = list.filter((o) => o.status === "ready");
    else if (filter === "completed") list = list.filter((o) => o.status === "completed");
    else if (filter === "cancelled") list = list.filter((o) => o.status === "cancelled");

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          o.items.some((i) => i.name.toLowerCase().includes(q)),
      );
    }

    return [...list].sort((a, b) => {
      if (sort === "amount-desc") return b.total - a.total;
      if (sort === "amount-asc") return a.total - b.total;
      const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sort === "newest" ? -diff : diff;
    });
  }, [orders, filter, query, sort]);

  const stats = useMemo(() => {
    const list = orders ?? [];
    return {
      total: list.length,
      active: list.filter((o) =>
        ["pending", "confirmed", "preparing", "ready"].includes(o.status),
      ).length,
      completed: list.filter((o) => o.status === "completed").length,
    };
  }, [orders]);

  const selected = useMemo(
    () => (orders ?? []).find((o) => o.id === selectedId) ?? null,
    [orders, selectedId],
  );

  const selectOrder = useCallback((id: string) => {
    setSelectedId(id);
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      requestAnimationFrame(() => {
        panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, []);

  const review = async (orderId: string, rating: number, comment: string) => {
    if (!user) return;
    try {
      await api.reviewOrder(devEmail, orderId, rating, comment);
      void refresh();
    } catch {
      onNotice("Could not submit review.");
    }
  };

  const reorder = async (order: Order) => {
    if (!user || reorderBusy) return;
    const matched: { id: number; qty: number }[] = [];
    for (const item of order.items) {
      const menuId = menuIdByName.get(item.name);
      if (menuId !== undefined) matched.push({ id: menuId, qty: item.quantity });
    }
    if (matched.length === 0) {
      onNotice("Could not reorder — items are no longer on the menu.");
      return;
    }
    setReorderBusy(true);
    try {
      for (const m of matched) await api.addToCart(devEmail, m.id, m.qty);
      onNotice(`Reorder added ${order.items.length} item(s) to your cart.`);
    } catch (e) {
      onNotice(e instanceof Error ? e.message : "Could not add items to cart.");
    } finally {
      setReorderBusy(false);
    }
  };

  return (
    <div className="min-w-0 flex-1 overflow-y-auto bg-[#08090B] px-6 py-8 sm:px-9">
      <div className="mx-auto max-w-[1440px]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-[32px] font-bold leading-none tracking-tight text-[#F5F5F5]">
              Your Orders
            </h1>
            <p className="mt-2 text-sm text-[#8B8B93]">
              Track your orders, view receipts, and manage your order history.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative flex h-11 w-full items-center sm:w-[395px]">
              <Search className="pointer-events-none absolute left-3.5 size-4 text-[#8B8B93]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search orders by ID or item..."
                className="h-11 w-full rounded-[10px] border border-white/10 bg-[#121214] pl-10 pr-4 text-sm text-[#F5F5F5] placeholder:text-[#6b6b73] outline-none transition-all focus:border-[#D8892F]/50 focus:ring-2 focus:ring-[#D8892F]/20"
              />
            </label>

            <label className="relative flex h-11 w-full items-center sm:w-[165px]">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="h-11 w-full cursor-pointer appearance-none rounded-[10px] border border-white/10 bg-[#121214] pl-4 pr-9 text-sm font-medium text-[#F5F5F5] outline-none transition-all focus:border-[#D8892F]/50"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 size-4 text-[#8B8B93]" />
            </label>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-[14px]">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "h-[38px] rounded-[9px] px-4 text-[13px] font-medium transition-all",
                filter === f.key
                  ? "bg-[#D8892F] text-[#140d06] shadow-[0_0_18px_rgba(216,137,47,0.35)]"
                  : "border border-white/10 bg-[#121214] text-[#8B8B93] hover:border-[#D8892F]/35 hover:text-[#F5F5F5]",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {orders !== null && (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              icon={ShoppingBag}
              tint="bg-[#8B5CF6]/15 text-[#a78bfa]"
              ring="border-[#8B5CF6]/20"
              title="Total Orders"
              value={fmtCount(stats.total)}
              sub="All time orders"
            />
            <StatCard
              icon={Flame}
              tint="bg-[#D8892F]/15 text-[#e89a45]"
              ring="border-[#D8892F]/25"
              title="Active Orders"
              value={fmtCount(stats.active)}
              sub="Currently in progress"
            />
            <StatCard
              icon={CheckCircle2}
              tint="bg-emerald-500/15 text-emerald-400"
              ring="border-emerald-500/25"
              title="Completed Orders"
              value={fmtCount(stats.completed)}
              sub="Successfully delivered"
            />
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-3">
            {!orders && (
              <div className="grid h-48 place-items-center text-[#8B8B93]">
                <Spinner />
              </div>
            )}

            {orders !== null && orders.length === 0 && (
              <div className="rounded-[14px] border border-white/10 bg-[#121214] py-20 text-center">
                <Coffee className="mx-auto size-8 text-[#D8892F]/60" />
                <p className="mt-3 text-sm font-semibold text-[#F5F5F5]">
                  No orders yet
                </p>
                <p className="mt-1 text-[13px] text-[#8B8B93]">
                  Place one through chat or the menu and it will show up here.
                </p>
              </div>
            )}

            {orders !== null && orders.length > 0 && filtered.length === 0 && (
              <div className="rounded-[14px] border border-white/10 bg-[#121214] py-16 text-center text-sm text-[#8B8B93]">
                No orders match your search or filters.
              </div>
            )}

            {filtered.map((order, i) => (
              <OrderCard
                key={order.id}
                order={order}
                index={i}
                selected={order.id === selected?.id}
                onSelect={() => selectOrder(order.id)}
                onReorder={() => void reorder(order)}
                reorderBusy={reorderBusy}
              />
            ))}
          </div>

          <div ref={panelRef} className="scroll-mt-6 space-y-4">
            {selected ? (
              <OrderDetailsPanel
                order={selected}
                onReorder={() => void reorder(selected)}
                onReview={(rating, comment) => void review(selected.id, rating, comment)}
                reorderBusy={reorderBusy}
              />
            ) : (
              <div className="rounded-[14px] border border-white/10 bg-[#121214] p-6 text-center">
                <Coffee className="mx-auto size-8 text-[#D8892F]/50" />
                <p className="mt-3 text-sm font-semibold text-[#F5F5F5]">
                  Order details
                </p>
                <p className="mt-1 text-[13px] text-[#8B8B93]">
                  Select an order to see its full details and timeline.
                </p>
              </div>
            )}
            <SupportCard onSupport={onSupport} />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  tint,
  ring,
  title,
  value,
  sub,
}: {
  icon: LucideIcon;
  tint: string;
  ring: string;
  title: string;
  value: string;
  sub: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[12px] border border-white/10 bg-[#121214] p-4"
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-full border",
            tint,
            ring,
          )}
        >
          <Icon className="size-[18px]" />
        </div>
        <p className="text-[13px] font-semibold text-[#8B8B93]">{title}</p>
      </div>
      <p className="mt-4 text-[24px] font-bold leading-none text-[#F5F5F5]">
        {value}
      </p>
      <p className="mt-1.5 text-xs text-[#6b6b73]">{sub}</p>
    </motion.div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.pending;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold tracking-wide",
        meta.badge,
      )}
    >
      <span className={cn("size-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}

function OrderCard({
  order,
  index,
  selected,
  onSelect,
  onReorder,
  reorderBusy,
}: {
  order: Order;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onReorder: () => void;
  reorderBusy: boolean;
}) {
  const first = order.items[0];
  const names = order.items.map((i) => i.name);
  const itemSummary =
    names.length <= 4
      ? names.join(", ")
      : `${names.slice(0, 4).join(", ")} and ${names.length - 4} more item${
          names.length - 4 === 1 ? "" : "s"
        }`;
  const pay = PAYMENT_META[order.paymentMethod] ?? {
    label: order.paymentMethod,
    Icon: CreditCard,
  };
  const PayIcon = pay.Icon;
  const isCompleted = order.status === "completed";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3) }}
      onClick={onSelect}
      className={cn(
        "cursor-pointer rounded-[14px] border bg-[#121214] p-4 transition-all sm:p-5",
        selected
          ? "border-[#D8892F]/55 shadow-[0_0_24px_-10px_rgba(216,137,47,0.5)]"
          : "border-white/10 hover:border-[#D8892F]/35 hover:bg-[#141416]",
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-[12px] border border-white/10 bg-[#0d0c0e] sm:size-24">
          {first && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageForName(first.name)}
              alt={first.name}
              loading="lazy"
              className="size-full object-cover"
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[16px] font-semibold tracking-tight text-[#F5F5F5]">
              {order.orderNumber}
            </p>
            <StatusBadge status={order.status} />
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#8B8B93]">
            <span>{fmtDateTime(order.createdAt)}</span>
            <span className="size-0.5 rounded-full bg-[#6b6b73]" aria-hidden />
            <span className="inline-flex items-center gap-1">
              <PayIcon className="size-3.5" />
              {pay.label}
            </span>
          </p>
          <p className="mt-2 truncate text-[13px] text-[#d6d6dc]">{itemSummary}</p>
          <p className="mt-2 text-[13px] text-[#8B8B93]">
            Total:{" "}
            <span className="font-bold text-[#F5F5F5]">{fmtMoney(order.total)}</span>
          </p>
        </div>

        <div className="flex shrink-0 flex-row items-center gap-2 sm:flex-col sm:items-end">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            className={btnGhost}
          >
            <Eye className="size-3.5" />
            View Details
          </button>
          {isCompleted && (
            <>
              {order.receipt && (
                <a
                  href={`${API_URL}${order.receipt.pdfUrl}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className={btnGhost}
                >
                  <Receipt className="size-3.5" />
                  Receipt
                </a>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onReorder();
                }}
                disabled={reorderBusy}
                className={btnGhost}
              >
                <RotateCcw
                  className={cn("size-3.5", reorderBusy && "animate-spin")}
                />
                Reorder
              </button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function ProductRow({ item }: { item: OrderItem }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-[10px] border border-white/10 bg-[#0d0c0e]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageForName(item.name)}
          alt={item.name}
          loading="lazy"
          className="size-full object-cover"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[#F5F5F5]">
          {item.name}
        </p>
        <p className="mt-0.5 text-xs text-[#8B8B93]">
          {item.quantity} × {fmtMoney(item.unitPrice)}
        </p>
      </div>
      <p className="shrink-0 text-[13px] font-bold text-[#e89a45]">
        {fmtMoney(item.quantity * item.unitPrice)}
      </p>
    </div>
  );
}

function OrderDetailsPanel({
  order,
  onReorder,
  onReview,
  reorderBusy,
}: {
  order: Order;
  onReorder: () => void;
  onReview: (rating: number, comment: string) => void;
  reorderBusy: boolean;
}) {
  const pay = PAYMENT_META[order.paymentMethod] ?? {
    label: order.paymentMethod,
    Icon: CreditCard,
  };
  const PayIcon = pay.Icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[14px] border border-white/10 bg-[#121214] p-5 lg:sticky lg:top-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6b6b73]">
            Order ID
          </p>
          <p className="mt-1 truncate text-[17px] font-bold tracking-tight text-[#F5F5F5]">
            {order.orderNumber}
          </p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <div className="mt-5 flex items-center gap-3 rounded-[10px] border border-white/10 bg-[#151416] p-3.5">
        <div className="grid size-10 shrink-0 place-items-center rounded-[10px] border border-[#D8892F]/25 bg-[#D8892F]/10 text-[#e89a45]">
          <PayIcon className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-[#6b6b73]">
            Payment Method
          </p>
          <p className="mt-0.5 text-sm font-semibold text-[#F5F5F5]">
            {pay.label}
          </p>
        </div>
        <div className="ml-auto shrink-0 text-right">
          <p className="text-[11px] uppercase tracking-wider text-[#6b6b73]">
            Payment Status
          </p>
          <p
            className={cn(
              "mt-0.5 text-sm font-semibold",
              order.paymentStatus === "paid" ? "text-emerald-400" : "text-amber-300",
            )}
          >
            {capitalize(order.paymentStatus)}
          </p>
        </div>
      </div>

      <OrderTimeline order={order} />

      <div className="mt-6">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-[#6b6b73]">
          Items ({order.items.length})
        </p>
        <div className="mt-3 space-y-3">
          {order.items.map((item) => (
            <ProductRow key={item.id} item={item} />
          ))}
        </div>
      </div>

      <div className="mt-6 space-y-1.5 border-t border-white/10 pt-4 text-[13px]">
        <TotalRow label="Subtotal" value={fmtMoney(order.subtotal)} />
        {order.discount > 0 && (
          <TotalRow label="Discount" value={`−${fmtMoney(order.discount)}`} accent />
        )}
        <TotalRow label="Tax" value={fmtMoney(order.tax)} />
        {order.tip > 0 && <TotalRow label="Tip" value={fmtMoney(order.tip)} />}
        <div className="flex items-center justify-between border-t border-white/10 pt-2">
          <span className="font-semibold text-[#F5F5F5]">Total</span>
          <span className="text-[20px] font-bold leading-none text-[#e89a45]">
            {fmtMoney(order.total)}
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-[10px] border border-white/10 bg-[#151416] p-4 text-[13px]">
        <Detail label="Order ID" value={order.id} />
        <Detail
          label="Est. time"
          value={order.estMinutes != null ? `${order.estMinutes} min` : "—"}
        />
        <Detail label="Coupon" value={order.couponCode ?? "—"} />
        <Detail label="Invoice" value={order.receipt?.invoiceNumber ?? "—"} />
        <Detail label="Notes" value={order.notes ?? "—"} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {order.receipt && (
          <a
            href={`${API_URL}${order.receipt.pdfUrl}`}
            target="_blank"
            rel="noreferrer"
            className={btnGhost}
          >
            <Receipt className="size-3.5" />
            Receipt
          </a>
        )}
        <button onClick={onReorder} disabled={reorderBusy} className={btnGhost}>
          <RotateCcw className={cn("size-3.5", reorderBusy && "animate-spin")} />
          Reorder
        </button>
        <RateOrder order={order} onRate={onReview} />
      </div>
    </motion.div>
  );
}

function TotalRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[#8B8B93]">{label}</span>
      <span className={cn("font-semibold text-[#F5F5F5]", accent && "text-emerald-400")}>
        {value}
      </span>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wider text-[#6b6b73]">
        {label}
      </p>
      <p className="mt-0.5 truncate font-medium text-[#F5F5F5]">{value}</p>
    </div>
  );
}

type TimelineState = "done" | "active" | "todo" | "cancelled";

const TIMELINE_STAGES: { key: string; label: string; Icon: typeof Clock }[] = [
  { key: "pending", label: "Order Placed", Icon: Clock },
  { key: "confirmed", label: "Confirmed", Icon: BadgeCheck },
  { key: "preparing", label: "Preparing", Icon: Flame },
  { key: "ready", label: "Ready", Icon: PackageCheck },
  { key: "completed", label: "Completed", Icon: CheckCircle2 },
];

function buildTimeline(order: Order) {
  const seq = TIMELINE_STAGES.map((s) => s.key);
  const history = order.statusHistory ?? [];
  const ts = new Map<string, string>();
  for (const h of history) ts.set(h.status, h.timestamp);

  const nodes: {
    key: string;
    label: string;
    Icon: typeof Clock;
    state: TimelineState;
    ts?: string;
  }[] = [];

  if (order.status === "cancelled") {
    for (let i = 0; i < seq.length; i++) {
      const s = seq[i];
      if (i === 0 || ts.has(s)) {
        nodes.push({
          key: s,
          label: TIMELINE_STAGES[i].label,
          Icon: TIMELINE_STAGES[i].Icon,
          state: "done",
          ts: ts.get(s) ?? (i === 0 ? order.createdAt : undefined),
        });
      }
    }
    nodes.push({
      key: "cancelled",
      label: "Cancelled",
      Icon: XCircle,
      state: "cancelled",
      ts: ts.get("cancelled"),
    });
    return nodes;
  }

  const currentIdx = seq.indexOf(order.status);
  for (let i = 0; i < seq.length; i++) {
    const s = seq[i];
    let nodeTs = ts.get(s);
    if (i === 0 && !nodeTs) nodeTs = order.createdAt;
    if (s === "completed" && !nodeTs && order.completedAt) nodeTs = order.completedAt;
    const state: TimelineState =
      i < currentIdx || order.status === "completed"
        ? "done"
        : i === currentIdx
          ? "active"
          : "todo";
    nodes.push({
      key: s,
      label: TIMELINE_STAGES[i].label,
      Icon: TIMELINE_STAGES[i].Icon,
      state,
      ts: nodeTs,
    });
  }
  return nodes;
}

function OrderTimeline({ order }: { order: Order }) {
  const nodes = useMemo(() => buildTimeline(order), [order]);
  return (
    <div className="mt-6">
      <p className="text-[12px] font-semibold uppercase tracking-wider text-[#6b6b73]">
        Order Timeline
      </p>
      <ol className="mt-4">
        {nodes.map((node, i) => {
          const isLast = i === nodes.length - 1;
          const lineHot = !isLast && (node.state === "done" || node.state === "active");
          return (
            <li key={node.key} className="relative flex gap-4 pb-6 last:pb-0">
              {!isLast && (
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-[11px] top-7 h-[calc(100%-14px)] w-0.5 rounded-full",
                    lineHot ? "bg-emerald-400/50" : "bg-white/10",
                  )}
                />
              )}
              <span
                className={cn(
                  "relative z-10 grid size-6 shrink-0 place-items-center rounded-full border",
                  node.state === "done" &&
                    "border-emerald-400/40 bg-emerald-500/15 text-emerald-300",
                  node.state === "active" &&
                    "border-[#D8892F]/60 bg-[#D8892F]/15 text-[#e89a45] shadow-[0_0_14px_rgba(216,137,47,0.55)]",
                  node.state === "todo" && "border-white/15 bg-[#151416] text-[#6b6b73]",
                  node.state === "cancelled" && "border-red-500/30 bg-red-500/10 text-red-400",
                )}
              >
                {node.state === "done" && <Check className="size-3.5" strokeWidth={3} />}
                {node.state === "cancelled" && <X className="size-3.5" strokeWidth={3} />}
                {node.state === "active" && (
                  <>
                    <node.Icon className="size-3.5" />
                    <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-[#D8892F]/25" />
                  </>
                )}
                {node.state === "todo" && <span className="size-1.5 rounded-full bg-[#6b6b73]" />}
              </span>
              <div className="min-w-0 pt-0.5">
                <p
                  className={cn(
                    "text-[13px] font-semibold",
                    node.state === "done" && "text-[#F5F5F5]",
                    node.state === "active" && "text-[#e89a45]",
                    node.state === "todo" && "text-[#6b6b73]",
                    node.state === "cancelled" && "text-red-400",
                  )}
                >
                  {node.label}
                  {node.state === "active" && (
                    <span className="ml-2 rounded-full border border-[#D8892F]/30 bg-[#D8892F]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#e89a45]">
                      Current
                    </span>
                  )}
                </p>
                {node.ts && (
                  <p className="mt-0.5 text-xs text-[#8B8B93]">{fmtTimeline(node.ts)}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function RateOrder({
  order,
  onRate,
}: {
  order: Order;
  onRate: (rating: number, comment: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  if (order.review) {
    return (
      <span className="inline-flex h-9 items-center gap-1.5 rounded-[9px] border border-white/10 bg-[#151416] px-3 text-[13px] font-medium text-amber-400">
        <Star className="size-3.5 fill-current" />
        {order.review.rating}/5
      </span>
    );
  }

  if (order.status !== "completed") return null;

  return (
    <div className="flex items-center gap-2">
      {open && (
        <div className="flex items-center gap-1.5">
          {[1, 2, 3, 4, 5].map((r) => (
            <button
              key={r}
              onClick={() => setRating(r)}
              className={r <= rating ? "text-amber-400" : "text-[#6b6b73]"}
            >
              <Star className="size-3.5 fill-current" />
            </button>
          ))}
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Comment (optional)"
            className="h-8 w-36 rounded-[9px] border border-white/10 bg-[#0f1012] px-2 text-xs text-[#F5F5F5] placeholder:text-[#6b6b73] outline-none focus:border-[#D8892F]/50"
          />
          <button
            onClick={() => {
              onRate(rating, comment);
              setOpen(false);
            }}
            className="h-8 rounded-[9px] bg-[#D8892F] px-3 text-xs font-semibold text-[#140d06] transition-all hover:brightness-110"
          >
            Save
          </button>
        </div>
      )}
      <button onClick={() => setOpen((p) => !p)} className={btnGhost}>
        <Star className="size-3.5" />
        Rate Order
      </button>
    </div>
  );
}

function SupportCard({ onSupport }: { onSupport?: () => void }) {
  return (
    <div className="rounded-[14px] border border-white/10 bg-[#121214] p-5">
      <div className="grid size-10 place-items-center rounded-full bg-[#D8892F]/15 text-[#e89a45]">
        <Headphones className="size-4" />
      </div>
      <h3 className="mt-4 text-[15px] font-semibold text-[#F5F5F5]">
        Need Help?
      </h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-[#8B8B93]">
        If you face any issue with your order
      </p>
      <button
        onClick={onSupport}
        className="mt-4 h-9 w-full rounded-[9px] border border-[#D8892F]/30 bg-[#D8892F]/10 text-[13px] font-semibold text-[#e89a45] transition-all hover:bg-[#D8892F]/20 hover:shadow-[0_0_16px_rgba(216,137,47,0.25)]"
      >
        Contact Support
      </button>
    </div>
  );
}
