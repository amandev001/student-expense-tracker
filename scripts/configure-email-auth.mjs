import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export function buildEmailAuthConfig(template) {
  if (
    !template.includes('{{ .Token }}') ||
    /ConfirmationURL|TokenHash|<a\b|href\s*=/i.test(template)
  ) {
    throw Error('The email template must include the verification code and no login links.');
  }
  return {
    mailer_autoconfirm: false,
    mailer_otp_length: 6,
    smtp_sender_name: 'Pluscode',
    mailer_subjects_confirmation: 'Pluscode verification code',
    mailer_subjects_magic_link: 'Pluscode verification code',
    mailer_templates_confirmation_content: template,
    mailer_templates_magic_link_content: template,
  };
}

export async function configureEmailAuth({ projectRef, accessToken, template, fetchImpl = fetch }) {
  if (!/^[a-z0-9]{20}$/.test(projectRef || ''))
    throw Error('A valid Supabase project reference is required.');
  if (!accessToken)
    throw Error(
      'Set SUPABASE_ACCESS_TOKEN locally to your Supabase management access token. The browser anon key cannot update email settings.',
    );
  const config = buildEmailAuthConfig(template);
  const endpoint = `https://api.supabase.com/v1/projects/${projectRef}/config/auth`;
  const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
  async function request(method, body) {
    const response = await fetchImpl(endpoint, {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok)
      throw Error(`Supabase email configuration ${method} failed (HTTP ${response.status}).`);
    return response.json();
  }
  // Read before writing so an invalid token/project fails without modifying it.
  await request('GET');
  await request('PATCH', config);
  const saved = await request('GET');
  for (const [key, value] of Object.entries(config)) {
    if (saved[key] !== value) throw Error(`Supabase did not save the requested setting: ${key}`);
  }
  return { configured: true, customSmtp: Boolean(saved.smtp_host && saved.smtp_admin_email) };
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const template = await readFile(
    path.join(root, 'supabase/templates/email-verification.html'),
    'utf8',
  );
  let projectRef = process.env.SUPABASE_PROJECT_REF;
  if (!projectRef) {
    const envFile = await readFile(path.join(root, 'client/.env'), 'utf8');
    const url = envFile.match(/^VITE_SUPABASE_URL=(.+)$/m)?.[1]?.trim();
    projectRef = url ? new URL(url).hostname.split('.')[0] : null;
  }
  const result = await configureEmailAuth({
    projectRef,
    accessToken: process.env.SUPABASE_ACCESS_TOKEN,
    template,
  });
  console.log(
    'Verified: 6-digit codes, code-only signup/OTP templates, Pluscode subjects, and Pluscode sender-name setting.',
  );
  if (!result.customSmtp) {
    console.log(
      'Custom SMTP is still required for reliable Pluscode-branded delivery to all users. No test email was sent.',
    );
    process.exitCode = 2;
  } else {
    console.log(
      'Custom SMTP is configured. Request a new code in the app to verify actual delivery and sender branding.',
    );
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
