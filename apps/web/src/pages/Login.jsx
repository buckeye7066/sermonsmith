import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Mail, KeyRound } from 'lucide-react';

// Same-origin redirect guard.
//
// `returnUrl.startsWith('/')` is NOT enough — "//evil.example" also starts
// with '/' and is treated by browsers as a scheme-relative URL, so a
// crafted login link could ship the user off-site after a successful
// authentication. We parse against our own origin and require the URL
// resolve back to it; on any mismatch (or parse error) we fall back to '/'.
export function getSafeReturnUrl(raw) {
  if (!raw) return '/';
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return '/';
    if (url.pathname === '/' && url.hash.startsWith('#/')) {
      return url.hash.slice(1) || '/';
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/';
  }
}

export default function Login() {
  // Modes: 'login' | 'register' | 'forgot' | 'reset'
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { checkAppState } = useAuth();
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get('return');
  const resetToken = searchParams.get('reset_token');
  // We capture the reset token into state so we can blow it out of the URL
  // immediately (history.replaceState) — leaving it in the location bar
  // means it shows up in screenshots, browser history, and shareable URLs.
  const [resetTokenState, setResetTokenState] = useState(null);

  // Auto-switch to reset mode when a reset token is in the URL and scrub
  // the token from the address bar.
  useEffect(() => {
    if (resetToken) {
      setResetTokenState(resetToken);
      setMode('reset');
      try {
        navigate('/Login', { replace: true });
      } catch {
        // history API unavailable (very old browser / private mode in
        // some embedded webviews) — the token is still in the URL but we
        // tried.
      }
    }
  }, [navigate, resetToken]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'register') {
        await api.auth.register(email, password, name);
      } else {
        await api.auth.login(email, password);
      }
      // Re-sync AuthContext from the server (sets `user` + `isAuthenticated`)
      // BEFORE navigating. The login endpoint sets the httpOnly cookie, but the
      // SPA's auth state only refreshes on mount — so without this the page we
      // navigate to still believes we're logged out and the protected route
      // bounces straight back to /Login (the "logged in but everything 401s
      // until a hard reload" bug). Showing the success toast only after the
      // confirmed re-sync also stops the premature "Welcome back!" that used to
      // flash on the login screen mid-bounce.
      await checkAppState();
      toast.success(mode === 'register' ? 'Account created successfully!' : 'Welcome back!');
      const safeReturn = getSafeReturnUrl(returnUrl);
      navigate(safeReturn, { replace: true });
    } catch (error) {
      toast.error(error.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Please enter your email address');
      return;
    }
    setLoading(true);
    try {
      await api.auth.forgotPassword(email);
      toast.success('If an account with that email exists, a reset link has been sent.');
    } catch (error) {
      // Always show success to prevent email enumeration
      toast.success('If an account with that email exists, a reset link has been sent.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      // resetToken came in via the URL but we've since scrubbed it out of
      // the address bar; resetTokenState is the captured copy.
      await api.auth.resetPassword(resetTokenState || resetToken, password);
      toast.success('Password reset successful! Please sign in.');
      setResetTokenState(null);
      setMode('login');
      setPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast.error(error.message || 'Reset failed — the link may have expired');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Temporary maintenance notice — hide by setting VITE_MAINTENANCE_BANNER=off */}
        {import.meta.env.VITE_MAINTENANCE_BANNER !== 'off' && (
          <div
            role="status"
            className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 text-center"
          >
            SermonSmith is currently being updated. You can still sign in, but some
            features may be briefly unavailable. Thanks for your patience.
          </div>
        )}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-indigo-600 to-blue-500 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg">
            <svg viewBox="0 0 24 24" className="w-10 h-10 text-white" fill="currentColor">
              <path d="M11 2v8H3v2h8v8h2v-8h8v-2h-8V2z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">SermonSmith</h1>
          <p className="text-gray-500 mt-1">AI-Powered Bible Study &amp; Sermon Builder</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* ── Sign In / Register ── */}
          {(mode === 'login' || mode === 'register') && (
            <>
              <h2 className="text-xl font-semibold mb-6 text-center">
                {mode === 'register' ? 'Create Account' : 'Sign In'}
              </h2>

              <form onSubmit={handleLogin} className="space-y-4">
                {mode === 'register' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                      placeholder="Your name"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                    placeholder="you@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                    placeholder="&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 text-base"
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Please wait...</>
                  ) : mode === 'register' ? 'Create Account' : 'Sign In'}
                </Button>
              </form>

              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => setMode('forgot')}
                  className="block w-full text-center text-sm text-gray-500 hover:text-indigo-600 mt-4"
                >
                  Forgot your password?
                </button>
              )}

              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => setMode(mode === 'register' ? 'login' : 'register')}
                  className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                >
                  {mode === 'register' ? 'Already have an account? Sign In' : "Don't have an account? Register"}
                </button>
              </div>
            </>
          )}

          {/* ── Forgot Password ── */}
          {mode === 'forgot' && (
            <>
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Mail className="w-6 h-6 text-indigo-600" />
                </div>
                <h2 className="text-xl font-semibold">Reset Password</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Enter your email and we'll send you a reset link
                </p>
              </div>

              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                    placeholder="you@example.com"
                    autoFocus
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 text-base"
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...</>
                  ) : 'Send Reset Link'}
                </Button>
              </form>

              <button
                type="button"
                onClick={() => setMode('login')}
                className="flex items-center justify-center gap-1 w-full text-sm text-gray-500 hover:text-indigo-600 mt-4"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Sign In
              </button>
            </>
          )}

          {/* ── Reset Password (from email link) ── */}
          {mode === 'reset' && (
            <>
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <KeyRound className="w-6 h-6 text-green-600" />
                </div>
                <h2 className="text-xl font-semibold">Set New Password</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Choose a strong password (8+ characters)
                </p>
              </div>

              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                    placeholder="&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                    placeholder="&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 text-base"
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Resetting...</>
                  ) : 'Reset Password'}
                </Button>
              </form>

              <button
                type="button"
                onClick={() => setMode('login')}
                className="flex items-center justify-center gap-1 w-full text-sm text-gray-500 hover:text-indigo-600 mt-4"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Sign In
              </button>
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Works on iPhone, Android, Mac, Windows, and Web
        </p>
      </div>
    </div>
  );
}
