import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSessionToken, setSessionToken } from '../../services/api';
import { SESSION_TIMEOUT_MS, touchSessionActivity, getSessionRemainingMs } from '../../services/sessionIdleState';

/**
 * Session Timeout Manager
 *
 * VHA Directive 6500 requires auto-logout after 15 minutes of inactivity.
 * This component monitors user activity and enforces the timeout.
 *
 * Activity events: mouse, keyboard, scroll, touch.
 * Warning shown 2 minutes before timeout.
 */

const TIMEOUT_MS = SESSION_TIMEOUT_MS;
const WARNING_MS = 2 * 60 * 1000;    // Show warning 2 min before logout
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart'];

export default function SessionManager() {
  const navigate = useNavigate();
  const timerRef = useRef(null);
  const warningTimerRef = useRef(null);
  const [showWarning, setShowWarning] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const countdownRef = useRef(null);

  const [idleBannerSec, setIdleBannerSec] = useState(0);
  useEffect(() => {
    if (!getSessionToken()) return undefined;
    const tick = () => setIdleBannerSec(Math.ceil(getSessionRemainingMs() / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [showWarning]);

  const doLogout = useCallback(() => {
    setSessionToken(null);
    setShowWarning(false);
    clearInterval(countdownRef.current);
    navigate('/login', { state: { reason: 'timeout' } });
  }, [navigate]);

  const resetTimers = useCallback(() => {
    if (!getSessionToken()) return;

    touchSessionActivity();

    clearTimeout(timerRef.current);
    clearTimeout(warningTimerRef.current);
    clearInterval(countdownRef.current);
    setShowWarning(false);

    // Warning timer: fires 2 min before logout
    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      setRemaining(WARNING_MS / 1000);
      countdownRef.current = setInterval(() => {
        setRemaining(prev => {
          if (prev <= 1) {
            clearInterval(countdownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, TIMEOUT_MS - WARNING_MS);

    // Logout timer
    timerRef.current = setTimeout(doLogout, TIMEOUT_MS);
  }, [doLogout]);

  useEffect(() => {
    if (!getSessionToken()) return;

    resetTimers();

    const onActivity = () => {
      if (showWarning) return; // Don't reset if warning is showing — user must click "Continue"
      resetTimers();
    };

    ACTIVITY_EVENTS.forEach(evt => document.addEventListener(evt, onActivity, { passive: true }));

    return () => {
      ACTIVITY_EVENTS.forEach(evt => document.removeEventListener(evt, onActivity));
      clearTimeout(timerRef.current);
      clearTimeout(warningTimerRef.current);
      clearInterval(countdownRef.current);
    };
  }, [resetTimers, showWarning]);

  const handleContinue = () => {
    setShowWarning(false);
    resetTimers();
  };

  /** Between 5 min and 2 min left: visible strip before the modal (last 2 min). */
  const showIdleBanner = !showWarning && idleBannerSec > 120 && idleBannerSec <= 300;

  if (!showWarning && !showIdleBanner) return null;

  const bannerMins = Math.floor(idleBannerSec / 60);
  const bannerSecs = idleBannerSec % 60;
  const warnMins = Math.floor(remaining / 60);
  const warnSecs = remaining % 60;

  return (
    <>
      {showIdleBanner && (
        <div
          className="fixed top-10 left-0 right-0 z-[9998] flex justify-center px-4 py-2 bg-amber-100 border-b border-amber-300 text-amber-950 text-sm font-medium shadow-sm"
          role="status"
          aria-live="polite"
        >
          <span className="material-symbols-outlined text-[18px] mr-2" aria-hidden>schedule</span>
          Session expires in{' '}
          <strong className="font-mono mx-1">
            {bannerMins}:{bannerSecs.toString().padStart(2, '0')}
          </strong>
          — move the mouse or press a key to extend your session.
        </div>
      )}
      {showWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <div className="bg-white rounded-lg shadow-xl w-[400px] p-6 text-center">
            <span className="material-symbols-outlined text-[48px] text-amber-500 mb-3 block">timer</span>
            <h2 className="text-lg font-bold text-[#1A1A2E] mb-2">Session Timeout Warning</h2>
            <p className="text-sm text-[#666] mb-4">
              Your session will expire due to inactivity in{' '}
              <strong className="text-red-600 font-mono">
                {warnMins}:{warnSecs.toString().padStart(2, '0')}
              </strong>
            </p>
            <p className="text-xs text-[#999] mb-5">
              Per VHA Directive 6500, sessions auto-lock after 15 minutes of inactivity.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                type="button"
                onClick={handleContinue}
                className="px-6 py-2.5 text-sm font-medium bg-[#1A1A2E] text-white rounded-md hover:bg-[#2E5984] transition-colors"
              >
                Continue Working
              </button>
              <button
                type="button"
                onClick={doLogout}
                className="px-6 py-2.5 text-sm font-medium border border-[#E2E4E8] rounded-md hover:bg-[#F5F8FB] transition-colors"
              >
                Sign Out Now
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
