import type { SupabaseClient } from '@supabase/supabase-js';
import { getSettings } from './settings';

export type Alert = { level: 'warn' | 'info'; text: string; href: string };

/** Compute actionable admin alerts (used by the dashboard + the topbar bell). */
export async function getAlerts(supabase: SupabaseClient): Promise<Alert[]> {
  const [{ data: templates }, settings] = await Promise.all([
    supabase.from('hb_templates').select('status, deliverable, cover'),
    getSettings(supabase),
  ]);
  const tpls = templates ?? [];
  const published = tpls.filter((t) => t.status === 'published');
  const drafts = tpls.filter((t) => t.status === 'draft');
  const publishedNoDeliverable = published.filter((t) => !t.deliverable);
  const noCover = tpls.filter((t) => !t.cover);
  const brevoReady = !!settings.brevo_api_key && !!settings.sender_email;

  const alerts: Alert[] = [];
  if (publishedNoDeliverable.length) alerts.push({ level: 'warn', text: `${publishedNoDeliverable.length} template(s) publié(s) sans fichier livrable — la livraison échouera`, href: '/admin/templates' });
  if (!brevoReady) alerts.push({ level: 'warn', text: 'Brevo non configuré — campagnes et emails automatiques désactivés', href: '/admin/settings' });
  if (drafts.length) alerts.push({ level: 'info', text: `${drafts.length} brouillon(s) à finaliser`, href: '/admin/templates' });
  if (noCover.length) alerts.push({ level: 'info', text: `${noCover.length} template(s) sans image de couverture`, href: '/admin/templates' });
  if (!settings.rebuild_hook_url) alerts.push({ level: 'info', text: 'Hook de rebuild non configuré (mises à jour du site public)', href: '/admin/settings' });
  return alerts;
}
