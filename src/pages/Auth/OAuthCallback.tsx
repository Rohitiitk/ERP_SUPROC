import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import Loader from '../../components/Loader';

// Parse URL hash fragments like "#access_token=...&refresh_token=..."
function parseHashFragment(hash: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!hash || !hash.startsWith('#')) return out;
  hash
    .slice(1)
    .split('&')
    .forEach((kv) => {
      const [k, v] = kv.split('=');
      if (k) out[decodeURIComponent(k)] = decodeURIComponent(v || '');
    });
  return out;
}

const OAuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const { search, hash } = useLocation();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const params = new URLSearchParams(search);
        const next = params.get('next') || '/';

        // 0) If we *already* have a session, skip parsing and go home.
        const existing = await supabase.auth.getSession();
        if (existing.data.session) {
          navigate(next, { replace: true });
          return;
        }

        // Provider sent an explicit error?
        const urlErr = params.get('error') || params.get('error_code');
        const urlErrDesc = params.get('error_description');
        if (urlErr) {
          const check = await supabase.auth.getSession();
          if (check.data.session) {
            navigate(next, { replace: true });
            return;
          }
          throw new Error(urlErrDesc || urlErr);
        }

        // 1) PKCE path: ?code=...
        const code = params.get('code');
        if (code) {
          const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
          if (exErr) throw exErr;

          // Optional: ensure profile row (if you didn't add the DB trigger)
          const { data: userData } = await supabase.auth.getUser();
          const user = userData?.user;
          if (user) {
            const full_name = (user.user_metadata as any)?.full_name || user.email?.split('@')[0] || '';
            const avatar_url = (user.user_metadata as any)?.avatar_url || null;
            await supabase
              .from('profiles')
              .upsert({ id: user.id, full_name, avatar_url, role: 'simple' }, { onConflict: 'id' });
          }

          // NEW: verify session before leaving (ensures Authorization header on next requests)
          const { data: sess } = await supabase.auth.getSession();
          if (!sess.session) {
            throw new Error('Session not established after OAuth exchange.');
          }

          navigate(next, { replace: true });
          return;
        }

        // 2) Implicit/Hybrid fallback: tokens arrive in the hash fragment
        const h = parseHashFragment(hash);
        if (h.error) {
          const check = await supabase.auth.getSession();
          if (check.data.session) {
            navigate(next, { replace: true });
            return;
          }
          throw new Error(h.error_description || h.error);
        }
        if (h.access_token && h.refresh_token) {
          const { error: sessErr } = await supabase.auth.setSession({
            access_token: h.access_token,
            refresh_token: h.refresh_token,
          });
          if (sessErr) throw sessErr;

          const { data: userData } = await supabase.auth.getUser();
          const user = userData?.user;
          if (user) {
            const full_name = (user.user_metadata as any)?.full_name || user.email?.split('@')[0] || '';
            const avatar_url = (user.user_metadata as any)?.avatar_url || null;
            await supabase
              .from('profiles')
              .upsert({ id: user.id, full_name, avatar_url, role: 'simple' }, { onConflict: 'id' });
          }

          // NEW: verify session before leaving (ensures Authorization header on next requests)
          const { data: sess } = await supabase.auth.getSession();
          if (!sess.session) {
            throw new Error('Session not established after OAuth exchange.');
          }

          navigate(next, { replace: true });
          return;
        }

        // 3) Nothing usable: if user somehow already has a session, allow through; else send to login
        const finalCheck = await supabase.auth.getSession();
        if (finalCheck.data.session) {
          navigate(next, { replace: true });
          return;
        }
        navigate('/login?oauth=missing_params', { replace: true });
      } catch (e: any) {
        console.error(e);
        const check = await supabase.auth.getSession();
        if (check.data.session) {
          const params = new URLSearchParams(search);
          const next = params.get('next') || '/';
          navigate(next, { replace: true });
          return;
        }
        setError(e?.message || 'OAuth callback failed.');
      }
    })();
  }, [navigate, search, hash]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="bg-white p-6 rounded-xl shadow-md w-full max-w-md">
          <h1 className="text-lg font-semibold mb-2">Sign-in error</h1>
          <p className="text-sm text-red-600">{error}</p>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => navigate('/login', { replace: true })}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white"
            >
              Back to Sign in
            </button>
            <button
              onClick={() => navigate('/', { replace: true })}
              className="px-4 py-2 rounded-lg bg-gray-200"
            >
              Go to Home
            </button>
          </div>
          <details className="mt-3 text-xs text-gray-600">
            <summary>Show callback URL</summary>
            <div className="mt-2 break-all">{typeof window !== 'undefined' ? window.location.href : ''}</div>
          </details>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader />
    </div>
  );
};

export default OAuthCallback;
