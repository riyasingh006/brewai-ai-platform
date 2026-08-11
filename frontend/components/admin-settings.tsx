"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Coffee,
  CreditCard,
  Info,
  Percent,
  Shield,
  Sparkles,
  UserRound,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/dev-auth";
import { cn } from "./ui";

export function AdminSettings() {
  const { user } = useAuth();
  const [health, setHealth] = useState<{ status: string; provider: string; env: string } | null>(null);

  useEffect(() => {
    api
      .health()
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  const isProd = health?.env === "production";
  const displayName = user?.name?.trim() || user?.email || "Admin";

  const rows: { icon: React.ReactNode; label: string; value: string; hint?: string }[] = [
    {
      icon: <Coffee className="size-3.5" />,
      label: "Shop name",
      value: "BrewAI Coffee Shop",
      hint: "Shown in receipts and the chat assistant identity.",
    },
    {
      icon: <Percent className="size-3.5" />,
      label: "Tax rate",
      value: "5%",
      hint: "Applied to every order before tip.",
    },
    {
      icon: <Sparkles className="size-3.5" />,
      label: "Loyalty rewards",
      value: "+10 pts / order · +50 pts / referral",
      hint: "Redeemable tiers: Bronze · Silver (100) · Gold (250).",
    },
    {
      icon: <CreditCard className="size-3.5" />,
      label: "Payments",
      value: health ? `Provider: ${health.provider}` : "Provider: sandbox",
      hint: "UPI, card, wallet and cash accepted.",
    },
    {
      icon: <Shield className="size-3.5" />,
      label: "Environment",
      value: health?.env ?? "development",
      hint: "Production requires Clerk JWTs and disables dev identity headers.",
    },
    {
      icon: <Info className="size-3.5" />,
      label: "Admin identity",
      value: user?.email ?? "—",
      hint: "The signed-in user owns admin access to all shop data.",
    },
  ];

  return (
    <div className="relative min-w-0 flex-1 overflow-y-auto bg-[#0b0b0d] px-4 py-4">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(70%_100%_at_50%_0%,rgba(216,137,53,0.07),transparent_70%)]" />
      <div className="relative mx-auto max-w-3xl space-y-2.5">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="pb-1"
        >
          <h1 className="text-xl font-bold tracking-tight text-[#F5F5F5]">Settings</h1>
          <p className="mt-0.5 text-xs text-[#888]">Shop configuration at a glance</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="flex items-center gap-3 rounded-[12px] border border-[rgba(255,255,255,0.07)] bg-[#151515] p-4"
        >
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#d89b5c] to-[#8a4f1f] text-white shadow-lg shadow-[var(--brand)]/30">
            <UserRound className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#F5F5F5]">{displayName}</p>
            <p className="mt-0.5 text-xs text-[#888]">{user?.email}</p>
          </div>
          <span
            className={cn(
              "ml-auto shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
              isProd
                ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-300"
                : "border-amber-500/25 bg-amber-500/10 text-amber-300",
            )}
          >
            {isProd ? "Production" : "Development"} · admin
          </span>
        </motion.div>

        <div className="overflow-hidden rounded-[12px] border border-[rgba(255,255,255,0.07)] bg-[#151515]">
          {rows.map((r, i) => (
            <div
              key={r.label}
              className={cn(
                "flex items-start gap-3 px-4 py-3.5",
                i > 0 && "border-t border-[rgba(255,255,255,0.05)]",
              )}
            >
              <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border border-[rgba(255,255,255,0.07)] bg-[#0f0f0f] text-[#e89a45]">
                {r.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium uppercase tracking-wide text-[#888]">{r.label}</p>
                <p className="mt-0.5 text-[13px] font-semibold text-[#F5F5F5]">{r.value}</p>
                {r.hint && <p className="mt-0.5 text-[11px] text-[#666]">{r.hint}</p>}
              </div>
            </div>
          ))}
        </div>

        <p className="px-1 text-[11px] text-[#555]">
          Configuration is managed server-side via environment variables. Data edits happen from the Orders,
          Menu Manager and Customers views.
        </p>
      </div>
    </div>
  );
}
