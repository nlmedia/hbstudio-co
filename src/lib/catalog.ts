import { createClient } from '@supabase/supabase-js';
import { DEFAULT_LOCALE, type Locale } from '../i18n/locales';
import { normalize } from './catalogNormalize';
export type { TemplateData, TemplateEntry } from './catalogNormalize';
export { normalize } from './catalogNormalize';

const sb = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
);

/** Public templates (published + coming-soon), ordered. Used at build time. */
export async function getTemplates(locale: Locale = DEFAULT_LOCALE) {
  const { data, error } = await sb
    .from('hb_templates')
    .select('*')
    .in('status', ['published', 'coming-soon'])
    .order('sort_order', { ascending: true });
  if (error) { console.error('[catalog] getTemplates', error.message); return []; }
  return (data ?? []).map((r) => normalize(r, locale));
}

export async function getTemplate(slug: string, locale: Locale = DEFAULT_LOCALE) {
  const { data } = await sb.from('hb_templates').select('*').eq('slug', slug).maybeSingle();
  return data ? normalize(data, locale) : null;
}
