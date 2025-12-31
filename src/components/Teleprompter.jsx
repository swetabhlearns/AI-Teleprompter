import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { parseScriptWithMarkers } from '../utils/formatters';

/**
 * Teleprompter Component
 * Smooth scrolling text overlay with speed control
 */
export function Teleprompter({
    script = '',
    isActive = false,
    isSpeaking = false,
    audioLevel = 0,
    onSpeedChange,
    initialSpeed = 20
}) {
    const [baseSpeed, setBaseSpeed] = useState(initialSpeed);
    const [isPaused, setIsPaused] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [isScrolling, setIsScrolling] = useState(false);
    const contentRef = useRef(null);
    const scrollPosRef = useRef(0);
    const animationRef = useRef(null);
    const speedRef = useRef(initialSpeed);

    // Parse script into segments
    const scriptSegments = useMemo(() => {
        return parseScriptWithMarkers(script);
    }, [script]);

    // Speed control handlers
    const handleSpeedUp = useCallback(() => {
        setBaseSpeed(prev => Math.min(100, prev + 10));
    }, []);

    const handleSpeedDown = useCallback(() => {
        setBaseSpeed(prev => Math.max(10, prev - 10));
    }, []);

    const handleTogglePause = useCallback(() => {
        setIsPaused(prev => !prev);
    }, []);

    const handleReset = useCallback(() => {
        scrollPosRef.current = 0;
        if (contentRef.current) {
            contentRef.current.scrollTop = 0;
        }
    }, []);

    // Update speed ref when baseSpeed changes
    useEffect(() => {
        speedRef.current = baseSpeed;
        if (onSpeedChange) {
            onSpeedChange(baseSpeed);
        }
    }, [baseSpeed, onSpeedChange]);

    // Keyboard shortcuts
    useEffect(() => {
        if (!isActive) return;

        const handleKeyDown = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            switch (e.key) {
                case 'ArrowUp':
                    e.preventDefault();
                    handleSpeedUp();
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    handleSpeedDown();
                    break;
                case ' ':
                    e.preventDefault();
                    handleTogglePause();
                    break;
                case 'r':
                case 'R':
                    e.preventDefault();
                    handleReset();
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isActive, handleSpeedUp, handleSpeedDown, handleTogglePause, handleReset]);

    // Countdown effect when becoming active
    useEffect(() => {
        if (isActive && !isScrolling && countdown === 0) {
            // Start countdown
            setCountdown(5);
        }

        if (!isActive) {
            // Reset when inactive
            setCountdown(0);
            setIsScrolling(false);
        }
    }, [isActive]);

    // Countdown timer
    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => {
                if (countdown === 1) {
                    setCountdown(0);
                    setIsScrolling(true);
                } else {
                    setCountdown(countdown - 1);
                }
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

    // Main scroll animation loop
    useEffect(() => {
        if (!isActive || !isScrolling) {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                animationRef.current = null;
            }
            return;
        }

        let lastTime = performance.now();

        const animate = (currentTime) => {
            const deltaTime = currentTime - lastTime;
            lastTime = currentTime;

            if (!isPaused && contentRef.current) {
                // Calculate speed: baseSpeed 0-100 maps to 0-200 pixels/second
                const pixelsPerSecond = (speedRef.current / 100) * 200;
                const scrollDelta = (pixelsPerSecond * deltaTime) / 1000;

                scrollPosRef.current += scrollDelta;

                const maxScroll = contentRef.current.scrollHeight - contentRef.current.clientHeight;
                scrollPosRef.current = Math.min(scrollPosRef.current, Math.max(0, maxScroll));

                contentRef.current.scrollTop = scrollPosRef.current;
            }

            animationRef.current = requestAnimationFrame(animate);
        };

        animationRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                animationRef.current = null;
            }
        };
    }, [isActive, isScrolling, isPaused]);

    // Reset on new script
    useEffect(() => {
        scrollPosRef.current = 0;
        setIsPaused(false);
        setIsScrolling(false);
        setCountdown(0);
        if (contentRef.current) {
            contentRef.current.scrollTop = 0;
        }
    }, [script]);

    if (!script) {
        return (
            <div className="teleprompter-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)' }}>
                    <p style={{ fontSize: '18px' }}>No script loaded</p>
                    <p style={{ fontSize: '14px', marginTop: '8px' }}>Go to Script tab to create or generate one</p>
                </div>
            </div>
        );
    }

    return (
        <div className="teleprompter-overlay">
            {/* Countdown overlay */}
            {countdown > 0 && (
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(0, 0, 0, 0.85)',
                        zIndex: 100,
                        flexDirection: 'column',
                        gap: '20px'
                    }}
                >
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '18px', fontWeight: '500' }}>
                        Get Ready...
                    </div>
                    <div
                        style={{
                            fontSize: '120px',
                            fontWeight: '800',
                            background: 'linear-gradient(135deg, #6366f1, #22d3ee)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            animation: 'pulse 1s ease-in-out infinite',
                            textShadow: '0 0 60px rgba(99,102,241,0.5)'
                        }}
                    >
                        {countdown}
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>
                        Starting in {countdown} second{countdown !== 1 ? 's' : ''}...
                    </div>
                </div>
            )}

            {/* Scrollable content */}
            <div
                ref={contentRef}
                className="teleprompter-text"
                style={{
                    height: '100%',
                    overflow: 'hidden',
                    paddingTop: '50vh',
                    paddingBottom: '50vh'
                }}
            >
                {scriptSegments.map((segment, index) => (
                    segment.type === 'pause' ? (
                        <div key={index} className="pause-marker">
                            {segment.content}
                        </div>
                    ) : (
                        <p key={index} style={{ marginBottom: '28px', lineHeight: '1.6' }}>
                            {segment.content}
                        </p>
                    )
                ))}
            </div>

            {/* Speed control bar */}
            {isActive && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: '24px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                        padding: '14px 28px',
                        background: 'rgba(0, 0, 0, 0.9)',
                        backdropFilter: 'blur(12px)',
                        borderRadius: '50px',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
                    }}
                >
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', fontWeight: '600', letterSpacing: '0.5px' }}>
                        SPEED
                    </span>

                    <button
                        onClick={handleSpeedDown}
                        style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            border: '2px solid rgba(255,255,255,0.2)',
                            background: 'transparent',
                            color: 'white',
                            fontSize: '24px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        −
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div
                            style={{
                                width: '140px',
                                height: '10px',
                                background: 'rgba(255,255,255,0.15)',
                                borderRadius: '5px',
                                overflow: 'hidden'
                            }}
                        >
                            <div
                                style={{
                                    height: '100%',
                                    width: `${baseSpeed}%`,
                                    background: isPaused
                                        ? 'rgba(255,255,255,0.3)'
                                        : 'linear-gradient(90deg, #6366f1, #22d3ee)',
                                    borderRadius: '5px',
                                    transition: 'width 0.15s ease'
                                }}
                            />
                        </div>
                        <span style={{
                            color: 'white',
                            fontSize: '16px',
                            fontWeight: '700',
                            minWidth: '50px',
                            textAlign: 'center'
                        }}>
                            {baseSpeed}%
                        </span>
                    </div>

                    <button
                        onClick={handleSpeedUp}
                        style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            border: '2px solid rgba(255,255,255,0.2)',
                            background: 'transparent',
                            color: 'white',
                            fontSize: '24px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        +
                    </button>

                    <div style={{ width: '1px', height: '28px', background: 'rgba(255,255,255,0.2)', margin: '0 4px' }} />

                    <button
                        onClick={handleTogglePause}
                        style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '50%',
                            border: 'none',
                            background: isPaused
                                ? 'linear-gradient(135deg, #10b981, #059669)'
                                : 'linear-gradient(135deg, #f59e0b, #d97706)',
                            color: 'white',
                            fontSize: '20px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
                        }}
                    >
                        {isPaused ? '▶' : '⏸'}
                    </button>

                    <button
                        onClick={handleReset}
                        style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            border: '2px solid rgba(255,255,255,0.2)',
                            background: 'transparent',
                            color: 'white',
                            fontSize: '18px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        ↺
                    </button>
                </div>
            )}

            {/* Keyboard hints */}
            {isActive && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: '100px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        fontSize: '12px',
                        color: 'rgba(255,255,255,0.25)',
                        textAlign: 'center'
                    }}
                >
                    ↑↓ Speed • Space Pause • R Reset
                </div>
            )}
        </div>
    );
}

export default Teleprompter;
