export function requiresPasswordSetup(session) {
  const metadata = session?.user?.user_metadata;
  return Boolean(
    session?.access_token &&
    metadata?.signup_method === 'email_otp' &&
    metadata?.registration_complete !== true,
  );
}
