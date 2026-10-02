import hashlib

import requests
from bs4 import BeautifulSoup

from .base import CheckResult

USER_AGENT = "ArtistTrackerBot/0.1 (+https://github.com/; personal monitoring tool)"


def check(url: str) -> CheckResult:
    """Fetch a page and hash its visible text. Any text change counts as
    a change to investigate further downstream (normalization/confidence
    steps decide what it means, not this adapter)."""
    try:
        response = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=20)
        response.raise_for_status()
    except requests.RequestException as exc:
        return CheckResult(success=False, error_message=str(exc))

    soup = BeautifulSoup(response.text, "html.parser")
    for tag in soup(["script", "style"]):
        tag.decompose()
    text = " ".join(soup.get_text(separator=" ").split())

    content_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()
    return CheckResult(success=True, content_hash=content_hash, raw_snapshot=text[:5000])
