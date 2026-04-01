import { useState, useEffect, useRef, useCallback } from 'react';
import { formatDuration } from '../utils/formatters';
import { useSarvamTTS } from '../hooks/useSarvamTTS';

const EXT_STATES = {
    TOPIC_SELECTION: 'topic_selection',
    PRACTICE: 'practice',
    REVIEW: 'review'
};

const CATEGORIES = [
    { id: 'general', label: 'General Interest' },
    { id: 'india', label: 'India Context' },
    { id: 'tech', label: 'Technology & AI' },
    { id: 'business', label: 'Business & Economy' },
    { id: 'social', label: 'Social Issues' }
];

function ExtemporePractice({
    isRecording,
    onStartRecording,
    onStopRecording,
    generateTopics,
}) {
    const [state, setState] = useState(EXT_STATES.TOPIC_SELECTION);
    const [topics, setTopics] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('general');
    const [currentTopic, setCurrentTopic] = useState('');
    const [isGeneratingTopics, setIsGeneratingTopics] = useState(false);

    // Store recording data pending review
    const [pendingData, setPendingData] = useState(null);

    // Timer state
    const [elapsedTime, setElapsedTime] = useState(0);
    const timerRef = useRef(null);
    const didInitTopicsRef = useRef(false);

    // Sarvam TTS
    const { speak, stop: stopTTS } = useSarvamTTS();

    // robust timer logic based on recording state
    useEffect(() => {
        if (isRecording) {
            timerRef.current = setInterval(() => {
                setElapsedTime(prev => prev + 1000); // formatDuration expects ms
            }, 1000);
        } else {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [isRecording]);

    const handleGenerateTopics = useCallback(async (category) => {
        setIsGeneratingTopics(true);
        try {
            if (window.posthog) {
                window.posthog.capture('extempore_topics_generated', { category });
            }
            const newTopics = await generateTopics(category);
            setTopics(newTopics || []);
        } catch (error) {
            console.error('Failed to generate topics:', error);
        } finally {
            setIsGeneratingTopics(false);
        }
    }, [generateTopics]);

    // Initial topic generation
    useEffect(() => {
        if (didInitTopicsRef.current) {
            return;
        }
        didInitTopicsRef.current = true;
        handleGenerateTopics(selectedCategory);
    }, [handleGenerateTopics, selectedCategory]);

    const handleSelectTopic = (topic) => {
        if (window.posthog) {
            window.posthog.capture('extempore_topic_selected', {
                topic_length: topic.length
            });
        }
        setCurrentTopic(topic);
        setState(EXT_STATES.PRACTICE);
    };

    const handleStartPractice = () => {
        setElapsedTime(0);
        onStartRecording();
    };

    const handleStopPractice = async () => {
        console.log('=== ExtemporePractice handleStopPractice ===');
        // Stop recording and get the blob/result immediately
        const result = await onStopRecording();
        console.log('Result from onStopRecording:', result);
        console.log('result.blob:', result?.blob);
        console.log('result.blob size:', result?.blob?.size);

        // Normalize result
        const data = {
            blob: result?.blob || result,
            duration: result?.duration || 0
        };
        console.log('Normalized pendingData:', data);
        console.log('pendingData.blob size:', data.blob?.size);

        setPendingData(data);
        setState(EXT_STATES.REVIEW);
    };

    // Review Actions
    const handleDiscard = () => {
        if (window.posthog) {
            window.posthog.capture('extempore_review_action', { action: 'discard' });
        }
        setPendingData(null);
        setState(EXT_STATES.TOPIC_SELECTION);
    };

    const handleRetry = () => {
        if (window.posthog) {
            window.posthog.capture('extempore_review_action', { action: 'retry' });
        }
        setPendingData(null);
        setState(EXT_STATES.PRACTICE);
    };

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            stopTTS();
        };
    }, [stopTTS]);

    // Phase 1: Topic Selection
    if (state === EXT_STATES.TOPIC_SELECTION) {
        return (
            <div className="relative flex h-full flex-col overflow-y-auto rounded-sm border border-outline-variant bg-surface text-text custom-scrollbar">
                {/* Shared page container for the full topic-selection composition */}
                <div className="mx-auto flex h-full w-full max-w-[1680px] flex-col gap-8 px-4 py-8 md:px-6 lg:px-8 lg:py-10">

                    {/* Header */}
                    <div className="w-full max-w-4xl">
                        <h2 className="text-5xl font-semibold tracking-[-0.04em] text-text">Extempore Practice</h2>
                        <p className="mt-4 text-xl leading-relaxed text-on-surface-variant">
                            Challenge yourself! Choose a topic below and speak for 2-3 minutes.
                        </p>
                    </div>

                    {/* Categories */}
                    <div className="w-full">
                        <div className="flex w-full flex-wrap items-center justify-start gap-3 rounded-sm border border-outline-variant bg-surface-container-low p-2 md:gap-4">
                            {CATEGORIES.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => {
                                        setSelectedCategory(cat.id);
                                        handleGenerateTopics(cat.id);
                                    }}
                                    className={`rounded-sm px-6 py-3 text-sm font-semibold transition-all duration-200 md:px-8 ${selectedCategory === cat.id
                                        ? 'bg-primary-container text-on-primary-container'
                                        : 'text-on-surface-variant hover:bg-surface-container-high hover:text-text'
                                        }`}
                                >
                                    {cat.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Topics Grid */}
                    <div className="grid w-full grid-cols-1 gap-6 xl:grid-cols-2 xl:gap-8">
                        {isGeneratingTopics ? (
                            Array(4).fill(0).map((_, i) => (
                                <div key={i} className="min-h-64 animate-pulse rounded-sm border border-outline-variant bg-surface-container-low" />
                            ))
                        ) : (
                            topics.map((topic, i) => (
                                <button
                                    key={i}
                                    onClick={async () => {
                                        handleSelectTopic(topic);
                                        void speak(`Your topic is: ${topic}`); // Speak on selection
                                    }}
                                    className="group relative flex min-h-64 h-full flex-col justify-between rounded-sm border border-outline-variant bg-surface-container-low p-6 text-left transition-all duration-300 hover:-translate-y-1 hover:border-primary-container hover:bg-surface-container-high md:p-8"
                                >
                                    <h3 className="line-clamp-4 text-xl font-medium leading-snug text-text group-hover:text-primary-container">
                                        {topic}
                                    </h3>

                                    <div className="mt-auto flex w-full items-center justify-between border-t border-outline-variant pt-6 group-hover:border-primary-container">
                                        <span className="text-sm font-medium text-on-surface-variant transition-colors group-hover:text-text">Start Speaking</span>
                                        <div className="flex size-10 items-center justify-center rounded-sm bg-surface-container-high transition-all group-hover:bg-primary-container group-hover:text-on-primary-container">
                                            <span className="transform group-hover:translate-x-0.5 transition-transform text-lg">→</span>
                                        </div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>

                    {/* Refresh Button */}
                    <button
                        onClick={() => handleGenerateTopics(selectedCategory)}
                        className="group mt-2 flex items-center gap-3 self-start rounded-sm border border-outline-variant px-6 py-4 text-on-surface-variant transition-all hover:bg-surface-container-low hover:text-text focus:ring-2 focus:ring-primary-container/30 outline-none md:px-8"
                        disabled={isGeneratingTopics}
                    >
                        <span className="text-2xl group-hover:rotate-180 transition-transform duration-500">🔄</span>
                        <span className="font-medium text-lg">Get New Topics</span>
                    </button>

                </div>
            </div>
        );
    }

    // Phase 2: Practice (Recording)
    if (state === EXT_STATES.PRACTICE) {
        const isGoalMet = elapsedTime >= 120000; // 2 minutes (in ms)

        return (
            <div className="flex h-full flex-col gap-4 text-text">
                {/* Header Info */}
                <div className="flex items-center justify-between px-4">
                    <div>
                        <span className="text-sm uppercase tracking-wider text-on-surface-variant">Topic</span>
                        <h3 className="max-w-3xl truncate text-xl font-semibold text-text">
                            {currentTopic}
                        </h3>
                    </div>
                </div>

                {/* Audio Practice Area */}
                <div className="flex flex-1 flex-col gap-8 overflow-hidden rounded-sm border border-outline-variant bg-surface-container-low p-8">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h4 className="mb-2 text-2xl font-semibold text-text">Speak your response aloud</h4>
                            <p className="max-w-2xl text-on-surface-variant">
                                Focus on structure, clarity, and pacing. The app records audio only and analyzes your speech after you stop.
                            </p>
                        </div>

                        <div className={`rounded-sm border px-4 py-2 ${isGoalMet
                            ? 'border-success bg-success/10 text-success'
                            : isRecording
                                ? 'border-danger bg-danger/10 text-danger'
                                : 'border-outline-variant bg-surface text-text'
                            }`}>
                            <span className="font-mono text-2xl font-bold">
                                {formatDuration(elapsedTime)}
                            </span>
                        </div>
                    </div>

                    <div className="grid flex-1 place-items-center rounded-sm border border-dashed border-outline-variant bg-surface">
                        <div className="text-center max-w-xl px-6">
                            <div className="text-5xl mb-4">🎤</div>
                            <p className="mb-2 text-lg text-text">
                                Audio-only practice mode
                            </p>
                            <p className="text-sm text-on-surface-variant">
                                {isRecording
                                    ? 'Keep speaking naturally. Use the recording controls below when you are finished.'
                                    : 'Press Start Speaking to begin recording your response.'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Controls */}
                <div className="sticky bottom-0 flex h-24 items-center justify-center gap-4 rounded-sm border border-outline-variant bg-surface-container-low">
                    {!isRecording ? (
                        <>
                            <button
                                onClick={() => setState(EXT_STATES.TOPIC_SELECTION)}
                                className="btn btn-secondary px-6"
                            >
                                ← Choose Different Topic
                            </button>
                            <button
                                onClick={handleStartPractice}
                                className="btn btn-primary px-8 text-lg"
                            >
                                ▶ Start Speaking
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={handleStopPractice}
                            className={`btn px-8 text-lg ${isGoalMet ? 'btn-success' : 'btn-danger'
                                }`}
                        >
                            {isGoalMet ? '✅ Finish & Analyze' : '⏹ Stop Recording'}
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // Phase 3: Review (Post-Recording)
    if (state === EXT_STATES.REVIEW) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-8">
                <div className="max-w-xl text-center">
                    <div className="text-6xl mb-6">🎉</div>
                    <h2 className="mb-4 text-4xl font-semibold text-text">Great Job!</h2>
                    <p className="mb-8 text-xl text-on-surface-variant">
                        You spoke for <span className="font-mono font-bold text-text">{formatDuration(pendingData?.duration || 0)}</span> on the topic:
                    </p>
                    <div className="rounded-sm border border-outline-variant bg-surface-container-low p-6">
                        <p className="text-lg font-medium italic text-text">"{currentTopic}"</p>
                    </div>
                </div>

                <div className="flex flex-col gap-4 w-full max-w-sm">
                        <button
                            onClick={handleRetry}
                            className="btn btn-secondary w-full py-3"
                        >
                            🔄 Record Again
                    </button>

                    <button
                        onClick={handleDiscard}
                        className="btn text-red-400 hover:text-red-300 hover:bg-red-500/10 w-full py-3"
                    >
                        🗑️ Discard & Choose New Topic
                    </button>
                </div>
            </div>
        );
    }

    // Phase 4: Analysis
    return (
            <div className="flex h-full flex-col items-center justify-center">
            <div className="spinner mb-4 h-8 w-8 border-2" />
            <p className="text-on-surface-variant">Processing your speech...</p>
        </div>
    );
}

export default ExtemporePractice;
