-- ============================================================================
-- hb_templates: French content columns
-- ============================================================================
--
-- The public site is now bilingual (English unprefixed, French under /fr),
-- but the marketing copy for each template -- title, tagline, description,
-- body, features, tags -- lives in this table, not in the site's i18n
-- dictionaries. These six nullable columns hold the French counterpart of
-- each field.
--
-- Plain columns rather than a separate hb_template_translations table: with
-- exactly two languages today, the fallback rule is trivial (French column
-- empty or absent -> render the English one), and a join table only pays for
-- itself once a third language shows up. If that happens, this table is the
-- migration target and these six columns get dropped in the same change.
--
-- All six are nullable on purpose: an empty French column is exactly what
-- lets a template ship before it is translated, falling back to English
-- field-by-field (src/lib/catalog.ts applies the fallback, not this schema).
alter table public.hb_templates add column if not exists title_fr       text;
alter table public.hb_templates add column if not exists tagline_fr     text;
alter table public.hb_templates add column if not exists description_fr text;
alter table public.hb_templates add column if not exists body_fr        text;
alter table public.hb_templates add column if not exists features_fr   jsonb;
alter table public.hb_templates add column if not exists tags_fr       jsonb;

comment on column public.hb_templates.title_fr is
  'French title. Null or empty falls back to title (see src/lib/catalog.ts).';
comment on column public.hb_templates.tagline_fr is
  'French tagline. Null or empty falls back to tagline.';
comment on column public.hb_templates.description_fr is
  'French short description. Null or empty falls back to description.';
comment on column public.hb_templates.body_fr is
  'French long-form body. Null or empty falls back to body.';
comment on column public.hb_templates.features_fr is
  'French features list. Null or empty array falls back to features -- a
   partially-filled features_fr would silently drop the rest of the list, so
   the fallback is all-or-nothing per field, not per item.';
comment on column public.hb_templates.tags_fr is
  'French tags list. Null or empty array falls back to tags.';
