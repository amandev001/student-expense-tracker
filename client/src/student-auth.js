export function normalizeEmail(value) {
  const email = String(value || '')
    .trim()
    .toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw Error('Enter a valid email address.');
  }
  return email;
}

export function passwordRequirements(password = '') {
  return [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'At least 1 capital letter (A–Z)', met: /[A-Z]/.test(password) },
    {
      label: 'At least 1 special character (for example @, #, !)',
      met: /[^\p{L}\p{N}\s]/u.test(password),
    },
    { label: 'At least 3 digits (0–9)', met: (password.match(/[0-9]/g) || []).length >= 3 },
  ];
}

export function validateRegistrationPassword(password) {
  if (typeof password !== 'string') throw Error('Enter a password.');
  const missing = passwordRequirements(password).filter((rule) => !rule.met);
  if (missing.length)
    throw Error('Password needs: ' + missing.map((rule) => rule.label).join('; ') + '.');
  if (new TextEncoder().encode(password).length > 72) {
    throw Error('Your password is too long. Use up to 72 bytes.');
  }
  return password;
}

function requireAuth(client) {
  if (!client) throw Error('Supabase is not configured. Please complete the project setup.');
  return client.auth;
}

function checkAuthError(error) {
  if (!error) return;
  if (error.code === 'user_already_exists' || error.code === 'email_exists') {
    throw Error('This email already has an account. Sign in with your existing password.');
  }
  if (error.code === 'signup_disabled') throw Error('Account registration is currently disabled.');
  if (error.code === 'email_not_confirmed') {
    throw Error('This older account is not activated. Contact the project administrator.');
  }
  if (error.status === 429) throw Error('Too many attempts. Please wait and try again.');
  throw Error(error.message || 'Unable to complete authentication.');
}

// Protect sessions left over from the previous, unfinished registration flow.
export function isIncompleteLegacyRegistration(session) {
  const metadata = session?.user?.user_metadata;
  return Boolean(
    session?.access_token &&
    metadata?.signup_method === 'email_otp' &&
    metadata?.registration_complete !== true,
  );
}

function isDuplicateAccount(error) {
  return error?.code === 'user_already_exists' || error?.code === 'email_exists';
}

export async function registerStudent(client, { email: value, password }) {
  const email = normalizeEmail(value);
  validateRegistrationPassword(password);
  const auth = requireAuth(client);
  let { data, error } = await auth.signUp({
    email,
    password,
    options: {
      data: {
        name: email.split('@')[0],
        username: email,
        signup_method: 'email_password',
        registration_complete: true,
      },
    },
  });
  const alreadyRegistered = isDuplicateAccount(error);
  if (alreadyRegistered) {
    const signupError = error;
    ({ data, error } = await auth.signInWithPassword({ email, password }));
    // A retry may follow an account creation whose success response was lost.
    // Recover only by proving the supplied password, never by replacing it.
    if (error?.code === 'invalid_credentials') checkAuthError(signupError);
  }
  checkAuthError(error);
  if (!data?.session?.access_token) {
    if (alreadyRegistered) throw Error('Sign-in did not finish. Please try again.');
    throw Error(
      'Registration setup requires Supabase Confirm email to be OFF. Contact the project administrator.',
    );
  }
  try {
    const user = data.user || data.session.user;
    if (!user?.id || normalizeEmail(user.email) !== email) {
      throw Error('Registration did not finish. Please try again.');
    }
    if (isIncompleteLegacyRegistration(data.session)) {
      throw Error(
        'Your earlier registration was not completed. Contact the project administrator to restore this account.',
      );
    }
    return alreadyRegistered ? { email, alreadyRegistered: true } : { email };
  } finally {
    // Signup uses an isolated client; students sign in separately afterwards.
    try {
      await auth.signOut({ scope: 'local' });
    } catch {}
  }
}

export async function signInStudent(client, { email: value, password }) {
  const email = normalizeEmail(value);
  if (typeof password !== 'string' || !password) throw Error('Enter your password.');
  const { data, error } = await requireAuth(client).signInWithPassword({ email, password });
  checkAuthError(error);
  if (!data?.session?.access_token) throw Error('Sign-in did not finish. Please try again.');
  if (isIncompleteLegacyRegistration(data.session)) {
    throw Error(
      'Your earlier registration was not completed. Contact the project administrator to restore this account.',
    );
  }
  return data.session;
}
