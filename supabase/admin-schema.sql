-- Run once in the Supabase SQL Editor after schema.sql.
-- Admin account credentials are provisioned separately; never put them in Vite.
begin;
create schema if not exists pluscode_admin;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists pluscode_admin.accounts (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  enabled boolean not null default true,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists admin_username_lower_unique
on pluscode_admin.accounts (lower(username));
create table if not exists pluscode_admin.sessions (
  token_hash text primary key,
  admin_id uuid not null references pluscode_admin.accounts (id)
    on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create table if not exists pluscode_admin.budget_changes (
  id bigint generated always as identity primary key,
  admin_id uuid not null references pluscode_admin.accounts (id),
  user_id uuid not null,
  month text not null,
  category text not null,
  previous_amount numeric(12, 2),
  new_amount numeric(12, 2) not null,
  changed_at timestamptz not null default now()
);
alter table pluscode_admin.accounts enable row level security;
alter table pluscode_admin.sessions enable row level security;
alter table pluscode_admin.budget_changes enable row level security;
revoke all on schema pluscode_admin from public, anon, authenticated;
revoke all on all tables in schema pluscode_admin from public, anon, authenticated;
revoke all on all sequences in schema pluscode_admin from public, anon, authenticated;

-- Support projects where pgcrypto was already installed in a different schema.
-- Resolve it during installation, then fully qualify every cryptographic call.
do $install$
declare
  crypto_schema text;
begin
  select n.nspname
  into crypto_schema
  from pg_catalog.pg_extension e
  join pg_catalog.pg_namespace n on n.oid = e.extnamespace
  where e.extname = 'pgcrypto';
  execute
    format(
      'create or replace function pluscode_admin.password_matches(p_password text, p_hash text)
 returns boolean language sql strict set search_path = '''' as %L',
      format('select %I.crypt(p_password,p_hash)=p_hash', crypto_schema)
    );
  execute
    format(
      'create or replace function pluscode_admin.token_hash(p_token text)
 returns text language sql strict set search_path = '''' as %L',
      format('select pg_catalog.encode(%I.digest(p_token,''sha256''),''hex'')', crypto_schema)
    );
  execute
    format(
      'create or replace function pluscode_admin.random_token()
 returns text language sql set search_path = '''' as %L',
      format('select pg_catalog.encode(%I.gen_random_bytes(32),''hex'')', crypto_schema)
    );
end;
$install$;

create or replace function pluscode_admin.require_session(p_session_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin_id uuid;
begin
  if p_session_token is null or p_session_token !~ '^[0-9a-f]{64}$' then
    raise exception 'Admin session expired. Please sign in again.' using errcode = '28000';
  end if;
  select s.admin_id
  into admin_id
  from pluscode_admin.sessions s
  join pluscode_admin.accounts a on a.id = s.admin_id
  where
    s.token_hash = pluscode_admin.token_hash(p_session_token)
    and s.expires_at > now()
    and a.enabled;
  if admin_id is null then
    raise exception 'Admin session expired. Please sign in again.' using errcode = '28000';
  end if;
  return admin_id;
end;
$$;

create or replace function public.pluscode_admin_login(p_username text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare account pluscode_admin.accounts%rowtype; token text; expiry timestamptz;
begin
 if p_username is null or length(p_username)>120 or p_password is null
 or octet_length(p_password)>72 then
  return jsonb_build_object('error','Invalid username or password.');
 end if;
 select * into account from pluscode_admin.accounts
 where lower(username)=lower(trim(p_username)) and enabled for update;
 if account.id is null then
  return jsonb_build_object('error','Invalid username or password.');
 end if;
 if account.locked_until>now() then
  return jsonb_build_object('error','Too many login attempts. Try again in 15 minutes.');
 end if;
 if pluscode_admin.password_matches(p_password,account.password_hash) is not true then
  update pluscode_admin.accounts set
   failed_attempts=case when locked_until<=now() then 1 else failed_attempts+1 end,
   locked_until=case when (case when locked_until<=now() then 1 else failed_attempts+1 end)>=5
     then now()+interval '15 minutes' else null end
  where id=account.id;
  return jsonb_build_object('error','Invalid username or password.');
 end if;
 update pluscode_admin.accounts set failed_attempts=0,locked_until=null where id=account.id;
 delete from pluscode_admin.sessions where expires_at<=now();
 token:=pluscode_admin.random_token(); expiry:=now()+interval '8 hours';
 insert into pluscode_admin.sessions(token_hash,admin_id,expires_at)
 values(pluscode_admin.token_hash(token),account.id,expiry);
 return jsonb_build_object('token',token,'username',account.username,'expiresAt',expiry);
end $$;

create or replace function public.pluscode_admin_session(p_session_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin_id uuid;
begin
  admin_id := pluscode_admin.require_session(p_session_token);
  return
    (
      select jsonb_build_object('username', a.username, 'expiresAt', s.expires_at)
      from pluscode_admin.accounts a
      join pluscode_admin.sessions s on s.admin_id = a.id
      where a.id = admin_id and s.token_hash = pluscode_admin.token_hash(p_session_token)
    );
end;
$$;

create or replace function public.pluscode_admin_users(
  p_session_token text,
  p_search text default '',
  p_page integer default 1,
  p_page_size integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pluscode_admin.require_session(p_session_token);
  if
    p_page is null
    or p_page < 1
    or p_page > 100000
    or p_page_size is null
    or p_page_size < 1
    or p_page_size > 50
    or p_search is null
    or length(p_search) > 120
  then
    raise exception 'Invalid search or page.' using errcode = '22023';
  end if;
  return
    (
      with
        users as (
          select
            id,
            email,
            created_at,
            coalesce(
              nullif(raw_user_meta_data->>'username', ''),
              nullif(raw_user_meta_data->>'name', ''),
              nullif(split_part(email, '@', 1), ''),
              id::text
            ) as username,
            coalesce(nullif(raw_user_meta_data->>'name', ''), 'Student') as name
          from auth.users
        ),
        matches as (
          select *
          from users
          where strpos(lower(concat_ws(' ', username, name, email)), lower(trim(p_search))) > 0
        ),
        page as (
          select *
          from matches
          order by created_at desc, id
          limit p_page_size offset (p_page - 1) * p_page_size
        )
      select jsonb_build_object(
        'total',
        (select count(*) from matches),
        'page',
        p_page,
        'users',
        coalesce(
          (select jsonb_agg(to_jsonb(page) order by created_at desc, id) from page),
          '[]'::jsonb
        )
      )
    );
end;
$$;

create or replace function public.pluscode_admin_user_budgets(
  p_session_token text,
  p_user_id uuid,
  p_month text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  student jsonb;
begin
  perform pluscode_admin.require_session(p_session_token);
  if p_month is null or p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Invalid month.' using errcode = '22023';
  end if;
  select jsonb_build_object(
    'id',
    id,
    'email',
    email,
    'username',
    coalesce(
      nullif(raw_user_meta_data->>'username', ''),
      nullif(raw_user_meta_data->>'name', ''),
      nullif(split_part(email, '@', 1), ''),
      id::text
    ),
    'name',
    coalesce(nullif(raw_user_meta_data->>'name', ''), 'Student')
  )
  into student
  from auth.users
  where id = p_user_id;
  if student is null then
    raise exception 'User not found.' using errcode = '22023';
  end if;
  return
    jsonb_build_object(
      'user',
      student,
      'month',
      p_month,
      'budgets',
      (
        select jsonb_agg(
          jsonb_build_object('category', c.category, 'amount', b.amount)
          order by c.position
        )
        from (
          values
            ('Food', 1),
            ('Travel', 2),
            ('Study', 3),
            ('Other', 4)
        ) c (category, position)
        left join public.budgets b
          on b.user_id = p_user_id and b.month = p_month and b.category = c.category
      )
    );
end;
$$;

create or replace function public.pluscode_admin_save_budget(
  p_session_token text,
  p_user_id uuid,
  p_month text,
  p_category text,
  p_amount numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin_id uuid;
  previous numeric;
begin
  admin_id := pluscode_admin.require_session(p_session_token);
  if
    p_month is null
    or p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
    or p_category is null
    or p_category not in ('Food', 'Travel', 'Study', 'Other')
    or p_amount is null
    or p_amount <= 0
    or p_amount > 9999999999.99
    or p_amount <> round(p_amount, 2)
  then
    raise exception 'Enter a valid month, category and positive amount with up to 2 decimals.'
      using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'User not found.' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text || p_month || p_category, 0)
  );
  select amount
  into previous
  from public.budgets
  where user_id = p_user_id and month = p_month and category = p_category;
  insert into public.budgets (user_id, month, category, amount)
  values (p_user_id, p_month, p_category, p_amount)
  on conflict (user_id, month, category) do update set amount = excluded.amount;
  insert into pluscode_admin.budget_changes
    (admin_id, user_id, month, category, previous_amount, new_amount)
  values (admin_id, p_user_id, p_month, p_category, previous, p_amount);
  return jsonb_build_object('ok', true, 'amount', p_amount);
end;
$$;

create or replace function public.pluscode_admin_logout(p_session_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_session_token ~ '^[0-9a-f]{64}$' then
    delete from pluscode_admin.sessions
    where token_hash = pluscode_admin.token_hash(p_session_token);
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on all functions in schema pluscode_admin from public, anon, authenticated;
revoke all on function public.pluscode_admin_login(text, text) from public, anon, authenticated;
revoke all on function public.pluscode_admin_session(text) from public, anon, authenticated;
revoke all
on function public.pluscode_admin_users(text, text, integer, integer)
from public, anon, authenticated;
revoke all
on function public.pluscode_admin_user_budgets(text, uuid, text)
from public, anon, authenticated;
revoke all
on function public.pluscode_admin_save_budget(text, uuid, text, text, numeric)
from public, anon, authenticated;
revoke all on function public.pluscode_admin_logout(text) from public, anon, authenticated;
grant execute on function public.pluscode_admin_login(text, text) to anon, authenticated;
grant execute on function public.pluscode_admin_session(text) to anon, authenticated;
grant execute
on function public.pluscode_admin_users(text, text, integer, integer)
to anon, authenticated;
grant execute
on function public.pluscode_admin_user_budgets(text, uuid, text)
to anon, authenticated;
grant execute
on function public.pluscode_admin_save_budget(text, uuid, text, text, numeric)
to anon, authenticated;
grant execute on function public.pluscode_admin_logout(text) to anon, authenticated;
commit;
