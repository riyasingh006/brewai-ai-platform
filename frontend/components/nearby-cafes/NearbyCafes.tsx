"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Coffee, Loader2, LocateFixed, MapPin, RefreshCw } from "lucide-react";
import {
  computeIsOpen,
  loadGoogleMaps,
  newPlaceToResult,
  placeDisplayName,
  placeLocation,
  placeUriToUrl,
  priceLevelToNumber,
  type GmsNamespace,
  type GmsNewPlace,
  type GmsPlaceResult,
  type LatLngLike,
} from "@/lib/google-maps";
import { CafeSearch, type SearchLocation } from "./CafeSearch";
import { CafeFilters } from "./CafeFilters";
import { CafeMap } from "./CafeMap";
import { CafeCard } from "./CafeCard";
import { CafeDetails } from "./CafeDetails";
import { LocationButton } from "./LocationButton";
import {
  RADII,
  type Cafe,
  type Phase,
  type RatingFilter,
  type SortBy,
  friendlyMessage,
  haversineKm,
} from "./cafe-types";

type MapsState = "loading" | "ready" | "error";

function placesToCafes(places: GmsNewPlace[], origin: LatLngLike): Cafe[] {
  const seen = new Set<string>();
  const out: Cafe[] = [];
  for (const p of places) {
    try {
      const placeId = p.id;
      const location = placeLocation(p.location);
      if (!placeId || !location || seen.has(placeId)) continue;
      seen.add(placeId);
      const photos = (p.photos ?? [])
        .map((ph) => {
          try {
            return ph.getUrl({ maxWidth: 800 });
          } catch {
            return "";
          }
        })
        .filter((u): u is string => typeof u === "string" && u.length > 0);
      out.push({
        placeId,
        name: placeDisplayName(p) || "Unnamed café",
        address: p.formattedAddress?.trim() || p.shortFormattedAddress?.trim() || "",
        rating: p.rating,
        ratingCount: p.userRatingCount,
        priceLevel: priceLevelToNumber(p.priceLevel),
        isOpen: computeIsOpen(p.regularOpeningHours),
        phone: p.internationalPhoneNumber?.trim() || p.nationalPhoneNumber?.trim() || undefined,
        website: placeUriToUrl(p.websiteURI),
        mapUrl: placeUriToUrl(p.googleMapsURI),
        photos,
        hours: p.regularOpeningHours?.weekdayDescriptions?.length
          ? p.regularOpeningHours.weekdayDescriptions
          : undefined,
        latitude: location.lat,
        longitude: location.lng,
        distanceKm: haversineKm(origin, location),
      });
    } catch {
      // A single malformed place must never fail the whole batch.
    }
  }
  return out;
}

/** Defensive extractor: handle arrays or any wrapper the API may return. */
function extractPlaces(payload: unknown): GmsNewPlace[] {
  if (Array.isArray(payload)) return payload as GmsNewPlace[];
  if (payload && typeof payload === "object") {
    const rec = payload as Record<string, unknown>;
    for (const key of ["places", "results", "cafes", "data"]) {
      const value = rec[key];
      if (Array.isArray(value)) return value as GmsNewPlace[];
    }
  }
  return [];
}

