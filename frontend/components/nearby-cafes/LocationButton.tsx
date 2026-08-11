"use client";

import { Loader2, MapPin } from "lucide-react";

export function LocationButton({
  onClick,
  loading,
  disabled,
}: {
  onClick: () => void;
  loading: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="inline-flex h-[54px] shrink-0 items-center justify-center gap-2 rounded-2xl border border-[#E99A3D]/40 bg-[#1A130D]/80 px-5 text-[15px] font-semibold text-[#F0A34A] shadow-[0_8px_24px_-12px_rgba(216,137,50,0.35)] transition-all hover:border-[#F0A34A]/80 hover:bg-[#241708]/80 hover:shadow-[0_12px_32px_-12px_rgba(216,137,50,0.5)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60 sm:px-6"
    >
      {loading ? (
        <Loader2 className="size-5 animate-spin" />
      ) : (
        <MapPin className="size-5" />
      )}
      {loading ? "Locating…" : "Use My Current Location"}
    </button>
  );
}
