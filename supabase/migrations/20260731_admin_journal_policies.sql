-- ============================================================================
-- Admin journal write policies
-- Spec: docs/superpowers/specs/2026-07-31-licences-espace-client-design.md
-- ============================================================================
--
-- hb_audit_log and hb_license_events previously had only a SELECT policy for
-- admins (hb_audit_admin_read, hb_license_events_admin_read). No policy ever
-- allowed a write. That gap was invisible in local development, because the
-- dev bypass in src/middleware.ts uses the service-role client, which skips
-- RLS entirely -- but in production, /admin/licenses/[id].astro writes these
-- two tables through the authenticated admin's own session, which RLS does
-- govern. Every revoke/extend/reassign action there would update the license
-- row (hb_licenses has an admin "for all" policy) while silently failing to
-- write its hb_audit_log and hb_license_events rows, leaving the admin trail
-- empty exactly when it is needed most: while investigating a past action.
--
-- Scope is INSERT only, not "for all" like hb_licenses_admin_all. Checked
-- against the actual write sites (src/pages/admin/licenses/[id].astro and
-- netlify/functions/_licensing.mjs): both tables are only ever INSERTed into,
-- never UPDATEd or DELETEd, by any part of the codebase. Granting UPDATE or
-- DELETE here would let an authenticated admin session alter or erase past
-- audit entries, which would defeat the purpose of keeping an audit trail at
-- all. Least privilege: grant exactly what the code needs, nothing more.

drop policy if exists hb_audit_admin_insert on public.hb_audit_log;
create policy hb_audit_admin_insert on public.hb_audit_log
  for insert to authenticated with check (public.hb_is_admin());

drop policy if exists hb_license_events_admin_insert on public.hb_license_events;
create policy hb_license_events_admin_insert on public.hb_license_events
  for insert to authenticated with check (public.hb_is_admin());
