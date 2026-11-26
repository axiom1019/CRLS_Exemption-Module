import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SessionState } from '@shared/api';
import { api, errorText, setToken, setUnauthenticatedHandler } from './api/client';
import seal from './assets/seal.png';
import { Loading } from './components/ui';
import { CertificatesPage } from './pages/CertificatesPage';
import { LoginPage } from './pages/LoginPage';
import { PeoplePage } from './pages/PeoplePage';
import { SettingsPage } from './pages/SettingsPage';
import { Session, type SessionCtx } from './session';

type Page = 'records' | 'people' | 'settings';

export function App() {
  const [state, setState] = useState<SessionState | null>(null);
  const [error, setError] = useState('');
  const [page, setPage] = useState<Page>('records');

  const load = useCallback(async () => {
    try {
      setState(await api('api_session'));
      setError('');
    } catch (e) {
      setError(errorText(e));
    }
  }, []);

  useEffect(() => {
    setUnauthenticatedHandler(() => {
      setToken(null);
      void load();
    });
    void load();
  }, [load]);

  const ctx = useMemo<SessionCtx | null>(() => {
    if (!state?.me || !state.settings) return null;
    const roles = new Set<string>(state.me.user.roles);
    return { me: state.me, settings: state.settings, environment: state.environment, refresh: () => void load(), has: (...r: string[]) => r.some((x) => roles.has(x)) };
  }, [state, load]);

  if (error) return <Loading error={error} />;
  if (!state) return <Loading />;
  if (!state.initialized) {
    return (
      <div className="spinner">
        <h2>Not set up yet</h2>
        <p className="muted">The system owner runs setupDatabase once in the Apps Script editor. See the README.</p>
      </div>
    );
  }
  if (!state.me) return <LoginPage googleEmail={state.googleEmail} denied={state.denied} onSignedIn={load} />;
  if (!ctx) return <Loading />;

  const admin = ctx.has('ADMIN');
  const nav: [Page, string, boolean][] = [
    ['records', 'Certificates', true],
    ['people', 'People', admin],
    ['settings', 'Settings and log', admin],
  ];
  const visible = nav.filter((n) => n[2]);
  const current = visible.some((n) => n[0] === page) ? page : 'records';

  return (
    <Session.Provider value={ctx}>
      {state.environment !== 'production' && <div className="env">{state.environment.toUpperCase()}: test copy. Records here are not official.</div>}
      <header className="topbar">
        <div className="inner">
          <div className="brand">
            <img src={seal} alt="" />
            <div>
              <div className="t1">DHSUD Region 10</div>
              <div className="t2">Certificate Verification</div>
            </div>
          </div>
          <div className="spacer" />
          <div className="who">
            <b>{ctx.me.user.fullName}</b>
            {ctx.me.user.email}
          </div>
          <button
            className="btn-link-light"
            onClick={async () => {
              try {
                await api('api_signOut');
              } finally {
                setToken(null);
                void load();
              }
            }}
          >
            Sign out
          </button>
        </div>
      </header>
      <nav className="tabs" aria-label="Sections">
        <div className="inner">
          {visible.map(([k, label]) => (
            <button key={k} aria-current={current === k ? 'page' : undefined} onClick={() => setPage(k)}>
              {label}
            </button>
          ))}
        </div>
      </nav>
      <main>
        {current === 'records' && <CertificatesPage />}
        {current === 'people' && <PeoplePage />}
        {current === 'settings' && <SettingsPage />}
      </main>
    </Session.Provider>
  );
}
