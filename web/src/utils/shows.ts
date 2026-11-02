import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";

export type Show = {
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
  foundAt: string;
  near: string | null;
};

export type SaleDrop = { show: Show; kind: "presale" | "on sale"; at: string };

// Every show the signed-in user has been alerted about. Cached per request so
// the nav ticker and the feed side panels share one round trip.
export const getMyShows = cache(async (): Promise<Show[]> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];

  const { data: alerts } = await supabase
    .from("alerts")
    .select("event_id, created_at, message")
    .not("event_id", "is", null)
    .order("created_at");
  const firstAlert = new Map<string, { created_at: string; message: string }>();
  for (const alert of alerts ?? []) {
    if (!firstAlert.has(alert.event_id)) firstAlert.set(alert.event_id, alert);
  }
  if (firstAlert.size === 0) return [];

  // Events are shared catalogue rows (secret key only); fetch just the ones
  // this user's own alerts point at.
  const { data: events } = await createAdminClient()
    .from("events")
    .select(
      "id, venue, city, country, event_date, presale_at, general_sale_at, ticket_url, status, artists(name)"
    )
    .in("id", [...firstAlert.keys()])
    .returns<Omit<Show, "foundAt" | "near">[]>();

  return (events ?? [])
    .map((event) => {
      const alert = firstAlert.get(event.id)!;
      return {
        ...event,
        foundAt: alert.created_at,
        // The worker writes "(near <location>)" into the message.
        near: alert.message.match(/\(near ([^)]+)\)/)?.[1] ?? null,
      };
    })
    .sort((a, b) => (a.event_date ?? "9999").localeCompare(b.event_date ?? "9999"));
});

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function isFuture(iso: string) {
  return Date.parse(iso) > Date.now();
}

export function upcomingShows(shows: Show[]) {
  const today = todayIso();
  return shows.filter(
    (s) => s.status !== "cancelled" && s.event_date && s.event_date >= today
  );
}

export function daysUntil(isoDate: string) {
  return Math.round(
    (Date.parse(`${isoDate}T00:00:00Z`) - Date.parse(`${todayIso()}T00:00:00Z`)) /
      86_400_000
  );
}

export function foundRecently(show: Show, days = 7) {
  return Date.now() - Date.parse(show.foundAt) < days * 86_400_000;
}

// Presales and general sales that haven't started yet, soonest first.
export function upcomingSales(shows: Show[]): SaleDrop[] {
  const drops: SaleDrop[] = [];
  for (const show of upcomingShows(shows)) {
    if (show.presale_at && isFuture(show.presale_at)) {
      drops.push({ show, kind: "presale", at: show.presale_at });
    }
    if (show.general_sale_at && isFuture(show.general_sale_at)) {
      drops.push({ show, kind: "on sale", at: show.general_sale_at });
    }
  }
  return drops.sort((a, b) => a.at.localeCompare(b.at));
}

// event_date is a plain date; format it as UTC so it doesn't shift a day.
export function formatShowDate(isoDate: string) {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function formatSaleTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
