"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

export async function acknowledgeAlert(alertId: string) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;

  await supabase
    .from("acknowledgements")
    .insert({ alert_id: alertId, user_id: data.user.id });

  revalidatePath("/feed");
}
