import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export async function configurePasswordAuth({ projectRef, accessToken, fetchImpl = fetch }) {
  if (!/^[a-z0-9]{20}$/.test(projectRef || ''))
    throw Error('A valid Supabase project reference is required.');
  if (!accessToken)
    throw Error(
      'Set SUPABASE_ACCESS_TOKEN locally to your Supabase management access token. The browser anon key cannot update auth settings.',
    );
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
      throw Error(`Supabase auth configuration ${method} failed (HTTP ${response.status}).`);
    return response.json();
  }
  const previous = await request('GET');
  const config = {
    mailer_autoconfirm: true,
    password_min_length: Math.max(8, Number(previous.password_min_length) || 8),
  };
  await request('PATCH', config);
  const saved = await request('GET');
  for (const [key, value] of Object.entries(config)) {
    if (saved[key] !== value) throw Error(`Supabase did not save the requested setting: ${key}`);
  }
  return { configured: true, minimumPasswordLength: saved.password_min_length };
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  let projectRef = process.env.SUPABASE_PROJECT_REF;
  if (!projectRef) {
    const envFile = await readFile(path.join(root, 'client/.env'), 'utf8');
    const url = envFile.match(/^VITE_SUPABASE_URL=(.+)$/m)?.[1]?.trim();
    projectRef = url ? new URL(url).hostname.split('.')[0] : null;
  }
  const result = await configurePasswordAuth({
    projectRef,
    accessToken: process.env.SUPABASE_ACCESS_TOKEN,
  });
  console.log(
    `Verified: Confirm email OFF; minimum password length ${result.minimumPasswordLength}. Registration does not require email delivery.`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
