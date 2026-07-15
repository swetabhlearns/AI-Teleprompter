import { Suspense } from 'react';

function RouteLoading() {
  return (
    <div
      className="flex min-h-[50vh] items-center justify-center rounded-[28px] border border-slate-200/80 bg-white/70 px-6 text-center shadow-[0_24px_80px_rgba(15,23,42,0.06)] backdrop-blur-xl"
      role="status"
      aria-live="polite"
    >
      <div>
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-600" aria-hidden="true" />
        <p className="mt-4 text-sm font-medium text-slate-600">Opening your workspace…</p>
      </div>
    </div>
  );
}

export function RouteSuspense({ children }) {
  return <Suspense fallback={<RouteLoading />}>{children}</Suspense>;
}
