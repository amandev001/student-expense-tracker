import { createClient } from '@supabase/supabase-js';
import Papa from 'papaparse';
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const configured = Boolean(url && key);
export const supabase = configured
  ? createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;
export function createRegistrationClient() {
  return configured
    ? createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
          storageKey: 'pluscode-registration-' + globalThis.crypto.randomUUID(),
        },
      })
    : null;
}
const CATS = ['Food', 'Travel', 'Study', 'Other'];
const fail = (e) => {
  if (e) throw new Error(e.message || String(e));
};
function dateValid(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return false;
  let [y, m, d] = s.split('-').map(Number);
  let dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() + 1 === m && dt.getUTCDate() === d;
}
function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function validateExpense(r) {
  const errors = [],
    date = String(r.date ?? '').trim(),
    amountText = String(r.amount ?? '').trim(),
    description = String(r.description ?? '').trim(),
    category = CATS.find(
      (c) =>
        c.toLowerCase() ===
        String(r.category ?? '')
          .trim()
          .toLowerCase(),
    );
  if (!dateValid(date)) errors.push('Date must be a real YYYY-MM-DD date');
  else if (date > getTodayStr())
    errors.push('Future dates cannot be recorded. Only today or past expenses allowed');
  if (
    !/^\d+(\.\d{1,2})?$/.test(amountText) ||
    !Number.isFinite(Number(amountText)) ||
    Number(amountText) <= 0 ||
    Number(amountText) > 9999999999.99
  )
    errors.push('Amount must be positive with up to 2 decimals');
  if (!description) errors.push('Description is required');
  if (description.length > 500) errors.push('Description exceeds 500 characters');
  if (!category) errors.push('Category must be Food, Travel, Study or Other');
  return { errors, expense: { date, amount: Number(amountText), description, category } };
}
export function budgetStatus(spent, limit) {
  return limit == null
    ? 'none'
    : spent > limit
      ? 'over'
      : spent >= 0.8 * limit
        ? 'warning'
        : 'good';
}
export function nextMonth(month) {
  let [y, m] = month.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}
export function fingerprint(e) {
  return JSON.stringify([
    e.date,
    Number(e.amount).toFixed(2),
    e.description.trim().toLowerCase(),
    e.category,
  ]);
}
async function uid() {
  if (!supabase) throw Error('Configure client/.env with Supabase URL and publishable key');
  const { data, error } = await supabase.auth.getUser();
  fail(error);
  if (!data.user) throw Error('Session expired; please sign in again');
  return data.user.id;
}
export async function request(path, method = 'GET', body) {
  if (!supabase) throw Error('Missing Supabase settings: create client/.env');
  const id = await uid();
  if (path.startsWith('/dashboard?')) {
    const params = new URLSearchParams(path.split('?')[1]);
    const month = params.get('month');
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw Error('Invalid month');
    const from = params.get('from') || month + '-01';
    const to = params.get('to') || nextMonth(month) + '-01';
    let { data: expenses, error } = await supabase
      .from('expenses')
      .select('id,date,amount,description,category')
      .eq('user_id', id)
      .gte('date', from)
      .lt('date', to)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });
    fail(error);
    let { data: budgets, error: be } = await supabase
      .from('budgets')
      .select('category,amount')
      .eq('user_id', id)
      .eq('month', month);
    fail(be);
    const categories = CATS.map((category) => {
      let spent = Number(
        (expenses || [])
          .filter((e) => e.category === category)
          .reduce((a, e) => a + Number(e.amount), 0)
          .toFixed(2),
      );
      let b = (budgets || []).find((b) => b.category === category);
      let limit = b ? Number(b.amount) : null;
      return { category, spent, limit, status: budgetStatus(spent, limit) };
    });
    return {
      expenses: expenses || [],
      categories,
      total: Number(categories.reduce((a, c) => a + c.spent, 0).toFixed(2)),
      count: expenses?.length || 0,
    };
  }
  if (path === '/expenses' && method === 'POST') {
    const { errors, expense } = validateExpense(body);
    if (errors.length) throw Error(errors.join('; '));
    let { error } = await supabase.from('expenses').insert({ ...expense, user_id: id });
    fail(error);
    return { ok: true };
  }
  if (path.startsWith('/expenses/') && method === 'DELETE') {
    let { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', path.split('/').pop())
      .eq('user_id', id);
    fail(error);
    return { ok: true };
  }
  if (path === '/budgets' && method === 'PUT') {
    if (
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(body.month) ||
      !CATS.includes(body.category) ||
      !Number.isFinite(Number(body.limit)) ||
      Number(body.limit) <= 0 ||
      Number(body.limit) > 9999999999.99
    )
      throw Error('Invalid budget');
    let { error } = await supabase
      .from('budgets')
      .upsert(
        { user_id: id, month: body.month, category: body.category, amount: Number(body.limit) },
        { onConflict: 'user_id,month,category' },
      );
    fail(error);
    return { ok: true };
  }
  if (path.startsWith('/budgets/') && method === 'DELETE') {
    const parts = path.split('/');
    const bMonth = parts[2],
      bCat = parts[3];
    if (!CATS.includes(bCat)) throw Error('Invalid category');
    let { error } = await supabase
      .from('budgets')
      .delete()
      .eq('user_id', id)
      .eq('month', bMonth)
      .eq('category', bCat);
    fail(error);
    return { ok: true };
  }
  if (path === '/import' && method === 'POST') {
    let file = body.get('file');
    if (!file) throw Error('Choose a CSV file');
    if (file.size > 2 * 1024 * 1024) throw Error('CSV must be under 2 MB');
    const csv = await file.text();
    const parsed = Papa.parse(csv, { header: true, skipEmptyLines: 'greedy' });
    if (
      !['date', 'amount', 'description', 'category'].every((k) =>
        parsed.meta.fields?.map((s) => s.trim().toLowerCase()).includes(k),
      )
    )
      throw Error('CSV requires date,amount,description,category header columns');
    const names = parsed.meta.fields;
    let rows = parsed.data,
      invalid = [],
      valid = [];
    rows.forEach((row, i) => {
      const normal = Object.fromEntries(
        Object.entries(row).map(([k, v]) => [k.trim().toLowerCase(), v]),
      );
      const result = validateExpense(normal);
      let errs = [...result.errors];
      if (row.__parsed_extra?.length) errs.push('Too many columns');
      if (errs.length) invalid.push({ row: i + 2, errors: errs, values: row });
      else valid.push({ ...result.expense, import_key: fingerprint(result.expense) });
    });
    for (const err of parsed.errors) {
      let line = err.row + 2;
      if (!invalid.some((r) => r.row === line))
        invalid.push({ row: line, errors: [err.message], values: rows[err.row] || {} });
    }
    const unique = new Map(valid.map((r) => [r.import_key, r]));
    const keys = [...unique.keys()];
    const { data: existing, error: fetchErr } = await supabase
      .from('expenses')
      .select('import_key')
      .eq('user_id', id)
      .in('import_key', keys.length ? keys : ['__none__']);
    fail(fetchErr);
    const seen = new Set((existing || []).map((e) => e.import_key));
    let added = 0;
    for (const row of unique.values()) {
      if (seen.has(row.import_key)) continue;
      const { error } = await supabase.from('expenses').insert({ ...row, user_id: id });
      if (error?.code === '23505') {
        seen.add(row.import_key);
        continue;
      }
      fail(error);
      seen.add(row.import_key);
      added++;
    }
    return {
      imported: added,
      duplicates: valid.length - added,
      invalid: invalid.sort((a, b) => a.row - b.row),
    };
  }
  throw Error('Unknown API route');
}
