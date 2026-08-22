import assert from 'node:assert/strict';
import test from 'node:test';
import { formatStoreSchedule, isStoreOpen } from '../businessHours';
import { selectWebsiteStoreStatus } from '../api/_store-operations';

function malaysiaTime(hour: number, minute = 0) {
  return new Date(Date.UTC(2026, 0, 1, hour - 8, minute));
}

test('business hours support both same-day and overnight schedules', () => {
  assert.equal(isStoreOpen(malaysiaTime(10), 9 * 60, 18 * 60), true);
  assert.equal(isStoreOpen(malaysiaTime(18), 9 * 60, 18 * 60), false);
  assert.equal(isStoreOpen(malaysiaTime(23), 17 * 60, 4 * 60), true);
  assert.equal(isStoreOpen(malaysiaTime(3, 59), 17 * 60, 4 * 60), true);
  assert.equal(isStoreOpen(malaysiaTime(4), 17 * 60, 4 * 60), false);
  assert.equal(isStoreOpen(malaysiaTime(12), 12 * 60, 12 * 60), false);
  assert.equal(formatStoreSchedule(9 * 60, 18 * 60), '每日 09:00–18:00');
});

test('website routes customers to an open branch instead of a closed higher-priority branch', () => {
  const status = selectWebsiteStoreStatus([
    { id: 'cheras', name: 'Cheras', active: true, sort_order: 10, opening_minute: 9 * 60, closing_minute: 18 * 60 },
    { id: 'pudu', name: 'Pudu', active: true, sort_order: 20, opening_minute: 17 * 60, closing_minute: 4 * 60 },
  ], malaysiaTime(20));
  assert.equal(status.branchId, 'pudu');
  assert.equal(status.open, true);
});
