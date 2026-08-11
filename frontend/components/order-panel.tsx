"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Coffee,
  Minus,
  Plus,
  Receipt,
  ShoppingBag,
  Trash2,
  X,
} from "lucide-react";
import { motion } from "framer-motion";
import { API_URL, api } from "@/lib/api";
import { useAuth } from "@/lib/dev-auth";
import type { CartItem, MenuItem, Order, OrderDraft } from "@/lib/types";
import { Badge, Button, cn, Input, Spinner, Textarea } from "./ui";
import { imageForName } from "./menu-panel";

const PAYMENT_METHODS = ["upi", "card", "cash", "wallet"];

export type DraftRequest = { drafts: OrderDraft[]; nonce: number } | null;

function matchMenuItem(draft: OrderDraft, menu: MenuItem[]): MenuItem | null {
  const rawItem = typeof draft.item === "string" ? draft.item : "";
  const needle = rawItem.trim().toLowerCase();
  if (!needle) return null;
  const words = needle.split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  let best: MenuItem | null = null;
  let bestScore = 0;
  for (const item of menu) {
    const name = item.name.toLowerCase();
    let score = 0;
    if (name === needle) score = 10;
    else if (name.includes(needle)) score = 5;
    else if (words.some((w) => name.includes(w))) score = words.length;
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return best;
}

export function OrderPanel({
  menu,
  draftRequest,
  refreshKey,
  onNotice,
  confirmedOrder = null,
  onDismissConfirmedOrder,
}: {
  menu: MenuItem[];
  draftRequest: DraftRequest;
  refreshKey: number;
  onNotice: (text: string) => void;
  confirmedOrder?: Order | null;
  onDismissConfirmedOrder?: () => void;
}) {
  const { devEmail, user } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [coupon, setCoupon] = useState("");
  const [tip, setTip] = useState(0);
  const [notes, setNotes] = useState("");
  const [payMethod, setPayMethod] = useState("upi");
  const [payError, setPayError] = useState<string | null>(null);
  const processedDraft = useRef(0);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      setCart(await api.cart(devEmail));
    } catch {
      setCart([]);
    } finally {
      setLoading(false);
    }
  }, [user, devEmail]);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshKey]);

  useEffect(() => {
    if (!draftRequest || !user) return;
    const { drafts, nonce } = draftRequest;
    if (nonce <= processedDraft.current) return;
    processedDraft.current = nonce;
    for (const draft of drafts) {
      const item = matchMenuItem(draft, menu);
      if (!item) {
        const attempted = typeof draft.item === "string" ? draft.item.trim() : "";
        onNotice(`I couldn't find "${attempted || "that item"}" on the menu — try a menu item name.`);
        continue;
      }
      const customization: Record<string, string | string[]> = {};
      if (draft.size) customization.size = draft.size;
      if (draft.milk) customization.milk = draft.milk;
      if (draft.toppings?.length) customization.toppings = draft.toppings;
      api
        .addToCart(devEmail, item.id, draft.quantity || 1, customization)
        .then(() => {
          onNotice(`Added ${draft.quantity || 1}× ${item.name} to your order.`);
          void refresh();
        })
        .catch((e) => onNotice(e instanceof Error ? e.message : "Could not add to order."));
    }
  }, [draftRequest, user, devEmail, menu, onNotice, refresh]);

  const subtotal = cart.reduce((s, c) => s + c.unitPrice * c.quantity, 0);
  const estTax = subtotal * 0.05;
  const estTotal = subtotal + estTax + tip;
  const displayOrder = confirmedOrder ?? order;

  const checkout = useCallback(async () => {
    if (!user || !cart.length) return;
    setCheckingOut(true);
    setPayError(null);
    try {
      const done = await api.checkout(devEmail, {
        paymentMethod: payMethod,
        couponCode: coupon.trim() || undefined,
        tip: tip || undefined,
        notes: notes.trim() || undefined,
      });
      setOrder(done);
      setCart([]);
      setCoupon("");
      setTip(0);
      setNotes("");
    } catch (e) {
      setPayError(e instanceof Error ? e.message : "Checkout failed.");
    } finally {
      setCheckingOut(false);
    }
  }, [user, devEmail, cart.length, payMethod, coupon, tip, notes]);

  return (
    <aside className="relative z-10 flex w-[320px] shrink-0 flex-col border-l border-[var(--border)] bg-[#0d0d10]/80">
      <div className="flex h-[60px] items-center justify-between border-b border-[var(--border)] px-5">
        <div className="flex items-center gap-2 text-sm font-bold">
          <span className="grid size-7 place-items-center rounded-lg bg-[var(--brand)]/15 text-[var(--brand)]">
            <ShoppingBag className="size-3.5" />
          </span>
          Your order
        </div>
        <Badge tone={cart.length ? "brand" : "default"}>
          {cart.length} item{cart.length === 1 ? "" : "s"}
        </Badge>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="grid h-40 place-items-center text-[var(--muted)]">
            <Spinner />
          </div>
        ) : cart.length === 0 ? (
          <EmptyCart hasOrder={!!displayOrder} />
        ) : (
          <div className="space-y-3">
            {cart.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="card-luxe card-luxe-hover rounded-2xl p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-[10px] border border-[var(--border)] bg-[#0d0c0e]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imageForName(item.name)}
                        alt={item.name}
                        loading="lazy"
                        className="size-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold leading-tight">
                        {item.name}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                        {formatCustomization(item.customization)}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-[var(--brand-hover)]">
                        ${item.unitPrice.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <p className="shrink-0 text-sm font-bold text-[var(--brand-hover)]">
                    ${(item.unitPrice * item.quantity).toFixed(2)}
                  </p>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <QtyBtn
                      onClick={() =>
                        item.quantity <= 1
                          ? api.removeCartItem(devEmail!, item.id).then(refresh)
                          : api
                              .updateCartItem(devEmail!, item.id, item.quantity - 1)
                              .then(refresh)
                      }
                    >
                      <Minus className="size-3" />
                    </QtyBtn>
                    <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                    <QtyBtn onClick={() => api.updateCartItem(devEmail!, item.id, item.quantity + 1).then(refresh)}>
                      <Plus className="size-3" />
                    </QtyBtn>
                  </div>
                  <button
                    onClick={() => api.removeCartItem(devEmail!, item.id).then(refresh)}
                    className="grid size-7 place-items-center rounded-lg text-[var(--muted)] hover:bg-red-500/15 hover:text-red-400"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </motion.div>
            ))}

            <div className="space-y-1.5 rounded-2xl border border-[var(--border)] bg-[var(--panel)]/60 p-3 text-[13px]">
              <Row label="Subtotal" value={subtotal} />
              <Row label="Tax (5%)" value={estTax} />
              <div className="flex items-center justify-between">
                <span className="text-[var(--muted)]">Tip</span>
                <div className="flex gap-1">
                  {[0, 1, 2].map((t) => (
                    <button
                      key={t}
                      onClick={() => setTip(t)}
                      className={cn(
                        "rounded-lg px-2 py-0.5 text-xs font-semibold transition-colors",
                        tip === t
                          ? "bg-gradient-to-br from-[#d89b5c] to-[#a96a2e] text-white shadow-sm shadow-[var(--brand)]/40"
                          : "bg-[var(--hover)] text-[var(--muted)] hover:text-[var(--fg)]",
                      )}
                    >
                      ${t}.00
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-[var(--border)] pt-1.5 font-bold">
                <span>Total</span>
                <motion.span
                  key={estTotal}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-[var(--brand-hover)]"
                >
                  ${estTotal.toFixed(2)}
                </motion.span>
              </div>
            </div>

            <Input
              label="Coupon code"
              placeholder="e.g. WELCOME10"
              value={coupon}
              onChange={(e) => setCoupon(e.target.value)}
            />
            <div>
              <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">
                Payment
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m}
                    onClick={() => setPayMethod(m)}
                    className={cn(
                      "rounded-lg border px-1 py-1.5 text-xs font-semibold capitalize transition-colors",
                      payMethod === m
                        ? "border-[var(--brand)] bg-[var(--brand)]/12 text-[var(--brand-hover)] shadow-[0_0_12px_-4px_rgba(201,134,66,0.6)]"
                        : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--fg)]",
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <Textarea
              placeholder="Notes for the barista (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
            {payError && <p className="text-xs text-red-400">{payError}</p>}
            <Button
              className="w-full shadow-lg shadow-[var(--brand)]/25 hover:shadow-[var(--brand)]/40"
              loading={checkingOut}
              onClick={() => void checkout()}
            >
              Place order · ${estTotal.toFixed(2)}
            </Button>
          </div>
        )}

        {displayOrder && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 p-4"
          >
            <div className="flex items-center gap-2 text-emerald-400">
              <Coffee className="size-4" />
              <p className="text-sm font-bold">Order confirmed!</p>
            </div>
            <p className="mt-2 text-xs text-[var(--fg)]/80">
              {displayOrder.orderNumber} · {displayOrder.estMinutes} min
            </p>
            <div className="mt-2 flex items-center justify-between text-[13px]">
              <span className="text-[var(--muted)]">Paid</span>
              <span className="font-bold text-emerald-400">${displayOrder.total.toFixed(2)}</span>
            </div>
            {displayOrder.receipt && (
              <a
                href={`${API_URL}${displayOrder.receipt.pdfUrl}`}
                target="_blank"
                rel="noreferrer"
                className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 py-2 text-xs font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/10"
              >
                <Receipt className="size-3.5" />
                Download receipt (PDF)
              </a>
            )}
            <Button
              variant="secondary"
              className="mt-2 w-full"
              onClick={() => {
                if (confirmedOrder) onDismissConfirmedOrder?.();
                else setOrder(null);
              }}
            >
              <X className="size-3.5" />
              Done
            </Button>
          </motion.div>
        )}
      </div>
    </aside>
  );
}

function QtyBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="grid size-6 place-items-center rounded-md border border-[var(--border)] bg-[var(--hover)]/70 text-[var(--muted)] transition-all hover:border-[var(--brand)]/40 hover:text-[var(--brand-hover)]"
    >
      {children}
    </button>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[var(--muted)]">{label}</span>
      <span>${value.toFixed(2)}</span>
    </div>
  );
}

function formatCustomization(c: Record<string, string | string[]>): string {
  const parts = Object.entries(c)
    .filter(([, v]) => v && !(Array.isArray(v) && !v.length))
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`);
  return parts.join(" · ") || "default";
}

function EmptyCart({ hasOrder }: { hasOrder: boolean }) {
  return (
    <div className="grid h-64 place-items-center text-center">
      <div>
        <div className="mx-auto grid size-16 place-items-center rounded-2xl border border-[var(--border)] bg-[var(--panel)]/60">
          <ShoppingBag className="size-7 text-[var(--brand)]/70" />
        </div>
        <p className="mt-4 text-sm font-semibold text-[var(--secondary)]">
          {hasOrder ? "Ready for the next one?" : "Your cart is empty"}
        </p>
        <p className="mx-auto mt-1 max-w-[220px] text-xs text-[var(--muted)]">
          Order through chat (try &quot;two espressos please&quot;) or add items from the menu.
        </p>
      </div>
    </div>
  );
}
