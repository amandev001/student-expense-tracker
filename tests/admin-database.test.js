import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

let db, token;
const alice = '11111111-1111-4111-8111-111111111111';
const bob = '22222222-2222-4222-8222-222222222222';
const month = '2026-10';
async function asRole(role, query, params = []) {
  await db.exec(`set role ${role}`);
  try {
    return await db.query(query, params);
  } finally {
    await db.exec('reset role');
  }
}
async function rpc(name, args = [], role = 'anon') {
  const placeholders = args.map((_, i) => `$${i + 1}`).join(',');
  const result = await asRole(role, `select public.${name}(${placeholders}) as data`, args);
  return result.rows[0].data;
}
before(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',created_at timestamptz default now());
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;
  `);
  await db.exec(readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
  const migration = readFileSync(new URL('../supabase/admin-schema.sql', import.meta.url), 'utf8');
  await db.exec(migration);
  await db.exec(migration); // Re-running setup must preserve data and permissions.
  await db.query(
    `insert into auth.users(id,email,raw_user_meta_data) values
    ($1,'alice@example.test','{"name":"Alice Student","username":"alice_user"}'),
    ($2,'bob@example.test','{"name":"Bob Student"}')`,
    [alice, bob],
  );
  await db.exec(`insert into auth.users(id,email,raw_user_meta_data)
    select gen_random_uuid(),'student'||g||'@example.test',jsonb_build_object('name','Student '||g,'username','student_'||g)
    from generate_series(1,21) g;
    insert into pluscode_admin.accounts(username,password_hash)
    values('TestAdmin',public.crypt('TestPassword#2026',public.gen_salt('bf',4)));
  `);
  await db.query(
    `insert into public.budgets(user_id,month,category,amount) values($1,$3,'Food',1200),($2,$3,'Food',500)`,
    [alice, bob, month],
  );
  const login = await rpc('pluscode_admin_login', ['TestAdmin', 'TestPassword#2026']);
  assert.match(login.token, /^[0-9a-f]{64}$/);
  token = login.token;
});
after(async () => {
  await db?.close();
});

test('passwords and session tokens are protected in private tables', async () => {
  const accounts = await db.query('select password_hash from pluscode_admin.accounts');
  assert.notEqual(accounts.rows[0].password_hash, 'TestPassword#2026');
  const sessions = await db.query('select token_hash from pluscode_admin.sessions');
  assert.ok(!sessions.rows.some((row) => row.token_hash === token));
  for (const role of ['anon', 'authenticated']) {
    await assert.rejects(
      asRole(role, 'select * from pluscode_admin.accounts'),
      /permission denied/,
    );
    await assert.rejects(
      asRole(role, 'select * from pluscode_admin.sessions'),
      /permission denied/,
    );
    const privileges = await db.query(
      `select has_function_privilege($1,'pluscode_admin.require_session(text)','execute') as allowed`,
      [role],
    );
    assert.equal(privileges.rows[0].allowed, false);
  }
});

test('ordinary users and fake tokens cannot list users or edit other budgets', async () => {
  for (const role of ['anon', 'authenticated']) {
    await assert.rejects(
      rpc('pluscode_admin_users', ['0'.repeat(64), '', 1, 20], role),
      /session expired/,
    );
    await assert.rejects(
      rpc('pluscode_admin_save_budget', ['0'.repeat(64), bob, month, 'Food', 9000], role),
      /session expired/,
    );
  }
  await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [alice]);
  const visible = await asRole('authenticated', 'select user_id from public.budgets');
  assert.deepEqual(
    visible.rows.map((row) => row.user_id),
    [alice],
  );
  await asRole('authenticated', 'update public.budgets set amount=9000 where user_id=$1', [bob]);
  const unchanged = await db.query('select amount from public.budgets where user_id=$1', [bob]);
  assert.equal(Number(unchanged.rows[0].amount), 500);
});

test('admin user search is case-insensitive, paginated, and supports existing users', async () => {
  const all = await rpc('pluscode_admin_users', [token, '', 1, 20]);
  assert.equal(all.total, 23);
  assert.equal(all.users.length, 20);
  const next = await rpc('pluscode_admin_users', [token, '', 2, 20]);
  assert.equal(next.users.length, 3);
  assert.equal(new Set([...all.users, ...next.users].map((user) => user.id)).size, 23);
  const byUsername = await rpc('pluscode_admin_users', [token, 'ALICE_USER', 1, 20]);
  assert.equal(byUsername.total, 1);
  assert.equal(byUsername.users[0].id, alice);
  const existing = await rpc('pluscode_admin_users', [token, 'Bob Student', 1, 20]);
  assert.equal(existing.total, 1);
  assert.equal(existing.users[0].id, bob);
  const literal = await rpc('pluscode_admin_users', [token, "%' OR 1=1 --", 1, 20]);
  assert.equal(literal.total, 0);
  assert.equal('raw_user_meta_data' in byUsername.users[0], false);
});

test('admin edits only the selected user, category, and month and records the change', async () => {
  const before = await rpc('pluscode_admin_user_budgets', [token, bob, month]);
  assert.equal(before.budgets.length, 4);
  assert.equal(before.budgets.find((b) => b.category === 'Food').amount, 500);
  await rpc('pluscode_admin_save_budget', [token, bob, month, 'Food', 2300.5]);
  await rpc('pluscode_admin_save_budget', [token, bob, '2026-11', 'Travel', 700]);
  const saved = await rpc('pluscode_admin_user_budgets', [token, bob, month]);
  assert.equal(saved.budgets.find((b) => b.category === 'Food').amount, 2300.5);
  assert.equal(saved.budgets.find((b) => b.category === 'Travel').amount, null);
  const other = await rpc('pluscode_admin_user_budgets', [token, alice, month]);
  assert.equal(other.budgets.find((b) => b.category === 'Food').amount, 1200);
  const audit = await db.query(
    `select previous_amount,new_amount from pluscode_admin.budget_changes where user_id=$1 and month=$2`,
    [bob, month],
  );
  assert.equal(Number(audit.rows[0].previous_amount), 500);
  assert.equal(Number(audit.rows[0].new_amount), 2300.5);
});

test('invalid budgets and nonexistent users are rejected by the database', async () => {
  for (const amount of [0, -1, 1.001, 10000000000]) {
    await assert.rejects(
      rpc('pluscode_admin_save_budget', [token, bob, month, 'Food', amount]),
      /valid month, category/,
    );
  }
  await assert.rejects(
    rpc('pluscode_admin_save_budget', [token, bob, '2026-13', 'Food', 500]),
    /valid month, category/,
  );
  await assert.rejects(
    rpc('pluscode_admin_save_budget', [token, bob, month, 'Invalid', 500]),
    /valid month, category/,
  );
  await assert.rejects(
    rpc('pluscode_admin_save_budget', [
      token,
      '33333333-3333-4333-8333-333333333333',
      month,
      'Food',
      500,
    ]),
    /User not found/,
  );
});

test('wrong passwords fail, five attempts lock the account, and expiry permits login again', async () => {
  const missing = await rpc('pluscode_admin_login', ['Missing', 'TestPassword#2026']);
  assert.match(missing.error, /Invalid username or password/);
  for (let i = 0; i < 5; i++) {
    const failed = await rpc('pluscode_admin_login', ['TestAdmin', 'wrong-password']);
    assert.match(failed.error, /Invalid username or password/);
    assert.equal(failed.token, undefined);
  }
  const locked = await rpc('pluscode_admin_login', ['TestAdmin', 'TestPassword#2026']);
  assert.match(locked.error, /Too many login attempts/);
  await db.exec("update pluscode_admin.accounts set locked_until=now()-interval '1 second'");
  const restored = await rpc('pluscode_admin_login', ['testadmin', 'TestPassword#2026']);
  assert.match(restored.token, /^[0-9a-f]{64}$/);
});

test('logout and session expiry prevent subsequent privileged requests', async () => {
  const login = await rpc('pluscode_admin_login', ['TestAdmin', 'TestPassword#2026']);
  await rpc('pluscode_admin_logout', [login.token]);
  await assert.rejects(rpc('pluscode_admin_users', [login.token, '', 1, 20]), /session expired/);
  await db.query(
    "update pluscode_admin.sessions set expires_at=now()-interval '1 second' where token_hash=pluscode_admin.token_hash($1)",
    [token],
  );
  await assert.rejects(
    rpc('pluscode_admin_save_budget', [token, bob, month, 'Food', 500]),
    /session expired/,
  );
});
