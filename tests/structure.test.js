import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const schema = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
test('SQL enables RLS on both tables', () => {
  assert.match(schema, /expenses enable row level security/);
  assert.match(schema, /budgets enable row level security/);
});
test('SQL isolates records using auth uid', () => assert.match(schema, /auth.uid\(\)/));
test('CSV repeat import protected with unique key', () =>
  assert.match(schema, /unique index.*expenses_user_import_unique/));
test('Supabase app includes sample import CSV', () =>
  assert.ok(existsSync(new URL('../client/public/sample-expenses.csv', import.meta.url))));
