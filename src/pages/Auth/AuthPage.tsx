import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Turnstile } from '@marsidev/react-turnstile';
import { supabase } from '../../supabaseClient';
import fullLogo from '../../assets/fullLogo.png';
import { GoogleAuthButton } from '../../components/GoogleAuthButton';

const AuthPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Pick the correct site key for localhost/LAN vs anything else.
  const isLAN =
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1' ||
    location.hostname.startsWith('192.168.');

  const siteKey =
    (isLAN
      ? import.meta.env.VITE_TURNSTILE_SITE_KEY_DEV
      : import.meta.env.VITE_TURNSTILE_SITE_KEY_PROD) ||
    // safety fallback so the widget still renders if one var is missing
    import.meta.env.VITE_TURNSTILE_SITE_KEY_DEV;

  // --- New: Google Sign-in handler (Supabase OAuth with PKCE) ---
  const handleGoogleLogin = async () => {
    try {
      setError(null);
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'Google sign-in failed.');
      console.error('Google OAuth error:', err);
    }
  };


  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    if (!turnstileToken) {
      setError('Please complete the CAPTCHA challenge.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          'cf-turnstile-response': turnstileToken,
        }),
      });

      const contentType = response.headers.get('content-type') || '';
      let data: any = null;

      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const rawText = await response.text();
        console.error('Unexpected /api/login response:', rawText);
        throw new Error('Unexpected response from the server. Please try again.');
      }

      if (!response.ok) {
        throw new Error(data.message || 'An error occurred.');
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      if (sessionError) throw new Error(sessionError.message);

      navigate('/');
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred. Please try again.');
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 font-sans">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-2xl shadow-lg">
        <div className="flex justify-center">
          <img src={fullLogo} alt="Zuproc Logo" className="h-12 w-auto" />
        </div>

        <h2 className="text-2xl font-bold text-center text-gray-800">Welcome Back</h2>

        <form className="mt-8 space-y-6" onSubmit={handleFormSubmit}>
          <div>
            <label htmlFor="email-address" className="sr-only">Email address</label>
            <input
              id="email-address"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 text-gray-700 bg-gray-100 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
              placeholder="Email address"
            />
          </div>

          <div>
            <label htmlFor="password" className="sr-only">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 text-gray-700 bg-gray-100 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
              placeholder="Password"
            />
          </div>

          <div className="flex items-center justify-end">
            <div className="text-sm">
              <Link
                to="/forgot-password"
                className="font-medium text-blue-600 hover:text-blue-500"
              >
                Forgot your password?
              </Link>
            </div>
          </div>

          {/* Turnstile */}
          <div className="flex justify-center">
            <Turnstile
              siteKey={siteKey}
              onSuccess={(token) => setTurnstileToken(token)}
              onError={() => setError('CAPTCHA could not load. Please refresh.')}
              options={{ theme: 'light' }}
            />
          </div>

          {error && <p className="text-sm text-center text-red-500">{error}</p>}

          <div className="space-y-3">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-[#1A2C4A] hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 transition-all duration-300"
            >
              {isLoading ? 'Signing In...' : 'Sign In'}
            </button>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <span className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase tracking-[0.2em] text-gray-400">
                <span className="bg-white px-3">or</span>
              </div>
            </div>

            <GoogleAuthButton onClick={handleGoogleLogin} disabled={isLoading} />
          </div>
        </form>

        <p className="text-sm text-center text-gray-600">
          Don't have an account?
          <Link to="/signup" className="ml-2 font-medium text-blue-600 hover:text-blue-500">
            Sign Up
          </Link>
        </p>
      </div>
    </div>
  );
};

export default AuthPage;

