import test from 'node:test';
import assert from 'node:assert/strict';
import { AdminSessionError, createAdminApi, validateAdminBudget } from '../client/src/admin-api.js';

test('frontend rejects malformed budget values before making requests', () => {
  for (const amount of ['', 0, -1, '1.001', '1e3', 'Infinity', '10000000000']) {
    assert.throws(() => validateAdminBudget('2026-10', 'Food', amount), /Budget must be positive/);
  }
  assert.equal(validateAdminBudget('2026-10', 'Food', '2300.50'), 2300.5);
});
test('admin API handles missing setup, expired sessions, and rejected login', async () => {
  const missing = createAdminApi({ rpc: async () => ({ error: { code: 'PGRST202' } }) });
  await assert.rejects(missing.login('admin', 'test'), /Admin setup is pending/);
  const expired = createAdminApi({ rpc: async () => ({ error: { code: '28000' } }) });
  await assert.rejects(expired.users('a'.repeat(64)), AdminSessionError);
  const invalid = createAdminApi({
    rpc: async () => ({ data: { error: 'Invalid username or password.' } }),
  });
  await assert.rejects(invalid.login('admin', 'test'), /Invalid username/);
});
