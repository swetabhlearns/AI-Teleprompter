import { useState, useEffect, useRef } from 'react';
import CameraView from './CameraView';
import FeedbackOverlay from './FeedbackOverlay';
import AnalysisView from './AnalysisView';
import { formatDuration } from '../utils/formatters';
import { useElevenLabs } from '../hooks/useElevenLabs';

const EXT_STATES = {
    TOPIC_SELECTION: 'topic_selection',
    PRACTICE: 'practice',
    REVIEW: 'review',
    ANALYSIS: 'analysis'
};

const CATEGORIES = [
    { id: 'general', label: 'General Interest' },
    { id: 'india', label: 'India Context' },
    { id: 'tech', label: 'Technology & AI' },
    { id: 'business', label: 'Business & Economy' },
    { id: 'social', label: 'Social Issues' }
];

function ExtemporePractice({
    stream,
    onStreamReady,
    mediaPipeReady,
    mediaPipeLoading,
    currentEyeContact,
    currentPosture,
    isRecording,
    onStartRecording,
    onStopRecording,
    onTranscribe,
    onAnalyze, // Helper to run analysis logic
    generateTopics,
    isLoading // Global loading state
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

    // ElevenLabs TTS
    const { speak, stop: stopTTS, isSpeaking: isReadingTopic } = useElevenLabs();

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

    // Initial topic generation
    useEffect(() => {
        handleGenerateTopics(selectedCategory);
    }, []);

    const handleGenerateTopics = async (category) => {
        setIsGeneratingTopics(true);
        try {
            const newTopics = await generateTopics(category);
            setTopics(newTopics || []);
        } catch (error) {
            console.error('Failed to generate topics:', error);
        } finally {
            setIsGeneratingTopics(false);
        }
    };

    const handleTopicPlay = (e, topic) => {
        e.stopPropagation();
        if (isReadingTopic) {
            stopTTS();
        } else {
            speak(topic);
        }
    };

    const handleSelectTopic = (topic) => {
        stopTTS();
        setCurrentTopic(topic);
        setState(EXT_STATES.PRACTICE);
    };

    const handleStartPractice = () => {
        setElapsedTime(0);
        onStartRecording(stream);
    };

    const handleStopPractice = async () => {
        // Stop recording and get the blob/result immediately
        const result = await onStopRecording();

        // Normalize result
        const data = {
            blob: result?.blob || result,
            duration: result?.duration || 0
        };

        setPendingData(data);
        setState(EXT_STATES.REVIEW);
    };

    // Review Actions
    const handleDiscard = () => {
        setPendingData(null);
        setState(EXT_STATES.TOPIC_SELECTION);
    };

    const handleRetry = () => {
        setPendingData(null);
        setState(EXT_STATES.PRACTICE);
    };

    const handleProceedToAnalysis = () => {
        if (pendingData) {
            setState(EXT_STATES.ANALYSIS);
            onAnalyze(pendingData.blob, pendingData.duration);
        }
    };

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            stopTTS();
        };
    }, []);

    // Phase 1: Topic Selection
    if (state === EXT_STATES.TOPIC_SELECTION) {
        return (
            <div className="flex flex-col h-full bg-slate-900/50 rounded-2xl overflow-y-auto relative custom-scrollbar">
                {/* Main Content Container - Centered with fixed max-width */}
                <div className="w-full max-w-[90%] mx-auto px-4 md:px-8 py-12 flex flex-col items-center gap-4">

                    {/* Header */}
                    <div className="text-center mb-16 w-full max-w-3xl">
                        <h2 className="text-5xl font-bold text-white mb-6 tracking-tight">Extempore Practice</h2>
                        <p className="text-gray-400 text-xl leading-relaxed">
                            Challenge yourself! Choose a topic below and speak for 2-3 minutes.
                            We'll analyze your fluency and presence.
                        </p>
                    </div>

                    {/* Categories */}
                    <div className="w-full flex justify-center mb-24">
                        <div className="flex flex-wrap justify-center gap-4 p-2 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-sm">
                            {CATEGORIES.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => {
                                        setSelectedCategory(cat.id);
                                        handleGenerateTopics(cat.id);
                                    }}
                                    className={`px-8 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${selectedCategory === cat.id
                                            ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                                            : 'text-gray-400 hover:text-white hover:bg-white/10'
                                        }`}
                                >
                                    {cat.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Topics Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full mb-16">
                        {isGeneratingTopics ? (
                            Array(4).fill(0).map((_, i) => (
                                <div key={i} className="h-64 bg-white/5 rounded-3xl animate-pulse border border-white/5" />
                            ))
                        ) : (
                            topics.map((topic, i) => (
                                <button
                                    key={i}
                                    onClick={() => {
                                        speak(`Your topic is: ${topic}`); // Speak on selection
                                        handleSelectTopic(topic);
                                    }}
                                    className="group relative flex flex-col justify-between h-64 p-8 bg-white/5 border border-white/10 rounded-3xl hover:bg-white/10 hover:border-purple-500/50 hover:shadow-2xl hover:shadow-purple-500/10 hover:-translate-y-1 transition-all duration-300 text-left"
                                >
                                    <h3 className="text-xl font-medium text-white group-hover:text-purple-200 leading-snug line-clamp-4">
                                        {topic}
                                    </h3>

                                    <div className="flex items-center justify-between w-full pt-6 mt-auto border-t border-white/10 group-hover:border-white/20">
                                        <span className="text-sm font-medium text-gray-500 group-hover:text-white transition-colors">Start Speaking</span>
                                        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-all">
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
                        className="group flex items-center gap-3 px-8 py-4 rounded-2xl text-gray-400 hover:text-white hover:bg-white/5 transition-all outline-none focus:ring-2 focus:ring-purple-500/50 mt-4"
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
            <div className="flex flex-col h-full gap-4">
                {/* Header Info */}
                <div className="flex items-center justify-between px-4">
                    <div>
                        <span className="text-gray-400 text-sm uppercasetracking-wider">Topic</span>
                        <h3 className="text-xl font-bold text-white max-w-3xl truncate">
                            {currentTopic}
                        </h3>
                    </div>
                </div>

                {/* Camera Area */}
                <div className="flex-1 relative rounded-2xl overflow-hidden bg-black border border-white/10">
                    <CameraView
                        onStreamReady={onStreamReady}
                        isRecording={isRecording}
                    />

                    <FeedbackOverlay
                        eyeContact={currentEyeContact}
                        posture={currentPosture}
                        isActive={isRecording}
                        mediaPipeReady={mediaPipeReady}
                        mediaPipeLoading={mediaPipeLoading}
                    />

                    {/* Timer Overlay */}
                    <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
                        <div className={`px-4 py-2 rounded-full backdrop-blur-md border ${isGoalMet
                                ? 'bg-green-500/20 border-green-500/50 text-green-400'
                                : isRecording
                                    ? 'bg-red-500/20 border-red-500/50 text-red-400'
                                    : 'bg-black/40 border-white/20 text-white'
                            }`}>
                            <span className="font-mono text-2xl font-bold">
                                {formatDuration(elapsedTime)}
                            </span>
                        </div>
                        {isRecording && !isGoalMet && (
                            <span className="text-xs text-white/50 mt-1 bg-black/40 px-2 py-0.5 rounded">
                                Goal: 2:00
                            </span>
                        )}
                    </div>
                </div>

                {/* Controls */}
                <div className="h-24 sticky bottom-0 glass-strong rounded-t-2xl flex items-center justify-center gap-4">
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
                <div className="text-center max-w-xl">
                    <div className="text-6xl mb-6">🎉</div>
                    <h2 className="text-4xl font-bold text-white mb-4">Great Job!</h2>
                    <p className="text-xl text-gray-400 mb-8">
                        You spoke for <span className="text-white font-mono font-bold">{formatDuration(pendingData?.duration || 0)}</span> on the topic:
                    </p>
                    <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                        <p className="text-lg text-white font-medium italic">"{currentTopic}"</p>
                    </div>
                </div>

                <div className="flex flex-col gap-4 w-full max-w-sm">
                    <button
                        onClick={handleProceedToAnalysis}
                        className="btn btn-primary w-full py-4 text-lg"
                    >
                        ✨ Analyze My Performance
                    </button>

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
        <div className="flex flex-col items-center justify-center h-full">
            <div className="spinner w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-gray-400">Processing your speech...</p>
        </div>
    );
}

export default ExtemporePractice;
