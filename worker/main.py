"""Entry point run on a schedule by GitHub Actions (see
.github/workflows/worker.yml). One pass = for every enabled source, fetch,
diff against the last successful check, and raise an alert on change.

Milestone 1 scope only: no entity resolution/merging of multiple sources
into one event yet, no geo/relevance filtering yet, single flat alert
priority. Those arrive once the one-artist loop is proven end to end.
"""
from datetime import datetime, timezone

from adapters import generic_html
from db import get_client
import discovery
import notify


def ensure_sources_discovered(client):
    artists = client.table("artists").select("id, name").execute().data
    for artist in artists:
        existing = (
            client.table("sources")
            .select("id")
            .eq("artist_id", artist["id"])
            .execute()
            .data
        )
        if existing:
            continue
        url = discovery.discover_bandsintown_url(artist["name"])
        if url:
            client.table("sources").insert(
                {
                    "artist_id": artist["id"],
                    "adapter_type": "generic_html",
                    "url": url,
                    "enabled": True,
                }
            ).execute()
            print(f"discovered source for {artist['name']}: {url}")
        else:
            print(f"no source discovered for {artist['name']} (add one manually)")


def last_successful_hash(client, source_id: str) -> str | None:
    rows = (
        client.table("source_checks")
        .select("raw_snapshot_hash")
        .eq("source_id", source_id)
        .eq("success", True)
        .order("checked_at", desc=True)
        .limit(1)
        .execute()
        .data
    )
    return rows[0]["raw_snapshot_hash"] if rows else None


def record_check(client, source_id: str, result):
    client.table("source_checks").insert(
        {
            "source_id": source_id,
            "checked_at": datetime.now(timezone.utc).isoformat(),
            "success": result.success,
            "error_message": result.error_message,
            "raw_snapshot_hash": result.content_hash,
        }
    ).execute()


def raise_alert(client, artist, source):
    message = (
        f"Possible update detected for {artist['name']} "
        f"(source: {source['url']}). Uncertain — confirm before acting."
    )

    follows = (
        client.table("user_artist_follows")
        .select("user_id")
        .eq("artist_id", artist["id"])
        .eq("enabled", True)
        .execute()
        .data
    )

    for follow in follows:
        alert = (
            client.table("alerts")
            .insert(
                {
                    "user_id": follow["user_id"],
                    "alert_type": "concert",
                    "priority": "normal",
                    "message": message,
                    "is_uncertain": True,
                    "requires_ack": False,
                }
            )
            .execute()
            .data[0]
        )

        sent, error = notify.send_email(f"Artist Tracker: {artist['name']} update", message)
        client.table("delivery_attempts").insert(
            {
                "alert_id": alert["id"],
                "channel": "email",
                "status": "sent" if sent else "failed",
                "error_message": error,
            }
        ).execute()


def run():
    client = get_client()
    ensure_sources_discovered(client)

    sources = client.table("sources").select("*, artists(*)").eq("enabled", True).execute().data
    for source in sources:
        artist = source["artists"]
        previous_hash = last_successful_hash(client, source["id"])

        if source["adapter_type"] == "generic_html":
            result = generic_html.check(source["url"])
        else:
            print(f"no adapter implemented for {source['adapter_type']}, skipping")
            continue

        record_check(client, source["id"], result)

        if not result.success:
            print(f"check failed for {artist['name']}: {result.error_message}")
            continue

        if previous_hash is None:
            print(f"baseline recorded for {artist['name']}")
        elif previous_hash != result.content_hash:
            print(f"change detected for {artist['name']}")
            raise_alert(client, artist, source)
        else:
            print(f"no change for {artist['name']}")


if __name__ == "__main__":
    run()
