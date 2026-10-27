from typing import Optional

from adapters import ticketmaster


def discover_ticketmaster_source(artist_name: str) -> Optional[ticketmaster.Attraction]:
    """'Attempt source discovery on addition' step from the brief: look the
    artist up on Ticketmaster by exact name. Not a guarantee of the right
    act (two bands can share a name), so the match is stored as unconfirmed
    and users can correct/add sources manually."""
    try:
        return ticketmaster.find_attraction(artist_name)
    except ticketmaster.TicketmasterError as exc:
        print(f"ticketmaster lookup failed for {artist_name}: {exc}")
        return None
