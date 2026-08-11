"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Search } from "lucide-react";
import { placeDisplayName, placeLocation, type GmsNamespace } from "@/lib/google-maps";
import { ERR, friendlyMessage } from "./cafe-types";

export interface SearchLocation {
  label: string;
  lat: number;
  lng: number;
}

interface Suggestion {
  placeId: string;
  main: string;
  secondary?: string;
}

const SEARCH_FIELDS = ["id", "displayName", "formattedAddress", "location"];

export function CafeSearch({
  gms,
  query,
  onQueryChange,
  onLocationFound,
  disabled,
}: {
  gms: GmsNamespace | null;
  query: string;
  onQueryChange: (v: string) => void;
  onLocationFound: (loc: SearchLocation) => void;
  disabled?: boolean;
}) {
  const [predictions, setPredictions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  const handleInput = (value: string) => {
    onQueryChange(value);
    setLocalError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = value.trim();
    if (!trimmed || !gms) {
      setPredictions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      gms.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: trimmed,
      })
        .then(({ suggestions }) => {
          const items: Suggestion[] = (suggestions ?? [])
            .map((s): Suggestion | null => {
              const pred = s.placePrediction;
              if (!pred?.placeId) return null;
              return {
                placeId: pred.placeId,
                main:
                  pred.structuredFormat?.mainText?.text?.trim() ||
                  pred.text?.text?.trim() ||
                  pred.placeId,
                secondary: pred.structuredFormat?.secondaryText?.text,
              };
            })
            .filter((s): s is Suggestion => s !== null);
          setPredictions(items);
          setOpen(items.length > 0);
        })
        .catch(() => {
          setPredictions([]);
          setOpen(false);
        });
    }, 300);
  };

  const detailsFromPlaceId = async (placeId: string): Promise<SearchLocation> => {
    if (!gms?.places?.Place) throw new Error(ERR.SEARCH_FAILED);
    const place = new gms.places.Place({ id: placeId });
    await place.fetchFields({ fields: SEARCH_FIELDS });
    const loc = placeLocation(place.location);
    if (!loc) throw new Error(ERR.INVALID_LOCATION);
    return {
      label: placeDisplayName(place) || place.formattedAddress?.trim() || "Selected location",
      lat: loc.lat,
      lng: loc.lng,
    };
  };

  const placeFromQuery = async (q: string): Promise<SearchLocation> => {
    if (!gms?.places?.Place) throw new Error(ERR.SEARCH_FAILED);
    const { places } = await gms.places.Place.searchByText({
      textQuery: q,
      fields: SEARCH_FIELDS,
    });
    const first = places?.[0];
    const loc = placeLocation(first?.location);
    if (!first || !loc) throw new Error(ERR.INVALID_LOCATION);
    return {
      label: placeDisplayName(first) || first.formattedAddress?.trim() || q,
      lat: loc.lat,
      lng: loc.lng,
    };
  };

  const runSearch = async (raw: string, suggestion?: Suggestion) => {
    setOpen(false);
    setPredictions([]);
    setBusy(true);
    setLocalError(null);
    try {
      const loc = suggestion
        ? await detailsFromPlaceId(suggestion.placeId)
        : await placeFromQuery(raw);
      onLocationFound(loc);
    } catch (e) {
      setLocalError(friendlyMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const pickPrediction = (s: Suggestion) => {
    onQueryChange(s.main);
    void runSearch(s.main, s);
  };

  const submit = () => {
    const trimmed = query.trim();
    if (trimmed) void runSearch(trimmed);
  };

  const searchDisabled = disabled || !gms || busy;

  return (
    <div className="relative min-w-0 flex-1">
      <div className="flex items-stretch gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]" />
          <input
            id="nearby-search-input"
            type="text"
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            onFocus={() => {
              if (predictions.length) setOpen(true);
            }}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            disabled={disabled}
            placeholder="Search a location or area…"
            className="h-[54px] w-full rounded-2xl border border-[#2E2118]/70 bg-[#12110D]/80 pl-11 pr-4 text-[15px] text-[#F5F5F5] placeholder:text-[#6B6662] shadow-inner transition-all focus:border-[#E79A3E]/60 focus:outline-none focus:ring-4 focus:ring-[#E79A3E]/15 disabled:opacity-60"
          />
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={searchDisabled || !query.trim()}
          className="inline-flex h-[54px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-[#E79A3E] to-[#A96A2E] px-5 text-[15px] font-semibold text-white shadow-lg shadow-[#c98642]/25 transition-all hover:brightness-110 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          <span className="hidden sm:inline">Search</span>
        </button>
      </div>

      {open && predictions.length > 0 && (
        <ul className="absolute inset-x-0 top-[60px] z-20 overflow-hidden rounded-2xl border border-[#2E2118]/70 bg-[#14110D]/95 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          {predictions.map((s) => (
            <li key={s.placeId}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pickPrediction(s)}
                className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[#2A1B12]/60"
              >
                <MapPin className="mt-0.5 size-4 shrink-0 text-[#E79A3E]" />
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-semibold text-[#F5F5F5]">
                    {s.main}
                  </span>
                  {s.secondary && (
                    <span className="block truncate text-[12px] text-[#A7A7AD]">
                      {s.secondary}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-2 text-[12px] text-[var(--muted)]">
        Try: Delhi · Gurugram · Chandigarh · Connaught Place · Sector 17 Chandigarh
      </p>

      {localError && (
        <p
          role="alert"
          className="mt-2 flex items-start gap-1.5 text-[12px] leading-snug text-red-400"
        >
          <span aria-hidden>!</span>
          {localError}
        </p>
      )}
    </div>
  );
}
