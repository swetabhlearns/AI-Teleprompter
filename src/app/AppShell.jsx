import { useEffect } from 'react';
import { Outlet, useRouterState } from '@tanstack/react-router';
import { useAppStore } from '../stores/appStore';
import { workerApi } from '../api/workerClient.js';
import {
  MagicBackground,
  MagicDock,
  MagicDockLink,
  MagicBadge
} from '../components/ui/MagicUI';

const PRIMARY_NAV_ITEMS = [
  { to: '/script', label: 'Script' },
  { to: '/interview', label: 'Interview' },
  { to: '/extempore', label: 'Extempore' },
  { to: '/history', label: 'History' }
];

export function AppShell() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname
  });
  const setActiveRoute = useAppStore((state) => state.setActiveRoute);
  const setShellReady = useAppStore((state) => state.setShellReady);
  const workerHealth = useAppStore((state) => state.workerHealth);
  const workerHealthMessage = useAppStore((state) => state.workerHealthMessage);
  const setWorkerHealth = useAppStore((state) => state.setWorkerHealth);

  useEffect(() => {
    setActiveRoute(pathname);
  }, [pathname, setActiveRoute]);

  useEffect(() => {
    setShellReady(true);
  }, [setShellReady]);

  useEffect(() => {
    let active = true;

    const checkWorkerHealth = async () => {
      if (!workerApi.hasWorkerApi()) {
        if (active) {
          setWorkerHealth('unconfigured', 'Worker API base URL is not configured');
        }
        return;
      }

      try {
        const health = await workerApi.getHealth();
        if (active) {
          setWorkerHealth(health?.status === 'healthy' ? 'healthy' : 'degraded', health?.status === 'healthy' ? '' : 'Worker responded but not healthy');
        }
      } catch (error) {
        if (active) {
          setWorkerHealth('offline', error?.message || 'Worker health check failed');
        }
      }
    };

    void checkWorkerHealth();

    return () => {
      active = false;
    };
  }, [setWorkerHealth]);

  const healthLabel = {
    healthy: 'Worker healthy',
    degraded: 'Worker degraded',
    offline: 'Worker offline',
    unconfigured: 'Worker not set'
  }[workerHealth] || 'Worker checking';

  const healthClass = {
    healthy: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    degraded: 'border-amber-200 bg-amber-50 text-amber-700',
    offline: 'border-rose-200 bg-rose-50 text-rose-700',
    unconfigured: 'border-slate-200 bg-slate-50 text-slate-600'
  }[workerHealth] || 'border-slate-200 bg-slate-50 text-slate-600';

  return (
    <MagicBackground>
      <a
        href="#main-content"
        className="sr-only z-[60] rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-xl focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2"
      >
        Skip to main content
      </a>
      <div className="relative flex min-h-screen flex-col">
        <header className="sticky top-0 z-40 px-4 pb-4 pt-4 sm:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white/75 text-lg shadow-[0_14px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl">
                ✦
              </div>
              <div className="md:hidden" role="status" aria-live="polite">
                <MagicBadge className={`${healthClass} max-w-[9.5rem] truncate`} title={workerHealthMessage || undefined}>
                  {healthLabel}
                </MagicBadge>
              </div>
            </div>

            <div className="hidden items-center gap-3 md:flex">
              <div role="status" aria-live="polite">
                <MagicBadge className={healthClass} title={workerHealthMessage || undefined}>
                  {healthLabel}
                </MagicBadge>
              </div>
              <MagicDock>
                <nav className="flex items-center gap-1" aria-label="Primary">
                  {PRIMARY_NAV_ITEMS.map((item) => (
                    <MagicDockLink key={item.to} to={item.to} active={pathname.startsWith(item.to)}>
                      {item.label}
                    </MagicDockLink>
                  ))}
                </nav>
              </MagicDock>
            </div>
          </div>
        </header>

        <main id="main-content" tabIndex="-1" className="flex-1 px-4 pb-28 pt-2 outline-none sm:px-6 md:pb-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-[1600px] min-h-0 flex-1 flex-col">
            <Outlet />
          </div>
        </main>

        <MagicDock className="fixed inset-x-3 bottom-3 z-50 rounded-[24px] !px-2 !py-2 md:hidden">
          <nav className="grid grid-cols-4 gap-1" aria-label="Primary mobile navigation">
            {PRIMARY_NAV_ITEMS.map((item) => (
              <MagicDockLink
                key={item.to}
                to={item.to}
                active={pathname.startsWith(item.to)}
                className="min-h-12 px-2 text-[11px] sm:text-xs"
              >
                {item.label}
              </MagicDockLink>
            ))}
          </nav>
        </MagicDock>
      </div>
    </MagicBackground>
  );
}

export default AppShell;
