"use client";

import {
  Coffee,
  History,
  LayoutDashboard,
  LogOut,
  MapPin,
  MessageSquarePlus,
  NotebookTabs,
  Settings,
  ShoppingBag,
  Trash2,
  UserRound,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "./ui";
import { useAuth } from "@/lib/dev-auth";
import type { ChatSession } from "@/lib/types";

export type CustomerView = "chat" | "menu" | "orders" | "dashboard" | "profile";
export type AdminViewKey =
  | "admin-dashboard"
  | "admin-orders"
  | "admin-menu"
  | "admin-customers"
  | "admin-settings";
export type View = CustomerView | AdminViewKey;

export const VIEW_ROUTE: Record<View, string> = {
  chat: "/chat",
  menu: "/menu",
  orders: "/orders",
  dashboard: "/dashboard",
  profile: "/profile",
  "admin-dashboard": "/admin/dashboard",
  "admin-orders": "/admin/orders",
  "admin-menu": "/admin/menu",
  "admin-customers": "/admin/customers",
  "admin-settings": "/admin/settings",
};

export const CUSTOMER_VIEWS: CustomerView[] = ["dashboard", "chat", "menu", "orders", "profile"];
export const ADMIN_VIEWS: AdminViewKey[] = [
  "admin-dashboard",
  "admin-orders",
  "admin-menu",
  "admin-customers",
  "admin-settings",
];

const CUSTOMER_NAV: { view: CustomerView; label: string; icon: typeof Coffee }[] = [
  { view: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { view: "chat", label: "Chat", icon: Coffee },
  { view: "menu", label: "Menu", icon: NotebookTabs },
  { view: "orders", label: "Orders", icon: UtensilsCrossed },
  { view: "profile", label: "Profile", icon: UserRound },
];

const ADMIN_NAV: { view: AdminViewKey; label: string; icon: typeof Coffee }[] = [
  { view: "admin-dashboard", label: "Dashboard", icon: LayoutDashboard },
  { view: "admin-orders", label: "Orders", icon: ShoppingBag },
  { view: "admin-menu", label: "Menu Manager", icon: NotebookTabs },
  { view: "admin-customers", label: "Customers", icon: Users },
  { view: "admin-settings", label: "Settings", icon: Settings },
];

function NavItem({
  label,
  icon: Icon,
  active,
  onClick,
  badge,
}: {
  label: string;
  icon: typeof Coffee;
  active: boolean;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
        active ? "text-white" : "text-[var(--muted)] hover:bg-[var(--hover)]/60 hover:text-[var(--secondary)]",
      )}
    >
      {active && (
        <motion.span
          layoutId="nav-pill"
          className="absolute inset-0 rounded-xl border border-[var(--brand)]/25 bg-gradient-to-r from-[var(--brand)]/18 to-transparent"
          transition={{ type: "spring", stiffness: 500, damping: 40 }}
        />
      )}
      {active && (
        <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-[var(--brand)]" />
      )}
      <Icon
        className={cn(
          "relative z-10 size-4",
          active && "text-[var(--brand-hover)]",
        )}
      />
      <span className="relative z-10">{label}</span>
      {typeof badge === "number" && badge > 0 && (
        <span className="relative z-10 ml-auto rounded-full border border-[var(--brand)]/25 bg-[var(--brand)]/15 px-2 py-0.5 text-[10px] font-bold text-[var(--brand-hover)]">
          {badge}
        </span>
      )}
    </button>
  );
}

