// Lightweight typed loader for the Google Maps JavaScript API (Maps + Places).
// The API key is NEVER hardcoded here — it is read from the environment variable
// NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (see .env.example). The script is loaded once
// and cached so the API is not re-initialized on every render.

export interface LatLngLike {
  lat: number;
  lng: number;
}

export interface LatLngBoundsLike {
  extend(point: LatLngLike): void;
  getCenter(): LatLngLike;
}

export interface GmsPoint {
  x: number;
  y: number;
}

export interface GmsMarker {
  addListener(eventName: string, handler: () => void): { remove(): void };
  setMap(map: GmsMap | null): void;
  setPosition(point: LatLngLike): void;
  setIcon(icon: string): void;
  setZIndex(z: number): void;
}

export interface GmsMarkerOptions {
  map?: GmsMap;
  position?: LatLngLike;
  icon?: string | { url: string; anchor?: GmsPoint };
  title?: string;
  label?: string;
  zIndex?: number;
}

export interface GmsInfoWindow {
  setContent(node: HTMLElement | string): void;
  open(map: GmsMap, anchor?: GmsMarker): void;
  close(): void;
}

export interface GmsMap {
  setCenter(point: LatLngLike): void;
  setZoom(zoom: number): void;
  panTo(point: LatLngLike): void;
  addListener(eventName: string, handler: () => void): { remove(): void };
}

export interface GmsMapStyle {
  featureType?: string;
  elementType?: string;
  stylers: Record<string, string>[];
}

export interface GmsMapOptions {
  center?: LatLngLike;
  zoom?: number;
  disableDefaultUI?: boolean;
  zoomControl?: boolean;
  fullscreenControl?: boolean;
  mapTypeControl?: boolean;
  streetViewControl?: boolean;
  styles?: GmsMapStyle[];
}

export interface GmsPlacePhoto {
  getUrl(options?: { maxWidth?: number; maxHeight?: number }): string;
}

export interface GmsPlaceResult {
  place_id?: string;
  name?: string;
  formatted_address?: string;
  vicinity?: string;
  geometry?: {
    location?: {
      lat: () => number;
      lng: () => number;
    };
  };
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  opening_hours?: { open_now?: boolean; weekday_text?: string[] };
  formatted_phone_number?: string;
  international_phone_number?: string;
  website?: string;
  url?: string;
  photos?: GmsPlacePhoto[];
}

// ---------------------------------------------------------------------------
// Places API (New) surface. The Google Cloud project for the configured key
// enables "Places API (New)" (the legacy "Places API" product is not active),
// so the app talks to the API through Place / AutocompleteSuggestion instead of
// the legacy PlacesService / AutocompleteService.
// ---------------------------------------------------------------------------

export type GmsPriceLevel =
  | "PRICE_LEVEL_FREE"
  | "PRICE_LEVEL_INEXPENSIVE"
  | "PRICE_LEVEL_MODERATE"
  | "PRICE_LEVEL_EXPENSIVE"
  | "PRICE_LEVEL_VERY_EXPENSIVE"
  | "FREE"
  | "INEXPENSIVE"
  | "MODERATE"
  | "EXPENSIVE"
  | "VERY_EXPENSIVE";

export interface GmsOpeningHoursPeriodTime {
  day?: number;
  hour?: number;
  minute?: number;
}

export interface GmsOpeningHoursPeriod {
  open?: GmsOpeningHoursPeriodTime;
  close?: GmsOpeningHoursPeriodTime;
}

export interface GmsOpeningHours {
  openNow?: boolean;
  weekdayDescriptions?: string[];
  periods?: GmsOpeningHoursPeriod[];
  specialDays?: unknown[];
}

export interface GmsCircle {
  getCenter(): LatLngLike;
  getRadius(): number;
}

export interface GmsNewPlace {
  id?: string;
  displayName?: { text?: string } | string;
  formattedAddress?: string;
  shortFormattedAddress?: string;
  location?: LatLngLike | { lat: () => number; lng: () => number };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: GmsPriceLevel | number;
  regularOpeningHours?: GmsOpeningHours;
  currentOpeningHours?: GmsOpeningHours;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteURI?: string | { toString(): string };
  googleMapsURI?: string | { toString(): string };
  photos?: GmsPlacePhoto[];
  fetchFields(request: { fields: string[] }): Promise<GmsNewPlace>;
}

export interface GmsNewPlacePrediction {
  placeId?: string;
  text?: { text?: string };
  structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } };
  toPlace?(): GmsNewPlace;
}

export interface GmsAutocompleteSuggestion {
  placePrediction?: GmsNewPlacePrediction;
}

