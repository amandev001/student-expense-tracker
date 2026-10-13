import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  LogOut,
  RefreshCw,
  Search,
  Target,
  Users,
  Wallet,
} from 'lucide-react';
import { supabase } from './api.js';
import Logo from './Logo.jsx';
import { ADMIN_CATEGORIES, AdminSessionError, createAdminApi } from './admin-api.js';

const api = createAdminApi(supabase);
const STORAGE_KEY = 'pluscode-admin-session-v1';
const money = (amount) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(
    Number(amount || 0),
  );
const monthNow = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
function readSession() {
  try {
    const value = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
    if (/^[0-9a-f]{64}$/.test(value?.token || '') && Date.parse(value.expiresAt) > Date.now())
      return value;
  } catch {}
  sessionStorage.removeItem(STORAGE_KEY);
  return null;
}

export default function AdminPanel({ onExit }) {
  const [session, setSession] = useState(readSession);
  const [verified, setVerified] = useState(false);
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [loginBusy, setLoginBusy] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState({ users: [], total: 0 });
  const [usersLoading, setUsersLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [month, setMonth] = useState(monthNow);
  const [details, setDetails] = useState(null);
  const [limits, setLimits] = useState({});
  const [budgetsLoading, setBudgetsLoading] = useState(false);
  const [saving, setSaving] = useState('');
  const [refresh, setRefresh] = useState(0);

  function clearSession(message = '') {
    sessionStorage.removeItem(STORAGE_KEY);
    setSession(null);
    setVerified(false);
    setSelected(null);
    setDetails(null);
    setUsers({ users: [], total: 0 });
    setQuery('');
    setSearch('');
    setPage(1);
    setNotice('');
    setError(message);
  }
  function reportError(err) {
    if (err instanceof AdminSessionError) clearSession(err.message);
    else setError(err.message);
  }
  useEffect(() => {
    if (!session) return;
    let active = true;
    setVerified(false);
    api
      .session(session.token)
      .then(() => {
        if (active) setVerified(true);
      })
      .catch((err) => {
        if (active) clearSession(err.message);
      });
    const timer = setTimeout(
      () => {
        if (active) clearSession('Admin session expired. Please sign in again.');
      },
      Math.max(0, Date.parse(session.expiresAt) - Date.now()),
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [session?.token]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    if (!session || !verified) return;
    let active = true;
    setUsersLoading(true);
    setError('');
    api
      .users(session.token, search, page)
      .then((result) => {
        if (active) setUsers(result);
      })
      .catch((err) => {
        if (active) {
          setUsers({ users: [], total: 0 });
          reportError(err);
        }
      })
      .finally(() => {
        if (active) setUsersLoading(false);
      });
    return () => {
      active = false;
    };
  }, [session?.token, verified, search, page, refresh]);
  useEffect(() => {
    setDetails(null);
    setLimits({});
    if (!session || !verified || !selected) return;
    let active = true;
    setBudgetsLoading(true);
    setError('');
    setNotice('');
    api
      .budgets(session.token, selected.id, month)
      .then((result) => {
        if (!active) return;
        setDetails(result);
        setLimits(Object.fromEntries(result.budgets.map((b) => [b.category, b.amount ?? ''])));
      })
      .catch((err) => {
        if (active) reportError(err);
      })
      .finally(() => {
        if (active) setBudgetsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [session?.token, verified, selected?.id, month, refresh]);

  async function login(e) {
    e.preventDefault();
    setLoginBusy(true);
    setError('');
    try {
      const result = await api.login(credentials.username, credentials.password);
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(result));
      setSession(result);
    } catch (err) {
      reportError(err);
    } finally {
      setCredentials((old) => ({ ...old, password: '' }));
      setLoginBusy(false);
    }
  }
  async function logout() {
    setLogoutBusy(true);
    setError('');
    try {
      await api.logout(session.token);
      clearSession();
    } catch (err) {
      reportError(err);
    } finally {
      setLogoutBusy(false);
    }
  }
  async function saveBudget(e, category) {
    e.preventDefault();
    if (!details || saving) return;
    setSaving(category);
    setError('');
    setNotice('');
    try {
      const result = await api.saveBudget(
        session.token,
        details.user.id,
        month,
        category,
        limits[category],
      );
      setDetails((old) =>
        old
          ? {
              ...old,
              budgets: old.budgets.map((b) =>
                b.category === category ? { ...b, amount: Number(result.amount) } : b,
              ),
            }
          : old,
      );
      setNotice(`${category} budget updated for ${details.user.username} in ${month}.`);
    } catch (err) {
      reportError(err);
    } finally {
      setSaving('');
    }
  }

  if (!session)
    return (
      <div className="adminLoginPage">
        <form
          className="panel adminLoginCard"
          onSubmit={login}
        >
          <button
            type="button"
            className="textBtn adminBack"
            onClick={onExit}
          >
            <ArrowLeft size={16} /> Back to student login
          </button>
          <Logo
            subtitle="ADMIN PANEL"
            className="adminLoginBrand"
          />
          <h1>Administrator sign in</h1>
          <p className="muted">Manage registered users and their monthly category budgets.</p>
          <label>
            Admin username
            <input
              required
              maxLength={120}
              autoComplete="username"
              value={credentials.username}
              onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
            />
          </label>
          <label>
            Password
            <input
              required
              type="password"
              autoComplete="current-password"
              value={credentials.password}
              onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
            />
          </label>
          {error && (
            <div
              className="error"
              role="alert"
            >
              {error}
            </div>
          )}
          <button
            className="primary full"
            disabled={loginBusy}
          >
            {loginBusy ? 'Signing in...' : 'Sign in as administrator'}
          </button>
        </form>
      </div>
    );
  if (!verified)
    return (
      <div className="adminLoginPage">
        <section className="panel adminLoginCard">
          <p role="status">Checking your admin session...</p>
        </section>
      </div>
    );

  const pageCount = Math.max(1, Math.ceil(users.total / 20));
  const budgetTotal = details?.budgets.reduce((sum, b) => sum + Number(b.amount || 0), 0) || 0;
  const controlsBusy = Boolean(saving || logoutBusy);
  return (
    <div className="adminApp">
      <header className="adminHeader">
        <Logo
          subtitle="ADMIN PANEL"
          className="adminBrand"
        />
        <div className="adminHeaderActions">
          <span>{session.username}</span>
          <button
            className="subtleBtn"
            disabled={controlsBusy}
            onClick={onExit}
          >
            <ArrowLeft size={16} /> Student app
          </button>
          <button
            className="subtleBtn"
            disabled={controlsBusy}
            onClick={logout}
          >
            <LogOut size={16} />
            {logoutBusy ? 'Signing out...' : 'Sign out'}
          </button>
        </div>
      </header>
      <main className="adminBody">
        <div className="welcome">
          <div>
            <div className="heroPill">USER MANAGEMENT</div>
            <h2>Manage your student community.</h2>
            <p>Find a user, select a month and update their category budgets.</p>
          </div>
          <Users size={44} />
        </div>
        {error && (
          <div
            className="error"
            role="alert"
          >
            {error}
          </div>
        )}
        {notice && (
          <div
            className="success"
            role="status"
          >
            {notice}
          </div>
        )}
        <div className="adminColumns">
          <section className="panel adminUsers">
            <div className="sectionHead">
              <div>
                <h3>
                  <Users size={18} /> {search ? 'Search results' : 'All registered users'}
                </h3>
                <p>
                  {usersLoading
                    ? 'Loading users...'
                    : `${users.total} ${search ? 'matching' : 'registered'} users`}
                </p>
              </div>
              <button
                className="subtleBtn"
                aria-label="Refresh users and budgets"
                disabled={controlsBusy || usersLoading}
                onClick={() => setRefresh((v) => v + 1)}
              >
                <RefreshCw size={16} />
              </button>
            </div>
            <div className="filterBar">
              <label>
                <Search size={17} />
                <input
                  aria-label="Search users by username"
                  maxLength={120}
                  placeholder="Search username, name or email..."
                  disabled={controlsBusy}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
            </div>
            <div className="tableWrap adminUsersTableWrap">
              <table className="adminUsersTable">
                <thead>
                  <tr>
                    <th scope="col">Username / name</th>
                    <th scope="col">Email</th>
                    <th scope="col">
                      <span className="srOnly">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {!usersLoading &&
                    users.users.map((student) => (
                      <tr
                        key={student.id}
                        className={selected?.id === student.id ? 'adminSelected' : ''}
                      >
                        <td data-label="Username / name">
                          <strong>{student.username}</strong>
                          <small>{student.name}</small>
                        </td>
                        <td data-label="Email">{student.email || 'No email'}</td>
                        <td data-label="Actions">
                          <button
                            className="subtleBtn"
                            disabled={controlsBusy}
                            aria-label={`Manage budgets for ${student.username}`}
                            onClick={() => setSelected(student)}
                          >
                            <Target size={15} />{' '}
                            {selected?.id === student.id ? 'Selected' : 'Budgets'}
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {usersLoading ? (
              <div
                className="empty"
                role="status"
              >
                Loading users...
              </div>
            ) : (
              users.users.length === 0 && (
                <div className="empty">
                  <Users size={30} />
                  <p>{search ? 'No users match your search.' : 'No registered users found.'}</p>
                </div>
              )
            )}
            <div className="adminPagination">
              <button
                className="subtleBtn"
                aria-label="Previous user page"
                disabled={controlsBusy || usersLoading || page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft size={16} />
              </button>
              <span>
                Page {page} of {pageCount}
              </span>
              <button
                className="subtleBtn"
                aria-label="Next user page"
                disabled={controlsBusy || usersLoading || page >= pageCount}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </section>
          <section className="panel adminBudgets">
            <div className="sectionHead">
              <div>
                <h3>
                  <Wallet size={18} /> User budgets
                </h3>
                <p>{selected ? selected.username : 'Select a user to manage their limits'}</p>
              </div>
            </div>
            {!selected ? (
              <div className="empty">
                <Target size={32} />
                <p>Choose Budgets beside a user.</p>
              </div>
            ) : (
              <>
                <div className="adminUserDetails">
                  <strong>{selected.name}</strong>
                  <small>{selected.email}</small>
                </div>
                <label>
                  Budget month
                  <input
                    aria-label="Admin budget month"
                    type="month"
                    required
                    value={month}
                    disabled={controlsBusy}
                    onChange={(e) => {
                      if (e.target.value) setMonth(e.target.value);
                    }}
                  />
                </label>
                {budgetsLoading ? (
                  <p
                    className="budgetLoading"
                    role="status"
                  >
                    Loading monthly limits...
                  </p>
                ) : (
                  details && (
                    <>
                      <div className="miniStat">
                        <span>Total category limits</span>
                        <strong>{money(budgetTotal)}</strong>
                      </div>
                      <div className="adminBudgetForms">
                        {ADMIN_CATEGORIES.map((category) => (
                          <form
                            key={category}
                            onSubmit={(e) => saveBudget(e, category)}
                          >
                            <label>
                              {category} budget
                              <input
                                aria-label={`${category} budget amount`}
                                type="number"
                                required
                                min="0.01"
                                max="9999999999.99"
                                step="0.01"
                                placeholder="Not set"
                                value={limits[category] ?? ''}
                                disabled={controlsBusy}
                                onChange={(e) =>
                                  setLimits((old) => ({ ...old, [category]: e.target.value }))
                                }
                              />
                            </label>
                            <button
                              className="primary"
                              disabled={controlsBusy}
                            >
                              {saving === category ? 'Saving...' : 'Save'}
                            </button>
                          </form>
                        ))}
                      </div>
                      <p className="adminBudgetNote">
                        Changes apply to this user and selected month. The user sees the updated
                        limit when their dashboard refreshes.
                      </p>
                    </>
                  )
                )}
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
