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
      <div className="relative flex min-h-screen flex-col">
        <header className="sticky top-0 z-40 px-4 pb-4 pt-4 sm:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white/75 text-lg shadow-[0_14px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl">
                ✦
              </div>
            </div>

            <div className="hidden items-center gap-3 md:flex">
              <MagicBadge className={healthClass} title={workerHealthMessage || undefined}>
                {healthLabel}
              </MagicBadge>
              <MagicDock>
                <nav className="flex items-center gap-1" aria-label="Primary">
                  <MagicDockLink to="/script" active={pathname.startsWith('/script')}>
                    Script
                  </MagicDockLink>
                  <MagicDockLink to="/interview" active={pathname.startsWith('/interview')}>
                    Interview
                  </MagicDockLink>
                  <MagicDockLink to="/extempore" active={pathname.startsWith('/extempore')}>
                    Extempore
                  </MagicDockLink>
                </nav>
              </MagicDock>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 pb-6 pt-2 sm:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-[1600px] min-h-0 flex-1 flex-col">
            <Outlet />
          </div>
        </main>
      </div>
    </MagicBackground>
  );
}

export default AppShell;
