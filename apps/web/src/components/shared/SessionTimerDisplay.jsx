import { useEffect, useState } from 'react';
import { getSessionToken } from '../../services/api';
import { getSessionRemainingMs } from '../../services/sessionIdleState';

/**
 * Shows remaining session time before inactivity logout (VHA 6500 / SessionManager).
 * @param {'bar'|'inline'} variant - bar: light text on navy system bar; inline: on light panels
 */
export default function SessionTimerDisplay({ className = '', variant = 'bar' }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!getSessionToken()) return undefined;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  if (!getSessionToken()) return null;

  const totalSec = Math.ceil(getSessionRemainingMs() / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const label = m >= 1 ? `${m}m` : `${s}s`;

  const warn = totalSec <= 60;
  const caution = totalSec > 60 && totalSec <= 300;

  const tone =
    variant === 'inline'
      ? (warn ? 'text-red-600' : caution ? 'text-amber-800' : 'text-text-secondary')
      : (warn ? 'text-red-400' : caution ? 'text-amber-300' : 'text-white/70');

  return (
    <span
      className={`text-[11px] font-medium tabular-nums ${tone} ${className}`}
      title="Time until session ends from inactivity (resets when you use the app)"
    >
      Session: {label}
    </span>
  );
}
