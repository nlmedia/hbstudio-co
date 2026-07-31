-- ============================================================================
-- HB Studio Co — admin database schema (portable backup)
-- Re-import on any Supabase project: SQL Editor → paste this → Run.
-- Then run seed.sql for the initial data. Tables are prefixed hb_ and isolated.
-- ============================================================================

-- Admin allowlist: only these emails can access the admin
create table if not exists public.hb_admins (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  created_at timestamptz not null default now()
);

-- Helper: is the current authenticated user an allowlisted admin?
create or replace function public.hb_is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.hb_admins a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- Templates (products to sell)
create table if not exists public.hb_templates (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  cms text not null default 'shopify' check (cms in ('shopify','wordpress','woocommerce','other')),
  tagline text,
  description text,
  body text,
  price numeric,
  sale_price numeric,
  sale_ends_at timestamptz,
  currency text not null default '€',
  status text not null default 'draft' check (status in ('draft','published','coming-soon')),
  featured boolean not null default false,
  sort_order int not null default 100,
  cover text,
  preview text,
  preview_mobile text,
  gallery jsonb not null default '[]',
  features jsonb not null default '[]',
  tags jsonb not null default '[]',
  demo_url text,
  buy_url text,
  docs_url text,
  deliverable text, -- path in the private "deliverables" storage bucket
  extended_price numeric, -- Extended tier price (licenses phase 1)
  theme_slug text, -- WordPress theme folder name (licenses phase 1)
  requires_wp text,
  requires_php text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.hb_templates.theme_slug is
  'WordPress theme folder name. WordPress identifies a theme by this exact name: without an exact match, the update never shows up for the client.';

-- Newsletter subscribers
create table if not exists public.hb_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  status text not null default 'subscribed' check (status in ('subscribed','unsubscribed')),
  source text default 'site',
  created_at timestamptz not null default now()
);

-- Sales (synced from Stripe)
create table if not exists public.hb_sales (
  id text primary key,
  item text,
  amount int,
  currency text default 'eur',
  email text,
  status text default 'paid',
  raw jsonb,
  created_at timestamptz not null default now()
);

-- Email campaigns log
create table if not exists public.hb_campaigns (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references public.hb_templates(id) on delete set null,
  subject text,
  recipients int default 0,
  status text default 'draft' check (status in ('draft','sent','failed')),
  brevo_message_id text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

-- Settings (key/value, admin-only — can hold secrets like the Brevo API key)
create table if not exists public.hb_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

-- Audit log
create table if not exists public.hb_audit_log (
  id bigint generated always as identity primary key,
  actor text,
  action text,
  detail jsonb,
  created_at timestamptz not null default now()
);

-- updated_at trigger for templates
create or replace function public.hb_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists hb_templates_touch on public.hb_templates;
create trigger hb_templates_touch before update on public.hb_templates
for each row execute function public.hb_touch_updated_at();

-- ============================================================================
-- Phase 1 licenses — hb_licenses, hb_activations, hb_template_versions,
-- hb_license_events. Spec: docs/superpowers/specs/2026-07-31-licences-espace-client-design.md
-- ============================================================================

-- Licenses (one row per purchase)
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

-- Activations (one row per site, active or past)
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

-- Template versions (feeds the update server and the download history)
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

-- License events — TECHNICAL log (API calls). The admin's human actions go
-- into hb_audit_log.
create table if not exists public.hb_license_events (
  id         bigint generated always as identity primary key,
  license_id uuid references public.hb_licenses(id) on delete cascade,
  event      text not null check (event in ('activate','deactivate','validate','revoke','reassign','extend')),
  domain     text,
  ip         text,
  user_agent text,
  detail     jsonb,
  created_at timestamptz not null default now()
);
create index if not exists hb_license_events_license_idx
  on public.hb_license_events (license_id, created_at desc);

-- ============ Row Level Security ============
alter table public.hb_admins      enable row level security;
alter table public.hb_templates   enable row level security;
alter table public.hb_subscribers enable row level security;
alter table public.hb_sales       enable row level security;
alter table public.hb_campaigns   enable row level security;
alter table public.hb_settings    enable row level security;
alter table public.hb_audit_log   enable row level security;
alter table public.hb_licenses          enable row level security;
alter table public.hb_activations       enable row level security;
alter table public.hb_template_versions enable row level security;
alter table public.hb_license_events    enable row level security;

drop policy if exists hb_admins_admin_all on public.hb_admins;
create policy hb_admins_admin_all on public.hb_admins
  for all to authenticated using (public.hb_is_admin()) with check (public.hb_is_admin());

drop policy if exists hb_templates_public_read on public.hb_templates;
create policy hb_templates_public_read on public.hb_templates
  for select to anon, authenticated using (status = 'published' or public.hb_is_admin());
drop policy if exists hb_templates_admin_write on public.hb_templates;
create policy hb_templates_admin_write on public.hb_templates
  for all to authenticated using (public.hb_is_admin()) with check (public.hb_is_admin());

drop policy if exists hb_subscribers_public_insert on public.hb_subscribers;
create policy hb_subscribers_public_insert on public.hb_subscribers
  for insert to anon, authenticated with check (true);
drop policy if exists hb_subscribers_admin_all on public.hb_subscribers;
create policy hb_subscribers_admin_all on public.hb_subscribers
  for all to authenticated using (public.hb_is_admin()) with check (public.hb_is_admin());

drop policy if exists hb_sales_admin_all on public.hb_sales;
create policy hb_sales_admin_all on public.hb_sales
  for all to authenticated using (public.hb_is_admin()) with check (public.hb_is_admin());
drop policy if exists hb_campaigns_admin_all on public.hb_campaigns;
create policy hb_campaigns_admin_all on public.hb_campaigns
  for all to authenticated using (public.hb_is_admin()) with check (public.hb_is_admin());
drop policy if exists hb_settings_admin_all on public.hb_settings;
create policy hb_settings_admin_all on public.hb_settings
  for all to authenticated using (public.hb_is_admin()) with check (public.hb_is_admin());
drop policy if exists hb_audit_admin_read on public.hb_audit_log;
create policy hb_audit_admin_read on public.hb_audit_log
  for select to authenticated using (public.hb_is_admin());

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

drop policy if exists hb_template_versions_owner_read on public.hb_template_versions;
create policy hb_template_versions_owner_read on public.hb_template_versions
  for select to authenticated using (
    public.hb_is_admin()
    or exists (
      select 1 from public.hb_licenses l
      where l.template_id = hb_template_versions.template_id
        and l.user_id = auth.uid()
    )
  );
drop policy if exists hb_template_versions_admin_all on public.hb_template_versions;
create policy hb_template_versions_admin_all on public.hb_template_versions
  for all to authenticated using (public.hb_is_admin()) with check (public.hb_is_admin());

drop policy if exists hb_license_events_admin_read on public.hb_license_events;
create policy hb_license_events_admin_read on public.hb_license_events
  for select to authenticated using (public.hb_is_admin());
