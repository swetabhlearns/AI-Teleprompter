import { useEffect } from 'react';
import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import { usePostHog } from 'posthog-js/react';
import { useAppStore } from '../stores/appStore';

const tabs = [
  { id: 'script', label: '📝 Script', to: '/script' },
  { id: 'extempore', label: '💬 Extempore', to: '/extempore' },
  { id: 'interview', label: '🗣️ Interview', to: '/interview' }
];

export function AppShell() {
  const posthog = usePostHog();
  const pathname = useRouterState({
    select: (state) => state.location.pathname
  });
  const setActiveRoute = useAppStore((state) => state.setActiveRoute);

  useEffect(() => {
    setActiveRoute(pathname);
  }, [pathname, setActiveRoute]);

  useEffect(() => {
    if (posthog) {
      posthog.capture('tab_changed', { tab: pathname.replace('/', '') || 'script' });
    }
  }, [pathname, posthog]);

  const isPracticeRoute = pathname === '/practice';

  return (
    <div className="min-h-screen flex flex-col bg-surface text-text">
      <header className="app-shell-header refined-shell-header">
        <div className="app-shell-header-inner refined-shell-header-inner">
          <div className="app-brand">
            <div className="app-brand-mark">🎙️</div>
            <div>
              <h1 className="app-brand-title refined-brand-title">AI TRACKER</h1>
              <p className="app-brand-subtitle refined-brand-subtitle">Speech Coach</p>
            </div>
          </div>

          <nav className="tab-nav reveal app-shell-nav refined-nav">
            {tabs.map((tab) => (
              <Link
                key={tab.id}
                to={tab.to}
                className="tab refined-nav-tab"
                activeProps={{ className: 'tab refined-nav-tab active refined-nav-tab-active' }}
              >
                {tab.label}
              </Link>
            ))}
          </nav>

          <div className="app-shell-status refined-status">
            <div className="app-shell-status-dot refined-status-dot" />
            <span>Audio only</span>
          </div>
        </div>
      </header>

      <main className={isPracticeRoute ? 'practice-shell-main' : 'refined-shell-main reveal reveal-delay-1'}>
        <Outlet />
      </main>

      {!isPracticeRoute && (
        <footer className="app-shell-footer refined-shell-footer">
          <div className="app-shell-footer-inner refined-shell-footer-inner">
            <div className="app-shell-footer-brand">
              <div className="app-brand-mark app-brand-mark-footer">🎙️</div>
              <div>
                <div className="app-shell-footer-title refined-shell-footer-title">AI TRACKER</div>
                <div className="app-shell-footer-subtitle refined-shell-footer-subtitle">Built for modern creators</div>
              </div>
            </div>

            <div className="app-shell-footer-links refined-shell-footer-links">
              <a href="#">Privacy Policy</a>
              <a href="#">Terms of Service</a>
              <a href="#">How it Works</a>
            </div>

            <div className="app-shell-footer-copy refined-shell-footer-copy">
              © 2026 AI Tracker Engine. Empowering clearer voices worldwide.
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}

export default AppShell;
