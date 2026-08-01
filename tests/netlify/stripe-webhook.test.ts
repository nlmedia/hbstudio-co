import { describe, it, expect } from 'vitest';
import { isFullRefund, isDisputeWon } from '../../netlify/functions/stripe-webhook.mjs';

describe('isFullRefund', () => {
  it('is true when the whole charge was refunded', () => {
    expect(isFullRefund({ amount: 6900, amount_refunded: 6900 })).toBe(true);
  });

  it('is false for a partial goodwill refund', () => {
    expect(isFullRefund({ amount: 6900, amount_refunded: 1000 })).toBe(false);
  });

  it('is false when nothing has been refunded yet', () => {
    expect(isFullRefund({ amount: 6900, amount_refunded: 0 })).toBe(false);
  });

  it('tolerates an over-refund Stripe should never send', () => {
    expect(isFullRefund({ amount: 6900, amount_refunded: 7000 })).toBe(true);
  });
});

describe('isDisputeWon', () => {
  const closed = (status: string) => ({ type: 'charge.dispute.closed', data: { object: { status } } });

  it('is true for a dispute closed in the merchant\'s favour', () => {
    expect(isDisputeWon(closed('won'))).toBe(true);
  });

  it('is false for a dispute lost — the revocation stands', () => {
    expect(isDisputeWon(closed('lost'))).toBe(false);
  });

  it('is false for an early warning closed without a real dispute', () => {
    expect(isDisputeWon(closed('warning_closed'))).toBe(false);
  });

  it('is false while the dispute is only being opened', () => {
    expect(isDisputeWon({ type: 'charge.dispute.created', data: { object: { status: 'won' } } })).toBe(false);
  });

  it('is false for any other event type, whatever it carries', () => {
    expect(isDisputeWon({ type: 'charge.refunded', data: { object: { status: 'won' } } })).toBe(false);
  });

  it('tolerates a malformed event instead of throwing inside the webhook', () => {
    expect(isDisputeWon(undefined)).toBe(false);
    expect(isDisputeWon({ type: 'charge.dispute.closed' })).toBe(false);
    expect(isDisputeWon({ type: 'charge.dispute.closed', data: {} })).toBe(false);
  });
});
