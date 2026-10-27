"""Entry point run on a schedule by GitHub Actions (see
.github/workflows/worker.yml). One pass = for every enabled source, fetch,
diff against what we've already seen, and raise alerts on anything new.

Two adapters:
- ticketmaster: structured events near each follower's locations. A new
  event ID is a new show; all new shows in a run go out as one email.
- generic_html: hash a page's visible text, alert on any change (uncertain).

Still out of scope: merging the same event across multiple sources, and
alerting on changes to already-seen events (reschedules, cancellations).
"""
import hashlib
from datetime import date, datetime, timezone

from adapters import generic_html, ticketmaster
from adapters.base import CheckResult
from db import get_client
import config
import discovery
import notify


def ensure_sources_discovered(client):
    if not config.TICKETMASTER_API_KEY:
        print("TICKETMASTER_API_KEY not set, skipping source discovery")
        return

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
        attraction = discovery.discover_ticketmaster_source(artist["name"])
        if not attraction:
            print(f"no source discovered for {artist['name']} (add one manually)")
            continue

        client.table("sources").insert(
            {
                "artist_id": artist["id"],
                "adapter_type": "ticketmaster",
                "url": ticketmaster.events_query_url(attraction.id),
                "enabled": True,
            }
        ).execute()
        client.table("artist_identities").insert(
            {
                "artist_id": artist["id"],
                "identity_type": "ticketing",
                "identifier": attraction.id,
                "confidence": "unconfirmed",
            }
        ).execute()
        print(
            f"discovered source for {artist['name']}: ticketmaster {attraction.name} "
            f"({attraction.upcoming_events} upcoming worldwide) {attraction.url or ''}"
        )


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


def enabled_follower_ids(client, artist_id: str) -> list[str]:
    follows = (
        client.table("user_artist_follows")
        .select("user_id")
        .eq("artist_id", artist_id)
        .eq("enabled", True)
        .execute()
        .data
    )
    return [f["user_id"] for f in follows]


