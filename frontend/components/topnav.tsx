"use client";

import { LogOut, UserRound } from "lucide-react";
import { useAuth } from "@/lib/dev-auth";
import { NotificationBell } from "./notification-bell";
import { cn } from "./ui";
import type { User } from "@/lib/types";

function adminGreeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Good morning,";
  if (h >= 12 && h < 17) return "Good afternoon,";
  if (h >= 17 && h < 21) return "Good evening,";
  return "Good night,";
}

function UserControls({
  user,
  displayName,
  avatarInitial,
  showProfile,
  compact,
  signOut,
}: {
  user: User;
  displayName: string;
  avatarInitial: string;
  showProfile: boolean;
  compact?: boolean;
  signOut: () => void;
}) {
  return (
    <div className="flex items-center gap-2 sm:gap-2.5">
      <NotificationBell user={user} />

      <div
        className={
          compact
            ? "flex items-center gap-2"
            : "group flex items-center gap-2.5 rounded-xl border border-[var(--border)] bg-white/[0.03] py-1.5 pl-1.5 pr-3 transition-colors hover:border-[var(--brand)]/30 hover:bg-[var(--hover)]/50"
        }
      >
        <div className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-[10px] bg-gradient-to-br from-[#d89b5c] to-[#8a4f1f] text-[13px] font-bold text-white shadow-md shadow-[var(--brand)]/25 ring-1 ring-white/10">
          {user.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.imageUrl}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            avatarInitial
          )}
        </div>
        {showProfile && (
          <div className="hidden sm:block">
            <p className="text-[13px] font-semibold leading-none text-[var(--fg)]">
              {displayName}
            </p>
            <p className="mt-1 text-[11px] leading-none text-[var(--muted)]">
              {user.role === "admin"
                ? "Administrator"
                : `${user.loyaltyPoints} pts · ${user.referralCode}`}
            </p>
          </div>
        )}
      </div>

      <span
        className={cn(
          "hidden items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors sm:inline-flex",
          user.role === "admin"
            ? "border-[var(--brand)]/20 bg-[var(--brand)]/10 text-[var(--brand)] hover:bg-[var(--brand)]/15"
            : "border-emerald-400/15 bg-emerald-400/10 text-emerald-400/90 hover:bg-emerald-400/15",
        )}
      >
        <UserRound className="size-2.5" />
        {user.role}
      </span>

      <button
        onClick={signOut}
        title="Logout"
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] font-medium text-[var(--muted)] transition-colors hover:bg-[var(--hover)]/60 hover:text-[var(--fg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
      >
        <LogOut className="size-3.5" />
        <span className="hidden lg:inline">Logout</span>
      </button>
    </div>
  );
}

export function Topnav() {
  const { user, signOut } = useAuth();
  const isAdmin = user?.role === "admin";
  const displayName = user?.name?.trim() || (isAdmin ? "Administrator" : "Coffee Lover");
  const avatarInitial = displayName.slice(0, 1).toUpperCase();
  const heroGreeting = adminGreeting();

  const controls = user && (
    <UserControls
      user={user}
      displayName={displayName}
      avatarInitial={avatarInitial}
      showProfile={false}
      compact
      signOut={signOut}
    />
  );

  return (
    <header className="relative z-20 shrink-0 border-b border-[var(--border)] bg-[var(--background)]">
      <div className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 pl-5 pr-4 sm:py-3.5 md:grid md:grid-cols-[1fr_auto_1fr] md:items-center md:gap-x-6 md:pr-[26px]">
        <h1 className="text-left">
          <span className="block text-[15px] font-semibold leading-none text-[var(--fg)] sm:text-[16px]">
            {heroGreeting}
          </span>
          <span className="mt-1.5 flex items-center gap-1.5 text-[13px] font-bold text-[var(--brand)] sm:text-[14px]">
            <span className="truncate">{displayName}</span>
            <span aria-hidden className="shrink-0 text-[14px] sm:text-[15px]">
              👋
            </span>
          </span>
        </h1>
        <p className="order-3 mt-1 w-full text-center text-[12.5px] leading-snug text-[var(--muted)] sm:text-[13px] md:order-none md:mt-0 md:w-auto md:px-4">
          {isAdmin
            ? "Manage your coffee shop, orders & customers from one place."
            : "Discover your perfect coffee, place orders & enjoy every sip."}
        </p>
        <div className="ml-auto flex items-center gap-2 sm:gap-2.5 md:ml-0 md:justify-self-end">
          {controls}
        </div>
      </div>
    </header>
  );
}
