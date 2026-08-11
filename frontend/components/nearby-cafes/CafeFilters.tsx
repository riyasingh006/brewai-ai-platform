"use client";

import { ArrowUpDown, Clock3, LocateFixed, Star } from "lucide-react";
import { RADII, type RatingFilter, type SortBy } from "./cafe-types";
import { cn } from "@/components/ui";

interface CafeFiltersProps {
  radius: number;
  onRadius: (r: number) => void;
  ratingMin: RatingFilter;
  onRating: (r: RatingFilter) => void;
  openNow: boolean;
  onOpenNow: (v: boolean) => void;
  sortBy: SortBy;
  onSort: (s: SortBy) => void;
  disabled?: boolean;
}

const RATING_OPTIONS: { value: RatingFilter; label: string }[] = [
  { value: 0, label: "Any" },
  { value: 4, label: "4.0+" },
  { value: 4.5, label: "4.5+" },
];

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "recommended", label: "Recommended" },
  { value: "distance", label: "Nearest" },
  { value: "rating", label: "Highest Rated" },
];

export function CafeFilters({
  radius,
  onRadius,
  ratingMin,
  onRating,
  openNow,
  onOpenNow,
  sortBy,
  onSort,
  disabled,
}: CafeFiltersProps) {
  const pill = (active: boolean) =>
    cn(
      "inline-flex h-9 items-center justify-center rounded-xl border px-2 text-[13px] font-semibold transition-all disabled:opacity-40 disabled:pointer-events-none",
      active
        ? "border-transparent bg-gradient-to-br from-[#E79A3E] to-[#A96A2E] text-white shadow-md shadow-[#c98642]/25"
        : "border-[#2E2118]/70 bg-[#12110D]/60 text-[#B9B9C1] hover:border-[#E79A3E]/40 hover:text-[#F0A34A]",
    );

  const label = (icon: React.ReactNode, text: string) => (
    <span className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
      <span className="text-[#E79A3E]">{icon}</span>
      {text}
    </span>
  );

  return (
    <div className="card-luxe space-y-4 p-4">
      <div>
        {label(<LocateFixed className="size-3.5" />, "Radius")}
        <div className="grid grid-cols-4 gap-1.5">
          {RADII.map((r) => (
            <button
              key={r}
              type="button"
              disabled={disabled}
              onClick={() => onRadius(r)}
              className={pill(radius === r)}
            >
              {r} km
            </button>
          ))}
        </div>
      </div>

      <div>
        {label(<Star className="size-3.5" />, "Minimum rating")}
        <div className="grid grid-cols-3 gap-1.5">
          {RATING_OPTIONS.map((o) => (
            <button
              key={o.label}
              type="button"
              disabled={disabled}
              onClick={() => onRating(o.value)}
              className={pill(ratingMin === o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={() => onOpenNow(!openNow)}
        className="flex w-full items-center justify-between rounded-xl border border-[#2E2118]/70 bg-[#12110D]/60 px-3 py-2.5 text-[13px] font-semibold text-[#ECECEF] transition-colors hover:border-[#E79A3E]/40 disabled:opacity-40 disabled:pointer-events-none"
      >
        <span className="flex items-center gap-2">
          <Clock3 className="size-4 text-[#E79A3E]" />
          Open Now
        </span>
        <span
          className={cn(
            "relative h-5 w-9 rounded-full transition-colors",
            openNow ? "bg-gradient-to-r from-[#E79A3E] to-[#A96A2E]" : "bg-[#2E2A24]",
          )}
          aria-hidden
        >
          <span
            className={cn(
              "absolute top-0.5 size-4 rounded-full bg-white shadow transition-all",
              openNow ? "left-[18px]" : "left-0.5",
            )}
          />
        </span>
      </button>

      <div>
        {label(<ArrowUpDown className="size-3.5" />, "Sort by")}
        <div className="grid grid-cols-3 gap-1.5">
          {SORT_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              disabled={disabled}
              onClick={() => onSort(o.value)}
              className={pill(sortBy === o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
