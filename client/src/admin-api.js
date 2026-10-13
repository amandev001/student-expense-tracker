export const ADMIN_CATEGORIES = ['Food', 'Travel', 'Study', 'Other'];

export class AdminSessionError extends Error {}

export function validateAdminBudget(month, category, amount) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !ADMIN_CATEGORIES.includes(category)) {
    throw Error('Select a valid month and category.');
  }
  const value = String(amount ?? '').trim();
  if (
    !/^\d+(\.\d{1,2})?$/.test(value) ||
    !Number.isFinite(Number(value)) ||
    Number(value) <= 0 ||
    Number(value) > 9999999999.99
  ) {
    throw Error('Budget must be positive, with up to 2 decimal places.');
  }
  return Number(value);
}

export function createAdminApi(client) {
  async function call(name, params) {
    if (!client) throw Error('Supabase is not configured. Please complete the project setup.');
    const { data, error } = await client.rpc(name, params);
    if (error) {
      if (error.code === 'PGRST202' || error.code === '42883') {
        throw Error(
          'Admin setup is pending. Run the admin setup SQL in your Supabase project first.',
        );
      }
      if (error.code === '28000')
        throw new AdminSessionError('Admin session expired. Please sign in again.');
      throw Error(error.message || 'Unable to complete the admin request.');
    }
    if (data?.error) throw Error(data.error);
    if (!data) throw Error('The admin server returned an empty response.');
    return data;
  }
  function sessionParams(token) {
    if (!/^[0-9a-f]{64}$/.test(token || ''))
      throw new AdminSessionError('Please sign in as an administrator.');
    return { p_session_token: token };
  }
  return {
    login: async (username, password) => {
      const data = await call('pluscode_admin_login', {
        p_username: username.trim(),
        p_password: password,
      });
      if (
        !/^[0-9a-f]{64}$/.test(data.token || '') ||
        !data.username ||
        !Number.isFinite(Date.parse(data.expiresAt))
      ) {
        throw Error('The admin server returned an invalid session.');
      }
      return data;
    },
    session: (token) => call('pluscode_admin_session', sessionParams(token)),
    users: (token, search = '', page = 1) =>
      call('pluscode_admin_users', {
        ...sessionParams(token),
        p_search: search,
        p_page: page,
        p_page_size: 20,
      }),
    budgets: (token, userId, month) =>
      call('pluscode_admin_user_budgets', {
        ...sessionParams(token),
        p_user_id: userId,
        p_month: month,
      }),
    saveBudget: (token, userId, month, category, amount) =>
      call('pluscode_admin_save_budget', {
        ...sessionParams(token),
        p_user_id: userId,
        p_month: month,
        p_category: category,
        p_amount: validateAdminBudget(month, category, amount),
      }),
    logout: (token) => call('pluscode_admin_logout', sessionParams(token)),
  };
}
