import { useEffect } from 'react';

export function useResponsiveOverlays({
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
}) {
  const hasBudgetAlert = Boolean(budgetAlert);
  const hasTour = tour >= 0;
  useEffect(() => {
    const media = window.matchMedia('(max-width: 1024px)');
    const resize = () => {
      if (!media.matches) setSidebarOpen(false);
    };
    media.addEventListener('change', resize);
    return () => media.removeEventListener('change', resize);
  }, [setSidebarOpen]);
  useEffect(() => {
    const drawer = sidebarOpen && window.matchMedia('(max-width: 1024px)').matches;
    if (!drawer && !profileOpen && !clearConfirmOpen && !hasBudgetAlert && !hasTour) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = 'hidden';
    const surface =
      document.querySelector('.tourOverlay[role="dialog"] .tourCard') ||
      (drawer ? document.getElementById('workspace-navigation') : null);
    const focusable = () =>
      [
        ...(surface?.querySelectorAll(
          'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),[tabindex="0"]',
        ) || []),
      ].filter((el) => el.getClientRects().length);
    const frame = requestAnimationFrame(() => focusable()[0]?.focus());
    const keydown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (profileOpen) setProfileOpen(false);
        else if (clearConfirmOpen) setClearConfirmOpen(false);
        else if (hasBudgetAlert) setBudgetAlert(null);
        else if (hasTour) setTour(-1);
        else setSidebarOpen(false);
      }
      if (event.key === 'Tab') {
        const elements = focusable();
        const first = elements[0],
          last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', keydown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [
    sidebarOpen,
    profileOpen,
    clearConfirmOpen,
    hasBudgetAlert,
    hasTour,
    setSidebarOpen,
    setProfileOpen,
    setClearConfirmOpen,
    setBudgetAlert,
    setTour,
  ]);
}
