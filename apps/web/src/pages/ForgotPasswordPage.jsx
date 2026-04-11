import { useState } from 'react';
import { Link } from 'react-router-dom';
import { tenantApi } from '../services/api';

export default function ForgotPasswordPage() {
  const [username, setUsername] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim()) return;
    setError('');
    setLoading(true);
    try {
      await tenantApi.post('/auth/forgot-password', { username: username.trim() });
      setSubmitted(true);
    } catch (err) {
      // Always show the same message to prevent username enumeration
      setSubmitted(true);
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

        <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
          <h2 className="text-lg font-semibold text-text">Reset Password</h2>

          {submitted ? (
            <div className="space-y-4">
              <div className="flex items-start gap-2 p-3 bg-success-bg rounded-md text-sm text-success">
                <span className="material-symbols-outlined text-[18px] mt-0.5">check_circle</span>
                If an account with that username exists and has an email address on file, a password reset link has been sent. Check your email inbox.
              </div>
              <p className="text-xs text-text-muted">
                If you don't receive an email within a few minutes, contact your system administrator to reset your password manually.
              </p>
              <Link to="/login" className="block w-full h-10 bg-navy text-white text-sm font-semibold rounded-md hover:bg-steel transition-colors text-center leading-10">
                Return to Sign In
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-text-secondary">
                Enter your username (Access Code) and we'll send a password reset link to the email address associated with your account.
              </p>

              {error && (
                <div className="flex items-start gap-2 p-3 bg-danger-bg rounded-md text-sm text-danger">
                  <span className="material-symbols-outlined text-[18px] mt-0.5">error</span>
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-text mb-1">Username (Access Code)</label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                  autoFocus
                  placeholder="e.g., JSMITH1234"
                  className="w-full h-10 px-3 border border-border rounded-md text-sm text-text focus:outline-none focus:border-steel focus:ring-1 focus:ring-steel"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !username.trim()}
                className="w-full h-10 bg-navy text-white text-sm font-semibold rounded-md hover:bg-steel transition-colors disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>

              <div className="text-center">
                <Link to="/login" className="text-xs text-steel hover:underline">Back to Sign In</Link>
              </div>
            </form>
          )}
        </div>

        <p className="text-xs text-text-muted text-center mt-6">
          If you don't have an email on file, contact your system administrator to reset your password.
        </p>
      </div>
    </div>
  );
}