export function Sidebar({
  view,
  role,
  onView,
  activeNearby = false,
  onNearby,
  sessions = [],
  activeSessionId = null,
  onNewChat,
  onOpenSession,
  onDeleteSession,
  orderCount = 0,
}: {
  view: View;
  role: "customer" | "admin";
  onView: (v: View) => void;
  activeNearby?: boolean;
  onNearby?: () => void;
  sessions?: ChatSession[];
  activeSessionId?: string | null;
  onNewChat?: () => void;
  onOpenSession?: (id: string) => void;
  onDeleteSession?: (id: string) => void;
  orderCount?: number;
}) {
  const { signOut } = useAuth();
  const isAdmin = role === "admin";
  const isActive = (v: View) => !activeNearby && view === v;
  const nav = isAdmin ? ADMIN_NAV : CUSTOMER_NAV;

  return (
    <aside className="relative z-10 flex w-[264px] shrink-0 flex-col border-r border-[var(--border)] bg-[#0d0d10]/80">
      <div className="flex items-center gap-3 px-5 pb-2 pt-5">
        <div className="relative grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-[#e0a25f] to-[#8a4f1f] shadow-lg shadow-[var(--brand)]/40">
          <Coffee className="size-5 text-white" />
          <span className="absolute -top-1 left-1/2 flex -translate-x-1/2 gap-0.5">
            <span className="steam-dot size-0.5 rounded-full bg-[#d89b5c]" style={{ animationDelay: "0s" }} />
            <span className="steam-dot size-0.5 rounded-full bg-[#d89b5c]" style={{ animationDelay: "0.5s" }} />
            <span className="steam-dot size-0.5 rounded-full bg-[#d89b5c]" style={{ animationDelay: "1s" }} />
          </span>
        </div>
        <div>
          <p className="text-[15px] font-bold leading-none tracking-tight">
            Brew<span className="text-gradient">AI</span>
          </p>
          <p className="mt-1 text-[11px] text-[var(--muted)]">
            {isAdmin ? "Admin workspace" : "Coffee Shop Assistant"}
          </p>
        </div>
      </div>

      {!isAdmin && (
        <div className="px-4 pt-3">
          <button
            onClick={onNewChat}
            className="group relative flex h-10 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-br from-[#d89b5c] to-[#a96a2e] text-sm font-semibold text-white shadow-lg shadow-[var(--brand)]/30 transition-all hover:shadow-[var(--brand)]/50 hover:brightness-110 active:scale-[0.98]"
          >
            <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            <MessageSquarePlus className="size-4" />
            New chat
          </button>
        </div>
      )}

      <nav className="mt-4 px-4">
        {nav.map(({ view: v, label, icon }) => (
          <NavItem key={v} label={label} icon={icon} active={isActive(v)} onClick={() => onView(v)} badge={!isAdmin && v === "orders" ? orderCount : undefined} />
        ))}

        {!isAdmin && (
          <button
            onClick={onNearby}
            className={cn(
              "relative mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
              activeNearby
                ? "text-white"
                : "text-[var(--muted)] hover:bg-[var(--hover)]/60 hover:text-[var(--secondary)]",
            )}
          >
            {activeNearby && (
              <motion.span
                layoutId="nav-pill"
                className="absolute inset-0 rounded-xl border border-[var(--brand)]/25 bg-gradient-to-r from-[var(--brand)]/18 to-transparent"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            {activeNearby && (
              <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-[var(--brand)]" />
            )}
            <MapPin
              className={cn(
                "relative z-10 size-4",
                activeNearby && "text-[var(--brand-hover)]",
              )}
            />
            <span className="relative z-10">Nearby Cafés</span>
          </button>
        )}
      </nav>

      {!isAdmin && (
        <>
          <div className="mx-5 mt-5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            <History className="size-3.5" />
            Recent chats
          </div>

          <div className="mt-2 flex-1 space-y-0.5 overflow-y-auto px-4 pb-3">
            {sessions.length === 0 && (
              <p className="px-2 py-3 text-xs text-[var(--muted)]">
                No chats yet. Start a conversation.
              </p>
            )}
            {sessions.map((s) => (
              <div
                key={s.id}
                className={cn(
                  "group flex items-center gap-1 rounded-xl pr-1 transition-colors",
                  activeSessionId === s.id
                    ? "border border-[var(--brand)]/20 bg-[var(--brand)]/10 text-white"
                    : "border border-transparent text-[var(--muted)] hover:bg-[var(--hover)]/60 hover:text-[var(--secondary)]",
                )}
              >
                <button
                  onClick={() => onOpenSession?.(s.id)}
                  className="min-w-0 flex-1 truncate px-3 py-2 text-left text-xs"
                  title={s.title}
                >
                  {s.title}
                </button>
                <button
                  onClick={() => onDeleteSession?.(s.id)}
                  className="hidden size-6 shrink-0 place-items-center rounded-md text-[var(--muted)] hover:bg-red-500/15 hover:text-red-400 group-hover:grid"
                  aria-label="Delete session"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {isAdmin && (
        <div className="mx-5 mt-5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
          <LayoutDashboard className="size-3.5" />
          Admin workspace
        </div>
      )}

      <div className="border-t border-[var(--border)] p-4">
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-[var(--muted)] transition-colors hover:bg-[var(--hover)]/60 hover:text-red-400"
        >
          <LogOut className="size-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}
