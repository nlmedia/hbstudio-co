import { createClient } from '@supabase/supabase-js';

/** Service-role Supabase client (or null when not configured). */
export function getSupabase() {
  const url = process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Load the requested settings keys from hb_settings into a plain object. */
export async function loadSettings(sb, keys) {
  if (!sb) return {};
  const { data } = await sb.from('hb_settings').select('key, value').in('key', keys);
  const out = {};
  for (const row of data ?? []) out[row.key] = row.value ?? '';
  return out;
}

/**
 * Log a failure with full detail — server side only (Netlify function logs).
 * Callers stay responsible for returning a message safe to show to the client:
 * raw error messages can carry API keys, hostnames or internal config.
 */
export function logError(scope, err) {
  console.error(`[${scope}]`, err);
}

/** Pick a config value: DB setting first, then env var fallback. */
export function pick(settings, key, envName) {
  return (settings && settings[key]) || (envName ? process.env[envName] : undefined) || '';
}
