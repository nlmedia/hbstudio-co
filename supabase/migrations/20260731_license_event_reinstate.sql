-- ============================================================================
-- hb_license_events: new "reinstate" event
-- Spec: docs/superpowers/specs/2026-07-31-licences-espace-client-design.md
-- ============================================================================
--
-- Winning a chargeback (charge.dispute.closed with status "won") has to undo
-- the revocation that opening it caused, and that reversal needs its own trace
-- in the technical log. None of the six existing event values fits: "activate"
-- already means a SITE activation (a domain consuming a seat), so reusing it
-- for a license coming back from revocation would corrupt the seat-counting
-- reading of the table.
--
-- The constraint is dropped and recreated rather than widened in place --
-- Postgres has no "alter constraint" for a CHECK. `if not exists` on the table
-- itself is not enough here: the table already exists in every environment, so
-- editing the inline check in schema.sql would silently do nothing.
--
-- hb_license_events_event_check is the name Postgres auto-assigned to the
-- inline `check (event in (...))` of the table (pattern: <table>_<column>_check).
-- `if exists` keeps this re-runnable and covers a database where it was ever
-- renamed by hand.

alter table public.hb_license_events
  drop constraint if exists hb_license_events_event_check;

alter table public.hb_license_events
  add constraint hb_license_events_event_check
  check (event in ('activate','deactivate','validate','revoke','reassign','extend','reinstate'));
