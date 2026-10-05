const SUPABASE_JS_VERSION = "2.116.0";
const SUPABASE_MODULE_URL = `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@${SUPABASE_JS_VERSION}/+esm`;
const rawConfig = window.QW_SUPABASE_CONFIG && typeof window.QW_SUPABASE_CONFIG === "object"
  ? window.QW_SUPABASE_CONFIG
  : {};

function normalized(value, maximum = 500) {
  return String(value ?? "").trim().slice(0, maximum);
}

export const supabaseConfig = Object.freeze({
  url: normalized(rawConfig.url),
  publishableKey: normalized(rawConfig.publishableKey)
});

export function isSupabaseConfigured() {
  return /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseConfig.url)
    && supabaseConfig.publishableKey.length >= 20;
}

let clientPromise;

export async function getSupabaseClient() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured. Add the Project URL and public Publishable key to data/supabase-config.js.");
  }

  if (!clientPromise) {
    clientPromise = import(SUPABASE_MODULE_URL).then(({ createClient }) => createClient(
      supabaseConfig.url,
      supabaseConfig.publishableKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        },
        global: {
          headers: { "X-Client-Info": "qw-tournaments-web" }
        }
      }
    ));
  }

  return clientPromise;
}

export async function getCurrentUser(client) {
  const { data, error } = await client.auth.getUser();
  if (error && error.name !== "AuthSessionMissingError") throw error;
  return data?.user || null;
}

export async function ensureAnonymousPlayer(client) {
  const current = await getCurrentUser(client);
  if (current) return current;
  const { data, error } = await client.auth.signInAnonymously();
  if (error) throw error;
  if (!data.user) throw new Error("Supabase did not create the anonymous player session.");
  return data.user;
}
