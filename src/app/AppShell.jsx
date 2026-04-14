import { useEffect } from 'react';
import { Outlet, useRouterState, Link } from '@tanstack/react-router';
import { usePostHog } from 'posthog-js/react';
import { useAppStore } from '../stores/appStore';

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
      posthog.capture('route_changed', { route: pathname.replace('/', '') || 'script' });
    }
  }, [pathname, posthog]);

  return (
    <div className="app-shell min-h-screen flex min-h-0 flex-col bg-surface text-text relative">
      <header className="app-shell-nav-header">
        <nav className="app-shell-nav-inline" aria-label="Primary">
          <Link to="/script" className="refined-nav-tab">
            Script
          </Link>
          <Link to="/interview" className="refined-nav-tab">
            Interview
          </Link>
          <Link to="/extempore" className="refined-nav-tab">
            Extempore
          </Link>
        </nav>
      </header>

      <main className="refined-shell-main reveal reveal-delay-1 min-h-0">
        <Outlet />
      </main>
    </div>
  );
}

export default AppShell;
