"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Coffee,
  ExternalLink,
  Globe,
  MapPin,
  Navigation,
  Phone,
  Star,
  Wallet,
  X,
} from "lucide-react";
import { motion } from "framer-motion";
import type { GmsPlaceResult } from "@/lib/google-maps";
import {
  type Cafe,
  directionsUrl,
  formatDistance,
  formatPrice,
  friendlyMessage,
} from "./cafe-types";

export function CafeDetails({
  cafe,
  getDetails,
  onClose,
  onViewOnMap,
}: {
  cafe: Cafe;
  getDetails: (placeId: string) => Promise<GmsPlaceResult>;
  onClose: () => void;
  onViewOnMap: () => void;
}) {
  const [details, setDetails] = useState<GmsPlaceResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPhotoIndex(0);
    getDetails(cafe.placeId)
      .then((d) => {
        if (!cancelled) setDetails(d);
      })
      .catch((e) => {
        if (!cancelled) setError(friendlyMessage(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cafe.placeId, getDetails]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const photos = useMemo(() => {
    const fromDetail = (details?.photos ?? []).map((p) => p.getUrl({ maxWidth: 1200 }));
    const combined = fromDetail.length ? fromDetail : (cafe.photos ?? []);
    return combined.filter((u): u is string => typeof u === "string" && u.length > 0);
  }, [details, cafe.photos]);

  const safeIndex = photos.length ? Math.min(photoIndex, photos.length - 1) : 0;
  const nextPhoto = () => setPhotoIndex((i) => (i + 1) % Math.max(photos.length, 1));
  const prevPhoto = () =>
    setPhotoIndex((i) => (i - 1 + Math.max(photos.length, 1)) % Math.max(photos.length, 1));

  const name = details?.name?.trim() || cafe.name;
  const rating = details?.rating ?? cafe.rating;
  const ratingCount = details?.user_ratings_total ?? cafe.ratingCount;
  const priceLevel = details?.price_level ?? cafe.priceLevel;
  const address = details?.formatted_address?.trim() || cafe.address;
  const isOpen = details?.opening_hours?.open_now ?? cafe.isOpen;
  const hours = details?.opening_hours?.weekday_text?.length
    ? details.opening_hours.weekday_text
    : (cafe.hours ?? []);
  const phone = details?.international_phone_number || details?.formatted_phone_number || cafe.phone;
  const website = details?.website || cafe.website;
  const mapUrl = details?.url || cafe.mapUrl;
  const dirs = directionsUrl(cafe);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="relative flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-[24px] border border-[#2E2118]/70 bg-[#12110D] shadow-[0_50px_120px_-30px_rgba(0,0,0,0.9)]"
      >
        {/* ------------------------------ HERO ------------------------------ */}
        <div className="relative h-52 shrink-0 overflow-hidden bg-gradient-to-br from-[#2A1B12] to-[#12110D] sm:h-60">
          {photos[safeIndex] ? (
            <img
              src={photos[safeIndex]}
              alt={name}
              className="absolute inset-0 size-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center">
              <div className="flex flex-col items-center gap-2 text-[#E79A3E]/60">
                <Coffee className="size-12" />
                <span className="text-[12px] font-medium tracking-wide">No photos yet</span>
              </div>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#12110D] via-transparent to-black/30" />

          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={prevPhoto}
                aria-label="Previous photo"
                className="absolute left-3 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-black/50 text-white backdrop-blur transition-colors hover:bg-black/70"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={nextPhoto}
                aria-label="Next photo"
                className="absolute right-3 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-black/50 text-white backdrop-blur transition-colors hover:bg-black/70"
              >
                <ChevronRight className="size-4" />
              </button>
              <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
                {photos.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${i === safeIndex ? "w-5 bg-[#F0A34A]" : "w-1.5 bg-white/40"}`}
                  />
                ))}
              </div>
            </>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="absolute right-3 top-3 grid size-9 place-items-center rounded-full border border-white/15 bg-black/50 text-white backdrop-blur transition-colors hover:bg-black/70"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* ----------------------------- BODY ------------------------------ */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          {loading && (
            <div className="space-y-3" aria-hidden>
              <div className="shimmer h-6 w-2/3 rounded-full" />
              <div className="shimmer h-4 w-1/3 rounded-full" />
              <div className="mt-4 shimmer h-4 w-full rounded-full" />
              <div className="shimmer h-4 w-5/6 rounded-full" />
              <div className="shimmer h-4 w-3/4 rounded-full" />
            </div>
          )}

          {!loading && error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-[13px] leading-snug text-red-300"
            >
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-red-500/20 text-[11px] font-bold">
                !
              </span>
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-[20px] font-bold leading-snug tracking-tight text-[#F5F5F5]">
                    {name}
                  </h2>
                  {isOpen != null && (
                    <span
                      className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        isOpen ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
                      }`}
                    >
                      <span
                        className={`size-1.5 rounded-full ${isOpen ? "bg-emerald-400" : "bg-red-400"}`}
                      />
                      {isOpen ? "Open now" : "Closed now"}
                    </span>
                  )}
                </div>
                {rating != null && (
                  <div className="shrink-0 rounded-2xl border border-[#2E2118]/70 bg-[#0D0C0A] px-3 py-2 text-center">
                    <p className="flex items-center gap-1 text-[15px] font-bold text-[#F5F5F5]">
                      <Star className="size-3.5 fill-[#F0A34A] text-[#F0A34A]" />
                      {rating.toFixed(1)}
                    </p>
                    {ratingCount != null && (
                      <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                        {ratingCount} reviews
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-5 space-y-2.5 text-[13px] text-[#A7A7AD]">
                {address && (
                  <p className="flex items-start gap-2.5 leading-snug">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-[#E79A3E]" />
                    <span className="font-medium text-[#ECECEF]">{address}</span>
                  </p>
                )}
                <p className="flex items-center gap-2.5">
                  <Navigation className="size-4 shrink-0 text-[var(--muted)]" />
                  <span className="font-medium text-[#ECECEF]">
                    {formatDistance(cafe.distanceKm)}
                  </span>
                </p>
                {priceLevel != null && (
                  <p className="flex items-center gap-2.5">
                    <Wallet className="size-4 shrink-0 text-[var(--muted)]" />
                    <span className="font-medium text-[#ECECEF]">{formatPrice(priceLevel)}</span>
                  </p>
                )}
                {phone && (
                  <a
                    href={`tel:${phone.replace(/[^+\d]/g, "")}`}
                    className="flex items-center gap-2.5 transition-colors hover:text-[#F0A34A]"
                  >
                    <Phone className="size-4 shrink-0 text-[var(--muted)]" />
                    <span className="font-medium text-[#ECECEF]">{phone}</span>
                  </a>
                )}
                {website && (
                  <a
                    href={website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 transition-colors hover:text-[#F0A34A]"
                  >
                    <Globe className="size-4 shrink-0 text-[var(--muted)]" />
                    <span className="line-clamp-1 font-medium text-[#ECECEF] underline-offset-2 hover:underline">
                      {website}
                    </span>
                  </a>
                )}
              </div>

              {hours.length > 0 && (
                <div className="mt-5 rounded-2xl border border-[#2E2118]/70 bg-[#0D0C0A]/70 p-4">
                  <p className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#F0A34A]">
                    <Clock className="size-3.5" />
                    Opening hours
                  </p>
                  <ul className="space-y-1 text-[13px] text-[#A7A7AD]">
                    {hours.map((h) => (
                      <li key={h} className="flex justify-between gap-3">
                        {(() => {
                          const idx = h.indexOf(":");
                          const day = idx > 0 ? h.slice(0, idx) : "";
                          const rest = idx > 0 ? h.slice(idx + 1).trim() : h;
                          return (
                            <>
                              <span className="shrink-0 font-semibold text-[#ECECEF]">{day}</span>
                              <span className="truncate text-right">{rest}</span>
                            </>
                          );
                        })()}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
                <a
                  href={dirs}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-[#E79A3E] to-[#A96A2E] text-[14px] font-semibold text-white shadow-lg shadow-[#c98642]/25 transition-all hover:brightness-110 active:scale-[0.99]"
                >
                  <Navigation className="size-4" />
                  Get Directions
                </a>
                <button
                  type="button"
                  onClick={onViewOnMap}
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[#E99A3D]/35 bg-[#1A130D]/80 text-[14px] font-semibold text-[#F0A34A] transition-all hover:border-[#F0A34A]/70 hover:bg-[#241708]/80 active:scale-[0.99]"
                >
                  <MapPin className="size-4" />
                  View on Map
                </button>
                <a
                  href={mapUrl || dirs}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#2E2118]/70 bg-[#12110D]/80 px-4 text-[14px] font-semibold text-[#ECECEF] transition-colors hover:border-[#E79A3E]/40 hover:text-[#F0A34A] active:scale-[0.99]"
                >
                  <ExternalLink className="size-4" />
                  Google Maps
                </a>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
