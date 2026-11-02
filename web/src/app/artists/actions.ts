"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireUser } from "@/utils/supabase/server";
import { eventsQueryUrl, getAttraction, type Attraction } from "@/utils/ticketmaster";

function check<T extends { error: { message: string } | null }>(result: T): T {
  if (result.error) throw new Error(result.error.message);
  return result;
}

// Find the catalogue artist for a Ticketmaster attraction, or create it with
// its identity and source. The user picked this exact attraction, so the
// identity is stored (or upgraded to) confirmed.
async function ensureArtist(admin: SupabaseClient, attraction: Attraction) {
  const { data: identity } = check(
    await admin
      .from("artist_identities")
      .select("id, artist_id")
      .eq("identity_type", "ticketing")
      .eq("identifier", attraction.id)
      .limit(1)
      .maybeSingle()
  );

  let artistId: string;
  if (identity) {
    artistId = identity.artist_id;
    check(
      await admin
        .from("artist_identities")
        .update({ confidence: "confirmed" })
        .eq("id", identity.id)
    );
  } else {
    const { data: artist } = check(
      await admin.from("artists").insert({ name: attraction.name }).select("id").single()
    );
    artistId = artist!.id;
    check(
      await admin.from("artist_identities").insert({
        artist_id: artistId,
        identity_type: "ticketing",
        identifier: attraction.id,
        confidence: "confirmed",
      })
    );
  }

  // Without a source the worker would fall back to guessing by name.
  const { data: sources } = check(
    await admin
      .from("sources")
      .select("id")
      .eq("artist_id", artistId)
      .eq("adapter_type", "ticketmaster")
      .limit(1)
  );
  if (!sources?.length) {
    check(
      await admin.from("sources").insert({
        artist_id: artistId,
        adapter_type: "ticketmaster",
        url: eventsQueryUrl(attraction.id),
        enabled: true,
      })
    );
  }
  return artistId;
}

export async function followArtist(formData: FormData) {
  const { supabase, user } = await requireUser();
  const attractionId = String(formData.get("attractionId") ?? "");
  if (!attractionId) return;

  // Re-fetch rather than trusting a name posted from the browser.
  const attraction = await getAttraction(attractionId);
  const artistId = await ensureArtist(createAdminClient(), attraction);

  check(
    await supabase
      .from("user_artist_follows")
      .upsert(
        { user_id: user.id, artist_id: artistId, enabled: true, origin: "manual" },
        { onConflict: "user_id,artist_id" }
      )
  );
  revalidatePath("/artists");
}

export async function setFollowEnabled(formData: FormData) {
  const { supabase, user } = await requireUser();
  check(
    await supabase
      .from("user_artist_follows")
      .update({ enabled: formData.get("enabled") === "true" })
      .eq("id", String(formData.get("followId")))
      .eq("user_id", user.id)
  );
  revalidatePath("/artists");
}

export async function unfollowArtist(formData: FormData) {
  const { supabase, user } = await requireUser();
  check(
    await supabase
      .from("user_artist_follows")
      .delete()
      .eq("id", String(formData.get("followId")))
      .eq("user_id", user.id)
  );
  revalidatePath("/artists");
}
