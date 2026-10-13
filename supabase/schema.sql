-- Run in Supabase SQL Editor. Uses Supabase Auth + RLS. Never expose service_role key to browser.
create extension if not exists pgcrypto;
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id)
    on delete cascade,
  date date not null,
  amount numeric(12, 2) not null check (amount > 0 and amount <= 9999999999.99),
  description text not null check (length(trim(description)) between 1 and 500),
  category text not null check (category in ('Food', 'Travel', 'Study', 'Other')),
  import_key text,
  created_at timestamptz not null default now(),
  constraint import_key_nonempty check (import_key is null or length(import_key) > 0)
);
create unique index if not exists expenses_user_import_unique
on public.expenses (user_id, import_key)
where import_key is not null;
create index if not exists expenses_user_date_idx on public.expenses (user_id, date desc);
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id)
    on delete cascade,
  month text not null check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  category text not null check (category in ('Food', 'Travel', 'Study', 'Other')),
  amount numeric(12, 2) not null check (amount > 0 and amount <= 9999999999.99),
  unique (user_id, month, category)
);
create index if not exists budgets_user_month_idx on public.budgets (user_id, month);
alter table public.expenses enable row level security;
alter table public.budgets enable row level security;
revoke all on public.expenses from anon;
revoke all on public.budgets from anon;
grant select, insert, delete, update on public.expenses to authenticated;
grant select, insert, delete, update on public.budgets to authenticated;
drop policy if exists "Users manage only own expenses" on public.expenses;
create policy "Users manage only own expenses" on public.expenses
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
drop policy if exists "Users manage only own budgets" on public.budgets;
create policy "Users manage only own budgets" on public.budgets
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
