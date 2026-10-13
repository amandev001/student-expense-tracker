import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildEmailAuthConfig, configureEmailAuth } from '../scripts/configure-email-auth.mjs';
import { requiresPasswordSetup } from '../client/src/student-session.js';

const template = readFileSync(
  new URL('../supabase/templates/email-verification.html', import.meta.url),
  'utf8',
);
test('both email types receive a six-digit code template and Pluscode branding', () => {
  const config = buildEmailAuthConfig(template);
  assert.equal(config.mailer_autoconfirm, false);
  assert.equal(config.mailer_otp_length, 6);
  assert.equal(config.smtp_sender_name, 'Pluscode');
  assert.equal(config.mailer_subjects_confirmation, 'Pluscode verification code');
  assert.equal(config.mailer_subjects_magic_link, 'Pluscode verification code');
  for (const content of [
    config.mailer_templates_confirmation_content,
    config.mailer_templates_magic_link_content,
  ]) {
    assert.match(content, /\{\{ \.Token \}\}/);
    assert.match(content, />\s*Pluscode\s*</);
    assert.doesNotMatch(content, /ConfirmationURL|TokenHash|<a\b|href\s*=/i);
  }
  assert.throws(
    () => buildEmailAuthConfig(template + '<a href="{{ .ConfirmationURL }}">Login</a>'),
    /no login links/,
  );
});
test('email settings are written and verified without overwriting SMTP credentials', async () => {
  const calls = [];
  let saved = {
    smtp_host: 'smtp.example.test',
    smtp_admin_email: 'noreply@example.test',
    smtp_pass: 'private-provider-password',
  };
  const result = await configureEmailAuth({
    projectRef: 'a'.repeat(20),
    accessToken: 'management-test-token',
    template,
    fetchImpl: async (url, options) => {
      calls.push(options.method);
      assert.equal(url, 'https://api.supabase.com/v1/projects/' + 'a'.repeat(20) + '/config/auth');
      assert.equal(options.headers.Authorization, 'Bearer management-test-token');
      if (options.method === 'PATCH') {
        const update = JSON.parse(options.body);
        assert.equal(update.smtp_pass, undefined);
        assert.equal(update.smtp_host, undefined);
        saved = { ...saved, ...update };
      }
      return { ok: true, json: async () => saved };
    },
  });
  assert.deepEqual(calls, ['GET', 'PATCH', 'GET']);
  assert.deepEqual(result, { configured: true, customSmtp: true });
});
test('missing privileges and failed verification never claim live setup success', async () => {
  let called = false;
  await assert.rejects(
    configureEmailAuth({
      projectRef: 'a'.repeat(20),
      template,
      fetchImpl: async () => {
        called = true;
      },
    }),
    /SUPABASE_ACCESS_TOKEN/,
  );
  assert.equal(called, false);
  const methods = [];
  await assert.rejects(
    configureEmailAuth({
      projectRef: 'a'.repeat(20),
      accessToken: 'test',
      template,
      fetchImpl: async (_url, options) => {
        methods.push(options.method);
        return { ok: false, status: 401 };
      },
    }),
    /HTTP 401/,
  );
  assert.deepEqual(methods, ['GET']);
  await assert.rejects(
    configureEmailAuth({
      projectRef: 'a'.repeat(20),
      accessToken: 'test',
      template,
      fetchImpl: async () => ({ ok: true, json: async () => ({}) }),
    }),
    /did not save/,
  );
});
test('verified OTP accounts need a password before the dashboard accepts their session', () => {
  const session = {
    access_token: 'token',
    user: { user_metadata: { signup_method: 'email_otp', registration_complete: false } },
  };
  assert.equal(requiresPasswordSetup(session), true);
  delete session.user.user_metadata.registration_complete;
  assert.equal(requiresPasswordSetup(session), true);
  session.user.user_metadata.registration_complete = true;
  assert.equal(requiresPasswordSetup(session), false);
  assert.equal(
    requiresPasswordSetup({
      access_token: 'existing-token',
      user: { user_metadata: { name: 'Existing Student' } },
    }),
    false,
  );
  assert.equal(requiresPasswordSetup(null), false);
});
