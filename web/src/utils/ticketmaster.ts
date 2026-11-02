import "server-only";

// Mirrors worker/adapters/ticketmaster.py. Keep events_query_url in sync:
// the worker parses the attractionId back out of sources.url.
const BASE_URL = "https://app.ticketmaster.com/discovery/v2";

export type Attraction = {
  id: string;
  name: string;
  url: string | null;
  genre: string | null;
  imageUrl: string | null;
  upcomingEvents: number;
};

type RawAttraction = {
  id: string;
  name: string;
  url?: string;
  images?: { url: string; width: number; ratio?: string }[];
  classifications?: { genre?: { name?: string } }[];
  upcomingEvents?: { _total?: number };
};

async function get(path: string, params: Record<string, string>) {
  const key = process.env.TICKETMASTER_API_KEY;
  if (!key) throw new Error("TICKETMASTER_API_KEY is not set");
  const query = new URLSearchParams({ ...params, apikey: key });
  const response = await fetch(`${BASE_URL}/${path}?${query}`);
  if (!response.ok) {
    // No URL in the message so the API key never reaches logs or the UI.
    throw new Error(`Ticketmaster request failed (HTTP ${response.status})`);
  }
  return response.json();
}

function parseAttraction(a: RawAttraction): Attraction {
  // Smallest 16:9 image that's still sharp at thumbnail size.
  const images = (a.images ?? [])
    .filter((i) => i.ratio === "16_9" && i.width >= 200)
    .sort((x, y) => x.width - y.width);
  const genre = a.classifications?.[0]?.genre?.name;
  return {
    id: a.id,
    name: a.name,
    url: a.url ?? null,
    genre: genre && genre !== "Undefined" ? genre : null,
    imageUrl: images[0]?.url ?? a.images?.[0]?.url ?? null,
    upcomingEvents: a.upcomingEvents?._total ?? 0,
  };
}

export async function searchAttractions(keyword: string): Promise<Attraction[]> {
  const data = await get("attractions.json", {
    keyword,
    classificationName: "music",
    size: "10",
  });
  return (data._embedded?.attractions ?? []).map(parseAttraction);
}

export async function getAttraction(id: string): Promise<Attraction> {
  return parseAttraction(await get(`attractions/${encodeURIComponent(id)}.json`, {}));
}

export function eventsQueryUrl(attractionId: string) {
  return `${BASE_URL}/events.json?attractionId=${attractionId}`;
}
