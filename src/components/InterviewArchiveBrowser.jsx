import { MagicBadge, MagicButton, MagicCard, MagicSectionHeader } from './ui/MagicUI';

function formatArchiveDate(timestamp) {
    if (!timestamp) return 'Saved';

    try {
        return new Intl.DateTimeFormat(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short'
        }).format(new Date(timestamp));
    } catch {
        return timestamp;
    }
}

export function InterviewArchiveBrowser({
    sessions = [],
    isLoading = false,
    error = null,
    onView,
    onReuse,
    onExport,
    onDelete
}) {
    return (
        <MagicCard className="mt-5 p-5 md:p-6">
            <MagicSectionHeader
                eyebrow="Interview Archive"
                title="Recent sessions"
                description="Stored by the AI Tracker Worker. Sessions survive refreshes and can be exported as JSON."
                right={(
                    <MagicBadge>{isLoading ? 'Loading...' : `${sessions.length} saved`}</MagicBadge>
                )}
            />

            {error && (
                <div className="mb-4 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {error}
                </div>
            )}

            {sessions.length === 0 && !isLoading ? (
                <div className="rounded-[18px] border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
                    Finished interviews will appear here once you complete a session.
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {sessions.slice(0, 8).map((session) => (
                        <div
                            key={session.id}
                            className="rounded-[22px] border border-slate-200 bg-white/75 p-4 shadow-[0_14px_32px_rgba(15,23,42,0.05)]"
                        >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h4 className="truncate text-sm font-semibold text-slate-950">
                                            {session.title}
                                        </h4>
                                        <span className="inline-flex min-h-[32px] items-center rounded-full border border-slate-200 bg-white/75 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                                            {session.mode === 'live' ? 'Gemini 3.1 Flash Live' : 'Worker'}
                                        </span>
                                        <span className="inline-flex min-h-[32px] items-center rounded-full border border-slate-200 bg-white/75 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                                            {session.status}
                                        </span>
                                    </div>
                                    <p className="mt-1 text-xs text-slate-500">
                                        {session.college || 'Unspecified college'} • {session.interviewType || 'general'} • {session.questionCount || 0} questions • {session.turnCount || 0} turns
                                    </p>
                                    <p className="mt-2 line-clamp-2 text-xs text-slate-500">
                                        {session.previewText || 'No preview available yet.'}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                                <span>Updated {formatArchiveDate(session.updatedAt || session.createdAt)}</span>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                                {session.status === 'completed' ? (
                                    <MagicButton
                                        type="button"
                                        onClick={() => onView?.(session.id)}
                                        className="!min-h-10 !px-4 !py-2 text-sm"
                                    >
                                        View Report
                                    </MagicButton>
                                ) : null}
                                <MagicButton
                                    type="button"
                                    onClick={() => onReuse?.(session.id)}
                                    variant="secondary"
                                    className="!min-h-10 !px-4 !py-2 text-sm"
                                >
                                    Reuse Setup
                                </MagicButton>
                                <MagicButton
                                    type="button"
                                    onClick={() => onExport?.(session.id)}
                                    variant="secondary"
                                    className="!min-h-10 !px-4 !py-2 text-sm"
                                >
                                    Export
                                </MagicButton>
                                {onDelete && (
                                    <MagicButton
                                        type="button"
                                        onClick={() => onDelete?.(session.id)}
                                        variant="secondary"
                                        className="!min-h-10 !px-4 !py-2 text-sm"
                                    >
                                        Delete
                                    </MagicButton>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </MagicCard>
    );
}

export default InterviewArchiveBrowser;
