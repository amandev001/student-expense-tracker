export class ExistingAccountError extends Error {}

export function normalizeEmail(value) {
  const email = String(value || '')
    .trim()
    .toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw Error('Enter a valid email address.');
  }
  return email;
}

export function validateRegistrationPassword(password, confirmation) {
  if (typeof password !== 'string' || password.length < 8)
    throw Error('Use a password with at least 8 characters.');
  if (new TextEncoder().encode(password).length > 72)
    throw Error('Your password is too long. Use up to 72 bytes.');
  if (password !== confirmation) throw Error('Passwords do not match.');
  return password;
}

function checkError(error) {
  if (!error) return;
  if (error.code === 'email_address_not_authorized') {
    throw Error(
      'Email delivery is not configured for this address yet. The app administrator needs to configure Supabase SMTP.',
    );
  }
  if (error.code === 'over_email_send_rate_limit' || error.status === 429) {
    throw Error('Too many code requests. Please wait before requesting another code.');
  }
  throw Error(error.message || 'Unable to complete email verification.');
}

// This client is separate from the dashboard client. OTP verification never
// signs the dashboard in or publishes a session before a password is set.
export function createEmailRegistration(client) {
  let requestedEmail = null;
  let verifiedEmail = null;
  let temporarySession = false;
  function requireClient() {
    if (!client) throw Error('Supabase is not configured. Please complete the project setup.');
    return client.auth;
  }
  async function clearTemporarySession() {
    verifiedEmail = null;
    if (!temporarySession) return;
    const { error } = await requireClient().signOut({ scope: 'local' });
    checkError(error);
    temporarySession = false;
  }
  return {
    async resumeVerifiedSession(session) {
      if (!session?.access_token || !session?.refresh_token)
        throw Error('Please verify your email again.');
      const auth = requireClient();
      const { error: sessionError } = await auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      checkError(sessionError);
      temporarySession = true;
      const { data, error } = await auth.getUser();
      checkError(error);
      const user = data?.user;
      if (!user?.email_confirmed_at || user.user_metadata?.signup_method !== 'email_otp') {
        await clearTemporarySession();
        throw Error('Please verify your email again before creating a password.');
      }
      if (user.user_metadata?.registration_complete === true) {
        await clearTemporarySession();
        throw new ExistingAccountError(
          'Your account is already complete. Sign in with your password.',
        );
      }
      verifiedEmail = normalizeEmail(user.email);
      requestedEmail = verifiedEmail;
      return verifiedEmail;
    },
    async sendCode(value) {
      const email = normalizeEmail(value);
      await clearTemporarySession();
      const { error } = await requireClient().signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          data: { signup_method: 'email_otp', registration_complete: false, username: email },
        },
      });
      checkError(error);
      requestedEmail = email;
      return email;
    },
    async verifyCode(value, code) {
      const email = normalizeEmail(value);
      if (email !== requestedEmail)
        throw Error('Request a verification code for this email first.');
      if (!/^\d{6}$/.test(String(code))) throw Error('Enter the 6-digit code from your email.');
      const { data, error } = await requireClient().verifyOtp({
        email,
        token: String(code),
        type: 'email',
      });
      checkError(error);
      const user = data?.user;
      temporarySession = Boolean(data?.session);
      if (
        !data?.session?.access_token ||
        !user?.email_confirmed_at ||
        normalizeEmail(user.email) !== email
      ) {
        await clearTemporarySession();
        throw Error('Email verification did not finish. Request a new code and try again.');
      }
      if (
        user.user_metadata?.signup_method !== 'email_otp' ||
        user.user_metadata?.registration_complete === true
      ) {
        await clearTemporarySession();
        requestedEmail = null;
        throw new ExistingAccountError(
          'This email already has an account. Sign in with your existing password.',
        );
      }
      verifiedEmail = email;
      return email;
    },
    async finish({ email: value, password, confirmation, name }) {
      const email = normalizeEmail(value);
      if (email !== verifiedEmail) throw Error('Verify your email before setting a password.');
      validateRegistrationPassword(password, confirmation);
      const auth = requireClient();
      const { data, error } = await auth.getUser();
      checkError(error);
      if (!data?.user?.email_confirmed_at || normalizeEmail(data.user.email) !== email) {
        verifiedEmail = null;
        throw Error('Your verification session expired. Please verify your email again.');
      }
      if (
        data.user.user_metadata?.registration_complete === true ||
        data.user.user_metadata?.signup_method !== 'email_otp'
      ) {
        await clearTemporarySession();
        throw new ExistingAccountError(
          'This email already has an account. Sign in with your existing password.',
        );
      }
      const fullName = String(name || '').trim();
      if (fullName.length > 120) throw Error('Name must be 120 characters or fewer.');
      const { error: updateError } = await auth.updateUser({
        password,
        data: {
          name: fullName || email.split('@')[0],
          username: email,
          registration_complete: true,
        },
      });
      checkError(updateError);
      verifiedEmail = null;
      requestedEmail = null;
      // The account is already complete if cleanup encounters a network error.
      // Keep the dashboard signed out and allow ordinary email/password login.
      try {
        await clearTemporarySession();
      } catch {}
      return { email };
    },
    async cancel() {
      requestedEmail = null;
      await clearTemporarySession();
    },
  };
}