export interface GmsPlaceConstructor {
  new (request: { id: string }): GmsNewPlace;
  searchNearby(request: {
    fields: string[];
    includedTypes: string[];
    locationRestriction:
      | GmsCircle
      | { circle: { center: LatLngLike; radius: number } };
    maxResultCount?: number;
  }): Promise<{ places: GmsNewPlace[] }>;
  searchByText(request: { fields: string[]; textQuery: string }): Promise<{
    places: GmsNewPlace[];
  }>;
}

export interface GmsNamespace {
  Map: new (element: HTMLElement, options?: GmsMapOptions) => GmsMap;
  Marker: new (options?: GmsMarkerOptions) => GmsMarker;
  InfoWindow: new (options?: { maxWidth?: number }) => GmsInfoWindow;
  LatLng: new (lat: number, lng: number) => LatLngLike;
  LatLngBounds: new () => LatLngBoundsLike;
  Circle: new (options?: { center?: LatLngLike; radius?: number }) => GmsCircle;
  Point: new (x: number, y: number) => GmsPoint;
  places: {
    Place: GmsPlaceConstructor;
    AutocompleteSuggestion: {
      fetchAutocompleteSuggestions(request: {
        input: string;
        region?: string;
      }): Promise<{ suggestions: GmsAutocompleteSuggestion[] }>;
    };
  };
}

declare global {
  interface Window {
    __brewaiGmapsInit?: () => void;
    google?: { maps?: GmsNamespace };
  }
}

export const GMAPS_ERROR = {
  KEY_MISSING: "MAPS_KEY_MISSING",
  LOAD_FAILED: "MAPS_LOAD_FAILED",
} as const;

export type GmapsErrorCode = (typeof GMAPS_ERROR)[keyof typeof GMAPS_ERROR];

