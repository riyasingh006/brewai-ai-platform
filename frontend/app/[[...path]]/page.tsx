"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { DevAuthProvider, useAuth } from "@/lib/dev-auth";
import { api } from "@/lib/api";
import type { ChatSession, MenuItem, Order, OrderDraft, User } from "@/lib/types";
import { Sidebar, type View, VIEW_ROUTE } from "@/components/sidebar";
import { Topnav } from "@/components/topnav";
import { LandingNav } from "@/components/landing-nav";
import { LandingHero } from "@/components/landing-hero";
import { Testimonials } from "@/components/testimonials";
import { AboutSection } from "@/components/about-page";
import { Chat } from "@/components/chat";
import { OrderPanel, type DraftRequest } from "@/components/order-panel";
import { MenuPanel } from "@/components/menu-panel";
import { OrdersView } from "@/components/orders-view";
import { ProfileView } from "@/components/profile-view";
import { AdminView } from "@/components/admin-view";
import { CustomerDashboard } from "@/components/customer-dashboard";
import { AdminOrdersView } from "@/components/admin-orders-view";
import { MenuManager } from "@/components/menu-manager";
import { AdminCustomers } from "@/components/admin-customers";
import { AdminSettings } from "@/components/admin-settings";
import { AuroraBackground } from "@/components/aurora-background";

const ROUTE_VIEW: Record<string, View> = {
  "/chat": "chat",
  "/menu": "menu",
  "/orders": "orders",
  "/dashboard": "dashboard",
  "/profile": "profile",
  "/admin/dashboard": "admin-dashboard",
  "/admin/orders": "admin-orders",
  "/admin/menu": "admin-menu",
  "/admin/customers": "admin-customers",
  "/admin/settings": "admin-settings",
};

type Resolve =
  | { kind: "landing"; redirect: string | null }
  | { kind: "app"; view: View; home: string };

/** Map a URL path to a workspace view, applying the role guard. */
function resolveWorkspace(pathname: string, user: User | null): Resolve {
  if (pathname === "/") return { kind: "landing", redirect: null };
  const view = ROUTE_VIEW[pathname];
  if (!view) return { kind: "landing", redirect: "/" };
  if (!user) return { kind: "landing", redirect: "/" };
  const isAdmin = user.role === "admin";
  const viewIsAdmin = view.startsWith("admin-");
  if (viewIsAdmin && !isAdmin) return { kind: "landing", redirect: "/" };
  if (!viewIsAdmin && isAdmin) return { kind: "landing", redirect: "/admin/dashboard" };
  return { kind: "app", view, home: isAdmin ? "/admin/dashboard" : "/dashboard" };
}

export default function Page() {
  return (
    <DevAuthProvider>
      <Suspense fallback={null}>
        <AppShell />
      </Suspense>
    </DevAuthProvider>
  );
}

function AppShell() {
  const { loading } = useAuth();
  const pathname = usePathname() ?? "/";

  if (loading) {
    return (
      <div className="relative grid min-h-screen place-items-center overflow-hidden bg-[var(--background)] text-[var(--muted)]">
        <AuroraBackground />
        <div className="relative z-10 flex items-center gap-3">
          <Loader2 className="size-6 animate-spin text-[var(--brand)]" />
          <span className="text-sm">warming up the machines…</span>
        </div>
      </div>
    );
  }

  return <Workspace pathname={pathname} />;
}

