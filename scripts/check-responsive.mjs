// Isolated headless layout checks. Authentication and database HTTP calls are
// mocked; this never uses the user's browser profile or changes live data.
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const url = process.env.RESPONSIVE_TEST_URL || 'http://127.0.0.1:5174/';
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
  [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe',
  ].find(existsSync);
const browser = await chromium.launch({
  headless: true,
  ...(executablePath ? { executablePath } : {}),
});
const context = await browser.newContext({ reducedMotion: 'reduce' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const now = new Date(),
  date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
const email = 'layout-student@example.test';
const id = '11111111-1111-4111-8111-111111111111';
let user = {
  id,
  aud: 'authenticated',
  role: 'authenticated',
  email,
  email_confirmed_at: now.toISOString(),
  created_at: now.toISOString(),
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { signup_method: 'email_otp', registration_complete: false },
};
const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const token = () =>
  `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: id, exp: Math.floor(Date.now() / 1000) + 3600, aud: 'authenticated', role: 'authenticated' })}.layout-test-signature`;
const session = () => ({
  access_token: token(),
  refresh_token: 'layout-test-refresh',
  token_type: 'bearer',
  expires_in: 3600,
  user,
});
const students = [
  {
    id,
    username: 'averylongstudentusername.withmanycharacters@example.test',
    name: 'A student with a deliberately long name for layout checking',
    email: 'averylongstudentemail.withmanycharacters.andmorecharacters@example.test',
    created_at: now.toISOString(),
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    username: 'Another Student',
    name: 'Another Student',
    email: 'another@example.test',
    created_at: now.toISOString(),
  },
];
const adminBudgets = ['Food', 'Travel', 'Study', 'Other'].map((category) => ({
  category,
  amount: 9999999999.99,
}));
await context.addInitScript(
  ({ email }) => {
    localStorage.setItem('pluscode-force-reset-to-signup-v2', 'done');
    localStorage.setItem('pluscode-user-clean-reset-v1:' + email, 'done');
    localStorage.setItem('pluscode-tour-v3:' + email, 'seen');
  },
  { email },
);
await context.route(/https:\/\/[^/]+\.supabase\.co\//, async (route) => {
  const request = route.request(),
    address = new URL(request.url()),
    body = request.postDataJSON?.() || {};
  let result = {};
  if (address.pathname.endsWith('/otp')) result = {};
  else if (address.pathname.endsWith('/verify')) result = session();
  else if (address.pathname.endsWith('/token')) result = session();
  else if (address.pathname.endsWith('/user')) {
    if (request.method() === 'PUT')
      user = { ...user, user_metadata: { ...user.user_metadata, ...body.data } };
    result = user;
  } else if (address.pathname.includes('/rpc/')) {
    const name = address.pathname.split('/').at(-1);
    if (name === 'pluscode_admin_login')
      result = {
        token: 'a'.repeat(64),
        username: 'LayoutTestAdmin',
        expiresAt: new Date(Date.now() + 8 * 3600000).toISOString(),
      };
    if (name === 'pluscode_admin_session') result = { username: 'LayoutTestAdmin' };
    if (name === 'pluscode_admin_users') result = { users: students, total: 2, page: 1 };
    if (name === 'pluscode_admin_user_budgets')
      result = { user: students[0], month: body.p_month, budgets: adminBudgets };
    if (name === 'pluscode_admin_save_budget') result = { ok: true, amount: body.p_amount };
    if (name === 'pluscode_admin_logout') result = { ok: true };
  } else if (address.pathname.endsWith('/expenses')) {
    result =
      request.method() === 'GET'
        ? [
            {
              id: 'expense-1',
              date,
              amount: 250,
              description: 'Stationery ' + 'longdescription'.repeat(22),
              category: 'Study',
            },
          ]
        : [];
  } else if (address.pathname.endsWith('/budgets')) result = [];
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(result),
  });
});

