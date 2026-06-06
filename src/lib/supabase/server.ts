import { createClient } from "@supabase/supabase-js";

function supabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL;
}

function serverKey() {
  return process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export function hasSupabaseServerConfig() {
  return Boolean(supabaseUrl() && serverKey());
}

export function createSupabaseServerClient() {
  const url = supabaseUrl();
  const key = serverKey();

  if (!url || !key) {
    throw new Error("Missing Supabase server config");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
