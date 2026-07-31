import { describe, it, expect, vi, afterEach } from 'vitest';
import { reinstateLicensesForSale } from './licensing.mjs';

/**
 * Minimal in-memory stand-in for the Supabase query builder, covering exactly
 * the operations _licensing.mjs uses: select/eq/in/order, update+select, insert.
 *
 * Written rather than mocked call-by-call on purpose: the behaviour under test
 * is "which rows come back for these filters", and a mock returning canned
 * values per call order would keep passing if the filters themselves were
 * wrong -- which is the one bug that matters here (reinstating a license that
 * was revoked for another reason).
 *
 * Rows are stored by reference so an update is visible to a later read, which
 * is what makes the replay test meaningful.
 */
function fakeSb(tables: Record<string, any[]>, failures: Record<string, string> = {}) {
  const inserted: { table: string; row: any }[] = [];

  function from(table: string) {
    const filters: Array<(r: any) => boolean> = [];
    const orderKeys: Array<[string, boolean]> = [];
    let op: 'select' | 'update' | 'insert' = 'select';
    let patch: any = {};

    const builder: any = {
      select: () => builder,
      eq: (col: string, val: any) => (filters.push((r) => r[col] === val), builder),
      in: (col: string, vals: any[]) => (filters.push((r) => vals.includes(r[col])), builder),
      order: (col: string, opts?: { ascending?: boolean }) =>
        (orderKeys.push([col, opts?.ascending !== false]), builder),
      update: (p: any) => ((op = 'update'), (patch = p), builder),
      insert: (row: any) => ((op = 'insert'), inserted.push({ table, row }), builder),
      // The real builder is a thenable, so `await query` runs it.
      then: (resolve: any, reject: any) => Promise.resolve(run()).then(resolve, reject),
    };

    function run() {
      const failure = failures[`${table}:${op}`];
      if (failure) return { data: null, error: { message: failure } };
      if (op === 'insert') return { data: null, error: null };

      let rows = (tables[table] ?? []).filter((r) => filters.every((f) => f(r)));
      if (op === 'update') for (const r of rows) Object.assign(r, patch);
      // Applied in reverse so the first .order() call is the primary key
      // (Array.prototype.sort is stable).
      for (const [col, asc] of [...orderKeys].reverse()) {
        rows = [...rows].sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (asc ? 1 : -1));
      }
      return { data: rows.map((r) => ({ ...r })), error: null };
    }

    return builder;
  }

  return { sb: { from } as any, inserted, tables };
}

const license = (id: string, status: string, saleId = 'cs_1') => ({
  id,
  sale_id: saleId,
  status,
});
const revokeEvent = (licenseId: string, reason: string | null, at: string, id: number) => ({
  id,
  license_id: licenseId,
  event: 'revoke',
  created_at: at,
  detail: reason === null ? { actor: 'admin@hbstudio.co' } : { reason, sale_id: 'cs_1' },
});

const DISPUTE = { revokedFor: 'charge.dispute.created', reason: 'charge.dispute.closed' };

afterEach(() => vi.restoreAllMocks());

