import type { SupabaseClient } from '@supabase/supabase-js';

export type SettingKey =
  | 'brevo_api_key'
  | 'brevo_list_id'
  | 'sender_name'
  | 'sender_email'
  | 'reply_to'
  | 'rebuild_hook_url'
  | 'auto_email_on_publish'
  | 'stripe_secret_key'
  | 'stripe_webhook_secret'
  | 'currency'
  | 'download_secret'
  | 'download_ttl_days';

export const SECRET_KEYS: SettingKey[] = ['brevo_api_key', 'stripe_secret_key', 'stripe_webhook_secret', 'download_secret'];

export type Settings = Partial<Record<SettingKey, string>>;

/** Read all settings into a plain object. Admin-only (RLS). */
export async function getSettings(supabase: SupabaseClient): Promise<Settings> {
  const { data } = await supabase.from('hb_settings').select('key, value');
  const out: Settings = {};
  for (const row of data ?? []) out[row.key as SettingKey] = row.value ?? '';
  return out;
}

/** Upsert a batch of settings. Empty string deletes nothing (kept), undefined skipped. */
export async function saveSettings(supabase: SupabaseClient, values: Settings) {
  const rows = Object.entries(values)
    .filter(([, v]) => v !== undefined)
    .map(([key, value]) => ({ key, value: value ?? '', updated_at: new Date().toISOString() }));
  if (!rows.length) return { error: null };
  const { error } = await supabase.from('hb_settings').upsert(rows);
  return { error };
}

/** Mask a secret for display: keeps the last 4 chars. */
export function maskSecret(v?: string): string {
  if (!v) return '';
  if (v.length <= 4) return '••••';
  return '••••••••' + v.slice(-4);
}
