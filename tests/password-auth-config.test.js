import test from 'node:test';
import assert from 'node:assert/strict';
import { configurePasswordAuth } from '../scripts/configure-password-auth.mjs';

test('auth setup disables confirmation and preserves SMTP and stronger password settings', async () => {
  let saved = {
    mailer_autoconfirm: false,
    password_min_length: 12,
    smtp_host: 'smtp.example.test',
    smtp_pass: 'private-test-password',
  };
  const calls = [];
  const result = await configurePasswordAuth({
    projectRef: 'a'.repeat(20),
    accessToken: 'test-token',
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://api.supabase.com/v1/projects/' + 'a'.repeat(20) + '/config/auth');
      calls.push(options.method);
      if (options.method === 'PATCH') {
        assert.deepEqual(JSON.parse(options.body), {
          mailer_autoconfirm: true,
          password_min_length: 12,
        });
        saved = { ...saved, ...JSON.parse(options.body) };
      }
      return { ok: true, json: async () => saved };
    },
  });
  assert.deepEqual(calls, ['GET', 'PATCH', 'GET']);
  assert.deepEqual(result, { configured: true, minimumPasswordLength: 12 });
  assert.equal(saved.smtp_pass, 'private-test-password');
});

test('missing access or failed verification cannot claim hosted configuration success', async () => {
  let called = false;
  await assert.rejects(
    configurePasswordAuth({
      projectRef: 'a'.repeat(20),
      fetchImpl: async () => {
        called = true;
      },
    }),
    /SUPABASE_ACCESS_TOKEN/,
  );
  assert.equal(called, false);
  const methods = [];
  await assert.rejects(
    configurePasswordAuth({
      projectRef: 'a'.repeat(20),
      accessToken: 'test',
      fetchImpl: async (_url, options) => {
        methods.push(options.method);
        return { ok: false, status: 401 };
      },
    }),
    /HTTP 401/,
  );
  assert.deepEqual(methods, ['GET']);
  await assert.rejects(
    configurePasswordAuth({
      projectRef: 'a'.repeat(20),
      accessToken: 'test',
      fetchImpl: async () => ({ ok: true, json: async () => ({}) }),
    }),
    /did not save/,
  );
});
