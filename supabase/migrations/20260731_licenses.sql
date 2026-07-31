-- ============================================================================
-- Phase 1 — Activation licenses
-- Spec: docs/superpowers/specs/2026-07-31-licences-espace-client-design.md
-- ============================================================================

-- ── hb_templates: added columns ─────────────────────────────────────────────
alter table public.hb_templates add column if not exists extended_price numeric;
alter table public.hb_templates add column if not exists theme_slug   text;
alter table public.hb_templates add column if not exists requires_wp  text;
alter table public.hb_templates add column if not exists requires_php text;

comment on column public.hb_templates.theme_slug is
  'WordPress theme folder name. WordPress identifies a theme by this exact name: without an exact match, the update never shows up for the client.';

-- ── hb_licenses ─────────────────────────────────────────────────────────────
-- No "expired" status: a license never expires for USAGE, only the right to
-- updates expires, and that is decided by updates_until.
create table if not exists public.hb_licenses (
  id            uuid primary key default gen_random_uuid(),
  key           text unique not null,
  template_id   uuid references public.hb_templates(id) on delete restrict,
  tier          text not null check (tier in ('single','extended')),
  seats         int  not null check (seats > 0),
  email         text not null,
  user_id       uuid references auth.users(id) on delete set null,
  status        text not null default 'active' check (status in ('active','revoked')),
  sale_id       text references public.hb_sales(id) on delete set null,
  updates_until timestamptz not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on column public.hb_licenses.seats is
  'Locked in at purchase. If the Extended tier ever moves from 5 to 10 sites, licenses already sold keep the rights that were paid for.';

create index if not exists hb_licenses_email_idx on public.hb_licenses (lower(email));
create index if not exists hb_licenses_user_idx  on public.hb_licenses (user_id);
-- A sale can only produce one license: guarantees idempotency if Stripe replays
-- the webhook. Never used as the target of an ON CONFLICT (partial index).
create unique index if not exists hb_licenses_sale_uidx
  on public.hb_licenses (sale_id) where sale_id is not null;

drop trigger if exists hb_licenses_touch on public.hb_licenses;
create trigger hb_licenses_touch before update on public.hb_licenses
  for each row execute function public.hb_touch_updated_at();

-- ── hb_activations ──────────────────────────────────────────────────────────
-- Seats consumed = deactivated_at is null AND is_dev = false.
-- Deliberately NO partial unique index on (license_id, domain): reactivating a
-- released domain is handled explicitly in phase 3, and a partial index
-- combined with an upsert forces the WHERE clause to be replicated in the
-- ON CONFLICT — a silent write-time divergence.
create table if not exists public.hb_activations (
  id             uuid primary key default gen_random_uuid(),
  license_id     uuid not null references public.hb_licenses(id) on delete cascade,
  domain         text not null,
  platform       text check (platform in ('woocommerce','shopify')),
  site_name      text,
  is_dev         boolean not null default false,
  activated_at   timestamptz not null default now(),
  deactivated_at timestamptz,
  last_seen_at   timestamptz
);
create index if not exists hb_activations_license_domain_idx
  on public.hb_activations (license_id, domain);

-- ── hb_template_versions ────────────────────────────────────────────────────
create table if not exists public.hb_template_versions (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.hb_templates(id) on delete cascade,
  version     text not null,
  package     text not null,
  changelog   text,
  released_at timestamptz not null default now(),
  unique (template_id, version)
);
create index if not exists hb_template_versions_released_idx
  on public.hb_template_versions (template_id, released_at desc);

-- ── hb_license_events ───────────────────────────────────────────────────────
-- TECHNICAL log (API calls). The admin's human actions go into hb_audit_log.
create table if not exists public.hb_license_events (
  id          bigint generated always as identity primary key,
  license_id  uuid references public.hb_licenses(id) on delete cascade,
  event       text not null check (event in ('activate','deactivate','validate','revoke','reassign','extend')),
  domain      text,
  ip          text,
  user_agent  text,
  key_hash    text,
  detail      jsonb,
  created_at  timestamptz not null default now()
);

comment on column public.hb_license_events.key_hash is
  'Hex-encoded SHA-256 digest of the presented key, computed by the CALLER — never the key itself. Populated even when no license matches, the case where license_id is necessarily null; that is what makes rate-limiting possible on an UNKNOWN key (§10.2). Do not "simplify" this into the raw key: this table is meant to be read, exported to observability tooling, and pasted into support tickets, so it must never carry a secret that by itself grants activation rights. A hash still lets two attempts on the same key be correlated, which is all rate-limiting needs.';

create index if not exists hb_license_events_license_idx
  on public.hb_license_events (license_id, created_at desc);
create index if not exists hb_license_events_ip_idx
  on public.hb_license_events (ip, created_at desc);
create index if not exists hb_license_events_key_hash_idx
  on public.hb_license_events (key_hash, created_at desc);

-- ============ Row Level Security ============
alter table public.hb_licenses          enable row level security;
alter table public.hb_activations       enable row level security;
alter table public.hb_template_versions enable row level security;
alter table public.hb_license_events    enable row level security;

drop policy if exists hb_licenses_owner_read on public.hb_licenses;
create policy hb_licenses_owner_read on public.hb_licenses
  for select to authenticated using (user_id = auth.uid() or public.hb_is_admin());
drop policy if exists hb_licenses_admin_all on public.hb_licenses;
create policy hb_licenses_admin_all on public.hb_licenses
  for all to authenticated using (public.hb_is_admin()) with check (public.hb_is_admin());

drop policy if exists hb_activations_owner_read on public.hb_activations;
create policy hb_activations_owner_read on public.hb_activations
  for select to authenticated using (
    exists (
      select 1 from public.hb_licenses l
      where l.id = hb_activations.license_id
        and (l.user_id = auth.uid() or public.hb_is_admin())
    )
  );
drop policy if exists hb_activations_admin_all on public.hb_activations;
create policy hb_activations_admin_all on public.hb_activations
  for all to authenticated using (public.hb_is_admin()) with check (public.hb_is_admin());

-- No client read policy here, deliberately. The `package` column is a storage
-- path in the private "deliverables" bucket, and spec §10.1 requires that this
-- path never reach the client in any form. RLS cannot restrict access at the
-- column level, only the row level, so any client-facing SELECT policy on this
-- table — even one filtered by license status or updates_until — would still
-- hand back `package` to whoever the row is visible to. Phase 2 will expose
-- version metadata to clients through a `security definer` RPC that omits
-- `package` and filters by entitlement (§5.4) instead of a table-level policy.
drop policy if exists hb_template_versions_admin_all on public.hb_template_versions;
create policy hb_template_versions_admin_all on public.hb_template_versions
  for all to authenticated using (public.hb_is_admin()) with check (public.hb_is_admin());

drop policy if exists hb_license_events_admin_read on public.hb_license_events;
create policy hb_license_events_admin_read on public.hb_license_events
  for select to authenticated using (public.hb_is_admin());
