# Pluscode — Student Expense Tracker

<p align="center">
  <img src="client/public/pluscode-logo.jpeg" alt="Pluscode logo" width="96" height="96" />
</p>

A responsive expense tracker built with **React, Vite, and Supabase**. Students register directly with an email and password, record expenses, set category budgets, view spending insights, and import/export CSV data. A separate administrator panel lists users and lets administrators update monthly category budgets.

This guide covers a fresh local installation on **Windows, macOS, or Linux**, including database setup, email delivery, administrator provisioning, and evaluation checks.

> **Evaluation data note:** Use a fresh Supabase project and test accounts. The current application contains a first-login reset: on a browser's first login for an email, it deletes that student's existing expenses and clears the selected month's category budgets. Clearing browser storage or using another browser can trigger this again. Read [Current implementation notes](#14-current-implementation-notes) before connecting an existing database.

## Contents

1. [Project overview](#1-project-overview)
2. [Requirements](#2-requirements)
3. [Get the project and install dependencies](#3-get-the-project-and-install-dependencies)
4. [Quick demo without Supabase](#4-quick-demo-without-supabase)
5. [Create the Supabase database](#5-create-the-supabase-database)
6. [Configure the environment file](#6-configure-the-environment-file)
7. [Configure password registration](#7-configure-password-registration)
8. [Set up the administrator panel](#8-set-up-the-administrator-panel)
9. [Start, stop, and restart the application](#9-start-stop-and-restart-the-application)
10. [Use the application](#10-use-the-application)
11. [Examiner verification checklist](#11-examiner-verification-checklist)
12. [Commands, tests, and production build](#12-commands-tests-and-production-build)
13. [Project structure](#13-project-structure)
14. [Current implementation notes](#14-current-implementation-notes)
15. [Troubleshooting](#15-troubleshooting)
16. [Submission checklist](#16-submission-checklist)

## 1. Project overview

### Main features

- Valid email + password → create account → email/password sign-in, without email verification.
- Student dashboard with spending totals, transactions, charts, category alerts, and a guided tour.
- Expenses categorized as **Food, Travel, Study, or Other**.
- Category budget limits, reporting periods, transaction search, and category filtering.
- CSV import with row validation and duplicate-import prevention; CSV export.
- Administrator login, user pagination/search, and monthly category budget updates.
- Responsive student and administrator screens for phones, tablets, and desktops.
- Interactive demo that does not write to Supabase.

### Technology and architecture

| Component        | Technology / purpose                                                |
| ---------------- | ------------------------------------------------------------------- |
| Frontend         | React 19 and Vite 6                                                 |
| Authentication   | Supabase Auth for students; PostgreSQL functions for administrators |
| Database         | Hosted Supabase PostgreSQL with Row Level Security (RLS)            |
| Charts and icons | Recharts and Lucide React                                           |
| CSV processing   | Papa Parse                                                          |
| Automated checks | Node.js test runner, PGlite, and Playwright                         |
| Formatting       | Prettier with PostgreSQL formatting support                         |

The browser communicates directly with Supabase. **Only the frontend development server runs locally.** You do not need PHP, XAMPP, MySQL, Express, Docker, Supabase CLI, or a separate local PostgreSQL server for this guide.

## 2. Requirements

| Requirement      | Details                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------- |
| Node.js          | **Node.js 24 LTS recommended**; installed Supabase dependencies require Node.js 22 or newer |
| npm              | Included with Node.js                                                                       |
| Browser          | A current Chrome, Edge, Firefox, Safari, or Brave browser                                   |
| Internet         | Required for package installation and real Supabase authentication/database access          |
| Supabase account | Required for real registration, persistent data, and the admin panel                        |
| Email address    | A valid email format; no inbox access or verification code is required                      |
| Git              | Optional; needed only if cloning instead of extracting the submitted ZIP                    |

Install Node.js from the [official Node.js download page](https://nodejs.org/en/download), then reopen your terminal. Check:

```bash
node --version
npm --version
```

An editor such as VS Code is useful but not required. Run all commands below from the **project root**, the folder containing the root `package.json`, `README.md`, `client/`, and `supabase/`, unless stated otherwise.

## 3. Get the project and install dependencies

### Option A: Use the submitted ZIP

1. Extract the ZIP completely; do not run the application from inside the archive.
2. Open the extracted project folder in VS Code or your terminal.
3. Confirm that `package.json` and `client/package.json` are present.

For example, on Windows PowerShell, if the extracted folder is `C:\Users\amank\Desktop\new`:

```powershell
Set-Location "C:\Users\amank\Desktop\new"
```

Replace that example with the folder on your own computer.

### Option B: Clone the repository

```bash
git clone https://github.com/amandev001/student-expense-tracker.git
cd student-expense-tracker
```

If the repository is private, the owner must grant you access. Otherwise, use the supplied ZIP. Use the latest submitted version containing the files in [Project structure](#13-project-structure).

### Install both sets of dependencies

```bash
npm run install:all
```

This installs root development tools and frontend dependencies in `client/`. Wait until it completes successfully. Run it once after extracting/cloning, and again if package dependencies change.

For a reproducible installation from a submission containing **both** lockfiles, you may instead use:

```bash
npm ci
npm ci --prefix client
```

Use either installation method; running both is unnecessary. If Windows PowerShell blocks `npm.ps1`, use `npm.cmd` in place of `npm`, or use Command Prompt.

## 4. Quick demo without Supabase

After installing dependencies:

```bash
npm run dev
```

1. Open the **Local URL printed in the terminal**, normally `http://127.0.0.1:5173/`.
2. The page may initially show **Create account**. Select the **Sign in** tab.
3. Click **Try demo**.
4. Explore the dashboard, transactions, budgets, and insights.

No account, verification email, or environment file is required for demo mode. A missing-Supabase notice is expected without an environment file. Demo changes are held in memory and disappear on reload. **Reset demo** restores sample expenses and clears demo budgets. CSV import and real administrator access require the full setup below.

## 5. Create the Supabase database

If the owner supplies an already configured **evaluation** project, confirm its schema and password/admin setup are complete, then use its supplied frontend URL/key. Otherwise:

1. Sign in at the [Supabase dashboard](https://supabase.com/dashboard).
2. Create a new project and wait until it is ready. Keep its database password securely; it does **not** belong in `client/.env`.
3. Open **SQL Editor → New query**.
4. Open [supabase/schema.sql](supabase/schema.sql), copy the **entire file**, paste it into SQL Editor, and click **Run**.
5. Confirm there are no SQL errors. In **Table Editor**, check that `public.expenses` and `public.budgets` exist.

The schema creates tables, validation constraints, indexes, and RLS policies. Students access only records associated with their authenticated user ID. Leave RLS enabled.

**Run SQL in Supabase SQL Editor, not in PowerShell, a browser address bar, or an npm terminal.** Run the base schema before the administrator schema.

## 6. Configure the environment file

### Copy the example file

Windows PowerShell:

```powershell
Copy-Item client/.env.example client/.env
```

macOS / Linux:

```bash
cp client/.env.example client/.env
```

Do this only when creating a new environment file; copying over an existing file replaces its values.

### Fill in your project's values

In Supabase, use the **Connect** dialog or **Project Settings → API / API Keys** to find the Project URL and its **publishable key** or legacy **anon key**. Dashboard labels may vary.

Edit `client/.env`:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
```

- Replace both placeholders with values from the **same Supabase project**.
- Keep variable names exactly as shown, including `VITE_SUPABASE_ANON_KEY` when using a publishable key.
- Save as **`client/.env`**, not a root `.env` or `.env.txt`.
- Do not put a `service_role` key, secret key, database password, SMTP password, or management token here. Vite exposes `VITE_` variables to the browser.
- Restart Vite whenever you change this file.

The environment file is intentionally ignored by Git. A fresh checkout creates it separately. The publishable/anon key is intended for frontend use; database access is controlled by RLS.

## 7. Configure password registration

### Required Supabase settings

Under **Authentication → Sign In / Providers → Email**:

1. Enable the **Email** provider and allow new user sign-ups.
2. Set **Confirm email OFF**, then save. This allows registration without an email code or link.
3. Set a minimum password length of **8** or more. Preserve any stricter existing password policy.

**No SMTP or email-template setup is needed for registration.** The app uses Supabase email/password signup and then returns to sign-in. Email validation checks address format; it does not prove that the user owns the inbox. See [Supabase password authentication](https://supabase.com/docs/guides/auth/passwords).

New student passwords must contain:

- At least **8 characters**.
- At least **1 capital letter** (A–Z).
- At least **1 special character**, such as @, #, or !. Spaces do not count as special characters.
- At least **3 digits** (0–9). They can appear anywhere; more than three is also allowed.
- No more than **72 UTF-8 bytes**.

These rules are checked in the registration form before sending signup to Supabase. The form displays which requirements are met. Supabase can enforce a stricter server password policy; a stronger project policy may require a longer password. Existing users continue to sign in with their chosen password.

### Optional configuration script

The dashboard method above is sufficient. If the owner has a **Supabase management access token**, the included script can turn confirmation off and set the server minimum length to at least eight without lowering a stronger length or changing SMTP settings. The browser anon/publishable key cannot change auth settings.

Windows PowerShell:

```powershell
$env:SUPABASE_ACCESS_TOKEN = "YOUR_SUPABASE_MANAGEMENT_ACCESS_TOKEN"
npm run auth:configure
Remove-Item Env:SUPABASE_ACCESS_TOKEN
```

macOS / Linux:

```bash
export SUPABASE_ACCESS_TOKEN='YOUR_SUPABASE_MANAGEMENT_ACCESS_TOKEN'
npm run auth:configure
unset SUPABASE_ACCESS_TOKEN
```

The script reads the project reference from client/.env or SUPABASE_PROJECT_REF, applies settings, and reads them back. Exit code 0 means the requested settings were verified; exit code 1 means configuration failed. Keep management tokens out of source files and VITE_ variables.

## 8. Set up the administrator panel

The admin panel is separate from student registration. A student account does not automatically become an administrator. Complete this section if admin features are part of the evaluation.

### 8.1 Install administrator functions

After running the base schema, copy the entire [supabase/admin-schema.sql](supabase/admin-schema.sql) into Supabase SQL Editor and run it. This creates private `pluscode_admin` storage and public administrator RPC functions. Keep the private schema private; it does not need to be exposed through API settings.

### 8.2 Create an administrator account

In a new SQL Editor query, replace `YOUR_ADMIN_USERNAME` and `YOUR_ADMIN_PASSWORD` below with credentials you choose, then run the whole block. Use a unique username and a strong password of at least eight characters, within bcrypt's **72-byte** limit. Escape a single quote in a value as two single quotes inside the SQL string.

```sql
DO $setup$
DECLARE
  crypto_schema text;
BEGIN
  SELECT n.nspname INTO crypto_schema
  FROM pg_catalog.pg_extension e
  JOIN pg_catalog.pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'pgcrypto';

  IF crypto_schema IS NULL THEN
    RAISE EXCEPTION 'Run schema.sql and admin-schema.sql first';
  END IF;

  EXECUTE format(
    'INSERT INTO pluscode_admin.accounts (username, password_hash)
     VALUES ($1, %I.crypt($2, %I.gen_salt(''bf'', 12)))',
    crypto_schema, crypto_schema
  ) USING 'YOUR_ADMIN_USERNAME', 'YOUR_ADMIN_PASSWORD';
END;
$setup$;
```

This detects the actual `pgcrypto` schema, so it works with the extension in `extensions` or `public`. It stores a password hash. Run account creation once; a duplicate-username error means that account already exists.

No usable default admin password is distributed in the repository. Obtain existing evaluation credentials privately from the owner, or create your own as above. A developer may have `supabase/admin-setup.local.sql` for local provisioning; **it is ignored by Git and is not required or included in a fresh checkout**.

### 8.3 Sign in and update a student's budget

1. Start the frontend and click **Administrator login**, or open `http://127.0.0.1:5173/#admin` using your actual port.
2. Enter the administrator username/password created in SQL Editor.
3. Search by student username, name, or email. New students use their email as username.
4. Click **Budgets** for a student, choose the month, and save a category limit.
5. Refresh the student's dashboard for the same month to see the updated limit.

Admin sessions expire after **eight hours**. Sign-out revokes the session. **Five failed attempts** lock the account for **15 minutes**. Budget changes are recorded in a private audit table; student RLS remains enabled.

## 9. Start, stop, and restart the application

From the project root:

```bash
npm run dev
```

Leave the terminal running. Open the Local URL printed by Vite, normally:

```text
Student application: http://127.0.0.1:5173/
Administrator panel: http://127.0.0.1:5173/#admin
```

The configured port is strict: Vite reports an error if `5173` is busy. To choose another:

```bash
npm run dev --prefix client -- --port 5174
```

Then use `http://127.0.0.1:5174/` and `http://127.0.0.1:5174/#admin`.

- **Stop:** Press `Ctrl+C` in the server terminal.
- **Restart:** Run the same dev command after stopping it.
- **After changing `.env`:** Restart the server and reload the browser.
- **On subsequent days:** Open the root folder and run the dev command; do not reinstall packages or recreate the database every time.

## 10. Use the application

### Create a student account

1. Select **Create account** and enter an email address in a valid format.
2. Choose a password that meets the displayed rules: at least eight characters, one capital letter, one special character, and three digits.
3. Click **Register**. The application returns to **Sign in** with your email filled in.
4. Sign in with that **same email and chosen password**.

Your email becomes your username. No verification code, email link, full-name field, or confirmation-password step is required. Passwords are not stored in browser storage. If you repeat registration after an account was created, the app verifies the supplied password and directs you to sign-in. A different password does not overwrite an existing account. Changing the email clears messages from the previous address. If an older interrupted signup reserved your email, contact the project administrator to restore that account rather than deleting existing records.

### Record and review expenses

Use **Add Expense** and supply a date, positive INR amount, description, and category. Only today's or past dates are allowed. Amounts allow up to two decimal places; descriptions allow up to 500 characters. Review **Transactions**, search/filter entries, or delete a test expense after confirming.

### Set budgets and view alerts

For a straightforward evaluation, select the **current month** and **Monthly** duration before setting budgets. Enter a positive limit for a category in **Budgets**. Limits apply to the selected month/category. The student UI locks a saved category budget during its active period; administrators can update monthly limits.

| Spending against a category limit | Display                   |
| --------------------------------- | ------------------------- |
| Below 80%                         | Within budget             |
| 80% through exactly 100%          | Budget warning            |
| Greater than 100%                 | Over-budget alert         |
| No limit configured               | No category-budget status |

Past periods cannot receive new student budgets, and future periods must start before saving. Weekly, half-month, quarterly, and yearly selections affect reporting; see [implementation notes](#14-current-implementation-notes) for budget storage details.

### Import and export CSV

Import requires real student sign-in and a file **no larger than 2 MB** with these headers:

```csv
date,amount,description,category
2026-10-01,150.00,Canteen lunch,Food
2026-10-02,50.00,Bus fare,Travel
```

Use real `YYYY-MM-DD` dates that are not in the future and match the period you want to display. Allowed categories are Food, Travel, Study, and Other. Valid rows import; invalid rows show CSV line numbers and explanations. Repeated imported entries are skipped using a per-user fingerprint.

Use [sample-data/expenses-sample.csv](sample-data/expenses-sample.csv) or **Download sample CSV** for testing. The sample has fixed September/October 2026 dates and deliberately invalid rows. Adjust valid dates for your evaluation date if needed; otherwise extra future-date errors or entries outside the current view are expected. Import the same valid file twice to check duplicate skipping.

Use the transaction CSV export control to download the displayed data. Your browser saves downloads; they are not placed in the source folder.

## 11. Examiner verification checklist

Use fresh accounts and let the initial dashboard finish loading before adding data. Do not switch browsers or clear storage during this sequence because of the first-login reset.

| Check               | Steps                                                       | Expected result                                      |
| ------------------- | ----------------------------------------------------------- | ---------------------------------------------------- |
| Local launch        | Install dependencies and start Vite                         | Authentication page opens at the Local URL           |
| Demo                | Sign in tab → Try demo                                      | Dashboard works without a real account               |
| Registration        | Email + qualifying password → Register → sign in            | Account created without an email code or link        |
| Password validation | Try a password missing a capital, symbol, or three digits   | Missing requirements shown; registration rejected    |
| Expense             | Add a Food expense dated today                              | Transaction, count, and total update                 |
| Month filtering     | View another month with no entries                          | First month's entries do not appear                  |
| Warning             | Current Monthly view: Food limit ₹1,000, Food spending ₹800 | 80% warning appears                                  |
| Over budget         | Add ₹201 more Food spending in the same month               | ₹1,001 shows over-budget alert                       |
| CSV validation      | Import valid and invalid rows                               | Valid rows import; invalid rows show explanations    |
| Duplicates          | Import that same file again                                 | Matching imported rows are skipped                   |
| Data isolation      | Sign in as a second student                                 | First student's records are not visible              |
| Admin search        | Admin login → search student email                          | Matching user appears                                |
| Admin update        | Revise monthly limit; refresh student's view                | Updated category limit appears                       |
| Responsive UI       | Test phone/tablet/desktop sizes                             | Navigation, forms, tables, and dialogs remain usable |
| Automated checks    | Run tests, formatting check, and build                      | Commands finish without failures                     |

For the budget example, start with an empty Food total; existing sample/test expenses change the percentage.

## 12. Commands, tests, and production build

### Command reference

| Command from project root                                         | Purpose                                                          |
| ----------------------------------------------------------------- | ---------------------------------------------------------------- |
| `npm run install:all`                                             | Install root and client dependencies                             |
| `npm run dev`                                                     | Start frontend on port 5173                                      |
| `npm run dev --prefix client -- --port 5174`                      | Start on another port                                            |
| `npm test`                                                        | Run automated logic/auth/database tests                          |
| `npm run build`                                                   | Create production frontend in `client/dist/`                     |
| `npm run preview --prefix client -- --host 127.0.0.1 --port 4173` | Serve the production build locally                               |
| `npm run format`                                                  | Format supported source files                                    |
| `npm run format:check`                                            | Check formatting without changes                                 |
| `npm run auth:configure`                                          | Disable email confirmation and configure minimum password length |
| `npm run test:responsive`                                         | Run isolated browser layout checks; needs a running dev server   |

### Standard verification

```bash
npm test
npm run format:check
npm run build
```

Tests cover expense/CSV validation, budget statuses, email/password registration, password rules, and auth settings, and admin authentication, permissions, search/pagination, budget updates, lockout, and logout. Database tests use embedded **PGlite**, not live Supabase data. Use the manual registration/sign-in check to verify your live Supabase configuration.

### Preview the production build

After `npm run build`:

```bash
npm run preview --prefix client -- --host 127.0.0.1 --port 4173
```

Open `http://127.0.0.1:4173/` or its `/#admin` page. Preview serves a local build; it does not publish the project. Environment values are embedded at build time, so rebuild after changing `client/.env`. Supabase still requires internet.

### Optional responsive browser checks

Checks use a separate headless browser with mocked auth/database responses, not your browser profile or live data. Configure a valid Supabase-shaped URL/key in `client/.env` so auth screens initialize; the normal evaluation environment is sufficient, and requests are intercepted by the test.

On Windows the script looks for Chrome, Edge, or Brave in common installation locations. If none is found, or on macOS/Linux, install Chromium:

```bash
npx playwright install chromium
```

If Linux reports missing system dependencies, follow Playwright's suggested installation command (`npx playwright install --with-deps chromium`); OS package installation may require administrator rights.

Start Vite in one terminal. In a **second terminal** at the project root, set the check URL to its actual port:

Windows PowerShell:

```powershell
$env:RESPONSIVE_TEST_URL = "http://127.0.0.1:5173/"
npm run test:responsive
Remove-Item Env:RESPONSIVE_TEST_URL
```

macOS / Linux:

```bash
RESPONSIVE_TEST_URL='http://127.0.0.1:5173/' npm run test:responsive
```

The script defaults to **5174**, so override it for 5173. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to a full browser executable path for custom installations. Reports/screenshots go into ignored `layout-artifacts/`. Checks cover 14 states across eight viewport configurations, including 320px phones, password validation states, and short landscape.

### Editor formatting

Source uses two-space indentation and Prettier. VS Code settings enable format-on-save; install the recommended **Prettier – Code formatter** extension (`esbenp.prettier-vscode`). Dependencies, generated builds/reports, environment files, and local SQL provisioning are excluded.

## 13. Project structure

```text
student-expense-tracker/
├── README.md                         # Setup, usage, evaluation, troubleshooting
├── package.json                      # Root commands and development tools
├── package-lock.json                 # Root dependency lockfile
├── .gitignore                        # Excludes secrets and generated output
├── .prettierrc.json                   # Formatting rules
├── .vscode/                          # Editor settings
├── client/
│   ├── .env.example                  # Copy to .env and fill values
│   ├── package.json                  # React/Vite dependencies and commands
│   ├── package-lock.json             # Frontend dependency lockfile
│   ├── index.html                    # Frontend entry page
│   ├── vite.config.js                # Dev server configuration
│   ├── public/pluscode-logo.jpeg     # Project logo and browser icon
│   ├── public/sample-expenses.csv    # In-app sample download
│   └── src/
│       ├── main.jsx                  # React entry and stylesheet imports
│       ├── App.jsx                   # Student workspace, expenses, budgets
│       ├── Logo.jsx                  # Shared project branding
│       ├── StudentAuth.jsx           # Registration and sign-in
│       ├── student-auth.js           # Email/password validation and authentication
│       ├── api.js                    # Student Supabase access / validation
│       ├── AdminPanel.jsx            # Administrator UI
│       ├── admin-api.js              # Administrator RPC access
│       ├── use-responsive-overlays.js
│       └── *.css                     # Student, admin, responsive styles
├── supabase/
│   ├── schema.sql                    # Base tables, indexes, student RLS
│   └── admin-schema.sql              # Admin storage and RPC functions
├── sample-data/expenses-sample.csv    # CSV evaluation fixture
├── scripts/
│   ├── configure-password-auth.mjs   # Password registration settings script
│   └── check-responsive.mjs          # Isolated browser layout checks
└── tests/                            # Node.js / embedded database tests
```

`client/.env`, `supabase/*.local.sql`, `node_modules/`, `client/dist/`, and `layout-artifacts/` are local or generated files, not required submission source files.

## 14. Current implementation notes

- **First-login reset:** `App.jsx` clears origin-local storage on first initialization and signs out any existing student session. On first signed-in use of an email without its local reset marker, it deletes that student's expenses across all months and clears the selected month's budgets. This is browser-dependent, not a database migration. Use disposable evaluation data; do not connect valuable existing records to this version.
- **Budget persistence:** There is one budget per **user + calendar month + category**. Weekly, half-month, quarterly, and yearly selections filter expenses but do not store independent budgets for each cycle. Use Monthly for a consistent persisted-budget demonstration.
- **Cycle locking:** Active-cycle state is stored in browser storage and cleared on logout. Student restrictions are UI logic, not a database-wide once-per-cycle policy. Admins can update monthly limits directly.
- **Internet:** Real auth/data are hosted on Supabase. Demo data is temporary and cannot demonstrate real authentication, RLS, or administrator access.
- **Separate credentials:** Frontend settings and admin credentials are not bundled. Confirm email must be OFF for immediate email/password registration. Existing MySQL data is not automatically migrated.
- **Older interrupted accounts:** Previous unfinished signups may already occupy an email. Completed accounts keep their password; unfinished legacy sessions remain blocked. The project administrator must restore those accounts if their password was never set. New registrations use the email/password flow.

## 15. Troubleshooting

| Problem                                      | What to check / do                                                                                          |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `node` / `npm` not recognized                | Install Node.js 24 LTS, reopen terminal, and check versions                                                 |
| `npm.ps1 cannot be loaded`                   | Use `npm.cmd` instead of `npm`, or Command Prompt                                                           |
| `ENOENT` / package.json not found            | Open the project root, not its parent or `supabase/`                                                        |
| Engine warning or install failure            | Upgrade to Node.js 24 LTS; installed Supabase package requires Node.js 22+                                  |
| `vite` not recognized / missing dependencies | Run `npm run install:all` from root and wait for completion                                                 |
| Port `5173` already in use                   | Use the `--port 5174` command and open that port                                                            |
| Cannot reach local URL                       | Keep Vite running; open exactly its terminal's Local URL                                                    |
| Missing Supabase settings                    | Create `client/.env`, fill values, check it is not `.env.txt`, restart Vite                                 |
| Invalid API key / failed request             | Check URL/key belong to the same active project and internet works                                          |
| Missing expenses/budgets relation            | Run all of `supabase/schema.sql` in the configured project                                                  |
| RLS / permission errors                      | Verify schema/policies and session; keep RLS enabled; never use browser service-role keys                   |
| Email/password login fails                   | Use registered email and chosen password; check Auth logs                                                   |
| Registration asks for confirmation           | Set Supabase Confirm email OFF; no code is used in this version                                             |
| Password rejected                            | Meet all four displayed rules and any stricter Supabase policy                                              |
| Earlier email already registered             | Sign in with its existing password; unfinished old accounts need administrator restoration                  |
| Admin setup pending / RPC missing            | Run base schema then all of `admin-schema.sql` in the same project as `.env`                                |
| Admin credentials rejected                   | Provision an admin account; student credentials do not grant admin access                                   |
| Duplicate admin username                     | Account already exists; use known credentials or another new username                                       |
| `crypt` / `gen_salt` missing                 | Run schemas first; use the schema-detecting creation block in this guide                                    |
| Admin account locked                         | Wait 15 minutes after repeated failures and use correct credentials                                         |
| Admin users empty                            | Complete real registration in the same project; demo users are not stored                                   |
| Expense not displayed                        | Check month/cycle/search/category filters; entry may be outside the view                                    |
| Budget input locked                          | Select a current started period; saved categories lock during that period; admins can revise monthly limits |
| CSV / rows rejected                          | Check four headers, size, non-future real dates, amounts, descriptions, and categories                      |
| Existing data disappears on new browser      | Read first-login reset note; this behavior exists in the current code                                       |
| Responsive test cannot connect               | Run Vite and set `RESPONSIVE_TEST_URL` to its actual port                                                   |
| Playwright executable missing                | Install Chromium or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE`                                                    |
| Preview has old settings                     | Rebuild after environment/source changes, then restart preview                                              |

For database/authentication errors, inspect browser console/network responses and Supabase logs. Do not include passwords or management tokens in shared screenshots or error reports.

## 16. Submission checklist

Before handing the project to the examiner:

- [ ] Include **latest** source, README, both package manifests/lockfiles, both schemas, scripts, tests, and sample CSV.
- [ ] Grant private repository access or supply a complete source ZIP.
- [ ] Verify installation from the actual submission folder, not an older copy.
- [ ] Provide a fresh evaluation Supabase project or allow time to create one using this guide.
- [ ] Apply database and administrator schemas if admin features will be evaluated.
- [ ] Enable email/password registration and save **Confirm email OFF** in Supabase.
- [ ] Test valid email + qualifying password → Register → sign in; test rejection of weak passwords.
- [ ] Share evaluation project URL/publishable key and existing admin credentials privately, or let the examiner create their own admin.
- [ ] Run `npm test`, `npm run format:check`, and `npm run build`; complete manual evaluation checks.
- [ ] Explain first-login reset and use disposable test records.
- [ ] Exclude secrets, local provisioning SQL, dependency folders, builds, and generated reports from public source submissions.

After successful setup, normal local use is: open project root → `npm run dev` → open the terminal's Local URL.
