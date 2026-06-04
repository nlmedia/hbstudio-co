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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

-- ============ Row Level Security ============
alter table public.hb_admins      enable row level security;
alter table public.hb_templates   enable row level security;
alter table public.hb_subscribers enable row level security;
alter table public.hb_sales       enable row level security;
alter table public.hb_campaigns   enable row level security;
alter table public.hb_audit_log   enable row level security;

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
drop policy if exists hb_audit_admin_read on public.hb_audit_log;
create policy hb_audit_admin_read on public.hb_audit_log
  for select to authenticated using (public.hb_is_admin());
