import "server-only";

// Open-Meteo's geocoder: free, no API key.
const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";

export type Place = {
  id: number;
  name: string;
  region: string | null;
  country: string | null;
  latitude: number;
  longitude: number;
};

type RawPlace = {
  id: number;
  name: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
};

export async function searchPlaces(name: string): Promise<Place[]> {
  const query = new URLSearchParams({ name, count: "8", language: "en", format: "json" });
  const response = await fetch(`${GEOCODE_URL}?${query}`);
  if (!response.ok) throw new Error(`Place search failed (HTTP ${response.status})`);
  const data: { results?: RawPlace[] } = await response.json();
  return (data.results ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    region: p.admin1 ?? null,
    country: p.country ?? null,
    latitude: p.latitude,
    longitude: p.longitude,
  }));
}
