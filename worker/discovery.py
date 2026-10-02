import re

import requests

from adapters.generic_html import USER_AGENT


def slugify(artist_name: str) -> str:
    slug = artist_name.lower().strip()
    slug = re.sub(r"[^a-z0-9]+", "-", slug).strip("-")
    return slug


def discover_bandsintown_url(artist_name: str) -> str | None:
    """Best-effort discovery: Bandsintown artist pages follow a predictable
    /a/<slug> pattern. We just verify the guess resolves; this is the
    'attempt source discovery on addition' step from the brief, not a
    guarantee. Users can correct/add sources manually when this misses."""
    candidate = f"https://www.bandsintown.com/a/{slugify(artist_name)}"
    try:
        response = requests.head(
            candidate, headers={"User-Agent": USER_AGENT}, timeout=10, allow_redirects=True
        )
        if response.status_code == 200:
            return candidate
    except requests.RequestException:
        pass
    return None
