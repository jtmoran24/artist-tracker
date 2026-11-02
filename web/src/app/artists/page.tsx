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

const buttonClass =
  "rounded-md border px-3 py-1 text-sm disabled:opacity-40";
const primaryButtonClass =
  "rounded-md bg-black px-3 py-1 text-sm text-white disabled:opacity-40";

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
    <main className="mx-auto w-full max-w-2xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Artists</h1>

      <Form action="/artists" className="flex gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search Ticketmaster for an artist"
          className="flex-1 rounded-md border px-3 py-2"
        />
        <button type="submit" className={primaryButtonClass}>
          Search
        </button>
      </Form>

      {query && (
        <section className="mt-4">
          {searchError ? (
            <p className="text-red-600">{searchError}</p>
          ) : results.length === 0 ? (
            <p className="text-gray-500">No artists found for “{query}”.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {results.map((attraction) => (
                <li
                  key={attraction.id}
                  className="flex items-center gap-3 rounded-md border p-3"
                >
                  {attraction.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={attraction.imageUrl}
                      alt=""
                      className="h-12 w-20 rounded object-cover"
                    />
                  ) : (
                    <div className="h-12 w-20 rounded bg-gray-200" />
                  )}
                  <div className="flex-1">
                    <div className="font-medium">
                      {attraction.url ? (
                        <a
                          href={attraction.url}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:underline"
                        >
                          {attraction.name}
                        </a>
                      ) : (
                        attraction.name
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {[
                        attraction.genre,
                        `${attraction.upcomingEvents} upcoming event${attraction.upcomingEvents === 1 ? "" : "s"} worldwide`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                  {followedTicketmasterIds.has(attraction.id) ? (
                    <span className="text-sm text-gray-500">Following</span>
                  ) : (
                    <form action={followArtist}>
                      <input type="hidden" name="attractionId" value={attraction.id} />
                      <SubmitButton className={primaryButtonClass} pendingText="Following…">
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

      <section className="mt-8">
        <h2 className="mb-2 text-lg font-semibold">
          Following ({follows.length})
        </h2>
        {follows.length === 0 ? (
          <p className="text-gray-500">
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
                  className="flex items-center gap-3 rounded-md border p-3"
                >
                  <div className={`flex-1 ${follow.enabled ? "" : "opacity-50"}`}>
                    <div className="font-medium">
                      {follow.artists.name}
                      {!follow.enabled && (
                        <span className="ml-2 text-xs uppercase text-gray-500">
                          paused
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {upcoming.length > 0
                        ? `Next near you: ${formatDate(upcoming[0].event_date)}${upcoming[0].city ? ` · ${upcoming[0].city}` : ""}${upcoming.length > 1 ? ` (+${upcoming.length - 1} more)` : ""}`
                        : "No upcoming shows near you yet"}
                      {unconfirmed && " · Ticketmaster match auto-detected"}
                    </div>
                  </div>
                  <form action={setFollowEnabled}>
                    <input type="hidden" name="followId" value={follow.id} />
                    <input
                      type="hidden"
                      name="enabled"
                      value={follow.enabled ? "false" : "true"}
                    />
                    <SubmitButton className={buttonClass}>
                      {follow.enabled ? "Pause" : "Resume"}
                    </SubmitButton>
                  </form>
                  <form action={unfollowArtist}>
                    <input type="hidden" name="followId" value={follow.id} />
                    <SubmitButton className={buttonClass} pendingText="Removing…">
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
