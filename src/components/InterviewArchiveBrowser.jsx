function formatArchiveDate(timestamp) {
    if (!timestamp) return 'Saved locally';

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
    onReuse,
    onExport,
    onDelete
}) {
    return (
        <div className="glass-strong mt-5 p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                    <h3 className="text-lg font-semibold text-text">Recent Interviews</h3>
                    <p className="text-xs text-on-surface-variant">
                        Stored locally in your browser. Sessions survive refreshes and can be exported as JSON.
                    </p>
                </div>
                <div className="text-xs text-on-surface-variant">
                    {isLoading ? 'Loading archive...' : `${sessions.length} saved`}
                </div>
            </div>

            {error && (
                <div className="mb-4 rounded-sm border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                    {error}
                </div>
            )}

            {sessions.length === 0 && !isLoading ? (
                <div className="rounded-sm border border-dashed border-outline-variant bg-surface-container-low px-4 py-6 text-sm text-on-surface-variant">
                    Finished interviews will appear here once you complete a session.
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {sessions.slice(0, 8).map((session) => (
                        <div
                            key={session.id}
                            className="rounded-sm border border-outline-variant bg-surface-container-low p-4"
                        >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h4 className="truncate text-sm font-semibold text-text">
                                            {session.title}
                                        </h4>
                                        <span className="rounded-full border border-outline-variant bg-surface px-2 py-0.5 text-[10px] uppercase tracking-[0.05em] text-on-surface-variant">
                                            {session.mode === 'live' ? 'Gemini 3.1 Flash Live' : 'Groq'}
                                        </span>
                                        <span className="rounded-full border border-outline-variant bg-surface px-2 py-0.5 text-[10px] uppercase tracking-[0.05em] text-on-surface-variant">
                                            {session.status}
                                        </span>
                                    </div>
                                    <p className="mt-1 text-xs text-on-surface-variant">
                                        {session.college || 'Unspecified college'} • {session.interviewType || 'general'} • {session.questionCount || 0} questions • {session.turnCount || 0} turns
                                    </p>
                                    <p className="mt-2 line-clamp-2 text-xs text-on-surface-variant">
                                        {session.previewText || 'No preview available yet.'}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-on-surface-variant">
                                <span>Updated {formatArchiveDate(session.updatedAt || session.createdAt)}</span>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => onReuse?.(session.id)}
                                    className="btn btn-primary px-4 py-2 text-sm"
                                >
                                    Reuse Setup
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onExport?.(session.id)}
                                    className="btn btn-secondary px-4 py-2 text-sm"
                                >
                                    Export
                                </button>
                                {onDelete && (
                                    <button
                                        type="button"
                                        onClick={() => onDelete?.(session.id)}
                                        className="btn btn-secondary px-4 py-2 text-sm"
                                    >
                                        Delete
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default InterviewArchiveBrowser;
