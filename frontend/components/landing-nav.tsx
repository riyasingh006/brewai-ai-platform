"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Coffee, Menu as MenuIcon, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/lib/dev-auth";
import { cn } from "./ui";
import type { View } from "./sidebar";

const BASE_LINKS: {
  kind: "home" | "view" | "about";
  view?: View;
  label: string;
  notice?: string;
  adminOnly?: boolean;
}[] = [
  { kind: "home", label: "Home" },
  { kind: "view", view: "menu", label: "Menu" },
  { kind: "view", view: "orders", label: "Orders" },
  { kind: "view", view: "admin-dashboard", label: "Dashboard", adminOnly: true },
  { kind: "about", label: "About" },
];

export function LandingNav({
  onView,
  onAbout,
  onHome,
  activeLabel,
  onNotice,
}: {
  onView: (v: View) => void;
  onAbout?: () => void;
  onHome?: () => void;
  activeLabel?: string;
  onNotice?: (text: string) => void;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const LINKS = BASE_LINKS.filter((l) => !l.adminOnly || user?.role === "admin");

  const handleNav = (l: (typeof LINKS)[number]) => {
    if (l.notice) {
      onNotice?.(l.notice);
      return;
    }
    if (l.kind === "home") {
      onHome?.();
      return;
    }
    if (l.kind === "about") {
      onAbout?.();
      return;
    }
    if (l.view) onView(l.view);
  };

  const handleCta = () => {
    if (user) router.push(user.role === "admin" ? "/admin/dashboard" : "/dashboard");
    else router.push("/auth");
  };

  return (
    <header className="relative z-30 shrink-0 border-b border-[#2E2118]/70 bg-[#0A0908]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[96px] max-w-[1440px] items-center justify-between gap-6 px-5 sm:px-8">
        <div className="flex items-center gap-3">
          <div className="relative grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-[#e0a25f] to-[#8a4f1f] shadow-lg shadow-[var(--brand)]/40">
            <Coffee className="size-5 text-white" />
            <span className="absolute -top-1 left-1/2 flex -translate-x-1/2 gap-0.5">
              <span
                className="steam-dot size-0.5 rounded-full bg-[#d89b5c]"
                style={{ animationDelay: "0s" }}
              />
              <span
                className="steam-dot size-0.5 rounded-full bg-[#d89b5c]"
                style={{ animationDelay: "0.5s" }}
              />
              <span
                className="steam-dot size-0.5 rounded-full bg-[#d89b5c]"
                style={{ animationDelay: "1s" }}
              />
            </span>
          </div>
          <div>
            <p className="text-[26px] font-bold leading-none tracking-tight">
              Brew<span className="text-[#e8a05a]">AI</span>
            </p>
            <p className="mt-1.5 text-[13px] text-[var(--muted)]">
              AI Coffee Shop Assistant
            </p>
          </div>
        </div>

        <nav className="hidden items-center justify-center gap-8 lg:flex">
          {LINKS.map((l) => {
            const active = l.label === activeLabel;
            return (
              <button
                key={l.label}
                onClick={() => handleNav(l)}
                className={cn(
                  "relative flex flex-col items-center gap-1.5 py-1 text-sm font-medium transition-colors duration-200",
                  active
                    ? "text-[#e39a45]"
                    : "text-[#b9b9c1] hover:text-[#e39a45]",
                )}
              >
                {l.label}
                {active && (
                  <motion.span
                    layoutId="landing-nav-underline"
                    className="h-[3px] w-[50px] rounded-full bg-gradient-to-r from-[#e8a05a] to-[#a96a2e] shadow-[0_0_10px_rgba(232,160,90,0.6)]"
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCta}
            className="inline-flex h-9 items-center rounded-full bg-gradient-to-br from-[#E79A3E] to-[#A96A2E] px-4 text-[13px] font-semibold text-white shadow-lg shadow-[#c98642]/30 transition-all hover:brightness-110"
          >
            {user ? "Start Brewing" : "Get Started"}
          </button>

          <button
            onClick={() => setMobileOpen((p) => !p)}
            className="grid size-9 place-items-center rounded-xl border border-[var(--border)] text-[var(--muted)] transition-colors hover:text-[var(--fg)] lg:hidden"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="size-4" /> : <MenuIcon className="size-4" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-[var(--border)] lg:hidden"
          >
            <nav className="space-y-1 px-5 py-4">
              {LINKS.map((l) => (
                <button
                  key={l.label}
                  onClick={() => {
                    setMobileOpen(false);
                    handleNav(l);
                  }}
                  className={cn(
                    "block w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors",
                    l.label === activeLabel
                      ? "bg-[var(--brand)]/10 text-[#e8a05a]"
                      : "text-[#c4c4cc] hover:bg-[var(--hover)]/60 hover:text-[#e8a05a]",
                  )}
                >
                  {l.label}
                </button>
              ))}
              <button
                onClick={() => {
                  setMobileOpen(false);
                  handleCta();
                }}
                className="block w-full rounded-xl bg-gradient-to-br from-[#E79A3E] to-[#A96A2E] px-3 py-2.5 text-center text-sm font-semibold text-white"
              >
                {user ? "Start Brewing" : "Get Started"}
              </button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
