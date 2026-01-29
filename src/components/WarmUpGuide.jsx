import { useState, useEffect, useCallback } from 'react';

/**
 * Vocal Warm-Up Guide Component
 * Pre-practice exercises to warm up the voice for clearer speech
 */
export function WarmUpGuide({ onComplete, onSkip }) {
    const [currentExercise, setCurrentExercise] = useState(0);
    const [timeRemaining, setTimeRemaining] = useState(0);
    const [isActive, setIsActive] = useState(false);
    const [completedExercises, setCompletedExercises] = useState([]);

    const exercises = [
        {
            id: 'breathing',
            name: 'Diaphragmatic Breathing',
            icon: '🌬️',
            duration: 30,
            description: 'Deep belly breathing to relax and support your voice',
            instructions: [
                'Sit or stand with good posture',
                'Place one hand on your belly',
                'Breathe in through your nose for 4 seconds',
                'Feel your belly expand (not your chest)',
                'Exhale slowly through your mouth for 6 seconds',
                'Repeat 4-5 times'
            ],
            tip: 'Nose breathing is your default - it warms and filters air for better vocal quality.'
        },
        {
            id: 'humming',
            name: 'Humming Warm-Up',
            icon: '🎵',
            duration: 45,
            description: 'Gentle humming to activate your vocal cords',
            instructions: [
                'Close your lips gently',
                'Hum at a comfortable pitch',
                'Feel the vibration in your lips and nose',
                'Slowly slide up and down in pitch',
                'Keep your jaw relaxed'
            ],
            tip: 'Humming warms up your voice without strain - perfect before important calls or presentations.'
        },
        {
            id: 'lipTrill',
            name: 'Lip Trills',
            icon: '👄',
            duration: 30,
            description: 'Relax your lips and engage breath support',
            instructions: [
                'Relax your lips completely',
                'Blow air through closed lips to make a "brrr" sound',
                'Keep the trill consistent and smooth',
                'Vary the pitch up and down',
                'If struggling, gently press fingers on cheeks'
            ],
            tip: 'This exercise releases facial tension that can make your voice sound strained.'
        },
        {
            id: 'vowels',
            name: 'Vowel Stretches',
            icon: '🗣️',
            duration: 30,
            description: 'Open up your mouth and project clearly',
            instructions: [
                'Say each vowel slowly: A - E - I - O - U',
                'Exaggerate your mouth movements',
                'Hold each vowel for 2-3 seconds',
                'Focus on clear, resonant sound',
                'Repeat the sequence 3 times'
            ],
            tip: 'Opening your mouth wider helps project your voice with more volume and clarity.'
        },
        {
            id: 'tongueTwister',
            name: 'Tongue Twisters',
            icon: '👅',
            duration: 45,
            description: 'Improve articulation and diction',
            instructions: [
                'Start slowly, then speed up:',
                '"Red lorry, yellow lorry"',
                '"She sells seashells by the seashore"',
                '"Unique New York"',
                'Focus on precision over speed'
            ],
            tip: 'Clear articulation makes you sound more confident and professional.'
        }
    ];

    // Timer effect
    useEffect(() => {
        let interval = null;
        if (isActive && timeRemaining > 0) {
            interval = setInterval(() => {
                setTimeRemaining(t => t - 1);
            }, 1000);
        } else if (timeRemaining === 0 && isActive) {
            setIsActive(false);
            // Mark as completed
            if (!completedExercises.includes(currentExercise)) {
                setCompletedExercises(prev => [...prev, currentExercise]);
            }
        }
        return () => clearInterval(interval);
    }, [isActive, timeRemaining, currentExercise, completedExercises]);

    const startExercise = useCallback(() => {
        setTimeRemaining(exercises[currentExercise].duration);
        setIsActive(true);
    }, [currentExercise, exercises]);

    const skipExercise = useCallback(() => {
        setIsActive(false);
        if (currentExercise < exercises.length - 1) {
            setCurrentExercise(prev => prev + 1);
        }
    }, [currentExercise, exercises.length]);

    const nextExercise = useCallback(() => {
        if (currentExercise < exercises.length - 1) {
            setCurrentExercise(prev => prev + 1);
            setIsActive(false);
        } else {
            // All done!
            onComplete?.();
        }
    }, [currentExercise, exercises.length, onComplete]);

    const prevExercise = useCallback(() => {
        if (currentExercise > 0) {
            setCurrentExercise(prev => prev - 1);
            setIsActive(false);
        }
    }, [currentExercise]);

    const exercise = exercises[currentExercise];
    const progress = ((currentExercise + (completedExercises.includes(currentExercise) ? 1 : 0)) / exercises.length) * 100;

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;
    };

    return (
        <div className="h-full flex flex-col p-6 overflow-hidden reveal">
            {/* Header */}
            <div className="flex items-center justify-between mb-8 reveal reveal-delay-1">
                <div>
                    <h2 className="text-3xl font-black text-white flex items-center gap-3 font-display tracking-tight">
                        <span className="text-accent-cyan">🎤</span> VOCAL WARM-UP
                    </h2>
                    <p className="text-white/30 text-[10px] uppercase tracking-widest font-bold mt-1">
                        {exercises.length} EXERCISES • OPTIMIZE FOR CLARITY
                    </p>
                </div>
                <button
                    onClick={onSkip}
                    className="text-white/30 hover:text-white/60 text-[10px] uppercase font-bold tracking-widest transition-colors border border-white/10 px-4 py-2 rounded-full"
                >
                    Skip warm-up →
                </button>
            </div>

            {/* Progress bar */}
            <div className="mb-10 reveal reveal-delay-2">
                <div className="flex justify-between text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3">
                    <span>Active: {exercise.name}</span>
                    <span>{Math.round(progress)}% Complete</span>
                </div>
                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-white transition-all duration-1000 ease-in-out"
                        style={{ width: `${progress}%`, boxShadow: '0 0 15px white' }}
                    />
                </div>
            </div>

            {/* Exercise Card */}
            <div className="flex-1 glass-strong rounded-lg p-10 flex flex-col overflow-hidden reveal reveal-delay-3 border-l-4 border-accent-cyan">
                {/* Exercise header */}
                <div className="flex items-center gap-6 mb-10">
                    <div className="text-7xl reveal reveal-delay-4">{exercise.icon}</div>
                    <div>
                        <h3 className="text-3xl font-black text-white font-display uppercase tracking-tight leading-none mb-2">
                            {exercise.name}
                        </h3>
                        <p className="text-white/40 text-xs font-mono uppercase tracking-wide">{exercise.description}</p>
                    </div>
                </div>

                {/* Timer or Instructions */}
                {isActive ? (
                    <div className="flex-1 flex flex-col items-center justify-center reveal">
                        <div
                            className="text-[10rem] font-black leading-none mb-8 font-display"
                            style={{
                                color: 'white',
                                letterSpacing: '-0.08em',
                                filter: 'drop-shadow(0 0 20px rgba(255,255,255,0.3))'
                            }}
                        >
                            {formatTime(timeRemaining)}
                        </div>
                        <p className="text-white/60 text-center max-w-lg text-lg font-medium leading-relaxed italic">
                            {exercise.instructions[Math.floor((exercise.duration - timeRemaining) / (exercise.duration / exercise.instructions.length)) % exercise.instructions.length]}
                        </p>
                        <button
                            onClick={() => setIsActive(false)}
                            className="mt-10 px-8 py-3 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-all rounded-lg"
                        >
                            II PAUSE SESSION
                        </button>
                    </div>
                ) : (
                    <div className="flex-1 overflow-auto reveal reveal-delay-4">
                        <ul className="space-y-4 mb-8">
                            {exercise.instructions.map((instruction, i) => (
                                <li key={i} className="flex items-start gap-5 text-white/80 group">
                                    <span className="text-accent-cyan font-bold text-lg leading-none mt-1 opacity-40 group-hover:opacity-100 transition-opacity">0{i + 1}</span>
                                    <span className="text-xl font-medium leading-relaxed">{instruction}</span>
                                </li>
                            ))}
                        </ul>

                        {/* Tip */}
                        <div className="bg-white/2 border border-white/5 rounded-lg p-6 mt-6">
                            <div className="flex items-start gap-4">
                                <span className="text-2xl">💡</span>
                                <div>
                                    <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest mb-1">PRO TIP</p>
                                    <p className="text-white/60 text-sm leading-relaxed">{exercise.tip}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-between mt-10 pt-8 border-t border-white/5">
                    <button
                        onClick={prevExercise}
                        disabled={currentExercise === 0}
                        className="btn btn-secondary !px-4"
                    >
                        ← BACK
                    </button>

                    <div className="flex gap-4">
                        {!isActive && !completedExercises.includes(currentExercise) && (
                            <button
                                onClick={startExercise}
                                className="btn btn-primary !px-10"
                            >
                                BEGIN SESSION ({exercise.duration}S)
                            </button>
                        )}

                        {(completedExercises.includes(currentExercise) || isActive) && (
                            <button
                                onClick={skipExercise}
                                className="btn btn-secondary"
                            >
                                SKIP
                            </button>
                        )}

                        {completedExercises.includes(currentExercise) && (
                            <button
                                onClick={nextExercise}
                                className="btn btn-success !px-10"
                            >
                                {currentExercise === exercises.length - 1 ? 'COMPLETE' : 'CONTINUE →'}
                            </button>
                        )}
                    </div>

                    <button
                        onClick={nextExercise}
                        disabled={currentExercise === exercises.length - 1 && !completedExercises.includes(currentExercise)}
                        className="btn btn-secondary !px-4"
                    >
                        {currentExercise === exercises.length - 1 ? 'DONE' : 'NEXT →'}
                    </button>
                </div>
            </div>

            {/* Exercise dots */}
            <div className="flex justify-center gap-2 mt-4">
                {exercises.map((_, i) => (
                    <button
                        key={i}
                        onClick={() => {
                            setCurrentExercise(i);
                            setIsActive(false);
                        }}
                        className={`w-2.5 h-2.5 rounded-full transition-all ${i === currentExercise
                            ? 'bg-cyan-400 scale-125'
                            : completedExercises.includes(i)
                                ? 'bg-emerald-500'
                                : 'bg-white/20 hover:bg-white/40'
                            }`}
                    />
                ))}
            </div>
        </div>
    );
}

export default WarmUpGuide;
