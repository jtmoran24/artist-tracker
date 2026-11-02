import { RetroWindow } from "@/components/RetroWindow";
import { requireUser } from "@/utils/supabase/server";
import {
  daysUntil,
  formatSaleTime,
  formatShowDate,
  getMyShows,
  isFuture,
  upcomingSales,
  upcomingShows,
} from "@/utils/shows";

export async function UpNext() {
  const next = upcomingShows(await getMyShows())[0];
  if (!next) {
    return (
      <RetroWindow title="up_next.exe">
        <p className="text-sm text-sage">Nothing on the calendar yet.</p>
      </RetroWindow>
    );
  }

  const days = daysUntil(next.event_date!);
  return (
    <RetroWindow title="up_next.exe">
      <div className="flex flex-col items-center gap-1 text-center">
        {days === 0 ? (
          <span className="vapor-heading text-5xl">TONIGHT</span>
        ) : (
          <>
            <span className="vapor-heading text-7xl leading-none">
              {String(days).padStart(2, "0")}
            </span>
            <span className="pixel text-xl text-pink">
              {days === 1 ? "day to go" : "days to go"}
            </span>
          </>
        )}
        <span className="mt-2 text-lg font-semibold text-pale">{next.artists.name}</span>
        <span className="text-sm text-sage">
          {[next.venue, next.city].filter(Boolean).join(" · ")}
        </span>
        <span className="pixel text-lg text-mint">{formatShowDate(next.event_date!)}</span>
        {next.ticket_url && (
          <a
            href={next.ticket_url}
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary mt-2"
          >
            Tickets ↗
          </a>
        )}
      </div>
    </RetroWindow>
  );
}

export async function SystemStats() {
  const { supabase } = await requireUser();
  const [follows, locations, shows] = await Promise.all([
    supabase
      .from("user_artist_follows")
      .select("id", { count: "exact", head: true })
      .eq("enabled", true),
    supabase
      .from("locations")
      .select("id", { count: "exact", head: true })
      .eq("active", true),
    getMyShows(),
  ]);

  const rows: [string, number][] = [
    ["artists", follows.count ?? 0],
    ["locations", locations.count ?? 0],
    ["shows ahead", upcomingShows(shows).length],
  ];
  return (
    <RetroWindow title="system.ini">
      <dl className="pixel flex flex-col gap-1 text-xl">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline gap-2">
            <dt className="text-sage">{label}</dt>
            <span className="flex-1 border-b border-dotted border-mint/25" aria-hidden />
            <dd className="text-mint">{value}</dd>
          </div>
        ))}
      </dl>
    </RetroWindow>
  );
}

const MAX_ROWS = 6;

// Ticket drops still to come, then (to fill the space) shows whose general
// sale has already started.
export async function TicketDrops() {
  const shows = await getMyShows();
  const drops = upcomingSales(shows).slice(0, MAX_ROWS);
  const onSaleNow = upcomingShows(shows)
    .filter((s) => s.general_sale_at && !isFuture(s.general_sale_at))
    .slice(0, MAX_ROWS - drops.length);

  return (
    <RetroWindow title="tickets.exe">
      {drops.length === 0 && onSaleNow.length === 0 ? (
        <p className="text-sm text-sage">No ticket sales to watch yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {drops.length > 0 && (
            <section>
              <h2 className="pixel mb-2 text-lg text-cyan">coming up</h2>
              <ul className="flex flex-col gap-3">
                {drops.map(({ show, kind, at }) => (
                  <li key={`${show.id}-${kind}`} className="flex flex-col">
                    <span className="flex items-center gap-2">
                      <span className={`chip ${kind === "presale" ? "text-cyan" : "text-mint"}`}>
                        {kind}
                      </span>
                      <span className="pixel text-lg text-pale">{formatSaleTime(at)}</span>
                    </span>
                    <span className="text-sm text-sage">
                      {show.artists.name} · {show.city ?? "TBA"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {onSaleNow.length > 0 && (
            <section>
              <h2 className="pixel mb-2 text-lg text-mint">on sale now</h2>
              <ul className="flex flex-col gap-2">
                {onSaleNow.map((show) => (
                  <li key={show.id} className="text-sm">
                    {show.ticket_url ? (
                      <a
                        href={show.ticket_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-pale hover:text-mint hover:underline"
                      >
                        {show.artists.name}
                      </a>
                    ) : (
                      <span className="text-pale">{show.artists.name}</span>
                    )}
                    <span className="text-sage">
                      {" "}
                      · {show.city ?? "TBA"} · {formatShowDate(show.event_date!)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </RetroWindow>
  );
}
