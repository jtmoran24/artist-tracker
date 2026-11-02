import {
  formatSaleTime,
  formatShowDate,
  foundRecently,
  getMyShows,
  upcomingSales,
  upcomingShows,
} from "@/utils/shows";

type Item = { label: string; tone: string; text: string };

const MAX_ITEMS = 12;

function where(show: { venue: string | null; city: string | null }) {
  return [show.venue, show.city].filter(Boolean).join(" · ");
}

// LED marquee under the nav: ticket drops first, then newly found shows,
// then everything else coming up.
export async function Ticker() {
  const shows = await getMyShows();
  const upcoming = upcomingShows(shows);

  const items: Item[] = [
    ...upcomingSales(shows).map(({ show, kind, at }) => ({
      label: kind,
      tone: kind === "presale" ? "text-cyan" : "text-mint",
      text: `${show.artists.name} · ${show.city ?? "TBA"} · ${formatSaleTime(at)}`,
    })),
    ...upcoming.filter((s) => foundRecently(s)).map((show) => ({
      label: "new",
      tone: "text-pink",
      text: `${show.artists.name} · ${where(show)} · ${formatShowDate(show.event_date!)}`,
    })),
    ...upcoming.filter((s) => !foundRecently(s)).map((show) => ({
      label: "show",
      tone: "text-sage",
      text: `${show.artists.name} · ${where(show)} · ${formatShowDate(show.event_date!)}`,
    })),
  ].slice(0, MAX_ITEMS);

  if (items.length === 0) {
    items.push(
      { label: "radar", tone: "text-cyan", text: "no shows on the radar yet" },
      { label: "tip", tone: "text-mint", text: "follow more artists to fill this up" }
    );
  }

  // The track holds the items twice and scrolls by half its width, so the
  // loop is seamless.
  return (
    <div className="ticker border-t border-mint/15 bg-forest-950/70">
      <div
        className="ticker-track pixel text-lg"
        style={{ "--ticker-duration": `${Math.max(items.length * 7, 25)}s` } as React.CSSProperties}
      >
        {[...items, ...items].map((item, i) => (
          <span key={i} className="ticker-item" aria-hidden={i >= items.length}>
            <span className={item.tone}>{item.label}</span>
            <span className="text-pale">{item.text}</span>
            <span className="text-pink">★</span>
          </span>
        ))}
      </div>
    </div>
  );
}
