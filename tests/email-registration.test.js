import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEmailRegistration,
  ExistingAccountError,
  normalizeEmail,
  validateRegistrationPassword,
} from '../client/src/email-registration.js';

const email = 'student@example.test';
function fixture({
  metadata = { signup_method: 'email_otp', registration_complete: false },
  verifyError = null,
  updateError = null,
  sendError = null,
} = {}) {
  const calls = [];
  const user = {
    id: 'student-1',
    email,
    email_confirmed_at: '2026-10-13T06:00:00Z',
    user_metadata: metadata,
  };
  let lastUpdateError = updateError;
  const client = {
    auth: {
      setSession: async (payload) => {
        calls.push(['setSession', payload]);
        return { data: { user }, error: null };
      },
      signInWithOtp: async (payload) => {
        calls.push(['send', payload]);
        return { error: sendError };
      },
      verifyOtp: async (payload) => {
        calls.push(['verify', payload]);
        return verifyError
          ? { error: verifyError }
          : { data: { user, session: { access_token: 'temporary-token' } }, error: null };
      },
      getUser: async () => {
        calls.push(['getUser']);
        return { data: { user }, error: null };
      },
      updateUser: async (payload) => {
        calls.push(['update', payload]);
        const error = lastUpdateError;
        lastUpdateError = null;
        return { data: { user }, error };
      },
      signOut: async (payload) => {
        calls.push(['signOut', payload]);
        return { error: null };
      },
    },
  };
  return { service: createEmailRegistration(client), calls, user };
}

test('registration verifies email first, then stores a password and uses email as username', async () => {
  const { service, calls } = fixture();
  assert.equal(await service.sendCode(' Student@Example.test '), email);
  assert.equal(calls[0][1].options.shouldCreateUser, true);
  assert.equal(calls[0][1].options.data.username, email);
  assert.ok(!('password' in calls[0][1]));
  await assert.rejects(
    service.finish({ email, password: 'Password#123', confirmation: 'Password#123' }),
    /Verify your email/,
  );
  await service.verifyCode(email, '123456');
  assert.deepEqual(calls.find((c) => c[0] === 'verify')[1], {
    email,
    token: '123456',
    type: 'email',
  });
  assert.ok(!calls.some((c) => c[0] === 'update'));
  assert.deepEqual(
    await service.finish({
      email,
      password: 'Password#123',
      confirmation: 'Password#123',
      name: 'Student',
    }),
    { email },
  );
  const update = calls.find((c) => c[0] === 'update')[1];
  assert.equal(update.password, 'Password#123');
  assert.equal(update.data.username, email);
  assert.equal(update.data.registration_complete, true);
  assert.deepEqual(calls.at(-1), ['signOut', { scope: 'local' }]);
  await assert.rejects(
    service.finish({ email, password: 'Password#123', confirmation: 'Password#123' }),
    /Verify your email/,
  );
});

test('incorrect or malformed codes never allow password creation', async () => {
  const { service, calls } = fixture({ verifyError: { message: 'Token expired or invalid' } });
  await service.sendCode(email);
  for (const code of ['12345', '1234567', 'abcdef'])
    await assert.rejects(service.verifyCode(email, code), /6-digit code/);
  assert.ok(!calls.some((c) => c[0] === 'verify'));
  await assert.rejects(service.verifyCode(email, '123456'), /expired or invalid/);
  await assert.rejects(
    service.finish({ email, password: 'Password#123', confirmation: 'Password#123' }),
    /Verify your email/,
  );
  assert.ok(!calls.some((c) => c[0] === 'update'));
});

test('registration does not overwrite passwords on existing accounts', async () => {
  for (const metadata of [
    { name: 'Legacy Student' },
    { signup_method: 'email_otp', registration_complete: true },
  ]) {
    const { service, calls } = fixture({ metadata });
    await service.sendCode(email);
    await assert.rejects(service.verifyCode(email, '123456'), ExistingAccountError);
    assert.ok(calls.some((c) => c[0] === 'signOut'));
    assert.ok(!calls.some((c) => c[0] === 'update'));
  }
});

