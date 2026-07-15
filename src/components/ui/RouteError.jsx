import { Link } from '@tanstack/react-router';
import { ArrowClockwise, House, WarningCircle } from '@phosphor-icons/react';
import { MagicButton, MagicCard } from './MagicUI';

function getRecoveryMessage(error) {
  const message = error instanceof Error ? error.message.toLowerCase() : '';

  if (!navigator.onLine) {
    return 'You appear to be offline. Reconnect, then try opening this workspace again.';
  }

  if (message.includes('dynamically imported') || message.includes('loading chunk')) {
    return 'A newer version of the application may be available. Reload to continue with the latest version.';
  }

  return 'Your saved browser data is still available. Try this screen again, or return to Script and continue from there.';
}

export function RouteError({ error, reset }) {
  const recoveryMessage = getRecoveryMessage(error);

  return (
    <MagicCard className="mx-auto flex min-h-[50vh] w-full max-w-3xl items-center justify-center p-6 text-center sm:p-10" hover={false}>
      <div className="max-w-xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-700" aria-hidden="true">
          <WarningCircle size={28} weight="duotone" />
        </div>
        <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-700">Workspace interrupted</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950">This screen could not finish loading.</h1>
        <p className="mt-4 text-sm leading-6 text-slate-600">{recoveryMessage}</p>

        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <MagicButton onClick={reset}>
            <ArrowClockwise size={18} /> Try again
          </MagicButton>
          <MagicButton variant="secondary" onClick={() => window.location.reload()}>
            Reload application
          </MagicButton>
          <MagicButton as={Link} to="/script" variant="ghost">
            <House size={18} /> Go to Script
          </MagicButton>
        </div>
      </div>
    </MagicCard>
  );
}
