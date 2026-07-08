import { createClient } from "@supabase/supabase-js";

/**
 * The single Supabase client. The browser talks directly to Supabase with the
 * public anon key; access is governed entirely by RLS with the Room `nanoid`
 * as the only capability (see ADR 0002). No server layer, no secrets here.
 */

// Fall back to the Supabase local-dev defaults so the client can be
// constructed in tests and local runs without a configured project.
const url = import.meta.env.VITE_SUPABASE_URL || "http://localhost:54321";
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "local-anon-key";

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: false },
});
