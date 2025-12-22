import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase environment variables not set. Indexing features will be disabled."
  );
}

// Client for browser/client-side use (uses anon key)
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient<Database>(supabaseUrl, supabaseAnonKey)
  : null;

// Server-side client with service role key (for webhooks)
export const createServerClient = (): ReturnType<typeof createClient<Database>> => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase service role key not configured");
  }
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

// Check if Supabase is configured
export const isSupabaseConfigured = () => {
  return !!supabaseUrl && !!supabaseAnonKey;
};
