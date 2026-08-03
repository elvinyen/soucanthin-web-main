import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { enforceAdminBranch, hasAdminPermission, hasAllBranchAccess, hashPassword, normalizeAdminRole, verifyPassword } from '../api/_admin-utils';
import { normalizeBranchAccess } from '../api/admin-accounts';
import { validateAdminOrderTransition } from '../api/admin-orders';

test('admin roles are reduced to administrator, operations assistant, and kitchen', () => {
  assert.equal(normalizeAdminRole('admin'), 'admin');
  assert.equal(normalizeAdminRole('owner'), 'admin');
  assert.equal(normalizeAdminRole('manager'), 'admin');
  assert.equal(normalizeAdminRole('staff'), 'customer_service');
  assert.equal(normalizeAdminRole('delivery'), 'customer_service');
  assert.equal(normalizeAdminRole('kitchen'), 'kitchen');
  assert.equal(hasAdminPermission('admin', ['kitchen']), true);
  assert.equal(hasAdminPermission('kitchen', ['customer_service']), false);
});

test('non-admin staff are restricted to their assigned branch', () => {
  const assistant = { role: 'customer_service' as const, assignedBranchId: 'cheras' };
  assert.equal(enforceAdminBranch(assistant), 'cheras');
  assert.equal(enforceAdminBranch(assistant, 'cheras'), 'cheras');
  assert.throws(() => enforceAdminBranch(assistant, 'pudu'), /其他门店/);
  assert.throws(() => enforceAdminBranch({ role: 'kitchen' as const }), /尚未分配门店/);
  assert.equal(enforceAdminBranch({ role: 'admin' as const }, 'pudu'), 'pudu');
});

test('operations assistants can be granted all-store access while kitchen stays single-store', () => {
  const globalAssistant = { role: 'customer_service' as const, branchScope: 'all' as const };
  assert.equal(hasAllBranchAccess(globalAssistant), true);
  assert.equal(enforceAdminBranch(globalAssistant), null);
  assert.equal(enforceAdminBranch(globalAssistant, 'pudu'), 'pudu');
  assert.deepEqual(normalizeBranchAccess('customer_service', 'all', null), { branchScope: 'all', assignedBranchId: null });
  assert.deepEqual(normalizeBranchAccess('customer_service', 'assigned', 'cheras'), { branchScope: 'assigned', assignedBranchId: 'cheras' });
  assert.throws(() => normalizeBranchAccess('kitchen', 'all', 'cheras'), /指定门店/);
});

test('admin password hashes verify without storing the original password', async () => {
  const passwordHash = await hashPassword('new-password-123');
  assert.notEqual(passwordHash, 'new-password-123');
  assert.equal(await verifyPassword('new-password-123', passwordHash), true);
  assert.equal(await verifyPassword('wrong-password', passwordHash), false);
});

test('operations assistants cannot bypass kitchen and delivery order transitions', () => {
  assert.doesNotThrow(() => validateAdminOrderTransition('customer_service', 'pending_confirm', 'waiting_kitchen', 'takeaway'));
  assert.doesNotThrow(() => validateAdminOrderTransition('customer_service', 'waiting_kitchen', 'cancelled', 'takeaway'));
  assert.doesNotThrow(() => validateAdminOrderTransition('customer_service', 'delivered', 'completed', 'takeaway'));
  assert.throws(() => validateAdminOrderTransition('customer_service', 'waiting_kitchen', 'cooking', 'takeaway'), /不能执行/);
  assert.throws(() => validateAdminOrderTransition('customer_service', 'pending_confirm', 'completed', 'dinein'), /不能执行/);
  assert.doesNotThrow(() => validateAdminOrderTransition('admin', 'pending_confirm', 'completed', 'takeaway'));
});

test('schema provides append-only unified admin audit logs', () => {
  const schemaPath = fileURLToPath(new URL('../supabase-schema.sql', import.meta.url));
  const schema = readFileSync(schemaPath, 'utf8');
  assert.match(schema, /create table if not exists public\.admin_audit_logs/);
  assert.match(schema, /alter table public\.admin_audit_logs enable row level security/);
  assert.match(schema, /revoke update, delete, truncate, references, trigger on table public\.admin_audit_logs from service_role/);
  assert.match(schema, /grant select, insert on table public\.admin_audit_logs to service_role/);
  assert.match(schema, /check \(role in \('admin', 'kitchen', 'customer_service'\)\)/);
  assert.match(schema, /branch_scope text not null default 'assigned'/);
  assert.match(schema, /branch_scope_snapshot/);
});
