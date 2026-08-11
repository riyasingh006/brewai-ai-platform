import type { LatLngLike } from "@/lib/google-maps";

export type SortBy = "recommended" | "distance" | "rating";
export type RatingFilter = 0 | 4 | 4.5;
export type Phase = "idle" | "loading" | "ready" | "error";

export const RADII: readonly number[] = [1, 3, 5, 10];
export const DEFAULT_RADIUS = 5;

export interface Cafe {
  placeId: string;
  name: string;
  address?: string;
  rating?: number;
  ratingCount?: number;
  distanceKm?: number;
  latitude: number;
  longitude: number;
  isOpen?: boolean;
  priceLevel?: number;
  phone?: string;
  website?: string;
  photos?: string[];
  mapUrl?: string;
  hours?: string[];
}

/** Great-circle distance between two points in kilometers. */
export function haversineKm(a: LatLngLike, b: LatLngLike): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(km?: number): string {
  if (km == null) return "Distance unknown";
  if (km < 1) return `${Math.max(1, Math.round(km * 1000))} m away`;
  return `${km.toFixed(1)} km away`;
}

export function formatPrice(level?: number): string {
  if (level == null) return "Price unavailable";
  if (level <= 0) return "Free";
  return "$".repeat(Math.min(level, 4));
}

/** Official Google Maps directions URL built from real place coordinates. */
export function directionsUrl(
  cafe: Pick<Cafe, "latitude" | "longitude" | "placeId">,
): string {
  const base = "https://www.google.com/maps/dir/?api=1";
  const destination = `destination=${cafe.latitude},${cafe.longitude}`;
  const placeId = cafe.placeId
    ? `&destination_place_id=${encodeURIComponent(cafe.placeId)}`
    : "";
  return `${base}&${destination}${placeId}`;
}

export const ERR = {
  MAPS_KEY_MISSING: "MAPS_KEY_MISSING",
  MAPS_LOAD_FAILED: "MAPS_LOAD_FAILED",
  PLACES_FAILED: "PLACES_FAILED",
  GEOLOCATION_DENIED: "GEOLOCATION_DENIED",
  GEOLOCATION_UNAVAILABLE: "GEOLOCATION_UNAVAILABLE",
  GEOLOCATION_UNSUPPORTED: "GEOLOCATION_UNSUPPORTED",
  INVALID_LOCATION: "INVALID_LOCATION",
  NETWORK: "NETWORK",
  SEARCH_FAILED: "SEARCH_FAILED",
} as const;

export type ErrorCode = (typeof ERR)[keyof typeof ERR];

/** Maps internal error codes to friendly, non-technical user messages. */
export function friendlyMessage(e: unknown): string {
  const code = e instanceof Error ? e.message : "";
  switch (code) {
    case ERR.MAPS_KEY_MISSING:
      // Developer-safe configuration state only; never leaks credentials.
      return typeof process !== "undefined" && process.env.NODE_ENV === "development"
        ? "Google Maps isn't configured yet. Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to your .env file to enable Nearby Cafés."
        : "Maps are unavailable right now. Please try again later.";
    case ERR.MAPS_LOAD_FAILED:
      return "Couldn't load the map right now. Check your connection and try again.";
    case ERR.GEOLOCATION_DENIED:
      return "Location access is disabled. Please allow location access in your browser to discover cafés near you.";
    case ERR.GEOLOCATION_UNAVAILABLE:
      return "Your location is unavailable right now. Try searching for a location instead.";
    case ERR.GEOLOCATION_UNSUPPORTED:
      return "Your browser doesn't support location services. Try searching for a location instead.";
    case ERR.INVALID_LOCATION:
      return "We couldn't find that location. Try a different name or area.";
    case ERR.PLACES_FAILED:
      return "We couldn't find cafés right now. Please try again.";
    case ERR.NETWORK:
      return "Network trouble. Check your connection and try again.";
    default:
      return "Something went wrong while searching. Please try again.";
  }
}