export function NearbyCafes() {
  const [mapsState, setMapsState] = useState<MapsState>("loading");
  const [mapsError, setMapsError] = useState<string | null>(null);
  const [gms, setGms] = useState<GmsNamespace | null>(null);
  const searchNonce = useRef(0);

  const [center, setCenter] = useState<LatLngLike | null>(null);
  const [centerLabel, setCenterLabel] = useState("");
  const [userLocation, setUserLocation] = useState<LatLngLike | null>(null);
  const [cafes, setCafes] = useState<Cafe[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [geolocating, setGeolocating] = useState(false);

  const [radius, setRadius] = useState<number>(5);
  const [ratingMin, setRatingMin] = useState<RatingFilter>(0);
  const [openNow, setOpenNow] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("recommended");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailsCafe, setDetailsCafe] = useState<Cafe | null>(null);

  const [query, setQuery] = useState("");

  const filterLogRef = useRef({ ratingMin, openNow, sortBy, query });

  useEffect(() => {
    filterLogRef.current = { ratingMin, openNow, sortBy, query };
  }, [ratingMin, openNow, sortBy, query]);

  useEffect(() => {
    let cancelled = false;
    setMapsState("loading");
    loadGoogleMaps()
      .then((ns) => {
        if (cancelled) return;
        setGms(ns);
        setMapsState("ready");
      })
      .catch((e) => {
        if (cancelled) return;
        setMapsState("error");
        setMapsError(friendlyMessage(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const retryMaps = useCallback(() => {
    setMapsState("loading");
    setMapsError(null);
    loadGoogleMaps()
      .then((ns) => {
        setGms(ns);
        setMapsState("ready");
      })
      .catch((e) => {
        setMapsState("error");
        setMapsError(friendlyMessage(e));
      });
  }, []);

  const fetchDetails = useCallback(
    (placeId: string) =>
      new Promise<GmsPlaceResult>((resolve, reject) => {
        const placeCtor = gms?.places?.Place;
        if (!placeCtor) {
          reject(new Error("PLACES_FAILED"));
          return;
        }
        const place = new placeCtor({ id: placeId });
        place
          .fetchFields({
            fields: [
              "id",
              "displayName",
              "formattedAddress",
              "location",
              "rating",
              "userRatingCount",
              "priceLevel",
              "regularOpeningHours",
              "internationalPhoneNumber",
              "nationalPhoneNumber",
              "photos",
            ],
          })
          .then(() => resolve(newPlaceToResult(place)))
          .catch(() => reject(new Error("PLACES_FAILED")));
      }),
    [gms],
  );

  const openDetails = useCallback((cafe: Cafe) => {
    setDetailsCafe(cafe);
  }, []);

  const closeDetails = useCallback(() => {
    setDetailsCafe(null);
  }, []);

  const viewOnMapFromDetails = useCallback(() => {
    const cafe = detailsCafe;
    setDetailsCafe(null);
    if (cafe) setSelectedId(cafe.placeId);
  }, [detailsCafe]);

  const searchNearby = useCallback(
    async (lat: number, lng: number, radiusKm: number, label: string) => {
      const nonce = ++searchNonce.current;
      setPhase("loading");
      setSearchError(null);
      setCafes([]);
      setSelectedId(null);
      setCenter({ lat, lng });
      setCenterLabel(label);

      try {
        let ns = gms;
        if (!ns) {
          ns = await loadGoogleMaps();
          setGms(ns);
        }
        const placeCtor = ns.places?.Place;
        if (!placeCtor) throw new Error("PLACES_FAILED");

        // The JS library validates searchNearby's locationRestriction as a
        // google.maps.Circle instance; literals / LatLngBounds throw
        // InvalidValueError. radius is in meters.
        const circle = new ns.Circle({
          center: new ns.LatLng(lat, lng),
          radius: radiusKm * 1000,
        });

        const result = await placeCtor.searchNearby({
          fields: [
            "id",
            "displayName",
            "formattedAddress",
            "shortFormattedAddress",
            "location",
            "rating",
            "userRatingCount",
            "priceLevel",
            "regularOpeningHours",
            "internationalPhoneNumber",
            "nationalPhoneNumber",
            "photos",
          ],
          includedTypes: ["cafe"],
          locationRestriction: circle,
          maxResultCount: 20,
        });

        if (nonce !== searchNonce.current) return;
        const places = extractPlaces(result);
        const parsed = placesToCafes(places, { lat, lng });
        if (process.env.NODE_ENV === "development") {
          console.log("[Nearby Cafes] Search succeeded:", {
            lat,
            lng,
            radiusKm,
            label,
            filters: filterLogRef.current,
            apiPlaces: places.length,
            parsed: parsed.length,
          });
        }
        setCafes(parsed);
        setPhase("ready");
      } catch (e) {
        if (nonce !== searchNonce.current) return;
        const err = e as { message?: string; name?: string; code?: number } | unknown;
        const message = e instanceof Error ? e.message : String(e);
        if (process.env.NODE_ENV === "development") {
          console.error("[Nearby Cafes] Search failed:", {
            lat,
            lng,
            radiusKm,
            label,
            filters: filterLogRef.current,
            errorName: (err as { name?: string })?.name,
            errorCode: (err as { code?: number })?.code,
            message,
          });
        }
        setCafes([]);
        setPhase("error");
        setSearchError(friendlyMessage(e));
      }
    },
    [gms],
  );

  const locate = useCallback(() => {
    setGeolocating(true);
    setSearchError(null);
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setGeolocating(false);
      setSearchError(friendlyMessage(new Error("GEOLOCATION_UNSUPPORTED")));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeolocating(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserLocation({ lat, lng });
        void searchNearby(lat, lng, radius, "Your Location");
      },
      (err) => {
        setGeolocating(false);
        const code =
          err.code === err.PERMISSION_DENIED ? "GEOLOCATION_DENIED" : "GEOLOCATION_UNAVAILABLE";
        setSearchError(friendlyMessage(new Error(code)));
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }, [radius, searchNearby]);

  const handleLocationFound = useCallback(
    (loc: SearchLocation) => {
      void searchNearby(loc.lat, loc.lng, radius, loc.label);
    },
    [radius, searchNearby],
  );

  const changeRadius = useCallback(
    (r: number) => {
      setRadius(r);
      if (center) void searchNearby(center.lat, center.lng, r, centerLabel);
    },
    [center, centerLabel, searchNearby],
  );

  const increaseRadius = useCallback(() => {
    const next = RADII[Math.min(RADII.indexOf(radius) + 1, RADII.length - 1)];
    changeRadius(next);
  }, [radius, changeRadius]);

  const clearFilters = useCallback(() => {
    setRatingMin(0);
    setOpenNow(false);
    setSortBy("recommended");
  }, []);

  const focusCard = useCallback((placeId: string) => {
    setSelectedId(placeId);
    requestAnimationFrame(() => {
      document
        .getElementById(`cafe-${placeId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, []);

  const focusSearchInput = useCallback(() => {
    document.getElementById("nearby-search-input")?.focus();
  }, []);

  const visibleCafes = useMemo(() => {
    let list = cafes.filter((c) => c.distanceKm != null && c.distanceKm <= radius);
    if (ratingMin > 0) list = list.filter((c) => (c.rating ?? 0) >= ratingMin);
    if (openNow) list = list.filter((c) => c.isOpen === true);
    const sorted = [...list];
    if (sortBy === "distance") {
      sorted.sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9));
    } else if (sortBy === "rating") {
      sorted.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    } else {
      sorted.sort(
        (a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9),
      );
    }
    return sorted;
  }, [cafes, radius, ratingMin, openNow, sortBy]);

  const mapsReady = mapsState === "ready";
  const controlsDisabled = !mapsReady;
  const hasActiveFilters = ratingMin > 0 || openNow || sortBy !== "recommended";
  const showEmpty = phase === "ready" && visibleCafes.length === 0;

  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 px-5 py-8 sm:px-8">
      {/* ------------------------------ HEADING ------------------------------ */}
      <div className="max-w-2xl">
        <span className="inline-flex items-center gap-2 rounded-full border border-[#E99A3D]/25 bg-[#2A1B12]/60 px-4 py-1.5 text-[12px] font-semibold tracking-wide text-[#F0A34A]">
          <MapPin className="size-3.5" />
          Nearby Cafés
        </span>
        <h1 className="mt-4 text-[clamp(30px,3.5vw,46px)] font-extrabold tracking-tight text-[#F5F5F5]">
          Find Cafés <span className="text-gradient">Near You</span>
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[#A7A7AD] sm:text-[16px]">
          Discover great coffee spots around your current location.
        </p>
      </div>

      {/* ------------------------ SEARCH + LOCATION ------------------------ */}
      <div className="mt-7 flex flex-col gap-3 lg:flex-row lg:items-start">
        <CafeSearch
          gms={gms}
          query={query}
          onQueryChange={setQuery}
          onLocationFound={handleLocationFound}
          disabled={controlsDisabled}
        />
        <LocationButton onClick={locate} loading={geolocating} disabled={controlsDisabled} />
      </div>

      {/* ------------------------------- BANNERS ---------------------------- */}
      {mapsError && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2.5 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-[13px] leading-snug text-amber-200"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-400" />
          <span>{mapsError}</span>
        </div>
      )}
      {searchError && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2.5 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-[13px] leading-snug text-red-300"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-400" />
          <span>{searchError}</span>
        </div>
      )}

      {/* ------------------------------- LAYOUT ----------------------------- */}
      <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* List column */}
        <div className="flex min-w-0 flex-col gap-4">
          <CafeFilters
            radius={radius}
            onRadius={changeRadius}
            ratingMin={ratingMin}
            onRating={setRatingMin}
            openNow={openNow}
            onOpenNow={setOpenNow}
            sortBy={sortBy}
            onSort={setSortBy}
            disabled={controlsDisabled}
          />

          {phase === "loading" && <CafeSkeletons />}

          {phase === "idle" && !mapsError && (
            <div className="card-luxe flex flex-col items-center gap-3 p-6 text-center">
              <div className="grid size-12 place-items-center rounded-2xl bg-[#2A1B12]/70 text-[#F0A34A]">
                <Coffee className="size-6" />
              </div>
              <div>
                <h3 className="text-[16px] font-bold text-[#F5F5F5]">
                  Find cafés near you
                </h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-[#A7A7AD]">
                  Use your current location or search an area to discover real coffee spots
                  nearby.
                </p>
              </div>
            </div>
          )}

          {phase === "ready" && visibleCafes.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="flex items-center justify-between text-[12px] font-medium text-[var(--muted)]">
                <span>
                  {visibleCafes.length} café{visibleCafes.length === 1 ? "" : "s"} found near{" "}
                  {centerLabel || "this location"}
                </span>
                <button
                  type="button"
                  onClick={focusSearchInput}
                  className="flex items-center gap-1 text-[#F0A34A] transition-colors hover:text-[#F0A34A]/75"
                >
                  <RefreshCw className="size-3" />
                  Search again
                </button>
              </p>
              {visibleCafes.map((cafe) => (
                <CafeCard
                  key={cafe.placeId}
                  cafe={cafe}
                  active={selectedId === cafe.placeId}
                  onClick={() => setSelectedId(cafe.placeId)}
                  onDetails={() => openDetails(cafe)}
                />
              ))}
            </div>
          )}

          {showEmpty && (
            <div className="card-luxe flex flex-col items-center gap-3 p-6 text-center">
              <div className="grid size-12 place-items-center rounded-2xl bg-[#2A1B12]/70 text-[#F0A34A]">
                <Coffee className="size-6" />
              </div>
              <div>
                <h3 className="text-[16px] font-bold text-[#F5F5F5]">
                  No cafés found nearby.
                </h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-[#A7A7AD]">
                  Try increasing your search radius or searching another location.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={increaseRadius}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-[#E79A3E] to-[#A96A2E] px-4 text-[13px] font-semibold text-white shadow-md shadow-[#c98642]/25 transition-all hover:brightness-110"
                >
                  <LocateFixed className="size-4" />
                  Increase Radius
                </button>
                <button
                  type="button"
                  onClick={focusSearchInput}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[#E99A3D]/35 bg-[#12110D]/60 px-4 text-[13px] font-semibold text-[#F0A34A] transition-all hover:border-[#F0A34A]/70"
                >
                  Search Another Location
                </button>
              </div>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-[12px] font-semibold text-[#F0A34A] transition-colors hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Map column */}
        <div className="relative h-[380px] overflow-hidden rounded-2xl sm:h-[480px] lg:sticky lg:top-24 lg:h-[calc(100vh-220px)] lg:min-h-[540px]">
          <CafeMap
            gms={gms}
            mapsError={mapsError}
            cafes={cafes}
            selectedId={selectedId}
            userLocation={userLocation}
            center={center}
            centerLabel={centerLabel}
            radiusKm={radius}
            onSelect={setSelectedId}
            onFocusCard={focusCard}
            onRetry={retryMaps}
          />
          {phase === "loading" && (
            <div className="absolute inset-0 z-20 grid place-items-center bg-[#0B0A08]/70 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-[#2E2118]/70 bg-[#12110D]/95 px-6 py-5 text-center shadow-2xl">
                <Loader2 className="size-6 animate-spin text-[#E79A3E]" />
                <p className="text-[13px] font-medium text-[#F5F5F5]">
                  Finding cafés near you…
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {detailsCafe && (
        <CafeDetails
          cafe={detailsCafe}
          getDetails={fetchDetails}
          onClose={closeDetails}
          onViewOnMap={viewOnMapFromDetails}
        />
      )}
    </main>
  );
}

function CafeSkeletons() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="card-luxe p-4">
          <div className="shimmer h-4 w-2/3 rounded-full" />
          <div className="mt-3 shimmer h-3 w-1/3 rounded-full" />
          <div className="mt-2 shimmer h-3 w-1/2 rounded-full" />
          <div className="mt-4 flex gap-2">
            <div className="shimmer h-9 flex-1 rounded-xl" />
            <div className="shimmer h-9 w-28 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}
