import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { authService, type McpAuthorizationRequest } from '../services/auth';
import { useAuthStore } from '../store/authStore';

export function McpAuthorizePage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [request, setRequest] = useState<McpAuthorizationRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const state = searchParams.get('state');

  useEffect(() => {
    if (!state) {
      return;
    }
    if (!isAuthenticated) {
      navigate(`/login?next=${encodeURIComponent(`${location.pathname}${location.search}`)}`, {
        replace: true,
      });
      return;
    }
    void authService
      .getMcpAuthorizationRequest(state)
      .then(setRequest)
      .catch(() => setError('This authorization request has expired.'));
  }, [isAuthenticated, location.pathname, location.search, navigate, state]);

  const finish = async (approve: boolean) => {
    if (!state) return;
    setBusy(true);
    setError(null);
    try {
      const redirectUri = approve
        ? await authService.approveMcpAuthorization(state)
        : await authService.denyMcpAuthorization(state);
      window.location.assign(redirectUri);
    } catch {
      setError('Unable to complete authorization. Please retry from your MCP client.');
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-900 px-4 text-white">
      <section className="w-full max-w-md space-y-6 rounded-2xl border border-slate-700 bg-slate-900/80 p-8 shadow-2xl">
        <div>
          <h1 className="text-2xl font-semibold">Authorize MCP access</h1>
          <p className="mt-2 text-sm text-slate-400">
            {request?.client_name ?? 'An MCP client'} is requesting access to your Lifestack data.
          </p>
        </div>
        {request && (
          <ul className="space-y-2 text-sm text-slate-300">
            {request.scopes.map((scope) => (
              <li key={scope} className="rounded-md bg-slate-800 px-3 py-2">
                {scope}
              </li>
            ))}
          </ul>
        )}
        {(error || !state) && (
          <p className="rounded-md bg-red-500/10 p-3 text-sm text-red-300">
            {error ?? 'This authorization request is missing its state.'}
          </p>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            disabled={busy || !request}
            onClick={() => void finish(false)}
            className="flex-1 rounded-lg border border-slate-600 px-4 py-3 text-sm font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            Deny
          </button>
          <button
            type="button"
            disabled={busy || !request}
            onClick={() => void finish(true)}
            className="flex-1 rounded-lg bg-cyan-500 px-4 py-3 text-sm font-medium text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
          >
            Allow access
          </button>
        </div>
      </section>
    </main>
  );
}
