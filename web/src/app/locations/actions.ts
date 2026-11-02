"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/utils/supabase/server";
import { RADIUS_OPTIONS_KM } from "./radius";

function parseRadius(value: FormDataEntryValue | null) {
  const radius = Number(value);
  if (!RADIUS_OPTIONS_KM.includes(radius)) throw new Error("Invalid radius");
  return radius;
}

function check<T extends { error: { message: string } | null }>(result: T): T {
  if (result.error) throw new Error(result.error.message);
  return result;
}

export async function addLocation(formData: FormData) {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const latitude = Number(formData.get("latitude"));
  const longitude = Number(formData.get("longitude"));
  if (
    !name ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    throw new Error("Invalid location");
  }

  check(
    await supabase.from("locations").insert({
      user_id: user.id,
      name,
      latitude,
      longitude,
      radius_km: parseRadius(formData.get("radius_km")),
      active: true,
    })
  );
  revalidatePath("/locations");
  // Clear the search once a place is added.
  redirect("/locations");
}

export async function updateLocation(formData: FormData) {
  const { supabase, user } = await requireUser();
  const changes: { radius_km?: number; active?: boolean } = {};
  if (formData.has("radius_km")) changes.radius_km = parseRadius(formData.get("radius_km"));
  if (formData.has("active")) changes.active = formData.get("active") === "true";

  check(
    await supabase
      .from("locations")
      .update(changes)
      .eq("id", String(formData.get("locationId")))
      .eq("user_id", user.id)
  );
  revalidatePath("/locations");
}

export async function deleteLocation(formData: FormData) {
  const { supabase, user } = await requireUser();
  check(
    await supabase
      .from("locations")
      .delete()
      .eq("id", String(formData.get("locationId")))
      .eq("user_id", user.id)
  );
  revalidatePath("/locations");
}
