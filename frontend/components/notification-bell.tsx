"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Check } from "lucide-react";
import type { User } from "@/lib/types";

export type AppNotification = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
};

const WELCOME_KEY_PREFIX = "brewai.notified_";

function seedWelcome(user: User, set: (n: AppNotification[]) => void) {
  const key = WELCOME_KEY_PREFIX + user.id;
  try {
    if (window.localStorage.getItem(key)) return;
    window.localStorage.setItem(key, "1");
  } catch {
    /* localStorage unavailable — skip seeding */
  }
  set([
    {
      id: `welcome-${user.id}`,
      title: "Welcome to BrewAI",
      message:
        "Your coffee journey starts here. Order your first brew and start earning loyalty points.",
      createdAt: new Date().toISOString(),
      read: false,
    },
  ]);
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff) || diff < 60_000) return "just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

export function NotificationBell({ user }: { user: User }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNotifications([]);
    setOpen(false);
    if (user) seedWelcome(user, setNotifications);
  }, [user]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleToggle = useCallback(() => {
    if (!open) {
      setNotifications((prev) =>
        prev.map((n) => (n.read ? n : { ...n, read: true })),
      );
    }
    setOpen((o) => !o);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={handleToggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ""}`}
        title="Notifications"
        className="relative grid size-9 place-items-center rounded-full border border-[var(--border)] bg-white/[0.03] text-[var(--secondary)] transition-all hover:border-[var(--brand)]/40 hover:text-[var(--fg)] hover:shadow-[0_0_14px_-2px_rgba(201,134,66,0.45)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute right-2 top-2 size-1.5 rounded-full bg-[var(--brand)] shadow-[0_0_6px_rgba(201,134,66,0.7)]" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[#121114]/95 shadow-2xl shadow-black/60 backdrop-blur-xl"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <p className="text-[13px] font-semibold text-[var(--fg)]">
                Notifications
              </p>
              {unreadCount > 0 && (
                <span className="rounded-full border border-[var(--brand)]/20 bg-[var(--brand)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--brand)]">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="max-h-[320px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-[13px] font-medium text-[var(--fg)]">
                    You&apos;re all caught up
                  </p>
                  <p className="mt-1 text-[12px] text-[var(--muted)]">
                    No new notifications right now.
                  </p>
                </div>
              ) : (
                <ul>
                  {notifications.map((n) => (
                    <li
                      key={n.id}
                      className="border-b border-[var(--border)]/60 px-4 py-3 last:border-b-0"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-[12px] font-semibold leading-snug text-[var(--fg)]">
                          {n.title}
                        </p>
                        {!n.read ? (
                          <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[var(--brand)] shadow-[0_0_6px_rgba(201,134,66,0.7)]" />
                        ) : (
                          <Check className="mt-0.5 size-3 shrink-0 text-[var(--muted)]" />
                        )}
                      </div>
                      <p className="mt-0.5 text-[12px] leading-snug text-[var(--secondary)]">
                        {n.message}
                      </p>
                      <p className="mt-1 text-[10px] text-[var(--muted)]">
                        {timeAgo(n.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
