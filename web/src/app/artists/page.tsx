import Form from "next/form";
import { SubmitButton } from "@/components/SubmitButton";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireUser } from "@/utils/supabase/server";
import { searchAttractions, type Attraction } from "@/utils/ticketmaster";
import { followArtist, setFollowEnabled, unfollowArtist } from "./actions";

type Follow = {
  id: string;
  enabled: boolean;
  artists: {
    id: string;
    name: string;
    artist_identities: {
      identity_type: string;
      identifier: string;
      confidence: string;
    }[];
  };
};

type UpcomingEvent = {
  artist_id: string;
  event_date: string;
  city: string | null;
};

function formatDate(isoDate: string) {
  // event_date is a plain date; parse as UTC so it doesn't shift a day.
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function ArtistsPage(props: PageProps<"/artists">) {
  const { q } = await props.searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  const { user } = await requireUser();
  const admin = createAdminClient();

  const { data: followRows } = await admin
    .from("user_artist_follows")
    .select(
      "id, enabled, artists(id, name, artist_identities(identity_type, identifier, confidence))"
    )
    .eq("user_id", user.id)
    .returns<Follow[]>();
  const follows = (followRows ?? []).sort((a, b) =>
    a.artists.name.localeCompare(b.artists.name)
  );

  const { data: events } = await admin
    .from("events")
    .select("artist_id, event_date, city")
    .in("artist_id", follows.map((f) => f.artists.id))
    .gte("event_date", new Date().toISOString().slice(0, 10))
    .neq("status", "cancelled")
    .order("event_date")
    .returns<UpcomingEvent[]>();
  const eventsByArtist = new Map<string, UpcomingEvent[]>();
  for (const event of events ?? []) {
    eventsByArtist.set(event.artist_id, [
      ...(eventsByArtist.get(event.artist_id) ?? []),
      event,
    ]);
  }

  const followedTicketmasterIds = new Set(
    follows.flatMap((f) =>
      f.artists.artist_identities
        .filter((i) => i.identity_type === "ticketing")
        .map((i) => i.identifier)
    )
  );

  let results: Attraction[] = [];
  let searchError: string | null = null;
  if (query) {
    try {
      results = await searchAttractions(query);
    } catch (error) {
      searchError = error instanceof Error ? error.message : "Search failed";
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="vapor-heading mb-1 text-4xl">Artists</h1>
      <p className="pixel mb-6 text-xl text-sage">アーティスト · who you follow</p>

      <Form action="/artists" className="flex gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search Ticketmaster for an artist"
          className="input min-w-0 flex-1"
        />
        <button type="submit" className="btn btn-primary">
          Search
        </button>
      </Form>

      {query && (
        <section className="mt-4">
          <h2 className="pixel mb-2 text-xl text-cyan">
            search results · Ticketmaster
          </h2>
          {searchError ? (
            <p className="panel p-4 text-pink">{searchError}</p>
          ) : results.length === 0 ? (
            <p className="panel p-4 text-sage">No artists found for “{query}”.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {results.map((attraction) => (
                <li
                  key={attraction.id}
                  className="panel flex items-center gap-3 p-3"
                >
                  {attraction.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={attraction.imageUrl}
                      alt=""
                      className="h-12 w-20 shrink-0 rounded border border-mint/30 object-cover"
                    />
                  ) : (
                    <div className="bg-linear-to-br from-forest-600 to-pink/40 h-12 w-20 shrink-0 rounded border border-mint/30" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-pale">
                      {attraction.url ? (
                        <a
                          href={attraction.url}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-mint hover:underline"
                        >
                          {attraction.name}
                        </a>
                      ) : (
                        attraction.name
                      )}
                    </div>
                    <div className="pixel text-lg text-sage">
                      {[
                        attraction.genre,
                        `${attraction.upcomingEvents} upcoming event${attraction.upcomingEvents === 1 ? "" : "s"} worldwide`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                  {followedTicketmasterIds.has(attraction.id) ? (
                    <span className="chip text-mint">following</span>
                  ) : (
                    <form action={followArtist}>
                      <input type="hidden" name="attractionId" value={attraction.id} />
                      <SubmitButton className="btn btn-primary" pendingText="…">
                        Follow
                      </SubmitButton>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="mt-10">
        <h2 className="vapor-heading mb-3 text-2xl">
          Following ({follows.length})
        </h2>
        {follows.length === 0 ? (
          <p className="panel p-6 text-sage">
            You&apos;re not following anyone yet. Search above to add artists.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {follows.map((follow) => {
              const upcoming = eventsByArtist.get(follow.artists.id) ?? [];
              const unconfirmed = follow.artists.artist_identities.some(
                (i) => i.identity_type === "ticketing" && i.confidence !== "confirmed"
              );
              return (
                <li
                  key={follow.id}
                  className="panel flex flex-wrap items-center gap-3 p-3"
                >
                  <div className={`min-w-0 flex-1 ${follow.enabled ? "" : "opacity-50"}`}>
                    <div className="font-semibold text-pale">
                      {follow.artists.name}
                      {!follow.enabled && (
                        <span className="chip ml-2 text-pink">paused</span>
                      )}
                    </div>
                    <div className="pixel text-lg text-sage">
                      {upcoming.length > 0
                        ? `next near you: ${formatDate(upcoming[0].event_date)}${upcoming[0].city ? ` · ${upcoming[0].city}` : ""}${upcoming.length > 1 ? ` (+${upcoming.length - 1} more)` : ""}`
                        : "no upcoming shows near you yet"}
                      {unconfirmed && (
                        <span className="text-cyan/70"> · match auto-detected</span>
                      )}
                    </div>
                  </div>
                  <form action={setFollowEnabled}>
                    <input type="hidden" name="followId" value={follow.id} />
                    <input
                      type="hidden"
                      name="enabled"
                      value={follow.enabled ? "false" : "true"}
                    />
                    <SubmitButton className="btn">
                      {follow.enabled ? "Pause" : "Resume"}
                    </SubmitButton>
                  </form>
                  <form action={unfollowArtist}>
                    <input type="hidden" name="followId" value={follow.id} />
                    <SubmitButton className="btn btn-danger" pendingText="…">
                      Unfollow
                    </SubmitButton>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
