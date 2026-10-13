import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  Circle,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { supabase, configured, createRegistrationClient } from './api.js';
import Logo from './Logo.jsx';
import { passwordRequirements, registerStudent, signInStudent } from './student-auth.js';

function PasswordField({ value, onChange, disabled, registering }) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="studentField">
      Password
      <div className="studentPassword">
        <input
          required
          minLength={registering ? 8 : undefined}
          type={visible ? 'text' : 'password'}
          autoComplete={registering ? 'new-password' : 'current-password'}
          aria-describedby={registering ? 'studentPasswordRequirements' : undefined}
          value={value}
          disabled={disabled}
          onChange={onChange}
          placeholder={registering ? 'Create your password' : 'Enter your password'}
        />
        <button
          type="button"
          aria-label={visible ? 'Hide password' : 'Show password'}
          disabled={disabled}
          onClick={() => setVisible((old) => !old)}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </label>
  );
}

export default function StudentAuth({
  onSignedIn,
  onDemo,
  onAdmin,
  pendingRegistrationSession,
  onRegistrationFinished,
}) {
  const registrationClient = useMemo(() => createRegistrationClient(), []);
  const [mode, setMode] = useState('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const submitting = useRef(false);
  const registering = mode === 'register';

  function switchMode(next) {
    if (submitting.current) return;
    setMode(next);
    setPassword('');
    setError('');
    setNotice('');
  }

  async function submit(event) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (registering) {
        const result = await registerStudent(registrationClient, { email, password });
        if (pendingRegistrationSession) await onRegistrationFinished?.();
        setEmail(result.email);
        setPassword('');
        setMode('login');
        setNotice(
          result.alreadyRegistered
            ? 'Your account is ready. Sign in with your email and this password.'
            : 'Account created. Sign in with your email and the password you just chose.',
        );
      } else {
        const session = await signInStudent(supabase, { email, password });
        setPassword('');
        onSignedIn(session);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="studentAuth">
      <aside className="studentAuthHero">
        <Logo />
        <div className="studentHeroBody">
          <span className="studentHeroPill">YOUR MONEY. YOUR NEXT CHAPTER.</span>
          <h1>
            A better start
            <br />
            for your <em>money.</em>
          </h1>
          <p>Track your spending, plan your budgets and make room for what matters.</p>
          <div className="studentHeroSteps">
            <span>
              <Mail size={20} />
              <div>
                <strong>One email, one account</strong>
                <small>Your email becomes your sign-in username.</small>
              </div>
            </span>
            <span>
              <KeyRound size={20} />
              <div>
                <strong>A password you choose</strong>
                <small>Include a capital letter, a special character and at least 3 digits.</small>
              </div>
            </span>
            <span>
              <Sparkles size={20} />
              <div>
                <strong>Start tracking right away</strong>
                <small>Create your account, then sign in and plan your spending.</small>
              </div>
            </span>
          </div>
        </div>
        <small className="studentHeroFooter">pluscode · Simple money management for students</small>
      </aside>
      <main className="studentAuthMain">
        <div className="studentAuthCard">
          <div className="studentMobileBrand">
            <Logo />
          </div>
          <div
            className="studentAuthTabs"
            aria-label="Account access"
          >
            <button
              type="button"
              className={!registering ? 'active' : ''}
              disabled={busy}
              onClick={() => switchMode('login')}
            >
              Sign in
            </button>
            <button
              type="button"
              className={registering ? 'active' : ''}
              disabled={busy}
              onClick={() => switchMode('register')}
            >
              Create account
            </button>
          </div>
          <span className="eyebrow">YOUR STUDENT ACCOUNT</span>
          <h2>{registering ? 'Create your account' : 'Welcome back'}</h2>
          <p className="studentAuthDescription">
            {registering
              ? 'Enter your email and choose a password. Then sign in to start tracking your expenses.'
              : 'Your email is your username. Sign in with the password you chose.'}
          </p>
          {pendingRegistrationSession && !error && (
            <div
              className="error"
              role="alert"
            >
              Your earlier registration was not completed. Contact the project administrator to
              restore that account, or register with another email.
            </div>
          )}
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
              className="studentAuthNotice"
              role="status"
            >
              <Check size={17} />
              <span>{notice}</span>
            </div>
          )}
          {!configured && (
            <div className="error">
              Registration is unavailable until the project is configured.
            </div>
          )}
          <form onSubmit={submit}>
            <label className="studentField">
              {registering ? 'Email address' : 'Email / username'}
              <input
                required
                type="email"
                maxLength={254}
                autoComplete={registering ? 'email' : 'username'}
                placeholder="you@example.com"
                value={email}
                disabled={busy}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError('');
                  setNotice('');
                }}
              />
            </label>
            <PasswordField
              key={mode}
              value={password}
              registering={registering}
              disabled={busy}
              onChange={(event) => setPassword(event.target.value)}
            />
            {registering && (
              <ul
                id="studentPasswordRequirements"
                className="studentPasswordRequirements"
                aria-label="Password requirements"
              >
                {passwordRequirements(password).map((rule) => (
                  <li
                    key={rule.label}
                    className={rule.met ? 'met' : ''}
                  >
                    {rule.met ? (
                      <Check
                        size={15}
                        aria-hidden="true"
                      />
                    ) : (
                      <Circle
                        size={15}
                        aria-hidden="true"
                      />
                    )}
                    <span>
                      <span className="srOnly">{rule.met ? 'Met: ' : 'Required: '}</span>
                      {rule.label}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <button
              className="primary studentSubmit"
              disabled={busy || !configured}
            >
              {busy ? 'Please wait...' : registering ? 'Register' : 'Sign in'}
              <ArrowRight size={18} />
            </button>
          </form>
          {!registering && (
            <div className="studentDemoEntry">
              <span>Want to explore first?</span>
              <button
                type="button"
                disabled={busy}
                onClick={onDemo}
              >
                <Sparkles size={16} /> Try demo
              </button>
            </div>
          )}
          <div className="studentAdminEntry">
            <button
              type="button"
              disabled={busy}
              onClick={onAdmin}
            >
              <ShieldCheck size={15} /> Administrator login
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
