"use client";

import {
  Clock,
  Coffee,
  Globe,
  Info,
  MapPin,
  Navigation,
  Phone,
  Star,
  Wallet,
} from "lucide-react";
import { type Cafe, directionsUrl, formatDistance, formatPrice } from "./cafe-types";
import { cn } from "@/components/ui";

export function CafeCard({
  cafe,
  active,
  onClick,
  onDetails,
}: {
  cafe: Cafe;
  active: boolean;
  onClick: () => void;
  onDetails?: () => void;
}) {
  const websiteHost = cafe.website
    ? cafe.website.replace(/^https?:\/\//, "").replace(/\/.*$/, "")
    : undefined;

  return (
    <article
      id={`cafe-${cafe.placeId}`}
      onClick={onClick}
      className={cn(
        "card-luxe card-luxe-hover cursor-pointer p-4",
        active && "glow-brand border-[#E79A3E]/50",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="flex min-w-0 items-start gap-2 text-[15px] font-bold leading-snug text-[#F5F5F5]">
          <span className="mt-0.5 shrink-0 text-[#E79A3E]">
            <Coffee className="size-4" />
          </span>
          <span className="min-w-0 break-words">{cafe.name}</span>
        </h3>
        {cafe.isOpen != null && (
          <span
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold",
              cafe.isOpen ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400",
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                cafe.isOpen ? "bg-emerald-400" : "bg-red-400",
              )}
            />
            {cafe.isOpen ? "Open now" : "Closed"}
          </span>
        )}
      </div>

      <div className="mt-3 space-y-1.5 text-[13px] text-[#A7A7AD]">
        {cafe.rating != null && (
          <p className="flex items-center gap-1.5">
            <Star className="size-3.5 shrink-0 fill-[#F0A34A] text-[#F0A34A]" />
            <span className="font-semibold text-[#F5F5F5]">{cafe.rating.toFixed(1)}</span>
            {cafe.ratingCount != null && (
              <span className="text-[12px] text-[var(--muted)]">({cafe.ratingCount})</span>
            )}
          </p>
        )}
        <p className="flex items-center gap-1.5">
          <MapPin className="size-3.5 shrink-0 text-[#E79A3E]" />
          <span className="font-medium text-[#ECECEF]">{formatDistance(cafe.distanceKm)}</span>
        </p>
        {cafe.address && (
          <p className="flex items-start gap-1.5 leading-snug">
            <Navigation className="mt-0.5 size-3.5 shrink-0 text-[var(--muted)]" />
            <span className="line-clamp-2">{cafe.address}</span>
          </p>
        )}
        {cafe.priceLevel != null && (
          <p className="flex items-center gap-1.5">
            <Wallet className="size-3.5 shrink-0 text-[var(--muted)]" />
            {formatPrice(cafe.priceLevel)}
          </p>
        )}
        {cafe.phone && (
          <a
            href={`tel:${cafe.phone.replace(/[^+\d]/g, "")}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 transition-colors hover:text-[#F0A34A]"
          >
            <Phone className="size-3.5 shrink-0 text-[var(--muted)]" />
            <span className="font-medium text-[#ECECEF]">{cafe.phone}</span>
          </a>
        )}
        {websiteHost && (
          <a
            href={cafe.website}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 transition-colors hover:text-[#F0A34A]"
          >
            <Globe className="size-3.5 shrink-0 text-[var(--muted)]" />
            <span className="line-clamp-1 font-medium text-[#ECECEF]">{websiteHost}</span>
          </a>
        )}
        {cafe.rating == null &&
          cafe.isOpen == null &&
          cafe.priceLevel == null &&
          !cafe.phone &&
          !websiteHost && (
            <p className="flex items-center gap-1.5 text-[12px] text-[var(--muted)]">
              <Clock className="size-3.5" /> Details from Google Places
            </p>
          )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onClick}
          className="inline-flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-[#E79A3E] to-[#A96A2E] text-[13px] font-semibold text-white shadow-md shadow-[#c98642]/25 transition-all hover:brightness-110 active:scale-[0.98]"
        >
          <MapPin className="size-3.5" />
          View on Map
        </button>
        <button
          type="button"
          onClick={onDetails}
          className="inline-flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#E99A3D]/35 bg-[#12110D]/60 px-3 text-[13px] font-semibold text-[#F0A34A] transition-all hover:border-[#F0A34A]/70 hover:bg-[#241708]/60 active:scale-[0.98]"
        >
          <Info className="size-3.5" />
          View Details
        </button>
        <a
          href={directionsUrl(cafe)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#E99A3D]/35 bg-[#12110D]/60 px-3 text-[13px] font-semibold text-[#F0A34A] transition-all hover:border-[#F0A34A]/70 hover:bg-[#241708]/60 active:scale-[0.98]"
        >
          <Navigation className="size-3.5" />
          Directions
        </a>
      </div>
    </article>
  );
}
