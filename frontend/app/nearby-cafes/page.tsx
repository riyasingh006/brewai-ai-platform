"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { DevAuthProvider, useAuth } from "@/lib/dev-auth";
import { Sidebar, VIEW_ROUTE } from "@/components/sidebar";
import { Topnav } from "@/components/topnav";
import { AuroraBackground } from "@/components/aurora-background";
import { SignInOverlay } from "@/components/signin-overlay";
import { NearbyCafes } from "@/components/nearby-cafes/NearbyCafes";

const GATE_CONTEXT = {
  title: "Sign in to discover cafés near you",
  subtitle:
    "Sign in to use Nearby Cafés, find places around your location, and get personalized café recommendations.",
};

export default function NearbyCafesPage() {
  return (
    <DevAuthProvider>
      <NearbyCafesShell />
    </DevAuthProvider>
  );
}

function NearbyCafesShell() {
  const { loading, user } = useAuth();
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#090807] text-[#A7A7AD]">
        <div className="flex items-center gap-3">
          <Loader2 className="size-6 animate-spin text-[#E79A3E]" />
          <span className="text-sm">warming up the machines…</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <SignInOverlay
        context={GATE_CONTEXT}
        onClose={() => router.push("/")}
        onSuccess={() => router.push("/nearby-cafes")}
      />
    );
  }

  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-[var(--background)] text-[var(--fg)]">
      <AuroraBackground />
      <div className="relative z-10 flex h-screen flex-col overflow-hidden">
        <Topnav />
        <div className="flex min-h-0 flex-1">
          <Sidebar
            view="chat"
            role={user.role}
            onView={(v) => router.push(VIEW_ROUTE[v])}
            activeNearby
            onNearby={scrollToTop}
            onNewChat={() => router.push("/chat")}
            onOpenSession={() => router.push("/chat")}
            onDeleteSession={() => router.push("/chat")}
          />
          <div ref={scrollRef} className="min-w-0 flex-1 overflow-y-auto">
            <NearbyCafes />
          </div>
        </div>
      </div>
    </div>
  );
}
