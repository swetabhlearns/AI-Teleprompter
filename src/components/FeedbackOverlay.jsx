import { useMemo } from 'react';

/**
 * FeedbackOverlay Component
 * Real-time visual feedback for eye contact and posture
 */
export function FeedbackOverlay({
    eyeContact,
    posture,
    isActive = false,
    mediaPipeReady = false,
    mediaPipeLoading = false
}) {
    const feedbackItems = useMemo(() => {
        const items = [];

        if (!isActive) return items;

        // Eye contact feedback
        if (eyeContact && !eyeContact.isLookingAtCamera) {
            let message = '👁️ Look at the camera';

            if (eyeContact.direction === 'left') {
                message = '👁️ Look right (to camera)';
            } else if (eyeContact.direction === 'right') {
                message = '👁️ Look left (to camera)';
            } else if (eyeContact.direction === 'down') {
                message = '👁️ Eyes up!';
            } else if (eyeContact.direction === 'up') {
                message = '👁️ Eyes down a bit';
            } else if (eyeContact.direction === 'no face') {
                message = '👤 Face not detected';
            }

            items.push({
                id: 'eye-contact',
                message,
                type: eyeContact.direction === 'no face' ? 'danger' : 'warning',
                priority: 1
            });
        }

        // Posture feedback
        if (posture && !posture.isGood && posture.issues) {
            posture.issues.forEach((issue, idx) => {
                let emoji = '🧍';
                let type = 'warning';

                if (issue.toLowerCase().includes('slouch') || issue.toLowerCase().includes('straight')) {
                    emoji = '🪑';
                    type = 'danger';
                } else if (issue.includes('close') || issue.includes('back')) {
                    emoji = '↔️';
                } else if (issue.includes('far') || issue.includes('closer')) {
                    emoji = '↔️';
                } else if (issue.includes('tilt')) {
                    emoji = '🔄';
                } else if (issue.includes('shoulder')) {
                    emoji = '💪';
                }

                items.push({
                    id: `posture - ${idx} `,
                    message: `${emoji} ${issue} `,
                    type,
                    priority: 2
                });
            });
        }

        // Sort by priority
        return items.sort((a, b) => a.priority - b.priority);
    }, [eyeContact, posture, isActive]);

    // Good feedback indicator
    const showGoodFeedback = isActive &&
        mediaPipeReady &&
        eyeContact?.isLookingAtCamera &&
        posture?.isGood &&
        feedbackItems.length === 0;

    if (!isActive) return null;

    return (
        <div className="feedback-overlay">
            {/* MediaPipe loading state */}
            {mediaPipeLoading && (
                <div
                    className="animate-fade-in"
                    style={{
                        padding: '12px 16px',
                        background: 'rgba(99, 102, 241, 0.9)',
                        borderRadius: '12px',
                        fontSize: '13px',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                    }}
                >
                    <div
                        className="spinner"
                        style={{ width: '16px', height: '16px', borderWidth: '2px' }}
                    />
                    <span>Loading AI tracking...</span>
                </div>
            )}

            {/* Not ready state (after loading failed or not supported) */}
            {!mediaPipeLoading && !mediaPipeReady && (
                <div
                    className="animate-fade-in"
                    style={{
                        padding: '12px 16px',
                        background: 'rgba(245, 158, 11, 0.9)',
                        borderRadius: '12px',
                        fontSize: '13px',
                        color: '#000',
                        fontWeight: '500'
                    }}
                >
                    ⚠️ Eye/posture tracking unavailable
                </div>
            )}

            {/* Warning/Error badges */}
            {feedbackItems.map((item, index) => (
                <div
                    key={item.id}
                    className={`feedback - badge ${item.type} animate - slide -in `}
                    style={{ animationDelay: `${index * 0.1} s` }}
                >
                    {item.message}
                </div>
            ))}

            {/* Good posture indicator */}
            {showGoodFeedback && (
                <div className="feedback-badge success animate-fade-in">
                    ✅ Great form! Keep it up!
                </div>
            )}

            {/* Live stats panel - only show when MediaPipe is ready and we have data */}
            {isActive && mediaPipeReady && (eyeContact || posture) && (
                <div
                    className="glass animate-fade-in"
                    style={{
                        marginTop: '12px',
                        padding: '14px 16px',
                        borderRadius: '14px',
                        minWidth: '160px'
                    }}
                >
                    <div style={{ fontSize: '11px', fontWeight: '600', color: 'rgba(255,255,255,0.5)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Live Tracking
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {/* Eye Contact */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>Eye Contact</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <div
                                    style={{
                                        width: '8px',
                                        height: '8px',
                                        borderRadius: '50%',
                                        background: eyeContact?.isLookingAtCamera ? '#10b981' : '#f59e0b',
                                        boxShadow: eyeContact?.isLookingAtCamera ? '0 0 8px #10b981' : 'none'
                                    }}
                                />
                                <span style={{
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    color: eyeContact?.isLookingAtCamera ? '#10b981' : '#f59e0b'
                                }}>
                                    {eyeContact ? (eyeContact.isLookingAtCamera ? 'Good' : eyeContact.direction) : '—'}
                                </span>
                            </div>
                        </div>

                        {/* Posture Score */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>Posture</span>
                            <span style={{
                                fontSize: '13px',
                                fontWeight: '600',
                                color: (posture?.score ?? 0) >= 80 ? '#10b981' : (posture?.score ?? 0) >= 50 ? '#f59e0b' : '#ef4444'
                            }}>
                                {posture?.score ?? '—'}/100
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default FeedbackOverlay;