describe('reinstateLicensesForSale', () => {
  it('puts back to active a license revoked by the chargeback it is closing', async () => {
    const { sb, inserted, tables } = fakeSb({
      hb_licenses: [license('lic_1', 'revoked')],
      hb_license_events: [revokeEvent('lic_1', 'charge.dispute.created', '2026-07-01T10:00:00Z', 1)],
    });

    expect(await reinstateLicensesForSale(sb, 'cs_1', DISPUTE)).toBe(1);
    expect(tables.hb_licenses[0].status).toBe('active');
    expect(inserted).toEqual([
      {
        table: 'hb_license_events',
        row: {
          license_id: 'lic_1',
          event: 'reinstate',
          detail: {
            reason: 'charge.dispute.closed',
            revoked_for: 'charge.dispute.created',
            sale_id: 'cs_1',
          },
        },
      },
    ]);
  });

  it('leaves revoked a license revoked by a refund', async () => {
    const { sb, inserted, tables } = fakeSb({
      hb_licenses: [license('lic_1', 'revoked')],
      hb_license_events: [revokeEvent('lic_1', 'charge.refunded', '2026-07-01T10:00:00Z', 1)],
    });

    expect(await reinstateLicensesForSale(sb, 'cs_1', DISPUTE)).toBe(0);
    expect(tables.hb_licenses[0].status).toBe('revoked');
    expect(inserted).toEqual([]);
  });

  it("leaves revoked a license revoked by an admin's own decision", async () => {
    // The admin UI writes { actor } with no reason at all -- it must land on the
    // refusing side of the comparison without needing a special case.
    const { sb, tables } = fakeSb({
      hb_licenses: [license('lic_1', 'revoked')],
      hb_license_events: [revokeEvent('lic_1', null, '2026-07-01T10:00:00Z', 1)],
    });

    expect(await reinstateLicensesForSale(sb, 'cs_1', DISPUTE)).toBe(0);
    expect(tables.hb_licenses[0].status).toBe('revoked');
  });

  it('leaves revoked a license whose revocation left no event behind', async () => {
    const { sb, tables } = fakeSb({
      hb_licenses: [license('lic_1', 'revoked')],
      hb_license_events: [],
    });

    expect(await reinstateLicensesForSale(sb, 'cs_1', DISPUTE)).toBe(0);
    expect(tables.hb_licenses[0].status).toBe('revoked');
  });

  it('judges on the LATEST revocation: dispute then refund stays revoked', async () => {
    const { sb, tables } = fakeSb({
      hb_licenses: [license('lic_1', 'revoked')],
      hb_license_events: [
        revokeEvent('lic_1', 'charge.dispute.created', '2026-07-01T10:00:00Z', 1),
        revokeEvent('lic_1', 'charge.refunded', '2026-07-05T10:00:00Z', 2),
      ],
    });

    expect(await reinstateLicensesForSale(sb, 'cs_1', DISPUTE)).toBe(0);
    expect(tables.hb_licenses[0].status).toBe('revoked');
  });

  it('judges on the LATEST revocation: refund then dispute comes back', async () => {
    const { sb, tables } = fakeSb({
      hb_licenses: [license('lic_1', 'revoked')],
      hb_license_events: [
        revokeEvent('lic_1', 'charge.refunded', '2026-07-01T10:00:00Z', 1),
        revokeEvent('lic_1', 'charge.dispute.created', '2026-07-05T10:00:00Z', 2),
      ],
    });

    expect(await reinstateLicensesForSale(sb, 'cs_1', DISPUTE)).toBe(1);
    expect(tables.hb_licenses[0].status).toBe('active');
  });

  it('breaks a same-timestamp tie on the event id, not on row order', async () => {
    const { sb, tables } = fakeSb({
      hb_licenses: [license('lic_1', 'revoked')],
      hb_license_events: [
        // Same created_at, and the dispute row comes FIRST in row order: a sort
        // on created_at alone is stable, so it would keep the dispute on top and
        // wrongly reinstate. Only the identity id says which happened last.
        revokeEvent('lic_1', 'charge.dispute.created', '2026-07-01T10:00:00Z', 4),
        revokeEvent('lic_1', 'charge.refunded', '2026-07-01T10:00:00Z', 9),
      ],
    });

    expect(await reinstateLicensesForSale(sb, 'cs_1', DISPUTE)).toBe(0);
    expect(tables.hb_licenses[0].status).toBe('revoked');
  });

  it('sorts each license on its own history, never on the batch as a whole', async () => {
    const { sb, tables } = fakeSb({
      hb_licenses: [license('lic_1', 'revoked'), license('lic_2', 'revoked')],
      hb_license_events: [
        revokeEvent('lic_1', 'charge.dispute.created', '2026-07-06T10:00:00Z', 3),
        revokeEvent('lic_2', 'charge.refunded', '2026-07-05T10:00:00Z', 2),
        revokeEvent('lic_2', 'charge.dispute.created', '2026-07-01T10:00:00Z', 1),
      ],
    });

    expect(await reinstateLicensesForSale(sb, 'cs_1', DISPUTE)).toBe(1);
    expect(tables.hb_licenses.map((l: any) => l.status)).toEqual(['active', 'revoked']);
  });

  it('is a no-op on a replay, once the license is already active', async () => {
    const { sb, inserted } = fakeSb({
      hb_licenses: [license('lic_1', 'active')],
      hb_license_events: [revokeEvent('lic_1', 'charge.dispute.created', '2026-07-01T10:00:00Z', 1)],
    });

    expect(await reinstateLicensesForSale(sb, 'cs_1', DISPUTE)).toBe(0);
    expect(inserted).toEqual([]);
  });

  it('never touches a license belonging to another sale', async () => {
    const { sb, tables } = fakeSb({
      hb_licenses: [license('lic_other', 'revoked', 'cs_2')],
      hb_license_events: [
        revokeEvent('lic_other', 'charge.dispute.created', '2026-07-01T10:00:00Z', 1),
      ],
    });

    expect(await reinstateLicensesForSale(sb, 'cs_1', DISPUTE)).toBe(0);
    expect(tables.hb_licenses[0].status).toBe('revoked');
  });

  it('refuses to reinstate blind when the revocation history cannot be read', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { sb, tables } = fakeSb(
      {
        hb_licenses: [license('lic_1', 'revoked')],
        hb_license_events: [revokeEvent('lic_1', 'charge.dispute.created', '2026-07-01T10:00:00Z', 1)],
      },
      { 'hb_license_events:select': 'connection reset' }
    );

    expect(await reinstateLicensesForSale(sb, 'cs_1', DISPUTE)).toBe(0);
    expect(tables.hb_licenses[0].status).toBe('revoked');
    expect(spy).toHaveBeenCalled();
  });

  it('reports 0 and changes nothing when the license lookup fails', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { sb, inserted } = fakeSb(
      { hb_licenses: [license('lic_1', 'revoked')], hb_license_events: [] },
      { 'hb_licenses:select': 'connection reset' }
    );

    expect(await reinstateLicensesForSale(sb, 'cs_1', DISPUTE)).toBe(0);
    expect(inserted).toEqual([]);
    expect(spy).toHaveBeenCalled();
  });

  it('reports 0 when the status update itself is refused', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { sb, inserted } = fakeSb(
      {
        hb_licenses: [license('lic_1', 'revoked')],
        hb_license_events: [revokeEvent('lic_1', 'charge.dispute.created', '2026-07-01T10:00:00Z', 1)],
      },
      { 'hb_licenses:update': 'permission denied' }
    );

    expect(await reinstateLicensesForSale(sb, 'cs_1', DISPUTE)).toBe(0);
    expect(inserted).toEqual([]);
    expect(spy).toHaveBeenCalled();
  });

  it('still counts the reinstatement when only the trace event is refused', async () => {
    // What an unapplied 20260731_license_event_reinstate.sql looks like: the
    // customer has their license back, only the audit line is missing.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { sb, tables } = fakeSb(
      {
        hb_licenses: [license('lic_1', 'revoked')],
        hb_license_events: [revokeEvent('lic_1', 'charge.dispute.created', '2026-07-01T10:00:00Z', 1)],
      },
      { 'hb_license_events:insert': 'violates check constraint "hb_license_events_event_check"' }
    );

    expect(await reinstateLicensesForSale(sb, 'cs_1', DISPUTE)).toBe(1);
    expect(tables.hb_licenses[0].status).toBe('active');
    expect(spy).toHaveBeenCalled();
  });

  it('logs every license it leaves revoked, so a won dispute is never silent', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { sb } = fakeSb({
      hb_licenses: [license('lic_1', 'revoked')],
      hb_license_events: [revokeEvent('lic_1', 'charge.refunded', '2026-07-01T10:00:00Z', 1)],
    });

    await reinstateLicensesForSale(sb, 'cs_1', DISPUTE);
    expect(spy.mock.calls.flat().join(' ')).toContain('lic_1');
    expect(spy.mock.calls.flat().join(' ')).toContain('charge.refunded');
  });

  it('does nothing without a client, a sale id, or a revocation reason to match', async () => {
    const { sb } = fakeSb({ hb_licenses: [license('lic_1', 'revoked')], hb_license_events: [] });
    expect(await reinstateLicensesForSale(null as any, 'cs_1', DISPUTE)).toBe(0);
    expect(await reinstateLicensesForSale(sb, '', DISPUTE)).toBe(0);
    // No filter means "reinstate everything", the exact outcome this guards against.
    expect(await reinstateLicensesForSale(sb, 'cs_1', { revokedFor: '', reason: 'x' })).toBe(0);
    expect(await reinstateLicensesForSale(sb, 'cs_1')).toBe(0);
  });
});
