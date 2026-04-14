import { useEffect } from 'react';
import { Outlet, useRouterState } from '@tanstack/react-router';
import { usePostHog } from 'posthog-js/react';
import { useAppStore } from '../stores/appStore';
import {
  MagicBackground,
  MagicDock,
  MagicDockLink
} from '../components/ui/MagicUI';

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
    <MagicBackground>
      <div className="relative flex min-h-screen flex-col">
        <header className="sticky top-0 z-40 px-4 pb-4 pt-4 sm:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white/75 text-lg shadow-[0_14px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl">
                ✦
              </div>
            </div>

            <div className="hidden md:block">
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