const viewports = [
  { width: 320, height: 740 },
  { width: 375, height: 812 },
  { width: 480, height: 850 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 667, height: 375 },
];
const results = [];
await mkdir('layout-artifacts', { recursive: true });
async function check(name) {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(120);
    const issues = await page.evaluate(() => {
      const width = document.documentElement.clientWidth;
      const issues = [];
      if (document.documentElement.scrollWidth > width + 1)
        issues.push(`Page overflow: ${document.documentElement.scrollWidth} > ${width}`);
      for (const element of document.querySelectorAll('button,input,select,.tourCard')) {
        const style = getComputedStyle(element),
          rect = element.getBoundingClientRect();
        if (
          style.visibility === 'hidden' ||
          style.display === 'none' ||
          !rect.width ||
          !rect.height
        )
          continue;
        let localScroll = false;
        for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
          const computed = getComputedStyle(ancestor);
          if (
            ['auto', 'scroll'].includes(computed.overflowX) &&
            ancestor.scrollWidth > ancestor.clientWidth
          ) {
            localScroll = true;
            break;
          }
        }
        if (!localScroll && (rect.left < -1 || rect.right > width + 1))
          issues.push(
            `Control overflow: ${element.getAttribute('aria-label') || element.textContent?.trim() || element.tagName}`,
          );
      }
      const dialog = document.querySelector('.tourCard');
      if (dialog && dialog.getBoundingClientRect().height > innerHeight - 20)
        issues.push('Dialog is taller than the available viewport');
      return issues;
    });
    assert.deepEqual(
      issues,
      [],
      `${name} at ${viewport.width}x${viewport.height}: ${issues.join('; ')}`,
    );
    results.push({ screen: name, ...viewport, passed: true });
  }
  console.log(`PASS ${name}: ${viewports.length} viewports`);
}
async function screen(name) {
  if (await page.getByRole('button', { name: 'Open menu', exact: true }).isVisible()) {
    await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  }
  await page.locator('#workspace-navigation').getByRole('button', { name, exact: true }).click();
  await page.waitForTimeout(150);
}
try {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await check('registration-email');
  await page.getByLabel('Email address', { exact: true }).fill(email);
  await page.getByRole('button', { name: 'Send verification code', exact: true }).click();
  await page.getByLabel('6-digit verification code', { exact: true }).waitFor();
  await check('registration-code');
  await page.getByLabel('6-digit verification code', { exact: true }).fill('123456');
  await page.getByRole('button', { name: 'Verify email', exact: true }).click();
  await page.getByLabel('Confirm password', { exact: true }).waitFor();
  await check('registration-password');
  await page.getByLabel('Password', { exact: true }).fill('LayoutPassword#123');
  await page.getByLabel('Confirm password', { exact: true }).fill('LayoutPassword#123');
  await page.getByRole('button', { name: 'Complete registration', exact: true }).click();
  await page.getByLabel('Email / username', { exact: true }).waitFor();
  await check('student-login');
  await page.getByRole('button', { name: 'Try demo', exact: true }).click();
  await page.getByRole('button', { name: 'Close tour', exact: true }).click();
  await check('dashboard-overview');
  await page.setViewportSize({ width: 320, height: 740 });
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  assert.equal(await page.locator('.sidebar').isVisible(), true);
  assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
  await page.keyboard.press('Escape');
  assert.equal(
    await page
      .getByRole('button', { name: 'Open menu', exact: true })
      .getAttribute('aria-expanded'),
    'false',
  );
  await screen('Transactions');
  await page.getByLabel(/Amount/).fill('9999999999.99');
  await page
    .getByLabel('Description', { exact: true })
    .fill('Student books ' + 'averylongword'.repeat(22));
  await page.getByRole('button', { name: 'Save expense', exact: true }).click();
  await check('transactions-with-long-values');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: 'layout-artifacts/mobile-transactions.png', fullPage: true });
  await page.getByRole('button', { name: 'Open user profile', exact: true }).click();
  await check('profile-dialog');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Start guided tour', exact: true }).click();
  await check('guided-tour-dialog');
  await page.keyboard.press('Escape');
  await screen('Budgets');
  await check('budget-editor');
  await page.getByRole('button', { name: /Clear all \(/ }).click();
  await check('budget-confirmation-dialog');
  await page.keyboard.press('Escape');
  await screen('Import CSV');
  await check('csv-import');
  await page.getByRole('button', { name: 'Exit', exact: true }).click();
  await page.getByRole('button', { name: 'Sign in', exact: true }).first().click();
  await page.getByLabel('Email / username', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('LayoutPassword#123');
  await page.locator('form').getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.locator('.app').waitFor();
  await screen('Import CSV');
  const csv = `date,amount,description,category\n${date},125,Stationery,Study\ninvalid-date,50,${'x'.repeat(600)},Unknown\n`;
  await page
    .locator('input[name=file]')
    .setInputFiles({ name: 'layout-sample.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await page
    .locator('.importPanel')
    .getByRole('button', { name: 'Import CSV', exact: true })
    .click();
  await page.getByRole('heading', { name: 'Import results', exact: true }).waitFor();
  await check('csv-results-and-invalid-rows');
  await page.goto(new URL('#admin', url).href, { waitUntil: 'networkidle' });
  await check('admin-login');
  await page.getByLabel('Admin username', { exact: true }).fill('LayoutTestAdmin');
  await page.getByLabel('Password', { exact: true }).fill('LayoutPassword#123');
  await page.getByRole('button', { name: 'Sign in as administrator', exact: true }).click();
  await page.locator('.adminApp').waitFor();
  await page
    .getByRole('button', { name: /Manage budgets for/ })
    .first()
    .click();
  await page.getByLabel('Food budget amount', { exact: true }).waitFor();
  await check('admin-users-and-budget-editor');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: 'layout-artifacts/desktop-admin.png', fullPage: true });
  assert.deepEqual(errors, [], 'Unexpected browser errors');
  await writeFile(
    'layout-artifacts/report.json',
    JSON.stringify({ checks: results.length, results }, null, 2),
  );
  console.log(
    `Verified ${results.length} screen/viewport combinations. No page overflow or clipped horizontal controls.`,
  );
} finally {
  await context.close();
  await browser.close();
}
