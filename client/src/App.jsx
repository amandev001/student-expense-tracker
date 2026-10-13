import { supabase, request, nextMonth } from './api.js';
import AdminPanel from './AdminPanel.jsx';
import StudentAuth from './StudentAuth.jsx';
import Logo from './Logo.jsx';
import { useResponsiveOverlays } from './use-responsive-overlays.js';
import { requiresPasswordSetup } from './student-session.js';
import React, { useEffect, useState } from 'react';
import {
  Wallet,
  LayoutDashboard,
  ReceiptText,
  Target,
  Upload,
  LogOut,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  CalendarDays,
  GraduationCap,
  ChartNoAxesCombined,
  FileDown,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Search,
  Download,
  RotateCcw,
  X,
  Lightbulb,
  Menu,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
const CATS = ['Food', 'Travel', 'Study', 'Other'];
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#a78bfa'];
const now = new Date();
const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
const money = (n) =>
  '₹' +
  Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
function getPeriodRange(month, period, weekNum, halfNum) {
  const [y, m] = month.split('-').map(Number);
  const dim = new Date(y, m, 0).getDate();
  if (period === 'quarterly') {
    const q = Math.floor((m - 1) / 3);
    const qs = q * 3 + 1;
    const qe = qs + 3;
    const toY = qe > 12 ? y + 1 : y;
    const toM = String(qe > 12 ? qe - 12 : qe).padStart(2, '0');
    return { from: `${y}-${String(qs).padStart(2, '0')}-01`, to: `${toY}-${toM}-01` };
  }
  if (period === 'yearly') return { from: `${y}-01-01`, to: `${y + 1}-01-01` };
  if (period === '15days') {
    const hf = halfNum === 1 ? `${month}-01` : `${month}-16`;
    const ht = halfNum === 1 ? `${month}-16` : nextMonth(month) + '-01';
    return { from: hf, to: ht };
  }
  if (period === 'weekly') {
    if (weekNum === 1) return { from: `${month}-01`, to: `${month}-08` };
    if (weekNum === 2) return { from: `${month}-08`, to: `${month}-15` };
    if (weekNum === 3) return { from: `${month}-15`, to: `${month}-22` };
    return { from: `${month}-22`, to: nextMonth(month) + '-01' };
  }
  return { from: `${month}-01`, to: nextMonth(month) + '-01' };
}
function getPeriodLabel(month, period, weekNum, halfNum) {
  const [y, m] = month.split('-').map(Number);
  const dim = new Date(y, m, 0).getDate();
  const mn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (period === 'weekly') {
    const weekNames = {
      1: `1st Week (1–7 ${mn[m - 1]})`,
      2: `2nd Week (8–14 ${mn[m - 1]})`,
      3: `3rd Week (15–21 ${mn[m - 1]})`,
      4: `4th Week (22–${dim} ${mn[m - 1]} All remaining days)`,
    };
    return `${weekNames[weekNum] || `Week ${weekNum}`} ${y}`;
  }
  if (period === '15days')
    return halfNum === 1 ? `1–15 ${mn[m - 1]} ${y}` : `16–${dim} ${mn[m - 1]} ${y}`;
  if (period === 'monthly') return `${mn[m - 1]} ${y}`;
  if (period === 'quarterly') return `Q${Math.floor((m - 1) / 3) + 1} ${y}`;
  if (period === 'yearly') return String(y);
  return month;
}
function isPeriodUnlocked(month, period, weekNum, halfNum) {
  const { from } = getPeriodRange(month, period, weekNum, halfNum);
  return today >= from;
}
function getCurrentWeekNum(d) {
  const n = Number(d.split('-')[2]);
  return n <= 7 ? 1 : n <= 14 ? 2 : n <= 21 ? 3 : 4;
}
function getCurrentHalfNum(d) {
  return Number(d.split('-')[2]) <= 15 ? 1 : 2;
}
const TOUR = [
  {
    title: 'Welcome to pluscode',
    description:
      'Track every rupee in one friendly dashboard. This 5-step tour explains the key features.',
    screen: 'Overview',
  },
  {
    title: 'Add your first expense',
    description:
      'Record an amount, date, description and category. Use the quick-entry form in Transactions.',
    screen: 'Transactions',
  },
  {
    title: 'Set monthly budgets',
    description:
      'Pick a category and set a monthly limit. You receive an alert at 80% and an over-budget message above 100%.',
    screen: 'Budgets',
  },
  {
    title: 'Understand your dashboard',
    description:
      'Change the month to compare spending. Charts, category progress and insights only use that selected month.',
    screen: 'Overview',
  },
  {
    title: 'Import from CSV',
    description:
      'Download the sample CSV, import it and review invalid rows. Duplicate imports are blocked.',
    screen: 'Import CSV',
  },
];
const DEMO_ROWS = [
  {
    id: 'demo1',
    date: currentMonth + '-03',
    amount: 350,
    description: 'Library textbooks',
    category: 'Study',
  },
  {
    id: 'demo2',
    date: currentMonth + '-05',
    amount: 450,
    description: 'Lunch and snacks',
    category: 'Food',
  },
  {
    id: 'demo3',
    date: currentMonth + '-07',
    amount: 380,
    description: 'Bus pass',
    category: 'Travel',
  },
  {
    id: 'demo4',
    date: currentMonth + '-10',
    amount: 420,
    description: 'Groceries',
    category: 'Food',
  },
  {
    id: 'demo5',
    date: currentMonth + '-11',
    amount: 250,
    description: 'Movie night',
    category: 'Other',
  },
];
function App() {
  const [adminMode, setAdminMode] = useState(() => window.location.hash === '#admin');
  useEffect(() => {
    const route = () => setAdminMode(window.location.hash === '#admin');
    window.addEventListener('hashchange', route);
    return () => window.removeEventListener('hashchange', route);
  }, []);
  const [token, setToken] = useState('');
  const [pendingRegistration, setPendingRegistration] = useState(null);
  const [user, setUser] = useState(null);
  const [screen, setScreen] = useState('Overview');
  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [expense, setExpense] = useState({
    amount: '',
    date: today,
    description: '',
    category: 'Food',
  });
  const [budget, setBudget] = useState({ category: 'Food', limit: '' });
  const [importResult, setImportResult] = useState(null);
  const [demo, setDemo] = useState(false);
  const [demoEntries, setDemoEntries] = useState(DEMO_ROWS);
  const [demoBudgets, setDemoBudgets] = useState({});
  const [tour, setTour] = useState(-1);
  const [filter, setFilter] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [budgetAlert, setBudgetAlert] = useState(null);
  const [period, setPeriod] = useState(() => localStorage.getItem('pluscode-period') || 'weekly');
  const [weekNum, setWeekNum] = useState(() => getCurrentWeekNum(today));
  const [halfNum, setHalfNum] = useState(() => getCurrentHalfNum(today));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [activeCycle, setActiveCycle] = useState(() => {
    try {
      const r = localStorage.getItem('pluscode-active-cycle');
      return r ? JSON.parse(r) : null;
    } catch (_) {
      return null;
    }
  });
  useResponsiveOverlays({
    sidebarOpen,
    setSidebarOpen,
    profileOpen,
    setProfileOpen,
    clearConfirmOpen,
    setClearConfirmOpen,
    budgetAlert,
    setBudgetAlert,
    tour,
    setTour,
  });
  const demoDashboard = (from, to) => {
    const f = from || month + '-01',
      t = to || nextMonth(month) + '-01';
    const list = demoEntries
      .filter((e) => e.date >= f && e.date < t)
      .sort((a, b) => b.date.localeCompare(a.date));
    const categories = CATS.map((category) => {
      const spent = list
        .filter((e) => e.category === category)
        .reduce((s, e) => s + Number(e.amount), 0);
      const limit = demoBudgets[month]?.[category] ?? null;
      return {
        category,
        spent,
        limit,
        status:
          limit === null
            ? 'none'
            : spent > limit
              ? 'over'
              : spent >= limit * 0.8
                ? 'warning'
                : 'good',
      };
    });
    return {
      expenses: list,
      categories,
      total: categories.reduce((a, c) => a + c.spent, 0),
      count: list.length,
    };
  };
  const beginDemo = () => {
    setDemo(true);
    setToken('demo-session');
    setUser({ name: 'Demo Student', email: 'demo@pluscode.local' });
    setScreen('Overview');
    setTour(0);
    setNotice('Safe demo mode: nothing is saved to Supabase.');
  };
  const runTour = () => {
    setTour(0);
    setScreen('Overview');
  };

  function acceptStudentSession(session) {
    if (requiresPasswordSetup(session)) {
      setToken('');
      setUser(null);
      setPendingRegistration(session);
      return;
    }
    setPendingRegistration(null);
    setToken((old) => (old === 'demo-session' ? old : session?.access_token || ''));
    setUser(
      session
        ? {
            name: session.user.user_metadata?.name || session.user.email,
            email: session.user.email,
          }
        : null,
    );
  }
  const refresh = async () => {
    const { from, to } = getPeriodRange(month, period, weekNum, halfNum);
    if (demo) {
      const d = demoDashboard(from, to);
      setData(d);
      return d;
    }
    if (!token) return;
    try {
      const d = await request(
        '/dashboard?month=' +
          month +
          '&from=' +
          encodeURIComponent(from) +
          '&to=' +
          encodeURIComponent(to),
        'GET',
        null,
        token,
      );
      setData(d);
      setError('');
      return d;
    } catch (e) {
      setError(e.message);
      if (e.message.includes('session')) logout();
    }
  };
  useEffect(() => {
    const resetKey = 'pluscode-force-reset-to-signup-v2';
    if (!localStorage.getItem(resetKey)) {
      localStorage.clear();
      localStorage.setItem(resetKey, 'done');
      if (supabase) supabase.auth.signOut().catch(() => {});
      setToken('');
      setUser(null);
      return;
    }
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) acceptStudentSession(data.session);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => acceptStudentSession(session));
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!token || demo || !user?.email) return;
    const key = 'pluscode-tour-v3:' + user.email;
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, 'seen');
      setTour(0);
    }
    const cleanKey = 'pluscode-user-clean-reset-v1:' + user.email;
    if (!localStorage.getItem(cleanKey)) {
      localStorage.setItem(cleanKey, 'done');
      (async () => {
        try {
          const { data: userExpenses } = await supabase.from('expenses').select('id');
          if (userExpenses && userExpenses.length > 0) {
            for (const exp of userExpenses) {
              await supabase.from('expenses').delete().eq('id', exp.id);
            }
          }
        } catch (_) {}
        for (const cat of CATS) {
          try {
            await request('/budgets/' + month + '/' + cat, 'DELETE', null, token);
          } catch (_) {}
        }
        localStorage.removeItem('pluscode-active-cycle');
        setActiveCycle(null);
        await refresh();
      })();
    }
  }, [token, demo, user?.email]);
  useEffect(() => {
    refresh();
  }, [token, month, period, weekNum, halfNum, demo, demoEntries, demoBudgets]);
  async function logout() {
    if (!demo) await supabase?.auth.signOut();
    setDemo(false);
    setToken('');
    setUser(null);
    setTour(-1);
    setData(null);
    localStorage.removeItem('pluscode-active-cycle');
    localStorage.removeItem('pluscode-period');
  }
  async function addExpense(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (expense.date > today) {
        const msg =
          'Future dates ke expenses add nahi kiye ja sakte! Sirf aaj (today) ya past dates ke expenses add karein.';
        alert(msg);
        throw Error(msg);
      }
      const prevCats = data?.categories || [];
      const prevTotal = data?.total || 0;
      if (demo) {
        const v = Number(expense.amount);
        if (!Number.isFinite(v) || v <= 0 || !expense.description.trim() || !expense.date)
          throw Error('Enter a valid expense');
        setDemoEntries((prev) => [{ ...expense, id: 'demo' + Date.now(), amount: v }, ...prev]);
      } else await request('/expenses', 'POST', expense, token);
      setExpense({ amount: '', date: today, description: '', category: 'Food' });
      setNotice('Expense added successfully');
      setScreen('Transactions');
      const newData = await refresh();
      if (newData) {
        const tl = newData.categories.reduce((s, c) => s + (c.limit || 0), 0);
        const ts = newData.total;
        const ptl = prevCats.reduce((s, c) => s + (c.limit || 0), 0);
        if (tl > 0) {
          const wasOk = ptl === 0 || prevTotal < 0.8 * ptl;
          const nowWarn = ts >= 0.8 * tl;
          if (wasOk && nowWarn)
            setBudgetAlert([
              {
                category: 'Overall Budget',
                spent: ts,
                limit: tl,
                status: ts > tl ? 'over' : 'warning',
              },
            ]);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function setLimit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { from, to } = getPeriodRange(month, period, weekNum, halfNum);
      if (to <= today) {
        const msg = `Past period ka budget save nahi ho sakta! ${getPeriodLabel(month, period, weekNum, halfNum)} already ${to} ko khatam ho chuka hai. Kripya current period (jaise 2nd Week: 8–14 Oct) select karein.`;
        alert(msg);
        throw Error(msg);
      }
      if (today < from) throw Error(`This period has not started yet (starts on ${from}).`);
      if (activeCycle && today < activeCycle.to) {
        const isSame =
          activeCycle.month === month &&
          activeCycle.period === period &&
          (period !== 'weekly' || activeCycle.weekNum === weekNum) &&
          (period !== '15days' || activeCycle.halfNum === halfNum);
        if (!isSame) {
          throw Error(
            `Active budget for ${getPeriodLabel(activeCycle.month, activeCycle.period, activeCycle.weekNum, activeCycle.halfNum)} is currently running until ${activeCycle.to}. You cannot set a budget for another period until it ends.`,
          );
        }
      }
      const existing = categories.find((c) => c.category === budget.category)?.limit;
      if (existing !== null && existing !== undefined && today < to) {
        throw Error(
          `The ${budget.category} budget is already set for ${getPeriodLabel(month, period, weekNum, halfNum)}. You can only edit it after this period ends on ${to}.`,
        );
      }
      if (demo) {
        if (!(Number(budget.limit) > 0)) throw Error('Budget must be greater than zero');
        setDemoBudgets((old) => ({
          ...old,
          [month]: { ...old[month], [budget.category]: Number(budget.limit) },
        }));
      } else await request('/budgets', 'PUT', { month, ...budget }, token);
      const newCycle = { period, weekNum, halfNum, month, from, to };
      setActiveCycle(newCycle);
      localStorage.setItem('pluscode-active-cycle', JSON.stringify(newCycle));
      setNotice(`Budget saved for ${getPeriodLabel(month, period, weekNum, halfNum)}`);
      setBudget({ category: budget.category, limit: '' });
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function resetBudget(category) {
    if (!confirm(`Clear the ${category} budget limit for ${month}?`)) return;
    try {
      if (demo) {
        setDemoBudgets((old) => {
          const m = { ...(old[month] || {}) };
          delete m[category];
          return { ...old, [month]: m };
        });
      } else await request('/budgets/' + month + '/' + category, 'DELETE', null, token);
      const remainingLimits = categories.filter((c) => c.category !== category && c.limit !== null);
      if (!remainingLimits.length) {
        setActiveCycle(null);
        localStorage.removeItem('pluscode-active-cycle');
      }
      setNotice(`${category} budget limit cleared.`);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }
  async function executeClearAllBudgets() {
    setBusy(true);
    setError('');
    try {
      if (demo) {
        setDemoBudgets((old) => ({ ...old, [month]: {} }));
      } else {
        for (const cat of CATS) {
          try {
            await request('/budgets/' + month + '/' + cat, 'DELETE', null, token);
          } catch (_) {}
        }
      }
      setActiveCycle(null);
      localStorage.removeItem('pluscode-active-cycle');
      setNotice(`All budget limits cleared for ${month}`);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(id) {
    if (!confirm('Delete this expense?')) return;
    try {
      if (demo) setDemoEntries((prev) => prev.filter((e) => e.id !== id));
      else await request('/expenses/' + id, 'DELETE', null, token);
      setNotice('Expense deleted');
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }
  async function importCSV(e) {
    e.preventDefault();
    const file = e.currentTarget.elements.file.files[0];
    if (!file) {
      setError('Select a CSV file');
      return;
    }
    setBusy(true);
    setImportResult(null);
    setError('');
    try {
      if (demo)
        throw Error(
          'CSV import requires a signed-in account. Demo data is intentionally temporary.',
        );
      const form = new FormData();
      form.append('file', file);
      const result = await request('/import', 'POST', form, token);
      setImportResult(result);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  const categories =
    data?.categories ||
    CATS.map((category) => ({ category, spent: 0, limit: null, status: 'none' }));
  const entries = data?.expenses || [];
  const warnings = categories.filter((c) => c.status === 'warning' || c.status === 'over');
  const filteredEntries = entries.filter(
    (e) =>
      (catFilter === 'All' || e.category === catFilter) &&
      `${e.description} ${e.category} ${e.date}`.toLowerCase().includes(filter.toLowerCase()),
  );
  const remaining = categories
    .filter((c) => c.limit != null)
    .reduce((n, c) => n + Math.max(c.limit - c.spent, 0), 0);
  const topCategory = [...categories].sort((a, b) => b.spent - a.spent)[0];
  const pieData = categories
    .filter((c) => c.spent > 0)
    .map((c) => ({ name: c.category, value: c.spent }));
  if (adminMode)
    return (
      <AdminPanel
        onExit={() => {
          window.location.hash = '';
          setAdminMode(false);
        }}
      />
    );
  if (!token)
    return (
      <StudentAuth
        pendingRegistrationSession={pendingRegistration}
        onRegistrationFinished={async () => {
          await supabase?.auth.signOut({ scope: 'local' });
          setPendingRegistration(null);
        }}
        onSignedIn={(session) => {
          acceptStudentSession(session);
          setScreen('Overview');
        }}
        onDemo={beginDemo}
        onAdmin={() => {
          window.location.hash = 'admin';
          setAdminMode(true);
        }}
      />
    );
  const nav = [
    ['Overview', LayoutDashboard],
    ['Transactions', ReceiptText],
    ['Budgets', Target],
    ['Import CSV', Upload],
  ];
  const exportMonthCsv = () => {
    const rows = [
      ['date', 'amount', 'description', 'category'],
      ...entries.map((e) => [e.date, e.amount, e.description, e.category]),
    ];
    const csv = rows
      .map((r) => r.map((v) => '"' + String(v).replaceAll('"', '""') + '"').join(','))
      .join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `pluscode-expenses-${month}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  return (
    <div className="app">
      <div
        aria-hidden="true"
        className={'sideOverlay' + (sidebarOpen ? ' sideOverlayVisible' : '')}
        onClick={() => setSidebarOpen(false)}
      />
      <aside
        id="workspace-navigation"
        aria-label="Workspace navigation"
        className={'sidebar' + (sidebarOpen ? ' sidebarOpen' : '')}
      >
        <div className="sidebarTop">
          <Logo />
          <button
            className="sideCloseBtn"
            aria-label="Close menu"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        <div className="navLabel">WORKSPACE</div>
        <nav>
          {nav.map(([name, Icon]) => (
            <button
              key={name}
              onClick={() => {
                setScreen(name);
                setError('');
                setNotice('');
                setSidebarOpen(false);
              }}
              className={screen === name ? 'active' : ''}
            >
              <Icon size={19} />
              {name}
            </button>
          ))}
        </nav>
        <div className="sideBottom">
          <div className="studentCard">
            <GraduationCap size={23} />
            <span>
              <strong>{user?.name}</strong>
              <small>Student account</small>
            </span>
          </div>
          <button
            className="logout"
            onClick={logout}
          >
            <LogOut size={18} /> Sign out
          </button>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="topbarLeft">
            <button
              className="hamburgerBtn"
              aria-label="Open menu"
              aria-expanded={sidebarOpen}
              aria-controls="workspace-navigation"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={20} />
            </button>
            <div>
              <span className="eyebrow">YOUR FINANCIAL SPACE</span>
              <h1>{screen}</h1>
            </div>
          </div>
          <div className="headActions">
            <button
              className="topbarBtn"
              onClick={runTour}
              title="Start guided tour"
            >
              <Lightbulb size={15} />
              <span>Guided tour</span>
            </button>
            <button
              className="topbarBtn"
              onClick={exportMonthCsv}
              title="Export current month expenses"
            >
              <Download size={15} />
              <span>Export month</span>
            </button>
            <label
              className="monthPicker"
              title="Change month"
            >
              <CalendarDays size={15} />
              <input
                aria-label="Select month"
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="avatar"
              aria-label="Open user profile"
              title="View profile"
              onClick={() => setProfileOpen(true)}
            >
              {user?.name?.charAt(0)?.toUpperCase() || 'S'}
            </button>
          </div>
        </header>
        <div className="mainBody">
          {demo && (
            <div className="demoBanner">
              <Sparkles size={18} />
              <span>
                <strong>Interactive demo</strong> · Changes are temporary and never touch your
                database.
              </span>
              <button
                onClick={() => {
                  setDemoEntries(DEMO_ROWS);
                  setDemoBudgets({});
                  setMonth(currentMonth);
                }}
              >
                <RotateCcw size={15} /> Reset demo
              </button>
              <button onClick={logout}>Exit</button>
            </div>
          )}
          {screen !== 'Overview' && (
            <div className="compactPeriodStrip">
              <span className="periodRowLabel">Budget window:</span>
              <span className="periodActive">
                {getPeriodLabel(month, period, weekNum, halfNum)}
              </span>
              {activeCycle && today < activeCycle.to && (
                <span className="activeCycleBadge">
                  🔒 Active cycle running until {activeCycle.to}
                </span>
              )}
            </div>
          )}
          {error && <div className="error">{error}</div>}
          {notice && (
            <div
              className="success"
              onClick={() => setNotice('')}
            >
              {notice} ×
            </div>
          )}
          {screen === 'Overview' && (
            <>
              <div className="welcome">
                <div className="welcomeContent">
                  <div className="welcomeBadges">
                    <span className="heroPill">MONTHLY SNAPSHOT</span>
                    <span className="heroPeriodBadge">
                      <CalendarDays size={13} />
                      <span>{getPeriodLabel(month, period, weekNum, halfNum)}</span>
                      {activeCycle && today < activeCycle.to && (
                        <span
                          className="heroLockPill"
                          title={`Active cycle running until ${activeCycle.to}`}
                        >
                          🔒 Active
                        </span>
                      )}
                    </span>
                  </div>
                  <h2>Stay in control of your spending.</h2>
                  <p>
                    Review where your money goes and make smarter decisions, one expense at a time.
                  </p>
                </div>
                <div className="welcomeActions">
                  <button
                    className="whiteBtn"
                    onClick={() => setScreen('Transactions')}
                  >
                    <Plus size={17} /> Add expense
                  </button>
                </div>
              </div>
              <div className="metricGrid">
                <div className="metric">
                  <div className="metricHead">
                    <span>Total spent this month</span>
                    <span className="iconBg purple">
                      <Wallet size={19} />
                    </span>
                  </div>
                  <strong>{money(data?.total)}</strong>
                  <small>Only expenses from {month}</small>
                </div>
                <div className="metric">
                  <div className="metricHead">
                    <span>Transactions</span>
                    <span className="iconBg green">
                      <ReceiptText size={19} />
                    </span>
                  </div>
                  <strong>{data?.count || 0}</strong>
                  <small>Expenses recorded this month</small>
                </div>
                <div className="metric">
                  <div className="metricHead">
                    <span>Budget alerts</span>
                    <span className={'iconBg ' + (warnings.length > 0 ? 'orange' : 'blue')}>
                      <AlertTriangle size={19} />
                    </span>
                  </div>
                  <strong className={warnings.length > 0 ? 'metricAlert' : ''}>
                    {warnings.length > 0 ? `${warnings.length} Needs attention` : '0 Alerts'}
                  </strong>
                  <small>
                    {warnings.length
                      ? 'Categories needing attention'
                      : 'All tracked budgets are on target'}
                  </small>
                </div>
              </div>
              {warnings.length > 0 && (
                <div className="alertList">
                  {warnings.map((c) => (
                    <div
                      key={c.category}
                      className={'alert ' + (c.status === 'over' ? 'over' : 'warn')}
                    >
                      <AlertTriangle size={18} />
                      <span>
                        <strong>
                          {c.status === 'over' ? 'Over budget!' : '80% budget warning'} —{' '}
                          {c.category}
                        </strong>
                        <small>
                          {money(c.spent)} spent of {money(c.limit)} limit (
                          {Math.round((c.spent / c.limit) * 100)}%)
                        </small>
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="insightStrip">
                <Lightbulb size={20} />
                <div>
                  <strong>Smart insight</strong>
                  <p>
                    {!data?.count
                      ? 'Start by adding an expense or try the guided tour.'
                      : warnings.some((c) => c.status === 'over')
                        ? 'You are over budget in at least one category. Review those purchases first.'
                        : warnings.length
                          ? 'At least one category has reached 80% of its budget. Keep an eye on upcoming spending.'
                          : `Your top spending category is ${topCategory.category} (${money(topCategory.spent)}). ${categories.some((c) => c.limit !== null) ? 'Your configured category budgets still have ' + money(remaining) + ' remaining in total.' : 'Set category budgets to receive automatic alerts.'}`}
                  </p>
                </div>
              </div>
              <div className="doubleGrid">
                <section className="panel">
                  <div className="sectionHead">
                    <div>
                      <h3>Category budgets</h3>
                      <p>Spending against monthly limits</p>
                    </div>
                    <button
                      className="textBtn"
                      onClick={() => setScreen('Budgets')}
                    >
                      Manage →
                    </button>
                  </div>
                  <div className="progressList">
                    {categories.map((c, i) => (
                      <div
                        key={c.category}
                        className="progressItem"
                      >
                        <div className="progressLabels">
                          <strong>
                            <span
                              className="dot"
                              style={{ background: COLORS[i] }}
                            />
                            {c.category}
                          </strong>
                          <span>
                            {money(c.spent)}{' '}
                            {c.limit !== null ? ' / ' + money(c.limit) : '/ No limit set'}
                          </span>
                        </div>
                        <div className="track">
                          <div
                            style={{
                              width: c.limit
                                ? Math.min(100, (c.spent / c.limit) * 100) + '%'
                                : '0%',
                              background: c.status === 'over' ? '#ef4444' : COLORS[i],
                            }}
                          />
                        </div>
                        <small
                          className={
                            c.status === 'over' ? 'red' : c.status === 'warning' ? 'amber' : ''
                          }
                        >
                          {c.status === 'over'
                            ? 'Over budget'
                            : c.status === 'warning'
                              ? '80% or more used'
                              : c.limit === null
                                ? 'Set a budget to track alerts'
                                : Math.round((c.spent / c.limit) * 100) + '% used'}
                        </small>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="panel">
                  <div className="sectionHead">
                    <div>
                      <h3>Spending breakdown</h3>
                      <p>By category, this month only</p>
                    </div>
                    <ChartNoAxesCombined
                      size={20}
                      color="#929bad"
                    />
                  </div>
                  {pieData.length ? (
                    <>
                      <div className="chart">
                        <ResponsiveContainer
                          width="100%"
                          height="100%"
                        >
                          <PieChart>
                            <Pie
                              data={pieData}
                              dataKey="value"
                              nameKey="name"
                              innerRadius={68}
                              outerRadius={100}
                              paddingAngle={3}
                            >
                              {pieData.map((d) => (
                                <Cell
                                  key={d.name}
                                  fill={COLORS[CATS.indexOf(d.name)]}
                                />
                              ))}
                            </Pie>
                            <Tooltip formatter={(v) => money(v)} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="chartCenter">
                          <small>TOTAL</small>
                          <strong>{money(data.total)}</strong>
                        </div>
                      </div>
                      <div className="legend">
                        {categories.map((c, i) => (
                          <span key={c.category}>
                            <i style={{ background: COLORS[i] }} />
                            {c.category}
                          </span>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="empty">
                      <Wallet size={32} />
                      <p>No expenses yet for this month</p>
                    </div>
                  )}
                </section>
              </div>
              <section className="panel recent">
                <div className="sectionHead">
                  <div>
                    <h3>Recent expenses</h3>
                    <p>Latest activity for {month}</p>
                  </div>
                  <button
                    className="textBtn"
                    onClick={() => setScreen('Transactions')}
                  >
                    View all →
                  </button>
                </div>
                <ExpenseTable
                  entries={entries.slice(0, 5)}
                  onDelete={remove}
                />
              </section>
            </>
          )}
          {screen === 'Transactions' && (
            <>
              <div className="twoSection">
                <section className="panel">
                  <div className="sectionHead">
                    <div>
                      <h3>Add a new expense</h3>
                      <p>Record what you spent</p>
                    </div>
                    <span className="iconBg purple">
                      <Plus size={20} />
                    </span>
                  </div>
                  <form
                    onSubmit={addExpense}
                    className="formGrid"
                  >
                    <label>
                      Amount (₹)
                      <input
                        required
                        min="0.01"
                        max="9999999999.99"
                        step="0.01"
                        type="number"
                        placeholder="e.g. 150"
                        value={expense.amount}
                        onChange={(e) => setExpense({ ...expense, amount: e.target.value })}
                      />
                    </label>
                    <label>
                      Date
                      <input
                        type="date"
                        required
                        max={today}
                        value={expense.date}
                        onChange={(e) => setExpense({ ...expense, date: e.target.value })}
                      />
                    </label>
                    <label className="span2">
                      Description
                      <input
                        maxLength="500"
                        required
                        placeholder="What did you spend on?"
                        value={expense.description}
                        onChange={(e) => setExpense({ ...expense, description: e.target.value })}
                      />
                    </label>
                    <label className="span2">
                      Category
                      <select
                        value={expense.category}
                        onChange={(e) => setExpense({ ...expense, category: e.target.value })}
                      >
                        {CATS.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                    <button
                      className="primary span2"
                      disabled={busy}
                    >
                      <Plus size={17} /> Save expense
                    </button>
                  </form>
                </section>
                <section className="panel infoPanel">
                  <div className="infoArt">
                    <ReceiptText size={36} />
                  </div>
                  <h3>Every expense matters.</h3>
                  <p>
                    Log spending in any month. Only expenses dated within your selected month count
                    toward its total and budgets.
                  </p>
                  <div className="miniStat">
                    <span>Selected month</span>
                    <strong>{month}</strong>
                  </div>
                  <div className="miniStat">
                    <span>Monthly total</span>
                    <strong>{money(data?.total)}</strong>
                  </div>
                </section>
              </div>
              <section className="panel">
                <div className="sectionHead">
                  <div>
                    <h3>Transactions for {month}</h3>
                    <p>{entries.length} recorded expenses</p>
                  </div>
                </div>
                <div className="filterBar">
                  <label>
                    <Search size={16} />
                    <input
                      placeholder="Search expenses..."
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    />
                  </label>
                  <select
                    value={catFilter}
                    onChange={(e) => setCatFilter(e.target.value)}
                  >
                    <option>All</option>
                    {CATS.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                  <small>{filteredEntries.length} shown</small>
                </div>
                <ExpenseTable
                  entries={filteredEntries}
                  onDelete={remove}
                />
              </section>
            </>
          )}
          {screen === 'Budgets' && (
            <>
              {(() => {
                const { from, to } = getPeriodRange(month, period, weekNum, halfNum);
                const isPastPeriod = to <= today;
                const isPeriodStarted = today >= from;
                const isCycleLocked = activeCycle && today < activeCycle.to;
                const selectedCatBudget = categories.find(
                  (c) => c.category === budget.category,
                )?.limit;
                const isSaved = selectedCatBudget !== null && selectedCatBudget !== undefined;
                const isLocked = isSaved || isPastPeriod;
                const [y, m] = month.split('-').map(Number);
                const dim = new Date(y, m, 0).getDate();
                const mn = [
                  'Jan',
                  'Feb',
                  'Mar',
                  'Apr',
                  'May',
                  'Jun',
                  'Jul',
                  'Aug',
                  'Sep',
                  'Oct',
                  'Nov',
                  'Dec',
                ][m - 1];
                return (
                  <>
                    <div className="twoSection">
                      <section className="panel">
                        <div className="sectionHead">
                          <div>
                            <h3>
                              {isPastPeriod
                                ? `Past Period — ${getPeriodLabel(month, period, weekNum, halfNum)}`
                                : isSaved
                                  ? `Budget Locked — ${budget.category} (${money(selectedCatBudget)})`
                                  : 'Set a budget limit'}
                            </h3>
                            <p>
                              {isPastPeriod
                                ? `Ended on ${to} — Cannot create past budget`
                                : isSaved
                                  ? `Next edit available on/after ${to}`
                                  : isCycleLocked
                                    ? `Active: ${getPeriodLabel(activeCycle.month, activeCycle.period, activeCycle.weekNum, activeCycle.halfNum)} (running until ${activeCycle.to})`
                                    : `Budget window: ${getPeriodLabel(month, period, weekNum, halfNum)}`}
                            </p>
                          </div>
                          <span className="iconBg purple">
                            <Target size={20} />
                          </span>
                        </div>
                        <form
                          onSubmit={setLimit}
                          className="formGrid"
                        >
                          <label className="span2">
                            Budget duration / cycle
                            <select
                              value={period}
                              disabled={isCycleLocked || isSaved}
                              onChange={(e) => {
                                setPeriod(e.target.value);
                                localStorage.setItem('pluscode-period', e.target.value);
                              }}
                            >
                              <option value="weekly">Weekly</option>
                              <option value="15days">15 Days (Half-month)</option>
                              <option value="monthly">Monthly</option>
                              <option value="quarterly">Quarterly (3 Months)</option>
                              <option value="yearly">Yearly</option>
                            </select>
                          </label>
                          {period === 'weekly' && (
                            <label className="span2">
                              Select week
                              <select
                                value={weekNum}
                                disabled={isCycleLocked || isSaved}
                                onChange={(e) => setWeekNum(Number(e.target.value))}
                              >
                                <option value={1}>
                                  1st Week (1–7 {mn})
                                  {today >= `${month}-08` ? ' — ⚠️ Past (Ended)' : ''}
                                </option>
                                <option value={2}>
                                  2nd Week (8–14 {mn})
                                  {today >= `${month}-08` && today < `${month}-15`
                                    ? ' — 🟢 Current'
                                    : today >= `${month}-15`
                                      ? ' — ⚠️ Past (Ended)'
                                      : ''}
                                </option>
                                <option value={3}>
                                  3rd Week (15–21 {mn})
                                  {today >= `${month}-15` && today < `${month}-22`
                                    ? ' — 🟢 Current'
                                    : today >= `${month}-22`
                                      ? ' — ⚠️ Past (Ended)'
                                      : ''}
                                </option>
                                <option value={4}>
                                  4th Week & remaining days (22–${dim} {mn})
                                  {today >= `${month}-22` ? ' — 🟢 Current' : ''}
                                </option>
                              </select>
                            </label>
                          )}
                          {period === '15days' && (
                            <label className="span2">
                              Select half
                              <select
                                value={halfNum}
                                disabled={isCycleLocked || isSaved}
                                onChange={(e) => setHalfNum(Number(e.target.value))}
                              >
                                <option value={1}>
                                  1st Half (1–15 {mn})
                                  {today >= `${month}-16`
                                    ? ' — ⚠️ Past (Ended)'
                                    : today <= `${month}-15`
                                      ? ' — 🟢 Current'
                                      : ''}
                                </option>
                                <option value={2}>
                                  2nd Half (16–${dim} {mn})
                                  {today >= `${month}-16` ? ' — 🟢 Current' : ''}
                                </option>
                              </select>
                            </label>
                          )}
                          <label className="span2">
                            Category
                            <select
                              value={budget.category}
                              onChange={(e) => {
                                setBudget({ category: e.target.value, limit: '' });
                              }}
                            >
                              {CATS.map((c) => (
                                <option key={c}>{c}</option>
                              ))}
                            </select>
                          </label>
                          <label className="span2">
                            Budget limit (₹)
                            <input
                              type="number"
                              required={!isLocked}
                              min="0.01"
                              max="9999999999.99"
                              step="0.01"
                              disabled={isLocked || !isPeriodStarted}
                              placeholder={
                                isPastPeriod
                                  ? 'Past period cannot be edited'
                                  : isSaved
                                    ? String(selectedCatBudget)
                                    : 'e.g. 2000'
                              }
                              value={
                                isPastPeriod
                                  ? ''
                                  : isSaved
                                    ? budget.limit || selectedCatBudget
                                    : budget.limit
                              }
                              onChange={(e) => setBudget({ ...budget, limit: e.target.value })}
                            />
                          </label>
                          {isPastPeriod && (
                            <div className="activeCycleBanner span2 warningLocked">
                              <AlertTriangle size={16} />
                              <span>
                                <strong>Past period alert!</strong>
                                <br />
                                {getPeriodLabel(month, period, weekNum, halfNum)} already{' '}
                                <strong>{to}</strong> ko khatam ho chuka hai. Past period ka budget
                                nahi banaya ja sakta. Kripya current period (jaise 2nd Week: 8–14
                                Oct) select karein.
                              </span>
                            </div>
                          )}
                          {!isPastPeriod && isSaved && (
                            <div className="activeCycleBanner span2 warningLocked">
                              <ShieldCheck size={16} />
                              <span>
                                <strong>
                                  {budget.category} budget of {money(selectedCatBudget)} is saved &
                                  locked!
                                </strong>
                                <br />
                                Aap agli nayi budget limit ya edit <strong>{to}</strong> ko hi kar
                                payenge.
                              </span>
                            </div>
                          )}
                          {!isPastPeriod && !isSaved && isCycleLocked && (
                            <div className="activeCycleBanner span2">
                              <AlertTriangle size={15} />
                              <span>
                                Active{' '}
                                <strong>
                                  {getPeriodLabel(
                                    activeCycle.month,
                                    activeCycle.period,
                                    activeCycle.weekNum,
                                    activeCycle.halfNum,
                                  )}
                                </strong>{' '}
                                budget is in progress until <strong>{activeCycle.to}</strong>. You
                                can only create or edit budgets after this period ends.
                              </span>
                            </div>
                          )}
                          {!isPeriodStarted && (
                            <div className="activeCycleBanner span2">
                              <CalendarDays size={15} />
                              <span>
                                This period starts on <strong>{from}</strong>. You can set limits
                                once it begins.
                              </span>
                            </div>
                          )}
                          <button
                            className={'primary span2' + (isLocked ? ' btnLocked' : '')}
                            disabled={busy || isLocked || !isPeriodStarted}
                            type={isLocked ? 'button' : 'submit'}
                          >
                            <Target size={16} />
                            {isPastPeriod
                              ? '❌ Past period cannot be saved'
                              : isSaved
                                ? `🔒 Next edit on/after ${to}`
                                : !isPeriodStarted
                                  ? 'Period not started'
                                  : 'Save limit'}
                          </button>
                        </form>
                      </section>
                      <section className="panel infoPanel">
                        <span className="iconBg orange">
                          <AlertTriangle size={22} />
                        </span>
                        <h3>Automatic budget alerts</h3>
                        <p>
                          Warnings begin at 80% of your total budget. A clear over-budget message
                          appears when spending goes above 100%.
                        </p>
                        <div className="miniStat">
                          <span>At exactly 80%</span>
                          <strong className="amber">Warning</strong>
                        </div>
                        <div className="miniStat">
                          <span>Above 100%</span>
                          <strong className="red">Over budget</strong>
                        </div>
                      </section>
                    </div>
                    <section className="panel">
                      <div className="sectionHead">
                        <div>
                          <h3>Budget limits — {getPeriodLabel(month, period, weekNum, halfNum)}</h3>
                          <p>
                            {categories.filter((c) => c.limit !== null).length} of {CATS.length}{' '}
                            categories configured
                          </p>
                        </div>
                        <button
                          className="clearAllBtn"
                          onClick={() => setClearConfirmOpen(true)}
                          title="Clear all budgets for this month"
                        >
                          <Trash2 size={14} /> Clear all (
                          {categories.filter((c) => c.limit !== null).length})
                        </button>
                      </div>
                      <div className="budgetGrid">
                        {categories.map((c, i) => {
                          const isTileLocked = c.limit !== null;
                          return (
                            <div
                              key={c.category}
                              className={
                                'budgetTile' +
                                (budget.category === c.category && screen === 'Budgets'
                                  ? ' budgetTileActive'
                                  : '')
                              }
                            >
                              <div className="budgetTileHead">
                                <span
                                  className="dot"
                                  style={{ background: COLORS[i] }}
                                />
                                <h3>{c.category}</h3>
                                {c.limit !== null && (
                                  <button
                                    className="tileResetBtn"
                                    title="Reset this budget to 0"
                                    onClick={() => resetBudget(c.category)}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>
                              <strong>{c.limit === null ? 'Not set' : money(c.limit)}</strong>
                              <p>{money(c.spent)} spent</p>
                              <div className="track">
                                <div
                                  style={{
                                    background: c.status === 'over' ? '#ef4444' : COLORS[i],
                                    width: c.limit
                                      ? Math.min(100, (c.spent / c.limit) * 100) + '%'
                                      : '0%',
                                  }}
                                />
                              </div>
                              <small
                                className={
                                  c.status === 'over'
                                    ? 'red'
                                    : c.status === 'warning'
                                      ? 'amber'
                                      : ''
                                }
                              >
                                {c.status === 'over'
                                  ? 'Over budget'
                                  : c.status === 'warning'
                                    ? '80% budget warning'
                                    : c.limit === null
                                      ? 'No limit yet'
                                      : 'On track'}
                              </small>
                              {isTileLocked && (
                                <span className="lockNotice">🔒 Next edit on/after ${to}</span>
                              )}
                              {c.limit === null && !isPastPeriod && isPeriodStarted && (
                                <button
                                  className="tileEditBtn"
                                  onClick={() => setBudget({ category: c.category, limit: '' })}
                                >
                                  <Plus size={12} /> Set limit
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  </>
                );
              })()}
            </>
          )}
          {screen === 'Import CSV' && (
            <>
              <section className="panel importPanel">
                <div className="importIcon">
                  <Upload size={30} />
                </div>
                <h2>Import your expenses</h2>
                <p>
                  Upload a CSV file with columns <code>date,amount,description,category</code>. Use
                  dates in YYYY-MM-DD format and one of Food, Travel, Study or Other.
                </p>
                <form onSubmit={importCSV}>
                  <input
                    required
                    name="file"
                    type="file"
                    accept=".csv,text/csv"
                  />
                  <button
                    className="primary"
                    disabled={busy}
                  >
                    <Upload size={17} />
                    {busy ? 'Importing...' : 'Import CSV'}
                  </button>
                </form>
                <div className="sampleNote">
                  <FileDown size={19} />
                  <div>
                    <strong>Need a test file?</strong>
                    <p>Includes multiple months and 3 invalid rows to test validation.</p>
                  </div>
                  <a
                    href="/sample-expenses.csv"
                    download
                  >
                    Download sample CSV
                  </a>
                </div>
              </section>
              {importResult && (
                <section className="panel results">
                  <div className="sectionHead">
                    <div>
                      <h3>Import results</h3>
                      <p>Invalid rows are reported, not silently skipped.</p>
                    </div>
                  </div>
                  <div className="resultStats">
                    <div>
                      <strong>{importResult.imported}</strong>
                      <span>Imported</span>
                    </div>
                    <div>
                      <strong>{importResult.duplicates}</strong>
                      <span>Duplicates skipped</span>
                    </div>
                    <div>
                      <strong>{importResult.invalid.length}</strong>
                      <span>Rows need correction</span>
                    </div>
                  </div>
                  {importResult.invalid.length > 0 && (
                    <div className="invalids">
                      <h3>
                        <AlertTriangle size={18} /> Rows requiring correction
                      </h3>
                      <div className="tableWrap">
                        <table>
                          <thead>
                            <tr>
                              <th>CSV row</th>
                              <th>Problem</th>
                              <th>Submitted values</th>
                            </tr>
                          </thead>
                          <tbody>
                            {importResult.invalid.map((r, i) => (
                              <tr key={i}>
                                <td>{r.row}</td>
                                <td className="red">{r.errors.join('; ')}</td>
                                <td>
                                  <code>{JSON.stringify(r.values)}</code>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p>
                        Correct these rows in your CSV and import again. Previously imported valid
                        rows will be skipped.
                      </p>
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </div>
        {profileOpen && (
          <div
            className="tourOverlay"
            role="dialog"
            aria-modal="true"
            aria-label="User profile"
            onClick={() => setProfileOpen(false)}
          >
            <div
              className="tourCard profileModalCard"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="tourTop">
                <span className="profileTopTag">
                  <ShieldCheck size={16} /> STUDENT PROFILE
                </span>
                <button
                  aria-label="Close profile"
                  onClick={() => setProfileOpen(false)}
                >
                  <X size={19} />
                </button>
              </div>
              <div className="profileModalHeader">
                <div className="profileAvatarBig">
                  {user?.name?.charAt(0)?.toUpperCase() || 'S'}
                </div>
                <div className="profileModalInfo">
                  <h3>{user?.name || 'Student Account'}</h3>
                  <p>{user?.email || 'student@pluscode.local'}</p>
                  <div className="profileBadgesRow">
                    <span className="profileRoleBadge">
                      <GraduationCap size={13} /> Student Member
                    </span>
                    <span className="profileStatusBadge">🟢 Verified</span>
                  </div>
                </div>
              </div>
              <div className="profileStatsGrid">
                <div className="profileStatCard">
                  <small>Month Spent</small>
                  <strong>{money(data?.total)}</strong>
                  <span>In {month}</span>
                </div>
                <div className="profileStatCard">
                  <small>Transactions</small>
                  <strong>{data?.count || 0}</strong>
                  <span>Logged</span>
                </div>
                <div className="profileStatCard">
                  <small>Active Cycle</small>
                  <strong style={{ fontSize: '12px' }}>
                    {getPeriodLabel(month, period, weekNum, halfNum)}
                  </strong>
                  <span>Running</span>
                </div>
              </div>
              <div className="profileActionsRow">
                <button
                  type="button"
                  className="topbarBtn"
                  onClick={() => {
                    setProfileOpen(false);
                    runTour();
                  }}
                >
                  <Lightbulb size={15} /> Guided Tour
                </button>
                <button
                  type="button"
                  className="logoutBtnDanger"
                  onClick={() => {
                    setProfileOpen(false);
                    logout();
                  }}
                >
                  <LogOut size={15} /> Sign Out
                </button>
              </div>
            </div>
          </div>
        )}
        {clearConfirmOpen && (
          <div
            className="tourOverlay"
            role="dialog"
            aria-modal="true"
            aria-label="Re-verify Clear All Budgets"
          >
            <div className="tourCard budgetAlertCard">
              <div className="tourTop">
                <span style={{ color: '#dc2626' }}>
                  <AlertTriangle size={18} /> RE-VERIFY ACTION
                </span>
                <button
                  aria-label="Close dialog"
                  onClick={() => setClearConfirmOpen(false)}
                >
                  <X size={19} />
                </button>
              </div>
              <div style={{ margin: '18px 0' }}>
                <h3 style={{ fontSize: '19px', margin: '0 0 10px', color: '#111827' }}>
                  Kya aap sabhi budgets clear karna chahte hain?
                </h3>
                <p style={{ color: '#4b5563', fontSize: '14px', lineHeight: 1.6, margin: 0 }}>
                  {categories.filter((c) => c.limit !== null).length > 0
                    ? `Yeh action ${getPeriodLabel(month, period, weekNum, halfNum)} ke sabhi ${categories.filter((c) => c.limit !== null).length} category limits ko reset (0) kar dega aur current budget period lock ko unlock kar dega.`
                    : `Abhi koi limit set nahi hai. Yeh action active budget cycle (${getPeriodLabel(month, period, weekNum, halfNum)}) ko reset aur unlock kar dega.`}
                </p>
                <div
                  style={{
                    marginTop: '14px',
                    padding: '11px 14px',
                    background: '#fef2f2',
                    border: '1px solid #fee2e2',
                    borderRadius: '10px',
                    color: '#991b1b',
                    fontSize: '13px',
                  }}
                >
                  ⚠️ <strong>Dhyan dein:</strong> Clear karne ke baad sabhi category limits reset ho
                  jayengi aur aap naye sire se limits configure kar payenge.
                </div>
              </div>
              <div className="tourActions">
                <button
                  type="button"
                  onClick={() => setClearConfirmOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  style={{
                    background: '#dc2626',
                    color: 'white',
                    border: 0,
                    borderRadius: '8px',
                    padding: '9px 16px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                  onClick={async () => {
                    setClearConfirmOpen(false);
                    await executeClearAllBudgets();
                  }}
                >
                  <Trash2 size={16} /> Yes, Clear All (
                  {categories.filter((c) => c.limit !== null).length})
                </button>
              </div>
            </div>
          </div>
        )}
        {budgetAlert && (
          <div
            className="tourOverlay"
            role="dialog"
            aria-modal="true"
            aria-label="Budget alert"
          >
            <div className="tourCard budgetAlertCard">
              <div className="tourTop">
                <span>
                  <AlertTriangle size={17} /> BUDGET ALERT
                </span>
                <button
                  aria-label="Close alert"
                  onClick={() => setBudgetAlert(null)}
                >
                  <X size={19} />
                </button>
              </div>
              <div className="budgetAlertBody">
                {budgetAlert.map((c) => (
                  <div
                    key={c.category}
                    className={'budgetAlertRow ' + (c.status === 'over' ? 'over' : 'warn')}
                  >
                    <span className={'iconBg ' + (c.status === 'over' ? 'alertRed' : 'alertAmber')}>
                      <AlertTriangle size={20} />
                    </span>
                    <div>
                      <strong>
                        {c.status === 'over' ? 'Over budget!' : '80% budget warning'} — {c.category}
                      </strong>
                      <p>
                        {money(c.spent)} spent of {money(c.limit)} limit{' '}
                        <span className={'alertPct ' + (c.status === 'over' ? 'red' : 'amber')}>
                          ({Math.round((c.spent / c.limit) * 100)}%)
                        </span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="tourActions">
                <button onClick={() => setBudgetAlert(null)}>Dismiss</button>
                <button
                  className="primary"
                  onClick={() => {
                    setBudgetAlert(null);
                    setScreen('Budgets');
                  }}
                >
                  <Target size={16} /> View Budgets
                </button>
              </div>
            </div>
          </div>
        )}
        {tour >= 0 && (
          <div
            className="tourOverlay"
            role="dialog"
            aria-modal="true"
            aria-label="Getting started tour"
          >
            <div className="tourCard">
              <div className="tourTop">
                <span>
                  <Sparkles size={17} /> GETTING STARTED
                </span>
                <button
                  aria-label="Close tour"
                  onClick={() => setTour(-1)}
                >
                  <X size={19} />
                </button>
              </div>
              <div className="tourDots">
                {TOUR.map((_, i) => (
                  <i
                    key={i}
                    className={i <= tour ? 'done' : ''}
                  />
                ))}
              </div>
              <small>
                STEP {tour + 1} OF {TOUR.length}
              </small>
              <h2>{TOUR[tour].title}</h2>
              <p>{TOUR[tour].description}</p>
              <div className="tourActions">
                <button onClick={() => setTour(-1)}>Skip tour</button>
                <div>
                  {tour > 0 && (
                    <button
                      onClick={() => {
                        setTour(tour - 1);
                        setScreen(TOUR[tour - 1].screen);
                      }}
                    >
                      <ArrowLeft size={16} /> Back
                    </button>
                  )}
                  <button
                    className="primary"
                    onClick={() => {
                      if (tour === TOUR.length - 1) setTour(-1);
                      else {
                        setTour(tour + 1);
                        setScreen(TOUR[tour + 1].screen);
                      }
                    }}
                  >
                    {tour === TOUR.length - 1 ? 'Finish tour' : 'Next'} <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        <footer>© {now.getFullYear()} pluscode · Student Expense Tracker</footer>
      </main>
    </div>
  );
}
function ExpenseTable({ entries, onDelete }) {
  if (!entries.length)
    return (
      <div className="empty">
        <ReceiptText size={29} />
        <p>No transactions in this month yet.</p>
      </div>
    );
  return (
    <div className="tableWrap expenseTableWrap">
      <table className="expenseTable">
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Description</th>
            <th scope="col">Category</th>
            <th scope="col">Amount</th>
            <th scope="col">
              <span className="srOnly">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id}>
              <td data-label="Date">{e.date}</td>
              <td data-label="Description">
                <strong>{e.description}</strong>
              </td>
              <td data-label="Category">
                <span className="categoryTag">{e.category}</span>
              </td>
              <td
                data-label="Amount"
                className="amount"
              >
                {money(e.amount)}
              </td>
              <td data-label="Actions">
                <button
                  aria-label={'Delete expense: ' + e.description}
                  title="Delete expense"
                  className="deleteBtn"
                  onClick={() => onDelete(e.id)}
                >
                  <Trash2 size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export default App;