/** Dark, warm map style so the map integrates with the BrewAI interface. */
export const DARK_MAP_STYLES: GmsMapStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#171310" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a8378" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#171310" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#3a2f20" }] },
  { featureType: "administrative.country", elementType: "labels.text.fill", stylers: [{ color: "#c98b45" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#211c16" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#8a6b48" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#1d2217" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#5c6b4f" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2a251d" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#221e17" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#7d7468" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2f281d" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#141e20" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#3d4d52" }] },
];

let mapsPromise: Promise<GmsNamespace> | null = null;

export function getGoogleMapsApiKey(): string {
  return (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "").trim();
}

export function isMapsConfigured(): boolean {
  return getGoogleMapsApiKey().length > 0;
}

/** Normalize a Place.location (LatLng object or literal) into a plain point. */
export function placeLocation(
  point: GmsNewPlace["location"],
): LatLngLike | null {
  if (!point) return null;
  const lat = typeof point.lat === "function" ? point.lat() : point.lat;
  const lng = typeof point.lng === "function" ? point.lng() : point.lng;
  if (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  ) {
    return { lat, lng };
  }
  return null;
}

/** Map a Places API (New) price-level enum onto the numeric price indicator. */
export function priceLevelToNumber(
  level?: GmsPriceLevel | number,
): number | undefined {
  if (typeof level === "number") return level;
  const key = level?.replace(/^PRICE_LEVEL_/, "").toUpperCase();
  switch (key) {
    case "FREE":
      return 0;
    case "INEXPENSIVE":
      return 1;
    case "MODERATE":
      return 2;
    case "EXPENSIVE":
      return 3;
    case "VERY_EXPENSIVE":
      return 4;
    default:
      return undefined;
  }
}

/** Normalize a Place displayName (plain string or {text}) to a trimmed string. */
export function placeDisplayName(
  place: Pick<GmsNewPlace, "displayName">,
): string | undefined {
  const d = place.displayName;
  if (typeof d === "string") return d.trim() || undefined;
  return d?.text?.trim() || undefined;
}

/**
 * Best-effort "is open now" from a Place opening-hours object. The JS library
 * may not populate `openNow`, so fall back to computing from `periods` using
 * the current local time. Returns undefined when no reliable data exists.
 */
export function computeIsOpen(
  hours?: GmsOpeningHours,
  now: Date = new Date(),
): boolean | undefined {
  if (!hours) return undefined;
  if (typeof hours.openNow === "boolean") return hours.openNow;
  if (!Array.isArray(hours.periods) || hours.periods.length === 0) return undefined;
  const day = now.getDay();
  const minutes = now.getHours() * 60 + now.getMinutes();
  for (const p of hours.periods) {
    const open = p.open;
    const close = p.close;
    if (!open || !close) continue;
    if (open.day == null || close.day == null || open.hour == null || close.hour == null) {
      continue;
    }
    const openMin = open.hour * 60 + (open.minute ?? 0);
    const closeMin = close.hour * 60 + (close.minute ?? 0);
    if (open.day === close.day) {
      if (open.day === day && minutes >= openMin && minutes < closeMin) return true;
    } else if (closeMin === 0) {
      // Open 24 hours (closes exactly at midnight of the next day).
      if (open.day === day && minutes >= openMin) return true;
      if (close.day === day && minutes >= 0) return true;
    } else {
      // Overnight period spanning two days.
      if (open.day === day && minutes >= openMin) return true;
      if (close.day === day && minutes < closeMin) return true;
    }
  }
  return false;
}

/** Safely convert a URL-ish Places field (string or URL object) to a string. */
export function placeUriToUrl(
  uri: string | { toString(): string } | undefined,
): string | undefined {
  if (!uri) return undefined;
  const text = typeof uri === "string" ? uri : uri.toString();
  return text.length > 0 ? text : undefined;
}

/**
 * Normalize a Places API (New) Place into the legacy GmsPlaceResult shape so
 * downstream consumers (e.g. the café details modal) do not change.
 */
export function newPlaceToResult(place: GmsNewPlace): GmsPlaceResult {
  const location = placeLocation(place.location);
  const openingHours = place.currentOpeningHours ?? place.regularOpeningHours;
  return {
    place_id: place.id,
    name: placeDisplayName(place),
    formatted_address: place.formattedAddress,
    geometry: location
      ? { location: { lat: () => location.lat, lng: () => location.lng } }
      : undefined,
    rating: place.rating,
    user_ratings_total: place.userRatingCount,
    price_level: priceLevelToNumber(place.priceLevel),
    opening_hours: openingHours
      ? {
          open_now: computeIsOpen(openingHours),
          weekday_text: openingHours.weekdayDescriptions,
        }
      : undefined,
    formatted_phone_number: place.nationalPhoneNumber,
    international_phone_number: place.internationalPhoneNumber,
    website: placeUriToUrl(place.websiteURI),
    url: placeUriToUrl(place.googleMapsURI),
    photos: place.photos,
  };
}

/** Load the Google Maps JS API once and cache the promise. */
export function loadGoogleMaps(): Promise<GmsNamespace> {
  if (mapsPromise) return mapsPromise;

  if (typeof window === "undefined") {
    mapsPromise = Promise.reject(new Error(GMAPS_ERROR.LOAD_FAILED));
    return mapsPromise;
  }

  const key = getGoogleMapsApiKey();
  if (!key) {
    mapsPromise = Promise.reject(new Error(GMAPS_ERROR.KEY_MISSING));
    return mapsPromise;
  }

  if (window.google?.maps) {
    mapsPromise = Promise.resolve(window.google.maps);
    return mapsPromise;
  }

  mapsPromise = new Promise<GmsNamespace>((resolve, reject) => {
    // Remove any previously-attempted script element first. A script tag that
    // already errored will never fire again if it is reused, so a retry must
    // create a fresh element to actually re-attempt the load.
    document.getElementById("brewai-gmaps-script")?.remove();

    const script = document.createElement("script");
    script.id = "brewai-gmaps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&v=weekly&loading=async&callback=__brewaiGmapsInit`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      mapsPromise = null;
      reject(new Error(GMAPS_ERROR.LOAD_FAILED));
    };
    window.__brewaiGmapsInit = () => {
      const ns = window.google?.maps;
      if (ns) resolve(ns);
      else {
        mapsPromise = null;
        reject(new Error(GMAPS_ERROR.LOAD_FAILED));
      }
    };
    document.head.appendChild(script);
  });

  return mapsPromise;
}

/** Pick a sensible zoom level for the search radius. */
export function zoomForRadius(km: number): number {
  if (km <= 1) return 15;
  if (km <= 3) return 14;
  if (km <= 5) return 13;
  return 12;
}

/** Warm orange café pin. The selected variant is brighter with a light ring. */
export function cafePinIcon(selected: boolean): string {
  const fill = selected ? "#F0A34A" : "#D88932";
  const ring = selected ? ' stroke="#FFF3E2" stroke-width="2.5"' : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48">
  <path d="M18 2C9.7 2 3 8.7 3 17c0 11 15 29 15 29s15-18 15-29C33 8.7 26.3 2 18 2z" fill="${fill}"${ring}/>
  <circle cx="18" cy="17" r="8.5" fill="#FFF7EC"/>
  <g transform="translate(12.5 12.5)" fill="#8A4F1F">
    <rect x="1.5" y="4" width="10" height="6.5" rx="1.8"/>
    <path d="M11.5 6.5h1.6a2.2 2.2 0 0 1 0 4.4h-1.6"/>
    <rect x="2" y="2" width="9" height="1.6" rx="0.8"/>
  </g>
</svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

/** Distinct blue dot marker for the user's current location. */
export function userPinIcon(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">
  <circle cx="15" cy="15" r="13" fill="rgba(46,124,228,0.25)"/>
  <circle cx="15" cy="15" r="8.5" fill="#2E7CE4" stroke="#EAF3FF" stroke-width="2.5"/>
</svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
