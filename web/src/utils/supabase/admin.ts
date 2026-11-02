import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Secret-key client for the shared catalogue tables (artists, sources,
// artist_identities, events), which have RLS on and no policies, so only
// this key can read or write them. Callers must check the signed-in user
// first and scope any per-user query to that user's id themselves.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