def raise_alert(client, artist, source):
    message = (
        f"Possible update detected for {artist['name']} "
        f"(source: {source['url']}). Uncertain — confirm before acting."
    )

    for user_id in enabled_follower_ids(client, artist["id"]):
        alert = (
            client.table("alerts")
            .insert(
                {
                    "user_id": user_id,
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


def check_generic_html_source(client, artist, source):
    previous_hash = last_successful_hash(client, source["id"])
    result = generic_html.check(source["url"])
    record_check(client, source["id"], result)

    if not result.success:
        print(f"check failed for {artist['name']}: {result.error_message}")
    elif previous_hash is None:
        print(f"baseline recorded for {artist['name']}")
    elif previous_hash != result.content_hash:
        print(f"change detected for {artist['name']}")
        raise_alert(client, artist, source)
    else:
        print(f"no change for {artist['name']}")


TICKETMASTER_STATUS = {"cancelled": "cancelled", "canceled": "cancelled", "postponed": "postponed", "rescheduled": "postponed"}


def format_show(artist_name: str, event: ticketmaster.TicketmasterEvent, location_name: str) -> str:
    when = (
        date.fromisoformat(event.local_date).strftime("%a %d %b %Y")
        if event.local_date
        else "date TBA"
    )
    where = ", ".join(p for p in [event.venue, event.city] if p) or "venue TBA"
    parts = [f"New show: {artist_name} — {where} · {when} (near {location_name})"]
    if event.presale_at:
        parts.append(f"presale {event.presale_at[:16].replace('T', ' ')} UTC")
    if event.public_sale_at:
        parts.append(f"on sale {event.public_sale_at[:16].replace('T', ' ')} UTC")
    if event.url:
        parts.append(event.url)
    return " · ".join(parts)


def check_ticketmaster_source(client, artist, source, pending_emails: list):
    """Query events near every active location of every follower, store any
    event IDs not seen before for this source, and queue one alert per
    (user, new event). Emails are sent once per run, in send_digest."""
    try:
        attraction_id = ticketmaster.attraction_id_from_url(source["url"])
        events_by_id: dict[str, ticketmaster.TicketmasterEvent] = {}
        # event id -> {user_id: location name it was found near}
        nearby_users: dict[str, dict[str, str]] = {}
        for user_id in enabled_follower_ids(client, artist["id"]):
            locations = (
                client.table("locations")
                .select("name, latitude, longitude, radius_km")
                .eq("user_id", user_id)
                .eq("active", True)
                .execute()
                .data
            )
            for loc in locations:
                for event in ticketmaster.upcoming_events(
                    attraction_id, loc["latitude"], loc["longitude"], loc["radius_km"]
                ):
                    events_by_id[event.id] = event
                    nearby_users.setdefault(event.id, {}).setdefault(user_id, loc["name"])
    except ticketmaster.TicketmasterError as exc:
        record_check(client, source["id"], CheckResult(success=False, error_message=str(exc)))
        print(f"check failed for {artist['name']}: {exc}")
        return

    snapshot = ",".join(sorted(events_by_id))
    record_check(
        client,
        source["id"],
        CheckResult(success=True, content_hash=hashlib.sha256(snapshot.encode()).hexdigest()),
    )

    new_count = 0
    for event_id, event in events_by_id.items():
        seen = (
            client.table("event_sources")
            .select("id")
            .eq("source_id", source["id"])
            .eq("raw_data->>id", event_id)
            .limit(1)
            .execute()
            .data
        )
        if seen or event.status_code in ("cancelled", "canceled"):
            continue
        new_count += 1

        stored = (
            client.table("events")
            .insert(
                {
                    "artist_id": artist["id"],
                    "name": event.name,
                    "venue": event.venue,
                    "city": event.city,
                    "region": event.region,
                    "country": event.country,
                    "latitude": event.latitude,
                    "longitude": event.longitude,
                    "event_date": event.local_date,
                    "presale_at": event.presale_at,
                    "general_sale_at": event.public_sale_at,
                    "ticket_url": event.url,
                    "status": TICKETMASTER_STATUS.get(event.status_code or "", "announced"),
                    "confidence": "confirmed",
                }
            )
            .execute()
            .data[0]
        )
        client.table("event_sources").insert(
            {"event_id": stored["id"], "source_id": source["id"], "raw_data": event.raw}
        ).execute()

        for user_id, location_name in nearby_users[event_id].items():
            message = format_show(artist["name"], event, location_name)
            alert = (
                client.table("alerts")
                .insert(
                    {
                        "user_id": user_id,
                        "alert_type": "concert",
                        "event_id": stored["id"],
                        "priority": "normal",
                        "message": message,
                        "is_uncertain": False,
                        "requires_ack": False,
                    }
                )
                .execute()
                .data[0]
            )
            pending_emails.append((alert["id"], message))

    print(
        f"{artist['name']}: {len(events_by_id)} upcoming near your locations, {new_count} new"
    )


def send_digest(client, pending_emails: list):
    """One email per run for all new Ticketmaster shows (there's no per-user
    email routing yet; everything goes to ALERT_TO_EMAIL)."""
    if not pending_emails:
        return
    count = len(pending_emails)
    subject = f"Artist Tracker: {count} new show{'s' if count != 1 else ''} near you"
    body = "\n\n".join(message for _, message in pending_emails)
    sent, error = notify.send_email(subject, body)
    for alert_id, _ in pending_emails:
        client.table("delivery_attempts").insert(
            {
                "alert_id": alert_id,
                "channel": "email",
                "status": "sent" if sent else "failed",
                "error_message": error,
            }
        ).execute()
    print(f"digest email {'sent' if sent else 'FAILED: ' + str(error)} ({count} shows)")


def run():
    client = get_client()
    ensure_sources_discovered(client)

    pending_emails: list[tuple[str, str]] = []
    sources = client.table("sources").select("*, artists(*)").eq("enabled", True).execute().data
    for source in sources:
        artist = source["artists"]
        if source["adapter_type"] == "ticketmaster":
            if not config.TICKETMASTER_API_KEY:
                print(f"TICKETMASTER_API_KEY not set, skipping {artist['name']}")
                continue
            check_ticketmaster_source(client, artist, source, pending_emails)
        elif source["adapter_type"] == "generic_html":
            check_generic_html_source(client, artist, source)
        else:
            print(f"no adapter implemented for {source['adapter_type']}, skipping")

    send_digest(client, pending_emails)


if __name__ == "__main__":
    run()
