import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeEmail,
  passwordRequirements,
  validateRegistrationPassword,
  registerStudent,
  signInStudent,
  isIncompleteLegacyRegistration,
} from '../client/src/student-auth.js';

const email = 'student@example.test';
const password = 'Student#123';
function fixture({ signupError, loginError, signupData, loginData, logoutError } = {}) {
  const calls = [];
  const user = {
    id: 'student-1',
    email,
    user_metadata: { signup_method: 'email_password', registration_complete: true },
  };
  const session = { access_token: 'test-access-token', user };
  const client = {
    auth: {
      signUp: async (payload) => {
        calls.push(['signup', payload]);
        return { data: signupData ?? { user, session }, error: signupError };
      },
      signInWithPassword: async (payload) => {
        calls.push(['login', payload]);
        return { data: loginData ?? { session }, error: loginError };
      },
      signOut: async (payload) => {
        calls.push(['logout', payload]);
        if (logoutError) throw logoutError;
        return { error: null };
      },
    },
  };
  return { client, calls, user, session };
}

test('email is normalized and malformed addresses are rejected', () => {
  assert.equal(normalizeEmail(' Student@Example.test '), email);
  for (const value of [
    '',
    'student',
    'student@',
    'student@example',
    'student @example.test',
    'a@b@c.test',
    'a'.repeat(255) + '@example.test',
  ])
    assert.throws(() => normalizeEmail(value), /valid email/);
});

test('new passwords require a capital, a special character and at least three digits', () => {
  assert.equal(validateRegistrationPassword(password), password);
  assert.equal(validateRegistrationPassword('A1b@2cd3'), 'A1b@2cd3');
  assert.equal(validateRegistrationPassword('STUDENT_1234'), 'STUDENT_1234');
  assert.equal(validateRegistrationPassword(' Student#123 '), ' Student#123 ');
  for (const [value, missing] of [
    ['student#123', /capital/],
    ['Student123', /special/],
    ['Student#12', /3 digits/],
    ['A#123', /8 characters/],
    ['Student 123', /special/],
  ])
    assert.throws(() => validateRegistrationPassword(value), missing);
  assert.throws(() => validateRegistrationPassword(undefined), /Enter a password/);
  assert.throws(() => validateRegistrationPassword('A#123' + 'é'.repeat(34)), /72 bytes/);
  assert(passwordRequirements(password).every((rule) => rule.met));
});

test('registration sends email and chosen password without OTP and leaves dashboard signed out', async () => {
  const { client, calls } = fixture();
  assert.deepEqual(await registerStudent(client, { email: ' Student@Example.test ', password }), {
    email,
  });
  assert.equal(calls[0][1].password, password);
  assert.equal(calls[0][1].email, email);
  assert.deepEqual(calls[0][1].options.data, {
    name: 'student',
    username: email,
    signup_method: 'email_password',
    registration_complete: true,
  });
  assert.deepEqual(calls[1], ['logout', { scope: 'local' }]);
  assert.equal(calls.length, 2);
});

test('invalid registration input never reaches Supabase', async () => {
  const { client, calls } = fixture();
  await assert.rejects(registerStudent(client, { email: 'invalid', password }), /valid email/);
  await assert.rejects(registerStudent(client, { email, password: 'Student#12' }), /3 digits/);
  assert.deepEqual(calls, []);
});

test('duplicate accounts are not overwritten and confirmation-required projects do not claim success', async () => {
  const duplicate = fixture({ signupError: { code: 'user_already_exists' } });
  duplicate.client.auth.signInWithPassword = async () => ({
    error: { code: 'invalid_credentials' },
  });
  await assert.rejects(
    registerStudent(duplicate.client, { email, password }),
    /already has an account/,
  );
  assert.equal(duplicate.calls.length, 1);
  const confirmation = fixture({ signupData: { user: { id: 'student-1', email }, session: null } });
  await assert.rejects(
    registerStudent(confirmation.client, { email, password }),
    /Confirm email to be OFF/,
  );
});

test('a signup retry recovers an existing account only after verifying the supplied password', async () => {
  for (const code of ['user_already_exists', 'email_exists']) {
    const { client, calls } = fixture({ signupError: { code } });
    assert.deepEqual(await registerStudent(client, { email, password }), {
      email,
      alreadyRegistered: true,
    });
    assert.deepEqual(
      calls.map(([method]) => method),
      ['signup', 'login', 'logout'],
    );
    assert.deepEqual(calls[1][1], { email, password });
  }
});

test('duplicate recovery preserves sign-in failures, validates identity and cleans temporary sessions', async () => {
  const limited = fixture({ signupError: { code: 'email_exists' }, loginError: { status: 429 } });
  await assert.rejects(registerStudent(limited.client, { email, password }), /Too many attempts/);
  const missing = fixture({ signupError: { code: 'email_exists' }, loginData: { session: null } });
  await assert.rejects(
    registerStudent(missing.client, { email, password }),
    /Sign-in did not finish/,
  );
  const mismatch = fixture({
    signupError: { code: 'email_exists' },
    loginData: {
      session: { access_token: 'token', user: { id: 'other', email: 'other@example.test' } },
    },
  });
  await assert.rejects(
    registerStudent(mismatch.client, { email, password }),
    /Registration did not finish/,
  );
  assert.equal(mismatch.calls.at(-1)[0], 'logout');
});

test('login uses supplied password without imposing the new signup policy on existing users', async () => {
  const { client, calls, session } = fixture();
  assert.equal(await signInStudent(client, { email, password: 'old-password' }), session);
  assert.deepEqual(calls[0], ['login', { email, password: 'old-password' }]);
});

test('authentication errors and missing sessions prevent dashboard access', async () => {
  const failed = fixture({ loginError: { message: 'Invalid login credentials' } });
  await assert.rejects(signInStudent(failed.client, { email, password }), /Invalid login/);
  const missing = fixture({ loginData: { session: null } });
  await assert.rejects(signInStudent(missing.client, { email, password }), /did not finish/);
  await assert.rejects(registerStudent(null, { email, password }), /not configured/);
  await assert.rejects(signInStudent(null, { email, password }), /not configured/);
});

test('unfinished legacy signup sessions remain blocked while complete accounts can sign in', async () => {
  const session = {
    access_token: 'legacy-token',
    user: { user_metadata: { signup_method: 'email_otp', registration_complete: false } },
  };
  assert.equal(isIncompleteLegacyRegistration(session), true);
  const legacy = fixture({ loginData: { session } });
  await assert.rejects(signInStudent(legacy.client, { email, password }), /earlier registration/);
  session.user.user_metadata.registration_complete = true;
  assert.equal(isIncompleteLegacyRegistration(session), false);
  assert.equal(isIncompleteLegacyRegistration(null), false);
  assert.equal(isIncompleteLegacyRegistration(fixture().session), false);
});

test('signup checks the returned identity and a cleanup failure cannot undo account creation', async () => {
  const wrong = fixture({
    signupData: {
      user: { id: 'another', email: 'other@example.test' },
      session: { access_token: 'token' },
    },
  });
  await assert.rejects(registerStudent(wrong.client, { email, password }), /did not finish/);
  assert.equal(wrong.calls.at(-1)[0], 'logout');
  const cleanup = fixture({ logoutError: Error('Network disconnected') });
  assert.deepEqual(await registerStudent(cleanup.client, { email, password }), { email });
});
