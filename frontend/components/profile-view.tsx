"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, Gift, Star } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/dev-auth";
import type { Coupon } from "@/lib/types";
import { Badge, Button, Card, Spinner } from "./ui";

export function ProfileView({ onNotice }: { onNotice: (t: string) => void }) {
  const { user, devEmail } = useAuth();
  const [coupons, setCoupons] = useState<Coupon[] | null>(null);

  useEffect(() => {
    if (!user) return;
    api
      .coupons(devEmail)
      .then(setCoupons)
      .catch(() => setCoupons([]));
  }, [user, devEmail]);

  if (!user) return null;

  const displayName = user.name?.trim() || "Coffee Lover";

  const copyCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    onNotice(`Copied ${code} to clipboard.`);
  };

  return (
    <div className="min-w-0 flex-1 overflow-y-auto px-6 py-6">
      <div className="mx-auto max-w-2xl space-y-4">
        <Card className="card-luxe p-5">
          <div className="flex items-center gap-4">
            <div className="grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-[#d89b5c] to-[#8a4f1f] text-2xl font-bold text-white shadow-lg shadow-[var(--brand)]/30">
              {displayName.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="flex items-center gap-1.5 text-lg font-bold">
                {displayName}
                <BadgeCheck className="size-4 text-[var(--brand)]" />
              </h1>
              <p className="text-xs text-[var(--muted)]">{user.email}</p>
              <div className="mt-2 flex gap-1.5">
                <Badge tone="brand">{user.role}</Badge>
                {user.birthday && <Badge>🎂 {user.birthday}</Badge>}
              </div>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-3 gap-3">
          <Stat label="Loyalty points" value={user.loyaltyPoints} icon="✨" />
          <Stat label="Orders" value={user.orderCount ?? 0} icon="🧾" />
          <Stat label="Favorites" value={user.favoriteCount ?? 0} icon="⭐" />
        </div>

        <Card className="card-luxe p-4">
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <Star className="size-4 text-amber-400" /> Coupons
          </h2>
          <div className="mt-3 space-y-2">
            {!coupons && (
              <div className="grid h-16 place-items-center text-[var(--muted)]">
                <Spinner />
              </div>
            )}
            {coupons?.length === 0 && (
              <p className="text-xs text-[var(--muted)]">No coupons yet.</p>
            )}
            {coupons?.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-xl border border-dashed border-[var(--brand)]/30 bg-[var(--brand)]/[0.04] p-3 transition-colors hover:border-[var(--brand)]/50"
              >
                <div>
                  <p className="text-sm font-bold text-[var(--brand-hover)]">{c.code}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {c.reason} {c.expiresAt ? `· expires ${new Date(c.expiresAt).toLocaleDateString()}` : ""}
                  </p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => void copyCode(c.code)}>
                  Copy
                </Button>
              </div>
            ))}
          </div>
        </Card>

        <Card className="card-luxe p-4">
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <Gift className="size-4 text-emerald-400" /> Refer a friend
          </h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Share your code — both of you get reward points on the first order.
          </p>
          <Button
            className="mt-3"
            variant="secondary"
            onClick={() => void copyCode(user.referralCode)}
          >
            {user.referralCode} · copy
          </Button>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <Card className="card-luxe p-3 text-center">
      <p className="text-lg">{icon}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
      <p className="text-[11px] text-[var(--muted)]">{label}</p>
    </Card>
  );
}
