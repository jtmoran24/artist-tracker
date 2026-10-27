"""Ticketmaster Discovery API adapter. Unlike generic_html this returns
structured events, so a "change" is a new event ID rather than any text
difference on a page."""
import time
from dataclasses import dataclass
from typing import Optional
from urllib.parse import parse_qs, urlparse

import requests

import config

BASE_URL = "https://app.ticketmaster.com/discovery/v2"
# Free tier allows 5 requests/second.
REQUEST_SPACING_SECONDS = 0.25

_GEOHASH_ALPHABET = "0123456789bcdefghjkmnpqrstuvwxyz"


class TicketmasterError(RuntimeError):
    pass


@dataclass
class Attraction:
    id: str
    name: str
    url: Optional[str]
    upcoming_events: int


@dataclass
class TicketmasterEvent:
    id: str
    name: str
    url: Optional[str]
    local_date: Optional[str]
    status_code: Optional[str]
    venue: Optional[str]
    city: Optional[str]
    region: Optional[str]
    country: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]
    public_sale_at: Optional[str]
    presale_at: Optional[str]
    raw: dict


def _get(path: str, params: dict) -> dict:
    if not config.TICKETMASTER_API_KEY:
        raise TicketmasterError("TICKETMASTER_API_KEY is not set")
    time.sleep(REQUEST_SPACING_SECONDS)
    try:
        response = requests.get(
            f"{BASE_URL}/{path}",
            params={**params, "apikey": config.TICKETMASTER_API_KEY},
            timeout=20,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        # Strip the query string so the API key never ends up in logs or the DB.
        raise TicketmasterError(str(exc).split("?")[0]) from None
    return response.json()


def geohash(latitude: float, longitude: float, precision: int = 9) -> str:
    """Ticketmaster's geoPoint param takes a geohash (latlong is deprecated)."""
    lat_range, lon_range = [-90.0, 90.0], [-180.0, 180.0]
    bits, bit_count, use_lon, out = 0, 0, True, []
    while len(out) < precision:
        rng, value = (lon_range, longitude) if use_lon else (lat_range, latitude)
        mid = (rng[0] + rng[1]) / 2
        bits <<= 1
        if value >= mid:
            bits |= 1
            rng[0] = mid
        else:
            rng[1] = mid
        use_lon = not use_lon
        bit_count += 1
        if bit_count == 5:
            out.append(_GEOHASH_ALPHABET[bits])
            bits, bit_count = 0, 0
    return "".join(out)


def find_attraction(artist_name: str) -> Optional[Attraction]:
    """Exact (case-insensitive) name match only. Keyword search is fuzzy, so
    short names like "ear" would otherwise match unrelated acts. When several
    attractions share the exact name, prefer the one with the most upcoming
    events."""
    data = _get(
        "attractions.json",
        {"keyword": artist_name, "classificationName": "music", "size": 50},
    )
    wanted = artist_name.strip().casefold()
    matches = [
        Attraction(
            id=a["id"],
            name=a["name"],
            url=a.get("url"),
            upcoming_events=a.get("upcomingEvents", {}).get("_total", 0),
        )
        for a in data.get("_embedded", {}).get("attractions", [])
        if a.get("name", "").strip().casefold() == wanted
    ]
    if not matches:
        return None
    return max(matches, key=lambda a: a.upcoming_events)


def events_query_url(attraction_id: str) -> str:
    """What gets stored as sources.url (no API key in it)."""
    return f"{BASE_URL}/events.json?attractionId={attraction_id}"


def attraction_id_from_url(url: str) -> str:
    ids = parse_qs(urlparse(url).query).get("attractionId")
    if not ids:
        raise TicketmasterError(f"no attractionId in source url: {url}")
    return ids[0]


def upcoming_events(
    attraction_id: str, latitude: float, longitude: float, radius_km: float
) -> list[TicketmasterEvent]:
    data = _get(
        "events.json",
        {
            "attractionId": attraction_id,
            "geoPoint": geohash(latitude, longitude),
            "radius": int(round(float(radius_km))),
            "unit": "km",
            "size": 100,
            "sort": "date,asc",
        },
    )
    return [_parse_event(e) for e in data.get("_embedded", {}).get("events", [])]


def _parse_event(e: dict) -> TicketmasterEvent:
    venue = (e.get("_embedded", {}).get("venues") or [{}])[0]
    location = venue.get("location", {})
    sales = e.get("sales", {})
    presale_starts = sorted(
        p["startDateTime"] for p in sales.get("presales", []) if p.get("startDateTime")
    )
    return TicketmasterEvent(
        id=e["id"],
        name=e.get("name", ""),
        url=e.get("url"),
        local_date=e.get("dates", {}).get("start", {}).get("localDate"),
        status_code=e.get("dates", {}).get("status", {}).get("code"),
        venue=venue.get("name"),
        city=venue.get("city", {}).get("name"),
        region=venue.get("state", {}).get("name"),
        country=venue.get("country", {}).get("countryCode"),
        latitude=float(location["latitude"]) if location.get("latitude") else None,
        longitude=float(location["longitude"]) if location.get("longitude") else None,
        public_sale_at=sales.get("public", {}).get("startDateTime"),
        presale_at=presale_starts[0] if presale_starts else None,
        raw=e,
    )
