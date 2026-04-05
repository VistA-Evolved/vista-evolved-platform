import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { login } from '../services/adminService';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const timedOut = location.state?.reason === 'timeout';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(username, password);
      if (data.ok) {
        navigate('/dashboard');
      } else {
        setError(data.error || data.message || 'Invalid credentials. Please try again.');
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

          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 bg-navy text-white text-sm font-semibold rounded-md hover:bg-steel transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-xs text-text-muted text-center mt-6">
          Session timeout: 15 minutes of inactivity
        </p>
      </div>
    </div>
  );
}
