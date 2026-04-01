import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Custom hook for audio-only recording with Voice Activity Detection
 * Records microphone audio for transcription and timing metrics.
 */
export function useRecorder() {
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [duration, setDuration] = useState(0);
    const [audioLevel, setAudioLevel] = useState(0);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [recordedBlob, setRecordedBlob] = useState(null);
    const [audioBlob, setAudioBlob] = useState(null);

    const mediaRecorderRef = useRef(null);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const streamRef = useRef(null);
    const chunksRef = useRef([]);
    const durationIntervalRef = useRef(null);
    const vadIntervalRef = useRef(null);
    const volumeHistoryRef = useRef([]);
    const startTimeRef = useRef(0);
    const finishResolveRef = useRef(null);

    const VAD_THRESHOLD = 15;
    const VAD_SMOOTHING = 0.8;

    const stopIntervals = useCallback(() => {
        if (durationIntervalRef.current) {
            clearInterval(durationIntervalRef.current);
            durationIntervalRef.current = null;
        }
        if (vadIntervalRef.current) {
            clearInterval(vadIntervalRef.current);
            vadIntervalRef.current = null;
        }
    }, []);

    const cleanupStream = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => {
                try {
                    track.stop();
                } catch {
                    // ignore cleanup errors
                }
            });
            streamRef.current = null;
        }

        if (audioContextRef.current) {
            audioContextRef.current.close().catch(() => {});
            audioContextRef.current = null;
        }

        analyserRef.current = null;
    }, []);

    const resolveRecording = useCallback((blob, durationMs) => {
        setRecordedBlob(blob);
        setAudioBlob(blob);
        setIsRecording(false);
        setIsPaused(false);
        setIsSpeaking(false);
        setAudioLevel(0);
        setDuration(0);
        stopIntervals();
        cleanupStream();

        const resolve = finishResolveRef.current;
        finishResolveRef.current = null;

        if (resolve) {
            resolve({
                blob,
                duration: durationMs,
                volumeHistory: [...volumeHistoryRef.current]
            });
        }
    }, [cleanupStream, stopIntervals]);

    const startVADMonitoring = useCallback(() => {
        if (!analyserRef.current) return;

        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        let smoothedLevel = 0;
        let sampleCounter = 0;

        volumeHistoryRef.current = [];

        vadIntervalRef.current = setInterval(() => {
            if (!analyserRef.current) return;

            analyserRef.current.getByteFrequencyData(dataArray);

            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
                sum += dataArray[i];
            }

            const average = sum / bufferLength;
            smoothedLevel = smoothedLevel * VAD_SMOOTHING + average * (1 - VAD_SMOOTHING);
            const roundedLevel = Math.round(smoothedLevel);

            setAudioLevel(roundedLevel);
            setIsSpeaking(smoothedLevel > VAD_THRESHOLD);

            sampleCounter++;
            if (sampleCounter % 4 === 0) {
                volumeHistoryRef.current.push({
                    timestamp: Date.now(),
                    level: roundedLevel
                });
            }
        }, 100);
    }, []);

    /**
     * Start recording with VAD
     */
    const startRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            streamRef.current = stream;
            chunksRef.current = [];

            try {
                audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
                analyserRef.current = audioContextRef.current.createAnalyser();
                analyserRef.current.fftSize = 256;

                const source = audioContextRef.current.createMediaStreamSource(stream);
                source.connect(analyserRef.current);
            } catch (audioErr) {
                console.warn('Failed to set up audio timing:', audioErr);
            }

            let mediaRecorder = null;
            const mimeTypes = [
                'audio/webm;codecs=opus',
                'audio/webm',
                'audio/ogg',
                'audio/mp4'
            ];

            for (const mimeType of mimeTypes) {
                if (MediaRecorder.isTypeSupported(mimeType)) {
                    try {
                        mediaRecorder = new MediaRecorder(stream, { mimeType });
                        break;
                    } catch {
                        // keep trying
                    }
                }
            }

            if (!mediaRecorder) {
                mediaRecorder = new MediaRecorder(stream);
            }

            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onerror = (event) => {
                console.error('MediaRecorder error:', event.error);
            };

            mediaRecorder.start(1000);
            setIsRecording(true);
            setIsPaused(false);
            setDuration(0);
            startTimeRef.current = Date.now();

            durationIntervalRef.current = setInterval(() => {
                setDuration(Date.now() - startTimeRef.current);
            }, 100);

            startVADMonitoring();
        } catch (err) {
            console.error('Recording start error:', err);
            throw err;
        }
    }, [startVADMonitoring]);

    /**
     * Stop recording
     */
    const stopRecording = useCallback(() => {
        return new Promise((resolve) => {
            finishResolveRef.current = resolve;
            const finalDuration = duration;

            stopIntervals();

            const finalize = () => {
                const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
                const blob = chunksRef.current.length > 0
                    ? new Blob(chunksRef.current, { type: mimeType })
                    : null;

                mediaRecorderRef.current = null;
                chunksRef.current = [];
                resolveRecording(blob, finalDuration);
            };

            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.onstop = finalize;
                mediaRecorderRef.current.stop();
            } else {
                finalize();
            }
        });
    }, [duration, resolveRecording, stopIntervals]);

    /**
     * Pause recording
     */
    const pauseRecording = useCallback(() => {
        if (mediaRecorderRef.current && isRecording && !isPaused) {
            mediaRecorderRef.current.pause();
            setIsPaused(true);
            if (durationIntervalRef.current) {
                clearInterval(durationIntervalRef.current);
                durationIntervalRef.current = null;
            }
        }
    }, [isRecording, isPaused]);

    /**
     * Resume recording
     */
    const resumeRecording = useCallback(() => {
        if (mediaRecorderRef.current && isRecording && isPaused) {
            mediaRecorderRef.current.resume();
            setIsPaused(false);

            const pausedDuration = duration;
            const resumeTime = Date.now();

            durationIntervalRef.current = setInterval(() => {
                setDuration(pausedDuration + (Date.now() - resumeTime));
            }, 100);
        }
    }, [duration, isPaused, isRecording]);

    /**
     * Audio-only blob passthrough for transcription
     */
    const extractAudio = useCallback(async (blob) => blob, []);

    useEffect(() => {
        return () => {
            stopIntervals();
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => {
                    try {
                        track.stop();
                    } catch {
                        // ignore cleanup errors
                    }
                });
            }
            if (audioContextRef.current) {
                audioContextRef.current.close().catch(() => {});
            }
        };
    }, [stopIntervals]);

    return {
        isRecording,
        isPaused,
        duration,
        audioLevel,
        isSpeaking,
        recordedBlob,
        audioBlob,
        startRecording,
        stopRecording,
        pauseRecording,
        resumeRecording,
        extractAudio
    };
}

export default useRecorder;
