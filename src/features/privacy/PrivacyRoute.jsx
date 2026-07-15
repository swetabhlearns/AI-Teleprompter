import { Link } from '@tanstack/react-router';
import { ArrowLeft, Browser, Cloud, Database, ShieldCheck } from '@phosphor-icons/react';
import { MagicBadge, MagicButton, MagicCard, MagicSectionHeader } from '../../components/ui/MagicUI';

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
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 py-4">
      <MagicCard className="p-6 md:p-9" hover={false}>
        <MagicSectionHeader
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
          <li><span className="font-semibold text-slate-900">Feedback and operational events:</span> There is not yet a self-service deletion interface because the beta has no accounts. Defining retention and deletion support is a launch gate before general availability.</li>
          <li><span className="font-semibold text-slate-900">Authentication:</span> The beta uses a random browser capability rather than a login. Clearing browser storage creates a new anonymous identity and removes access to data associated with the old capability.</li>
        </ul>
        <MagicButton as={Link} to="/history" variant="secondary" className="mt-7"><ArrowLeft size={18} /> Return to History</MagicButton>
      </MagicCard>
    </div>
  );
}

export default PrivacyRoute;
