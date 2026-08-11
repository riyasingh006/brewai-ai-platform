"use client";

import { useEffect, useRef } from "react";
import { Loader2, MapPin, RefreshCw, WifiOff } from "lucide-react";
import {
  DARK_MAP_STYLES,
  cafePinIcon,
  userPinIcon,
  zoomForRadius,
  type GmsInfoWindow,
  type GmsMap,
  type GmsMarker,
  type GmsNamespace,
  type LatLngLike,
} from "@/lib/google-maps";
import { type Cafe, directionsUrl, formatPrice } from "./cafe-types";

interface CafeMapProps {
  gms: GmsNamespace | null;
  mapsError: string | null;
  cafes: Cafe[];
  selectedId: string | null;
  userLocation: LatLngLike | null;
  center: LatLngLike | null;
  centerLabel: string;
  radiusKm: number;
  onMapReady?: (map: GmsMap) => void;
  onSelect: (placeId: string | null) => void;
  onFocusCard: (placeId: string) => void;
  onRetry?: () => void;
}

function el(tag: string, className?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function buildInfoContent(cafe: Cafe, onDetails: () => void): HTMLElement {
  const root = el("div", "brew-info");

  const name = el("div", "brew-info-name", cafe.name);
  root.appendChild(name);

  if (cafe.rating != null) {
    const rating = el("div", "brew-info-line");
    const star = el("span", "brew-info-star", "★");
    rating.appendChild(star);
    rating.appendChild(document.createTextNode(` ${cafe.rating.toFixed(1)}`));
    root.appendChild(rating);
  }

  if (cafe.address) {
    root.appendChild(el("div", "brew-info-line brew-info-muted", cafe.address));
  }

  if (cafe.isOpen != null) {
    const status = el(
      "div",
      `brew-info-status ${cafe.isOpen ? "is-open" : "is-closed"}`,
      cafe.isOpen ? "Open now" : "Closed now",
    );
    root.appendChild(status);
  }

  if (cafe.priceLevel != null) {
    root.appendChild(
      el("div", "brew-info-line brew-info-muted", `Price: ${formatPrice(cafe.priceLevel)}`),
    );
  }

  const actions = el("div", "brew-info-actions");
  const detailsBtn = el("button", "brew-info-btn", "View Details");
  detailsBtn.addEventListener("click", onDetails);
  const directionsLink = el("a", "brew-info-btn brew-info-btn-outline", "Get Directions");
  directionsLink.setAttribute("href", directionsUrl(cafe));
  directionsLink.setAttribute("target", "_blank");
  directionsLink.setAttribute("rel", "noopener noreferrer");
  actions.appendChild(detailsBtn);
  actions.appendChild(directionsLink);
  root.appendChild(actions);

  return root;
}

export function CafeMap({
  gms,
  mapsError,
  cafes,
  selectedId,
  userLocation,
  center,
  centerLabel,
  radiusKm,
  onMapReady,
  onSelect,
  onFocusCard,
  onRetry,
}: CafeMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GmsMap | null>(null);
  const markersRef = useRef<Map<string, GmsMarker>>(new Map());
  const userMarkerRef = useRef<GmsMarker | null>(null);
  const infoWindowRef = useRef<GmsInfoWindow | null>(null);

  // Create the map exactly once, when the API is available.
  useEffect(() => {
    if (!gms || !containerRef.current || mapRef.current) return;
    try {
      const map = new gms.Map(containerRef.current, {
        center: { lat: 20.5937, lng: 78.9629 },
        zoom: 5,
        disableDefaultUI: false,
        zoomControl: true,
        fullscreenControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        styles: DARK_MAP_STYLES,
      });
      mapRef.current = map;
      infoWindowRef.current = new gms.InfoWindow({ maxWidth: 300 });
      map.addListener("click", () => {
        infoWindowRef.current?.close();
        onSelect(null);
      });
      onMapReady?.(map);
    } catch {
      // The parent surfaces a friendly message through mapsError when needed.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gms]);

  // Reconcile café markers whenever the result set or selection changes.
  useEffect(() => {
    if (!gms || !mapRef.current) return;
    const map = mapRef.current;
    const wanted = new Set(cafes.map((c) => c.placeId));
    for (const [id, marker] of markersRef.current) {
      if (!wanted.has(id)) {
        marker.setMap(null);
        markersRef.current.delete(id);
      }
    }
    for (const cafe of cafes) {
      const selected = cafe.placeId === selectedId;
      const marker = markersRef.current.get(cafe.placeId);
      if (!marker) {
        const created = new gms.Marker({
          map,
          position: { lat: cafe.latitude, lng: cafe.longitude },
          title: cafe.name,
        });
        created.addListener("click", () => onSelect(cafe.placeId));
        created.setIcon(cafePinIcon(selected));
        created.setZIndex(selected ? 100 : 1);
        markersRef.current.set(cafe.placeId, created);
        continue;
      }
      marker.setPosition({ lat: cafe.latitude, lng: cafe.longitude });
      marker.setIcon(cafePinIcon(selected));
      marker.setZIndex(selected ? 100 : 1);
    }
  }, [gms, cafes, selectedId, onSelect]);

  // Center + zoom whenever a new search location is set.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !center) return;
    map.setCenter(center);
    map.setZoom(zoomForRadius(radiusKm));
  }, [center, radiusKm]);

  // Show / hide the user's current location marker.
  useEffect(() => {
    if (!gms || !mapRef.current) return;
    if (userMarkerRef.current) {
      userMarkerRef.current.setMap(null);
      userMarkerRef.current = null;
    }
    if (userLocation) {
      const marker = new gms.Marker({
        map: mapRef.current,
        position: userLocation,
        icon: { url: userPinIcon(), anchor: new gms.Point(15, 15) },
        title: "Your Location",
        label: "You",
        zIndex: 200,
      });
      userMarkerRef.current = marker;
    }
  }, [gms, userLocation]);

  // Open the info popup when a café is selected.
  useEffect(() => {
    if (!gms || !mapRef.current || !infoWindowRef.current) return;
    if (!selectedId) {
      infoWindowRef.current.close();
      return;
    }
    const cafe = cafes.find((c) => c.placeId === selectedId);
    if (!cafe) return;
    const map = mapRef.current;
    map.panTo({ lat: cafe.latitude, lng: cafe.longitude });
    map.setZoom(16);
    const marker = markersRef.current.get(selectedId);
    infoWindowRef.current.setContent(
      buildInfoContent(cafe, () => onFocusCard(cafe.placeId)),
    );
    infoWindowRef.current.open(map, marker);
  }, [gms, selectedId, cafes, onFocusCard]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-[#2E2118]/70 bg-[#12110D]">
      <div ref={containerRef} className="absolute inset-0" />

      {!gms && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-[#12110D]/95 p-6">
          {mapsError ? (
            <div className="max-w-sm text-center">
              <div className="mx-auto grid size-12 place-items-center rounded-2xl border border-amber-500/25 bg-amber-500/10 text-amber-400">
                <WifiOff className="size-6" />
              </div>
              <p className="mt-4 text-[14px] font-semibold leading-snug text-[#F5F5F5]">
                Map unavailable
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-[#A7A7AD]">
                {mapsError}
              </p>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-4 inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#E99A3D]/35 bg-[#12110D]/60 px-4 text-[13px] font-semibold text-[#F0A34A] transition-all hover:border-[#F0A34A]/70 hover:bg-[#2A1B12]/60"
                >
                  <RefreshCw className="size-3.5" />
                  Retry
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-[#A7A7AD]">
              <Loader2 className="size-6 animate-spin text-[#E79A3E]" />
              <p className="text-[13px] font-medium">Loading Google Maps…</p>
            </div>
          )}
        </div>
      )}

      {centerLabel && gms && (
        <div className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full border border-[#2E2118]/70 bg-[#12110D]/90 px-3 py-1.5 text-[12px] font-semibold text-[#F0A34A] shadow-lg backdrop-blur">
          <MapPin className="size-3.5" />
          <span className="max-w-[180px] truncate">{centerLabel}</span>
        </div>
      )}
    </div>
  );
}
