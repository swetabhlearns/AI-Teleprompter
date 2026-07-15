import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, Browser, Cloud, Database, ShieldCheck } from '@phosphor-icons/react';
import { MagicBadge, MagicButton, MagicCard, MagicSectionHeader } from '../../components/ui/MagicUI';
import { workerApi } from '../../api/workerClient';

const DATA_SECTIONS = [
  {
    icon: Browser,
    title: 'Stored in this browser',
    body: 'Onboarding choices, practice goals, activity history, saved scripts, drill status, feedback receipts, and any feedback waiting to retry stay in this browser’s site storage.'
  },
  {
    icon: Cloud,
    title: 'Sent when you use AI features',
    body: 'The prompt or session data needed for the feature is sent through the Cloudflare Worker to the configured AI provider. Microphone audio is processed only when you start a voice feature.'
  },
  {
    icon: Database,
    title: 'Stored by the beta service',
    body: 'Interview archives, optional feedback, and allowlisted operational events are stored in Cloudflare D1 under a hashed anonymous browser capability. Telemetry contains route, mode, event name, sanitized error class, version, and timestamps only.'
  },
  {
    icon: ShieldCheck,
    title: 'Never included in telemetry',
    body: 'Operational events never include audio, transcripts, scripts, interview answers, prompts, profile details, feedback notes, email addresses, or names.'
  }
];

export function PrivacyRoute() {
  const [deletionState, setDeletionState] = useState('idle');
  const [deletionMessage, setDeletionMessage] = useState('');

  const deleteServiceData = async () => {
    if (!window.confirm('Delete this browser identity’s interview archives, feedback, and operational events from the beta service? This cannot be undone.')) return;
    setDeletionState('deleting');
    setDeletionMessage('');
    try {
      await workerApi.deleteBetaData();
      setDeletionState('deleted');
      setDeletionMessage('Your server-side beta data for this browser identity was deleted. Browser-local drafts and history remain on this device.');
    } catch (error) {
      setDeletionState('error');
      setDeletionMessage(error?.message || 'Deletion could not be completed. Please try again.');
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 py-4">
      <MagicCard className="p-6 md:p-9" hover={false}>
        <MagicSectionHeader
          headingLevel={1}
          eyebrow="Beta data notice"
          title="Your data, without an account"
          description="This explains the current beta behavior in plain language. It is a product data notice, not a substitute for a final legal privacy policy."
          right={<MagicBadge>Last updated · 16 Jul 2026</MagicBadge>}
        />
        <div className="mt-7 grid gap-4 md:grid-cols-2">
          {DATA_SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <section key={section.title} className="rounded-[22px] border border-slate-200 bg-white/75 p-5">
                <Icon size={24} className="text-emerald-700" aria-hidden="true" />
                <h2 className="mt-4 text-lg font-semibold text-slate-950">{section.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{section.body}</p>
              </section>
            );
          })}
        </div>
      </MagicCard>

      <MagicCard className="p-6 md:p-8" hover={false}>
        <h2 className="text-2xl font-semibold tracking-[-0.04em] text-slate-950">Controls and current limitations</h2>
        <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-600">
          <li><span className="font-semibold text-slate-900">Local data:</span> Clear the activity index from History, delete saved scripts from the library, or clear this site’s browser storage to reset all local data.</li>
          <li><span className="font-semibold text-slate-900">Interview archives:</span> Individual archived interviews can be deleted from the application.</li>
          <li><span className="font-semibold text-slate-900">Retention:</span> Operational events are retained for 30 days, optional feedback for 180 days, and interview archives for 365 days. Expired records are removed daily.</li>
          <li><span className="font-semibold text-slate-900">Server-side deletion:</span> Use the control below to delete interview archives, feedback, and operational events associated with this browser identity.</li>
          <li><span className="font-semibold text-slate-900">Authentication:</span> The beta uses a random browser capability rather than a login. Clearing browser storage creates a new anonymous identity and removes access to data associated with the old capability.</li>
        </ul>
        <div className="mt-7 flex flex-wrap gap-3">
          <MagicButton as={Link} to="/history" variant="secondary"><ArrowLeft size={18} /> Return to History</MagicButton>
          <MagicButton type="button" variant="secondary" onClick={deleteServiceData} disabled={deletionState === 'deleting'}>
            {deletionState === 'deleting' ? 'Deleting…' : 'Delete my beta service data'}
          </MagicButton>
        </div>
        {deletionMessage ? (
          <p className={`mt-4 text-sm ${deletionState === 'error' ? 'text-rose-700' : 'text-emerald-700'}`} role="status">
            {deletionMessage}
          </p>
        ) : null}
      </MagicCard>
    </div>
  );
}

export default PrivacyRoute;
