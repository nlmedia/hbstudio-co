import type { SupabaseClient } from '@supabase/supabase-js';
import { getSettings } from './settings';

const SITE_URL = 'https://hbstudio-co.netlify.app';

export interface CampaignTemplate {
  slug: string;
  title: string;
  tagline?: string;
  description?: string;
  cms?: string;
  price?: number | null;
  sale_price?: number | null;
  currency?: string;
  cover?: string;
}

/** Build a polished, on-brand HTML email announcing a template. */
export function buildTemplateEmail(t: CampaignTemplate, opts: { siteUrl?: string } = {}): { subject: string; html: string } {
  const base = opts.siteUrl ?? SITE_URL;
  const url = `${base}/templates/${t.slug}`;
  const cur = t.currency ?? '€';
  const onSale = t.price != null && t.sale_price != null && t.sale_price < t.price;
  const priceBlock = t.price == null ? '' : onSale
    ? `<span style="text-decoration:line-through;color:#9a9aa2;font-size:15px">${cur}${t.price}</span>
       <span style="color:#e23b3b;font-weight:700;font-size:20px;margin-left:6px">${cur}${t.sale_price}</span>`
    : `<span style="font-weight:700;font-size:20px;color:#0e0e12">${cur}${t.price}</span>`;
  const subject = onSale
    ? `Nouveau template : ${t.title} — en promo`
    : `Nouveau template : ${t.title}`;

  const cover = t.cover
    ? `<img src="${t.cover}" alt="${escapeHtml(t.title)}" width="536" style="width:100%;max-width:536px;border-radius:14px;display:block;margin:0 0 22px" />`
    : '';

  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;background:#f8f7f4;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0e0e12">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px">
    <div style="text-align:center;margin-bottom:28px">
      <span style="font-size:20px;font-weight:800;letter-spacing:-.02em">HB Studio<span style="color:#6d4aff">.</span>Co</span>
    </div>
    <div style="background:#fff;border:1px solid #ececec;border-radius:18px;padding:28px">
      <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#6d4aff">Nouveau template${t.cms ? ` · ${escapeHtml(t.cms)}` : ''}</p>
      <h1 style="margin:0 0 8px;font-size:26px;line-height:1.2">${escapeHtml(t.title)}</h1>
      ${t.tagline ? `<p style="margin:0 0 18px;font-size:16px;color:#56565e">${escapeHtml(t.tagline)}</p>` : ''}
      ${cover}
      ${t.description ? `<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#3a3a42">${escapeHtml(t.description)}</p>` : ''}
      <div style="margin:0 0 22px">${priceBlock}</div>
      <a href="${url}" style="display:inline-block;background:#0e0e12;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 26px;border-radius:999px">Voir le template →</a>
    </div>
    <p style="text-align:center;margin:22px 0 0;font-size:12px;color:#9a9aa2">
      Vous recevez cet email car vous êtes inscrit à la newsletter HB Studio Co.<br />
      <a href="${base}" style="color:#9a9aa2">hbstudio.co</a> · <a href="{{ unsubscribe }}" style="color:#9a9aa2">Se désabonner</a>
    </p>
  </div>
</body></html>`;
  return { subject, html };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

export interface SendResult { ok: boolean; sent: number; error?: string; messageId?: string }

/**
 * Send a one-off transactional email to a batch of recipients via Brevo.
 * Uses the transactional API (each recipient gets the mail; we BCC in batches).
 */
export async function sendCampaign(
  supabase: SupabaseClient,
  args: { subject: string; html: string; recipients: string[] },
): Promise<SendResult> {
  const s = await getSettings(supabase);
  if (!s.brevo_api_key) return { ok: false, sent: 0, error: 'Clé API Brevo manquante (Réglages).' };
  if (!s.sender_email) return { ok: false, sent: 0, error: 'Email expéditeur manquant (Réglages).' };
  if (!args.recipients.length) return { ok: false, sent: 0, error: 'Aucun destinataire.' };

  const sender = { name: s.sender_name || 'HB Studio Co', email: s.sender_email };
  let sent = 0;
  let lastId: string | undefined;
  // Brevo allows many recipients per call; chunk to stay safe.
  const chunks = chunk(args.recipients, 90);
  for (const group of chunks) {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': s.brevo_api_key, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender,
        ...(s.reply_to ? { replyTo: { email: s.reply_to } } : {}),
        to: [{ email: sender.email, name: sender.name }],
        bcc: group.map((email) => ({ email })),
        subject: args.subject,
        htmlContent: args.html,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { ok: false, sent, error: `Brevo ${res.status}: ${body.slice(0, 300)}` };
    }
    const json = await res.json().catch(() => ({}));
    lastId = json.messageId ?? lastId;
    sent += group.length;
  }
  return { ok: true, sent, messageId: lastId };
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/**
 * Auto-announce a template to subscribers when it becomes published.
 * No-op unless the setting is enabled, Brevo is configured, the template just
 * transitioned into 'published', and it has never been announced before.
 * Safe to call on every save — guards prevent duplicate sends.
 */
export async function autoAnnounceTemplate(
  supabase: SupabaseClient,
  templateId: string,
  opts: { prevStatus?: string | null; newStatus?: string | null } = {},
): Promise<SendResult | null> {
  if (opts.newStatus !== 'published') return null;
  if (opts.prevStatus === 'published') return null;

  const s = await getSettings(supabase);
  if (s.auto_email_on_publish !== 'true') return null;
  if (!s.brevo_api_key || !s.sender_email) return null;

  // Already announced once? Don't re-send.
  const { count } = await supabase.from('hb_campaigns')
    .select('*', { count: 'exact', head: true })
    .eq('template_id', templateId).eq('status', 'sent');
  if ((count ?? 0) > 0) return null;

  const { data: tpl } = await supabase.from('hb_templates')
    .select('id, slug, title, tagline, description, cms, price, sale_price, currency, cover')
    .eq('id', templateId).maybeSingle();
  if (!tpl) return null;

  const { data: subs } = await supabase.from('hb_subscribers').select('email').eq('status', 'subscribed');
  const recipients = (subs ?? []).map((r) => r.email);
  if (!recipients.length) return null;

  const { subject, html } = buildTemplateEmail(tpl);
  const result = await sendCampaign(supabase, { subject, html, recipients });
  await supabase.from('hb_campaigns').insert({
    template_id: tpl.id,
    subject,
    recipients: result.ok ? result.sent : 0,
    status: result.ok ? 'sent' : 'failed',
    brevo_message_id: result.messageId ?? null,
    sent_at: result.ok ? new Date().toISOString() : null,
  });
  return result;
}
