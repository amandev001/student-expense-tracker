import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { supabase, configured, createRegistrationClient } from './api.js';
import Logo from './Logo.jsx';
import {
  createEmailRegistration,
  ExistingAccountError,
  normalizeEmail,
} from './email-registration.js';

function PasswordField({ label, value, onChange, disabled, autoComplete = 'new-password' }) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="studentField">
      {label}
      <div className="studentPassword">
        <input
          required
          minLength={8}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          disabled={disabled}
          onChange={onChange}
          placeholder="At least 8 characters"
        />
        <button
          type="button"
          aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
          disabled={disabled}
          onClick={() => setVisible((v) => !v)}
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
  const registration = useMemo(() => createEmailRegistration(createRegistrationClient()), []);
  const [mode, setMode] = useState('register');
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [resendAt, setResendAt] = useState(0);
  const [clock, setClock] = useState(Date.now);
  const [registered, setRegistered] = useState(false);
  const seconds = Math.max(0, Math.ceil((resendAt - clock) / 1000));
  const stepIndex = step === 'email' ? 0 : step === 'code' ? 1 : 2;
  useEffect(
    () => () => {
      registration.cancel().catch(() => {});
    },
    [registration],
  );
  useEffect(() => {
    if (!pendingRegistrationSession) return;
    let active = true;
    setBusy(true);
    setError('');
    registration
      .resumeVerifiedSession(pendingRegistrationSession)
      .then((verified) => {
        if (!active) return;
        setEmail(verified);
        setMode('register');
        setStep('password');
        setNotice(
          'Your email is verified. Create and confirm your password to finish your account.',
        );
      })
      .catch((err) => {
        if (active) {
          setError(err.message);
        }
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [pendingRegistrationSession?.access_token, registration]);
  useEffect(() => {
    if (mode !== 'register' || step !== 'code') return;
    setClock(Date.now());
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [mode, step]);

  async function switchMode(next) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await registration.cancel();
      if (pendingRegistrationSession) await onRegistrationFinished?.();
      setMode(next);
      setStep('email');
      setCode('');
      setPassword('');
      setConfirmation('');
      setRegistered(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  function reportError(err) {
    if (err instanceof ExistingAccountError) {
      setMode('login');
      setStep('email');
      setCode('');
      setPassword('');
      setConfirmation('');
    }
    setError(err.message);
  }
  async function sendCode() {
    const normalized = await registration.sendCode(email);
    setEmail(normalized);
    setCode('');
    setStep('code');
    setClock(Date.now());
    setResendAt(Date.now() + 60000);
    setNotice(
      `A verification code was requested for ${normalized}. Check your inbox and spam folder.`,
    );
  }
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (mode === 'login') {
        if (!supabase)
          throw Error('Supabase is not configured. Please complete the project setup.');
        const { data, error: loginError } = await supabase.auth.signInWithPassword({
          email: normalizeEmail(email),
          password,
        });
        if (loginError) throw loginError;
        if (!data?.session) throw Error('Sign-in did not finish. Please try again.');
        setPassword('');
        onSignedIn(data.session);
      } else if (step === 'email') {
        await sendCode();
      } else if (step === 'code') {
        await registration.verifyCode(email, code);
        setStep('password');
        setCode('');
        setNotice('Email verified. Choose your password to complete registration.');
      } else {
        const result = await registration.finish({ email, password, confirmation, name });
        setEmail(result.email);
        setMode('login');
        setStep('email');
        setPassword('');
        setConfirmation('');
        setRegistered(true);
        if (pendingRegistrationSession) await onRegistrationFinished?.();
        setNotice('Account created. Sign in below with your email and the password you just set.');
      }
    } catch (err) {
      reportError(err);
    } finally {
      setBusy(false);
    }
  }
  async function resend() {
    if (busy || seconds > 0) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await sendCode();
    } catch (err) {
      reportError(err);
    } finally {
      setBusy(false);
    }
  }
  async function changeEmail() {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await registration.cancel();
      if (pendingRegistrationSession) await onRegistrationFinished?.();
      setStep('email');
      setCode('');
      setPassword('');
      setConfirmation('');
    } catch (err) {
      reportError(err);
    } finally {
      setBusy(false);
    }
  }
  const title =
    mode === 'login'
      ? registered
        ? 'Your account is ready'
        : 'Welcome back'
      : step === 'email'
        ? 'Start with your email'
        : step === 'code'
          ? 'Check your inbox'
          : 'Create your password';
  const description =
    mode === 'login'
      ? 'Your registered email is your username. Use the same password you set when creating your account.'
      : step === 'email'
        ? 'We will send a 6-digit code to verify your email before you set a password.'
        : step === 'code'
          ? 'Enter the 6-digit verification code sent to your email.'
          : 'Your email is verified. Set a password you will use for every sign-in.';

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
              <ShieldCheck size={20} />
              <div>
                <strong>Verify before you begin</strong>
                <small>A 6-digit email code confirms it is you.</small>
              </div>
            </span>
            <span>
              <KeyRound size={20} />
              <div>
                <strong>A password you choose</strong>
                <small>Use it with your email whenever you return.</small>
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
              className={mode === 'login' ? 'active' : ''}
              disabled={busy}
              onClick={() => switchMode('login')}
            >
              Sign in
            </button>
            <button
              type="button"
              className={mode === 'register' ? 'active' : ''}
              disabled={busy}
              onClick={() => switchMode('register')}
            >
              Create account
            </button>
          </div>
          {mode === 'register' && (
            <ol
              className="studentSignupSteps"
              aria-label="Registration progress"
            >
              {['Email', 'Verify', 'Password'].map((label, index) => (
                <li
                  key={label}
                  className={index <= stepIndex ? 'active' : ''}
                  aria-current={index === stepIndex ? 'step' : undefined}
                >
                  <span>{index < stepIndex ? <Check size={14} /> : index + 1}</span>
                  {label}
                </li>
              ))}
            </ol>
          )}
          <span className="eyebrow">
            {mode === 'login' ? 'YOUR STUDENT ACCOUNT' : `STEP ${stepIndex + 1} OF 3`}
          </span>
          <h2>{title}</h2>
          <p className="studentAuthDescription">{description}</p>
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
              Email registration is unavailable until the project is configured.
            </div>
          )}
          <form onSubmit={submit}>
            {mode === 'login' || step === 'email' ? (
              <label className="studentField">
                {mode === 'login' ? 'Email / username' : 'Email address'}
                <input
                  required
                  type="email"
                  maxLength={254}
                  autoComplete={mode === 'login' ? 'username' : 'email'}
                  placeholder="you@example.com"
                  value={email}
                  disabled={busy}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
            ) : (
              <div className="studentVerifiedEmail">
                <Mail size={18} />
                <span>
                  <small>
                    {step === 'password' ? 'Verified email / username' : 'Verification email'}
                  </small>
                  <strong>{email}</strong>
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={changeEmail}
                >
                  Change
                </button>
              </div>
            )}
            {mode === 'login' && (
              <PasswordField
                label="Password"
                autoComplete="current-password"
                value={password}
                disabled={busy}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
            {mode === 'register' && step === 'code' && (
              <>
                <label className="studentField">
                  6-digit verification code
                  <input
                    className="studentOtpInput"
                    required
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    aria-describedby="studentOtpHelp"
                    placeholder="000000"
                    value={code}
                    disabled={busy}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  />
                </label>
                <p
                  id="studentOtpHelp"
                  className="studentFieldHelp"
                >
                  Use the code from your latest email. If it expires, request a new one.
                </p>
                <div className="studentPasswordNext">
                  <KeyRound size={18} />
                  <span>
                    <strong>Password setup is next</strong>
                    <small>
                      After verifying this code, enter and confirm the password you will use to sign
                      in.
                    </small>
                  </span>
                </div>
              </>
            )}
            {mode === 'register' && step === 'password' && (
              <>
                <label className="studentField">
                  Full name <span className="studentOptional">(optional)</span>
                  <input
                    maxLength={120}
                    autoComplete="name"
                    placeholder="Your name"
                    value={name}
                    disabled={busy}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <PasswordField
                  label="Password"
                  value={password}
                  disabled={busy}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <PasswordField
                  label="Confirm password"
                  value={confirmation}
                  disabled={busy}
                  onChange={(e) => setConfirmation(e.target.value)}
                />
                <p className="studentFieldHelp">
                  At least 8 characters. Your email stays your username.
                </p>
              </>
            )}
            <button
              className="primary studentSubmit"
              disabled={busy || !configured}
            >
              {busy
                ? 'Please wait...'
                : mode === 'login'
                  ? 'Sign in'
                  : step === 'email'
                    ? 'Send verification code'
                    : step === 'code'
                      ? 'Verify email'
                      : 'Complete registration'}
              <ArrowRight size={18} />
            </button>
          </form>
          {mode === 'register' && step === 'code' && (
            <div className="studentCodeActions">
              <button
                type="button"
                disabled={busy}
                onClick={changeEmail}
              >
                <ArrowLeft size={15} /> Change email
              </button>
              <button
                type="button"
                disabled={busy || seconds > 0}
                onClick={resend}
              >
                {seconds > 0 ? `Resend in ${seconds}s` : 'Resend code'}
              </button>
            </div>
          )}
          {mode === 'login' && (
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
              onClick={async () => {
                if (busy) return;
                setBusy(true);
                try {
                  await registration.cancel();
                  if (pendingRegistrationSession) await onRegistrationFinished?.();
                  onAdmin();
                } catch (err) {
                  setError(err.message);
                  setBusy(false);
                }
              }}
            >
              <ShieldCheck size={15} /> Administrator login
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
