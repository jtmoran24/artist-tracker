import { SubmitButton } from "@/components/SubmitButton";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import { acknowledgeAlert } from "./actions";
import { SystemStats, TicketDrops, UpNext } from "./SidePanels";

type Alert = {
  id: string;
  event_id: string | null;
  message: string;
  priority: string;
  is_uncertain: boolean;
  requires_ack: boolean;
  created_at: string;
  acknowledgements: { id: string }[];
};

type Event = {
  id: string;
  venue: string | null;
  city: string | null;
  country: string | null;
  event_date: string | null;
  presale_at: string | null;
  general_sale_at: string | null;
  ticket_url: string | null;
  status: string;
  artists: { name: string };
};

function isPast(iso: string) {
  return new Date(iso).getTime() <= Date.now();
}

function formatSaleTime(iso: string) {
  if (isPast(iso)) return "now";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Ticket-stub date block. event_date is a plain date, so read it as UTC.
function DateBlock({ isoDate }: { isoDate: string | null }) {
  if (!isoDate) {
    return <span className="pixel text-2xl text-sage">TBA</span>;
  }
  const date = new Date(`${isoDate}T00:00:00Z`);
  const part = (options: Intl.DateTimeFormatOptions) =>
    date.toLocaleDateString("en-GB", { ...options, timeZone: "UTC" });
  return (
    <>
      <span className="pixel text-lg uppercase text-pink">{part({ weekday: "short" })}</span>
      <span className="vapor-heading text-4xl leading-none">{part({ day: "numeric" })}</span>
      <span className="pixel text-lg uppercase text-mint">
        {part({ month: "short" })} {part({ year: "2-digit" })}
      </span>
    </>
  );
}

function EventCard({ alert, event }: { alert: Alert; event: Event }) {
  // The worker writes "(near <location>)" into the message; surface it.
  const near = alert.message.match(/\(near ([^)]+)\)/)?.[1];
  const onSaleNow =
    !!event.general_sale_at && isPast(event.general_sale_at);
  const place = [event.venue, event.city, event.country].filter(Boolean).join(" · ");
  return (
    <li className="panel flex overflow-hidden">
      <div className="flex w-24 shrink-0 flex-col items-center justify-center gap-1 border-r border-dashed border-mint/30 bg-forest-800/60 py-4">
        <DateBlock isoDate={event.event_date} />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip text-mint">new show</span>
          {event.status !== "announced" && (
            <span className="chip text-pink">{event.status}</span>
          )}
          {near && <span className="pixel text-lg text-sage">near {near}</span>}
        </div>
        <h2 className="text-xl font-semibold text-pale">{event.artists.name}</h2>
        <p className="text-sm text-sage">{place || "Venue TBA"}</p>
        {(event.presale_at || event.general_sale_at) && (
          // Once general sale has started, the presale time is just noise.
          <dl className="pixel flex flex-wrap gap-x-5 text-lg">
            {event.presale_at && !onSaleNow && (
              <div className="flex gap-2">
                <dt className="text-cyan">presale</dt>
                <dd>{formatSaleTime(event.presale_at)}</dd>
              </div>
            )}
            {event.general_sale_at && (
              <div className="flex gap-2">
                <dt className="text-cyan">on sale</dt>
                <dd>{formatSaleTime(event.general_sale_at)}</dd>
              </div>
            )}
          </dl>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-3">
          {event.ticket_url && (
            <a
              href={event.ticket_url}
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary"
            >
              Tickets ↗
            </a>
          )}
          <AckButton alert={alert} />
          <span className="pixel ml-auto text-base text-sage/60">
            found {new Date(alert.created_at).toLocaleDateString("en-GB")}
          </span>
        </div>
      </div>
    </li>
  );
}

// Alerts without a stored event (e.g. generic page-change alerts).
function MessageCard({ alert }: { alert: Alert }) {
  return (
    <li className="panel flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className={`chip ${alert.is_uncertain ? "text-pink" : "text-mint"}`}>
          {alert.is_uncertain ? "possible update" : alert.priority}
        </span>
        <span className="pixel text-base text-sage/60">
          {new Date(alert.created_at).toLocaleString("en-GB")}
        </span>
      </div>
      <p className="text-pale">{alert.message}</p>
      <AckButton alert={alert} />
    </li>
  );
}

function AckButton({ alert }: { alert: Alert }) {
  if (!alert.requires_ack) return null;
  const acked = alert.acknowledgements.length > 0;
  return (
    <form
      action={async () => {
        "use server";
        await acknowledgeAlert(alert.id);
      }}
    >
      <SubmitButton className="btn" pendingText="…">
        {acked ? "Acknowledged" : "Acknowledge"}
      </SubmitButton>
    </form>
  );
}

export default async function FeedPage() {
  const supabase = await createClient();
  const { data: alerts } = await supabase
    .from("alerts")
    .select("*, acknowledgements(id)")
    .order("created_at", { ascending: false })
    .returns<Alert[]>();

  // Events are shared catalogue rows (secret key only); fetch just the ones
  // the signed-in user's own alerts point at.
  const eventIds = [
    ...new Set((alerts ?? []).map((a) => a.event_id).filter((id): id is string => !!id)),
  ];
  const { data: events } = eventIds.length
    ? await createAdminClient()
        .from("events")
        .select(
          "id, venue, city, country, event_date, presale_at, general_sale_at, ticket_url, status, artists(name)"
        )
        .in("id", eventIds)
        .returns<Event[]>()
    : { data: [] as Event[] };
  const eventsById = new Map((events ?? []).map((e) => [e.id, e]));

  // Newest finds first (by day, since one worker run creates a batch);
  // within a day, soonest show first.
  const sortedAlerts = (alerts ?? []).toSorted((a, b) => {
    const foundA = a.created_at.slice(0, 10);
    const foundB = b.created_at.slice(0, 10);
    if (foundA !== foundB) return foundB.localeCompare(foundA);
    const dateA = (a.event_id && eventsById.get(a.event_id)?.event_date) || "9999";
    const dateB = (b.event_id && eventsById.get(b.event_id)?.event_date) || "9999";
    return dateA.localeCompare(dateB);
  });

  // Below xl the side panels sit between the heading and the feed (two
  // across from sm); at xl they move into sticky columns either side of it.
  return (
    <main className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-8 sm:grid-cols-2 sm:px-6 xl:grid-cols-[16rem_minmax(0,1fr)_16rem]">
      <div className="sm:col-span-2 xl:col-span-1 xl:col-start-2 xl:row-start-1">
        <h1 className="vapor-heading mb-1 text-4xl">Feed</h1>
        <p className="pixel text-xl text-sage">ニュース · shows near you</p>
      </div>
      <aside className="flex flex-col gap-6 xl:sticky xl:top-32 xl:col-start-1 xl:row-span-2 xl:row-start-1 xl:self-start">
        <UpNext />
        <SystemStats />
      </aside>
      <aside className="flex flex-col gap-6 xl:sticky xl:top-32 xl:col-start-3 xl:row-span-2 xl:row-start-1 xl:self-start">
        <TicketDrops />
      </aside>
      <div className="sm:col-span-2 xl:col-span-1 xl:col-start-2 xl:row-start-2">
        {!alerts || alerts.length === 0 ? (
          <p className="panel p-6 text-sage">
            No alerts yet. The worker checks your followed artists&apos; sources on
            a schedule and alerts will show up here when something changes.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {sortedAlerts.map((alert) => {
              const event = alert.event_id ? eventsById.get(alert.event_id) : undefined;
              return event ? (
                <EventCard key={alert.id} alert={alert} event={event} />
              ) : (
                <MessageCard key={alert.id} alert={alert} />
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
