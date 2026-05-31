import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anonKey) {
  // Surface a clear message during development instead of a cryptic runtime error.
  // eslint-disable-next-line no-console
  console.error("Supabase env vars ausentes. Verifique VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.");
}

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: false },
});

export const FOTOS_BUCKET = "fotos";