function Workspace({ pathname }: { pathname: string }) {
  const { devEmail, user } = useAuth();
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<"Home" | "About">("Home");
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [draftRequest, setDraftRequest] = useState<DraftRequest>(null);
  const [cartRefresh, setCartRefresh] = useState(0);
  const [ordersRefresh, setOrdersRefresh] = useState(0);
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);
  const [orderCount, setOrderCount] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nonce = useRef(0);
  const authHandledRef = useRef(false);
  const pendingAboutRef = useRef(false);

  const resolved = resolveWorkspace(pathname, user);
  const isLanding = resolved.kind === "landing";
  const view = resolved.kind === "app" ? resolved.view : "dashboard";

  useEffect(() => {
    if (!user) return;
    Promise.all([api.menu(devEmail), api.sessions(devEmail)])
      .then(([m, s]) => {
        setMenu(m);
        setSessions(s);
      })
      .catch(() => setNotice("Could not reach the backend at localhost:8000."));
  }, [user, devEmail]);

  const showNotice = useCallback((text: string) => {
    setNotice(text);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 2600);
  }, []);

  const handleDraft = useCallback((drafts: OrderDraft[]) => {
    nonce.current += 1;
    setDraftRequest({ drafts, nonce: nonce.current });
  }, []);

  const refreshOrderCount = useCallback(async () => {
    if (!user) return;
    try {
      const orders = await api.orders(devEmail);
      setOrderCount(
        orders.filter((o) =>
          ["pending", "confirmed", "preparing", "ready"].includes(o.status),
        ).length,
      );
    } catch {
      /* sidebar badge stays as-is */
    }
  }, [user, devEmail]);

  useEffect(() => {
    if (user) void refreshOrderCount();
  }, [user, refreshOrderCount]);

  const handleOrderCreated = useCallback(
    (order: Order) => {
      setConfirmedOrder(order);
      setCartRefresh((n) => n + 1);
      setOrdersRefresh((n) => n + 1);
      void refreshOrderCount();
    },
    [refreshOrderCount],
  );

  const handleOrderCancelled = useCallback(() => {
    setOrdersRefresh((n) => n + 1);
    void refreshOrderCount();
  }, [refreshOrderCount]);

  const handleOrderStatus = useCallback(() => {
    setOrdersRefresh((n) => n + 1);
  }, []);

  const handleCartState = useCallback(() => {
    setCartRefresh((n) => n + 1);
  }, []);

  const addFromMenu = useCallback(
    async (item: MenuItem) => {
      if (!user) return;
      try {
        await api.addToCart(devEmail, item.id, 1);
        setCartRefresh((n) => n + 1);
        showNotice(`Added ${item.name} to your order.`);
      } catch (e) {
        showNotice(e instanceof Error ? e.message : "Could not add item.");
      }
    },
    [user, devEmail, showNotice],
  );

  const goView = useCallback(
    (v: View) => {
      router.push(VIEW_ROUTE[v]);
    },
    [router],
  );

  const goChat = useCallback(() => {
    router.push("/chat");
  }, [router]);

  const newChat = useCallback(() => {
    setActiveSessionId(null);
    goChat();
  }, [goChat]);

  const openSession = useCallback(
    (id: string) => {
      setActiveSessionId(id);
      goChat();
    },
    [goChat],
  );

  const deleteSession = useCallback(
    async (id: string) => {
      if (!user) return;
      try {
        await api.deleteSession(devEmail, id);
        setSessions((p) => p.filter((s) => s.id !== id));
        if (activeSessionId === id) setActiveSessionId(null);
      } catch {
        showNotice("Could not delete session.");
      }
    },
    [user, devEmail, activeSessionId, showNotice],
  );

  const onSessionChange = useCallback(
    (id: string | null) => {
      setActiveSessionId(id);
      if (id && user) void api.sessions(devEmail).then(setSessions);
    },
    [user, devEmail],
  );

  // Route a signed-in user visiting the landing page to their role's home
  // workspace (dashboard guard rails).
  useEffect(() => {
    if (!user) {
      authHandledRef.current = false;
      return;
    }
    if (authHandledRef.current) return;
    authHandledRef.current = true;
    if (pathname === "/") {
      router.replace(user.role === "admin" ? "/admin/dashboard" : "/dashboard");
    }
  }, [user, pathname, router]);

  // Signing out on an app route returns the user to the landing page.
  useEffect(() => {
    if (!user && resolved.kind === "app") {
      router.replace("/");
    }
  }, [user, resolved.kind, router]);

  // Fix up URLs that don't match the signed-in role (guard rails).
  useEffect(() => {
    if (isLanding && resolved.redirect && resolved.redirect !== pathname) {
      router.replace(resolved.redirect);
    }
  }, [isLanding, resolved, pathname, router]);

  const scrollToId = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const goAbout = useCallback(() => {
    if (!isLanding) {
      router.push("/");
      pendingAboutRef.current = true;
      return;
    }
    scrollToId("about");
  }, [isLanding, router, scrollToId]);

  const goHome = useCallback(() => {
    if (!isLanding) {
      router.push("/");
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [isLanding, router]);

  useEffect(() => {
    if (!isLanding) return;
    const shouldScrollAbout = pendingAboutRef.current || window.location.hash === "#about";
    pendingAboutRef.current = false;
    if (shouldScrollAbout) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => scrollToId("about"));
      });
    }
  }, [isLanding, scrollToId]);

  useEffect(() => {
    if (!isLanding) return;
    const aboutEl = document.getElementById("about");
    if (!aboutEl) return;
    const observer = new IntersectionObserver(
      ([entry]) => setActiveSection(entry.isIntersecting ? "About" : "Home"),
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
    observer.observe(aboutEl);
    return () => observer.disconnect();
  }, [isLanding]);

  const handleLandingNav = useCallback(
    (v: View) => {
      if (v === "chat") {
        window.scrollTo({ top: 0, behavior: "smooth" });
        setActiveSection("Home");
        return;
      }
      if (!user) {
        router.push("/auth");
        return;
      }
      goView(v);
    },
    [user, goView, router],
  );

  const openMenu = useCallback(() => {
    if (!user) {
      router.push("/auth");
      return;
    }
    goView("menu");
  }, [user, goView, router]);

  const openNearby = useCallback(() => {
    if (user) {
      router.push("/nearby-cafes");
      return;
    }
    router.push("/auth?next=/nearby-cafes");
  }, [user, router]);

  if (isLanding) {
    return (
      <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-[#090807] text-[var(--fg)]">
        <AuroraBackground />
        <div className="relative z-10 flex min-h-screen flex-col">
          <LandingNav
            activeLabel={activeSection}
            onView={handleLandingNav}
            onAbout={goAbout}
            onHome={goHome}
            onNotice={showNotice}
          />
          <main>
            <LandingHero
              onMenu={openMenu}
              onNearby={openNearby}
              onDiscover={goAbout}
            />
            <AboutSection onMenu={openMenu} onNotice={showNotice} />
            <Testimonials />
          </main>
        </div>
        <NoticeToast notice={notice} />
      </div>
    );
  }

  const role = user?.role === "admin" ? "admin" : "customer";

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-[var(--background)] text-[var(--fg)]">
      <AuroraBackground />
      <div className="relative z-10 flex h-screen flex-col overflow-hidden">
        <Topnav />
        <div className="flex min-h-0 flex-1">
          <Sidebar
            view={view}
            role={role}
            onView={goView}
            sessions={sessions}
            activeSessionId={activeSessionId}
            onNewChat={newChat}
            onOpenSession={openSession}
            onDeleteSession={(id) => void deleteSession(id)}
            onNearby={openNearby}
            orderCount={orderCount}
          />

          <AnimatePresence mode="wait">
            <motion.main
              key={view}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18 }}
              className="flex min-w-0 flex-1"
            >
              {view === "chat" && (
                <div className="flex min-w-0 flex-1">
                  <Chat
                    activeSessionId={activeSessionId}
                    onSessionChange={onSessionChange}
                    onDraft={handleDraft}
                    onNotice={showNotice}
                    onOrderCreated={handleOrderCreated}
                    onOrderCancelled={handleOrderCancelled}
                    onOrderStatus={handleOrderStatus}
                    onCartState={handleCartState}
                  />
                  <OrderPanel
                    menu={menu}
                    draftRequest={draftRequest}
                    refreshKey={cartRefresh}
                    onNotice={showNotice}
                    confirmedOrder={confirmedOrder}
                    onDismissConfirmedOrder={() => setConfirmedOrder(null)}
                  />
                </div>
              )}
              {view === "menu" && <MenuPanel menu={menu} onAdd={(i) => void addFromMenu(i)} />}
              {view === "orders" && (
                <OrdersView
                  onNotice={showNotice}
                  onSupport={goChat}
                  refreshKey={ordersRefresh}
                />
              )}
              {view === "profile" && <ProfileView onNotice={showNotice} />}
              {view === "dashboard" && (
                <CustomerDashboard
                  onNotice={showNotice}
                  onOpenMenu={() => goView("menu")}
                  onOpenOrders={() => goView("orders")}
                />
              )}
              {view === "admin-dashboard" && <AdminView onNotice={showNotice} />}
              {view === "admin-orders" && <AdminOrdersView onNotice={showNotice} />}
              {view === "admin-menu" && <MenuManager onNotice={showNotice} />}
              {view === "admin-customers" && <AdminCustomers onNotice={showNotice} />}
              {view === "admin-settings" && <AdminSettings />}
            </motion.main>
          </AnimatePresence>
        </div>
      </div>
      <NoticeToast notice={notice} />
    </div>
  );
}

function NoticeToast({ notice }: { notice: string | null }) {
  return (
    <AnimatePresence>
      {notice && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-[var(--brand)]/30 bg-[#17171b]/90 px-4 py-2.5 text-sm shadow-xl backdrop-blur"
        >
          {notice}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
