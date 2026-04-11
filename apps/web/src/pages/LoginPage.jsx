import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { login, updateCredentials } from '../services/adminService';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordExpired, setPasswordExpired] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const timedOut = location.state?.reason === 'timeout';

  useEffect(() => { document.title = 'Sign In — VistA Evolved'; }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(username, password);
      if (data.ok) {
        setFailedAttempts(0);
        // X005: Redirect back to the page the user was on before session expired
        const returnTo = sessionStorage.getItem('ve-return-to');
        sessionStorage.removeItem('ve-return-to');
        navigate(returnTo || '/dashboard');
      } else {
        // I004: Parse VistA broker errors into user-friendly messages
        const raw = data.error || data.message || '';
        const lower = raw.toLowerCase();
        if (lower.includes('locked') || lower.includes('lockout')) {
          setError('Your account has been locked due to too many failed attempts. Contact your system administrator.');
          setFailedAttempts(0);
        } else if (lower.includes('disabled') || lower.includes('disuser') || lower.includes('inactive')) {
          setError('Your account has been deactivated. Contact your system administrator to restore access.');
        } else if (lower.includes('expired') || lower.includes('verify code')) {
          setPasswordExpired(true);
          setError('Your password has expired. Please create a new password below.');
        } else if (lower.includes('not found') || lower.includes('no such')) {
          setError('Username not found. Check your username and try again.');
        } else {
          const attempts = failedAttempts + 1;
          setFailedAttempts(attempts);
          // S5.4: Show remaining attempts (VistA default lockout is 5 attempts)
          const lockoutThreshold = data.lockoutAttempts || 5;
          const remaining = Math.max(0, lockoutThreshold - attempts);
          const attemptMsg = remaining > 0
            ? ` (${remaining} attempt${remaining !== 1 ? 's' : ''} remaining before lockout)`
            : '';
          setError((raw || 'Invalid credentials. Please try again.') + attemptMsg);
        }
      }
    } catch (err) {
      if (err.name === 'ApiError') {
        setError(err.message);
      } else {
        setError('Unable to connect to the server. Please check your connection.');
      }
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

        {/* S5.2: Password change form for expired credentials */}
        {passwordExpired && (
          <form onSubmit={async (e) => {
            e.preventDefault();
            setError('');
            if (newPassword.length < 8) { setError('New password must be at least 8 characters.'); return; }
            if (newPassword !== confirmNewPassword) { setError('Passwords do not match.'); return; }
            if (newPassword === password) { setError('New password must be different from the current password.'); return; }
            setLoading(true);
            try {
              await updateCredentials(username, { accessCode: username, verifyCode: newPassword });
              setPasswordExpired(false);
              setPassword('');
              setNewPassword('');
              setConfirmNewPassword('');
              setError('');
              // Re-attempt login with new credentials
              const data = await login(username, newPassword);
              if (data.ok) {
                const returnTo = sessionStorage.getItem('ve-return-to');
                sessionStorage.removeItem('ve-return-to');
                navigate(returnTo || '/dashboard');
              } else {
                setError('Password changed successfully. Please sign in with your new password.');
              }
            } catch (err) {
              setError(err.message || 'Failed to change password. Contact your system administrator.');
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
