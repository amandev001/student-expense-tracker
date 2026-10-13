# pluscode Student Expense Tracker — Supabase Edition

**Stack:** React 19 + Vite + Supabase Authentication + Supabase PostgreSQL; **no PHP, no MySQL, no Express or separate backend**.

## 1. Create your Supabase database

1. Create a project at https://supabase.com/dashboard.
2. Open **SQL Editor** and run `supabase/schema.sql` in full.
3. Open **Project Settings → API** (or Connect) and copy your Project URL and **publishable/anon key**, **NOT** `service_role` or secret key.
4. In **Authentication → Providers → Email**, enable email/password sign-in. If email confirmation is enabled, confirm your email after registration before logging in. For local-only test accounts, you can optionally adjust confirmation settings in Supabase dashboard.

## 2. Configure frontend (Mac)

```bash
cd pluscode-student-expense-tracker-supabase
cp client/.env.example client/.env
```

Edit `client/.env` to include **your** project URL and publishable key:

```
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
```

The publishable/anon key is designed to be used by browser apps; RLS prevents cross-user data access. **Never put a secret/service_role key in Vite env**.

## 3. Run

```bash
npm run install:all
npm run dev
```

Visit **http://127.0.0.1:5173/** and create an account. Only the React development server runs locally. Supabase requires an internet connection.

Build: `npm run build`. Tests: `npm test`.

## New professional onboarding and demo (v3)

- **5-step guided onboarding tour** opens automatically on first sign-in on each browser and can be replayed with **Guided tour**. The tour explains the dashboard, recording expenses, monthly limits, insights and CSV import.
- On the login page, choose **Try interactive demo** to explore without an account or Supabase credentials. Demo entries and budgets are held in memory only, never uploaded, and disappear on page reload. The demo intentionally disables CSV import; download sample CSV and sign in to test real importing.
- **Smart spending insight** card highlights overspending, warnings, and top spending categories.
- **Transaction search and category filtering** plus **Export month** CSV.
- **Reset demo** restores the sample budgets and expenses.
- Existing database schema remains unchanged, so existing Supabase customers do **not** need to rerun SQL.

## Features and verification

- Expenses have amount, date, description and Food/Travel/Study/Other category.
- Budget limits apply to the selected calendar month only.
- At 80% (including exactly 80%), show warning. Over 100% (strictly greater than the limit), show over-budget warning.
- Month-boundary filtering is executed against PostgreSQL, with a lower bound inclusive and next month exclusive.
- CSV upload supports `date,amount,description,category` columns. Failed rows are shown with CSV row numbers. Valid rows are imported; importing again skips duplicates using a per-user database unique index.
- `sample-data/expenses-sample.csv` or in-app **Download sample CSV** contains valid examples across two months and three invalid rows.
- Supabase authentication and PostgreSQL RLS isolate each student's data by their authenticated user ID.

### Test sequence

1. Sign up and sign in.
2. Add September and October expenses; switch month and confirm separate totals.
3. Set October Food budget at ₹1000; add ₹800 in October Food => warning.
4. Add ₹201 more => over budget.
5. Import sample CSV => correction messages for missing date/amount/description; import again => duplicate rows skipped.
6. Sign in to another account => first student's records should be inaccessible.

### Notes

- **No credentials are bundled**. You must create a Supabase project and insert its URL and key.
- This is a local-first development app connected to a remotely hosted Supabase database, not an offline database app.
- Existing MySQL data is **not automatically migrated**. If you have old data, export it as CSV for import.
- Supabase RLS is the security boundary; do not disable it.
