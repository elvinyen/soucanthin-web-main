import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { hasAdminPermission } from '../api/_admin-utils';
import type { Order } from '../types/order';
import {
  DEFAULT_DELIVERY_SETTINGS,
  calculateCustomerDeliveryFee,
  calculateFallbackFee,
  createLalamoveSignature,
  createOrderCartHash,
  hasReachedApprovalRequestLimit,
  isExpiredTimestamp,
  isQuoteRateLimited,
  validateDeliverySettings,
} from '../api/_delivery-policy';

test('fallback pricing covers every configured boundary through 20km', () => {
  const cases = [[3, 6], [3.01, 8], [5, 8], [8, 12], [10, 15], [12, 18], [15, 22], [18, 26], [20, 30]];
  for (const [distance, fee] of cases) assert.equal(calculateFallbackFee(distance, DEFAULT_DELIVERY_SETTINGS), fee);
  assert.throws(() => calculateFallbackFee(20.01, DEFAULT_DELIVERY_SETTINGS));
});

test('Lalamove price adds markup and rounds upward to whole MYR', () => {
  assert.equal(calculateCustomerDeliveryFee(12.5, 15), 15);
  assert.equal(calculateCustomerDeliveryFee(18, 15), 21);
  assert.equal(calculateCustomerDeliveryFee(24.5, 15), 29);
});

test('settings reject unordered tiers or a final tier that differs from the distance limit', () => {
  assert.throws(() => validateDeliverySettings({ ...DEFAULT_DELIVERY_SETTINGS, fallbackFeeTiers: [{ maxKm: 5, fee: 8 }, { maxKm: 3, fee: 6 }] }));
  assert.throws(() => validateDeliverySettings({ ...DEFAULT_DELIVERY_SETTINGS, maxAutoDistanceKm: 21 }));
});

test('cart hash is stable across item and option ordering but changes with quantity', () => {
  const order = sampleOrder();
  const reordered = sampleOrder();
  reordered.items.reverse();
  reordered.items[1].options?.reverse();
  assert.equal(createOrderCartHash(order), createOrderCartHash(reordered));
  reordered.items[0].qty += 1;
  assert.notEqual(createOrderCartHash(order), createOrderCartHash(reordered));
});

test('Lalamove HMAC signature uses the documented canonical request', () => {
  const signature = createLalamoveSignature('1700000000000', 'POST', '/v3/quotations', '{"data":{}}', 'secret');
  assert.equal(signature, '4f9630e6d1ab3a8a9bd354f110bc18d7dce26a0cb42a05c6c931887ef214c1a2');
});

test('quote and approval expiration treats missing, invalid, and boundary timestamps as expired', () => {
  const now = Date.parse('2026-08-02T00:00:00.000Z');
  assert.equal(isExpiredTimestamp(null, now), true);
  assert.equal(isExpiredTimestamp('invalid', now), true);
  assert.equal(isExpiredTimestamp('2026-08-02T00:00:00.000Z', now), true);
  assert.equal(isExpiredTimestamp('2026-08-02T00:00:00.001Z', now), false);
});

test('public quote and manual request limits enforce the configured windows', () => {
  const now = Date.parse('2026-08-02T12:00:00.000Z');
  const withinTenMinutes = Array.from({ length: 10 }, (_, index) => ({ created_at: new Date(now - index * 30_000).toISOString() }));
  const withinOneDay = Array.from({ length: 60 }, (_, index) => ({ created_at: new Date(now - 11 * 60_000 - index * 60_000).toISOString() }));
  assert.equal(isQuoteRateLimited(withinTenMinutes, now), true);
  assert.equal(isQuoteRateLimited(withinOneDay, now), true);
  assert.equal(isQuoteRateLimited(withinTenMinutes.slice(0, 9), now), false);
  assert.equal(hasReachedApprovalRequestLimit(2), false);
  assert.equal(hasReachedApprovalRequestLimit(3), true);
});

test('delivery approval permissions include the operations assistant and exclude kitchen staff', () => {
  const approvalRoles = ['admin', 'customer_service'] as const;
  assert.equal(hasAdminPermission('customer_service', [...approvalRoles]), true);
  assert.equal(hasAdminPermission('admin', [...approvalRoles]), true);
  assert.equal(hasAdminPermission('kitchen', [...approvalRoles]), false);
});

test('database migration prevents approval reuse and restricts delivery tables to service role', () => {
  const schemaPath = fileURLToPath(new URL('../supabase-schema.sql', import.meta.url));
  const schema = readFileSync(schemaPath, 'utf8');
  assert.match(schema, /create unique index if not exists orders_delivery_approval_unique_idx/);
  assert.match(schema, /delivery_approval_one_active_user_idx[\s\S]*status in \('pending', 'approved'\)/);
  assert.match(schema, /alter table public\.delivery_approval_requests enable row level security/);
  assert.match(schema, /revoke all on table public\.delivery_settings, public\.delivery_quotes, public\.delivery_approval_requests from public, anon, authenticated/);
  assert.match(schema, /grant select, insert, update, delete on table public\.delivery_settings, public\.delivery_quotes, public\.delivery_approval_requests to service_role/);
});

function sampleOrder(): Order {
  return {
    orderType: 'takeaway', paymentMethod: 'wallet', customer: { name: 'Test', phone: '0123456789' },
    takeaway: { address: 'Kuala Lumpur' }, subtotal: 20, serviceCharge: 0, total: 20, createdAt: new Date(0).toISOString(),
    items: [
      { id: '2', name: 'B', price: 8, qty: 1 },
      { id: '1', name: 'A', price: 6, qty: 2, options: [
        { groupId: 'g2', groupName: 'G2', optionId: 'o2', name: 'O2', priceDelta: 1 },
        { groupId: 'g1', groupName: 'G1', optionId: 'o1', name: 'O1', priceDelta: 0 },
      ] },
    ],
  };
}
