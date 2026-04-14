import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import LoginIntroPreview from '../components/shared/LoginIntroPreview';
import { changeExpiredPassword, getPublicLoginConfig, login } from '../services/adminService';

/** Map tenant-admin / VistA broker errors to clear, actionable copy (Section 4 / 7.3). */
function mapLoginError(err) {
  const expiredMsg = 'Your password has expired. Please enter a new password below.';
  const wrongCreds = 'Invalid credentials. Please check your username and password.';
  const vistaDown = 'System is currently unavailable. Please try again later.';
  const locked = 'Your account has been locked after multiple failed attempts. Contact your administrator.';

  if (err.name !== 'ApiError') {
    return {
      message: err.message || 'Unable to connect to the server. Please check your connection.',
      passwordExpired: false,
    };
  }

  const code = err.code || '';
  const raw = (err.message || '').toLowerCase();
  const status = err.status;

  if (status === 429) {
    return {
      message: err.message || 'Too many login attempts. Please wait and try again.',
      passwordExpired: false,
    };
  }

  if (code === 'PASSWORD_EXPIRED' || code === 'VERIFY_EXPIRED') {
    return { message: expiredMsg, passwordExpired: true };
  }
  if (code === 'VISTA_UNAVAILABLE' || code === 'VISTA_DOWN') {
    return { message: vistaDown, passwordExpired: false };
  }
  if (code === 'ACCOUNT_LOCKED' || code === 'LOCKED') {
    return { message: locked, passwordExpired: false };
  }
  if (code === 'ACCOUNT_DISABLED') {
    return {
      message: 'Your account has been deactivated. Contact your system administrator to restore access.',
      passwordExpired: false,
    };
  }
  if (code === 'INVALID_CREDENTIALS') {
    return { message: err.message || wrongCreds, passwordExpired: false };
  }

  if (raw.includes('locked') || raw.includes('lockout')) {
    return { message: locked, passwordExpired: false };
  }
  if (raw.includes('disabled') || raw.includes('disuser')) {
    return {
      message: 'Your account has been deactivated. Contact your system administrator to restore access.',
      passwordExpired: false,
    };
  }
  if (raw.includes('expired') || raw.includes('verify code')) {
    return { message: expiredMsg, passwordExpired: true };
  }
  if (/tcp|timeout|econnrefused|unavailable|network|connection refused|etimedout|enotfound/i.test(raw)) {
    return { message: vistaDown, passwordExpired: false };
  }
  if (raw.includes('not found') || raw.includes('no such')) {
    return { message: 'Username not found. Check your username and try again.', passwordExpired: false };
  }

  if (code === 'UNKNOWN' || !code) {
    return { message: wrongCreds, passwordExpired: false };
  }

  return { message: err.message || wrongCreds, passwordExpired: false };
}

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordExpired, setPasswordExpired] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [loginConfig, setLoginConfig] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const timedOut = location.state?.reason === 'timeout';

  useEffect(() => { document.title = 'Sign In — VistA Evolved'; }, []);

  useEffect(() => {
    let cancelled = false;
    getPublicLoginConfig()
      .then((result) => {
        if (!cancelled) setLoginConfig(result?.data || null);
      })
      .catch(() => {
        if (!cancelled) setLoginConfig(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(username, password);
      if (data.ok) {
        const returnTo = sessionStorage.getItem('ve-return-to');
        sessionStorage.removeItem('ve-return-to');
        navigate(returnTo || '/dashboard');
      }
    } catch (err) {
      const mapped = mapLoginError(err);
      setError(mapped.message);
      setPasswordExpired(mapped.passwordExpired);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-alt flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-navy">VistA Evolved</h1>
          <p className="text-sm text-text-secondary mt-1">Healthcare Information System</p>
        </div>

        <div className="mb-4">
          <LoginIntroPreview
            heading="System notice"
            helperText="Live intro text configured in VistA Kernel."
            siteName={loginConfig?.siteName}
            domain={loginConfig?.domain}
            production={loginConfig?.production}
            message={loginConfig?.introMessage}
          />
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-4">
          <h2 className="text-lg font-semibold text-text">Sign In</h2>

          {timedOut && !error && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800">
              <span className="material-symbols-outlined text-[18px] mt-0.5">timer_off</span>
              Your session expired due to inactivity. Please sign in again.
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 bg-danger-bg rounded-md text-sm text-danger">
              <span className="material-symbols-outlined text-[18px] mt-0.5">error</span>
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              autoFocus
              className="w-full h-10 px-3 border border-border rounded-md text-sm text-text focus:outline-none focus:border-steel focus:ring-1 focus:ring-steel"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full h-10 px-3 border border-border rounded-md text-sm text-text focus:outline-none focus:border-steel focus:ring-1 focus:ring-steel"
            />
            {Number.isFinite(Number(loginConfig?.lockoutAttempts)) && Number(loginConfig?.lockoutAttempts) > 0 && (
              <p className="mt-2 text-xs text-text-secondary">
                Account lockout threshold: {loginConfig.lockoutAttempts} failed attempt{Number(loginConfig.lockoutAttempts) === 1 ? '' : 's'}. Remaining attempts are shown after each failed sign-in.
              </p>
            )}
          </div>

          <div className="flex justify-end">
            <Link to="/forgot-password" className="text-xs text-steel hover:underline">Forgot password?</Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 bg-navy text-white text-sm font-semibold rounded-md hover:bg-steel transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {passwordExpired && (
          <form onSubmit={async (e) => {
            e.preventDefault();
            setError('');
            if (newPassword.length < 8) { setError('New password must be at least 8 characters.'); return; }
            if (newPassword !== confirmNewPassword) { setError('Passwords do not match.'); return; }
            if (newPassword === password) { setError('New password must be different from the current password.'); return; }
            setLoading(true);
            try {
              await changeExpiredPassword(username, password, newPassword);
              setPasswordExpired(false);
              setPassword('');
              setNewPassword('');
              setConfirmNewPassword('');
              setError('');
              const data = await login(username, newPassword);
              if (data.ok) {
                const returnTo = sessionStorage.getItem('ve-return-to');
                sessionStorage.removeItem('ve-return-to');
                navigate(returnTo || '/dashboard');
              }
            } catch (err) {
              const mapped = mapLoginError(err);
              setError(mapped.message || err.message || 'Failed to change password. Contact your system administrator.');
            } finally { setLoading(false); }
          }} className="bg-white rounded-lg shadow-md p-6 space-y-4 mt-4">
            <h2 className="text-lg font-semibold text-text">Change Password</h2>
            <p className="text-sm text-text-secondary">Your password has expired. Enter a new password to continue.</p>
            <div>
              <label className="block text-sm font-medium text-text mb-1">New Password</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={8} maxLength={20}
                className="w-full h-10 px-3 border border-border rounded-md text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-text mb-1">Confirm New Password</label>
              <input type="password" value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)} required
                className="w-full h-10 px-3 border border-border rounded-md text-sm" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full h-10 bg-navy text-white text-sm font-semibold rounded-md hover:bg-steel transition-colors disabled:opacity-50">
              {loading ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        )}

        <p className="text-xs text-text-muted text-center mt-6">
          Session timeout: 15 minutes of inactivity
        </p>
      </div>
    </div>
  );
}