test('changing email or cancelling invalidates previous verification', async () => {
  const { service, calls } = fixture();
  await service.sendCode(email);
  await assert.rejects(
    service.verifyCode('another@example.test', '123456'),
    /Request a verification code/,
  );
  await service.verifyCode(email, '123456');
  await service.cancel();
  await assert.rejects(
    service.finish({ email, password: 'Password#123', confirmation: 'Password#123' }),
    /Verify your email/,
  );
  assert.ok(calls.some((c) => c[0] === 'signOut'));
});

test('the server identity is checked again before setting a password', async () => {
  const { service, user, calls } = fixture();
  await service.sendCode(email);
  await service.verifyCode(email, '123456');
  user.email = 'another@example.test';
  await assert.rejects(
    service.finish({ email, password: 'Password#123', confirmation: 'Password#123' }),
    /session expired/,
  );
  assert.ok(!calls.some((c) => c[0] === 'update'));
});

test('password rejection leaves verification available for a retry', async () => {
  const { service } = fixture({ updateError: { message: 'Password rejected by server policy' } });
  await service.sendCode(email);
  await service.verifyCode(email, '123456');
  await assert.rejects(
    service.finish({ email, password: 'Password#123', confirmation: 'different' }),
    /do not match/,
  );
  await assert.rejects(
    service.finish({ email, password: 'Password#123', confirmation: 'Password#123' }),
    /server policy/,
  );
  assert.deepEqual(
    await service.finish({
      email,
      password: 'BetterPassword#123',
      confirmation: 'BetterPassword#123',
    }),
    { email },
  );
});

test('a verified incomplete session resumes at password setup without sending another email', async () => {
  const { service, calls } = fixture();
  assert.equal(
    await service.resumeVerifiedSession({
      access_token: 'verified-access',
      refresh_token: 'verified-refresh',
    }),
    email,
  );
  assert.ok(!calls.some((c) => c[0] === 'send'));
  await assert.rejects(service.finish({ email, password: '', confirmation: '' }), /at least 8/);
  await service.finish({
    email,
    password: 'ChosenPassword#123',
    confirmation: 'ChosenPassword#123',
  });
  assert.equal(calls.find((c) => c[0] === 'update')[1].password, 'ChosenPassword#123');
});

test('resuming a session cannot alter a completed or unverified account', async () => {
  const completed = fixture({
    metadata: { signup_method: 'email_otp', registration_complete: true },
  });
  await assert.rejects(
    completed.service.resumeVerifiedSession({ access_token: 'access', refresh_token: 'refresh' }),
    ExistingAccountError,
  );
  assert.ok(!completed.calls.some((c) => c[0] === 'update'));
  const unverified = fixture();
  unverified.user.email_confirmed_at = null;
  await assert.rejects(
    unverified.service.resumeVerifiedSession({ access_token: 'access', refresh_token: 'refresh' }),
    /verify your email again/,
  );
  await assert.rejects(
    unverified.service.finish({ email, password: 'Password#123', confirmation: 'Password#123' }),
    /Verify your email/,
  );
});

test('delivery errors are reported and do not claim that a code was sent', async () => {
  for (const [error, pattern] of [
    [{ code: 'email_address_not_authorized' }, /SMTP/],
    [{ status: 429 }, /Too many code requests/],
  ]) {
    const { service } = fixture({ sendError: error });
    await assert.rejects(service.sendCode(email), pattern);
    await assert.rejects(service.verifyCode(email, '123456'), /Request a verification code/);
  }
});

test('email and password validators preserve passwords and reject invalid input', () => {
  assert.equal(normalizeEmail(' STUDENT@example.test '), email);
  for (const value of ['', 'student', 'student example@test.com'])
    assert.throws(() => normalizeEmail(value), /valid email/);
  assert.throws(() => validateRegistrationPassword('short', 'short'), /at least 8/);
  assert.throws(() => validateRegistrationPassword('a'.repeat(73), 'a'.repeat(73)), /too long/);
  assert.throws(
    () => validateRegistrationPassword('\u20b9'.repeat(25), '\u20b9'.repeat(25)),
    /too long/,
  );
  assert.equal(validateRegistrationPassword(' Password#123 ', ' Password#123 '), ' Password#123 ');
});
