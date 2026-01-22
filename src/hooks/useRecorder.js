import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Custom hook for audio/video recording with Voice Activity Detection
 * Records both video (for playback) and audio-only (for transcription)
 */
export function useRecorder() {
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [duration, setDuration] = useState(0);
    const [audioLevel, setAudioLevel] = useState(0);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [recordedBlob, setRecordedBlob] = useState(null);
    const [audioBlob, setAudioBlob] = useState(null); // Audio-only for transcription

    const mediaRecorderRef = useRef(null);
    const audioRecorderRef = useRef(null); // Separate audio-only recorder
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const streamRef = useRef(null);
    const audioStreamRef = useRef(null); // Audio-only stream
    const chunksRef = useRef([]);
    const audioChunksRef = useRef([]); // Audio-only chunks
    const durationIntervalRef = useRef(null);
    const vadIntervalRef = useRef(null);

    // Voice Activity Detection thresholds
    const VAD_THRESHOLD = 15; // Minimum audio level to consider as speech
    const VAD_SMOOTHING = 0.8; // Smoothing factor for audio level

    /**
     * Start recording with VAD
     * @param {MediaStream} existingStream - Optional existing media stream (ignored, we always get fresh)
     */
    const startRecording = useCallback(async (existingStream = null) => {
        try {
            console.log('Starting recording...');

            // ALWAYS get a fresh stream for recording to avoid codec issues
            // The existing stream may have been used by MediaPipe which can cause conflicts
            let stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    },
                    video: true
                });
                console.log('Got fresh media stream');
            } catch (mediaErr) {
                console.error('Failed to get media stream:', mediaErr);
                throw mediaErr;
            }

            // Verify stream has active tracks
            const audioTracks = stream.getAudioTracks();
            const videoTracks = stream.getVideoTracks();
            console.log('Audio tracks:', audioTracks.length, 'Video tracks:', videoTracks.length);

            if (audioTracks.length === 0) {
                console.warn('No audio tracks available');
            }
            if (videoTracks.length === 0) {
                console.warn('No video tracks available');
            }

            // Check track states
            audioTracks.forEach((t, i) => console.log(`Audio track ${i}: ${t.label}, enabled: ${t.enabled}, readyState: ${t.readyState}`));
            videoTracks.forEach((t, i) => console.log(`Video track ${i}: ${t.label}, enabled: ${t.enabled}, readyState: ${t.readyState}`));

            streamRef.current = stream;
            chunksRef.current = [];

            // Set up audio analysis for VAD
            try {
                audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
                analyserRef.current = audioContextRef.current.createAnalyser();
                analyserRef.current.fftSize = 256;

                const source = audioContextRef.current.createMediaStreamSource(stream);
                source.connect(analyserRef.current);
                console.log('Audio context set up for VAD');
            } catch (audioErr) {
                console.warn('Failed to set up audio analysis:', audioErr);
                // Continue without VAD
            }

            // Try to create MediaRecorder - start with no options, let browser decide
            let mediaRecorder = null;

            // First try: let browser choose
            try {
                mediaRecorder = new MediaRecorder(stream);
                console.log('MediaRecorder created with browser defaults. MimeType:', mediaRecorder.mimeType);
            } catch (e1) {
                console.log('Browser defaults failed, trying specific mimeTypes...');

                // Try specific mimeTypes
                const mimeTypes = [
                    'video/webm',
                    'video/webm;codecs=vp8',
                    'audio/webm',
                    'video/mp4'
                ];

                for (const mimeType of mimeTypes) {
                    if (MediaRecorder.isTypeSupported(mimeType)) {
                        try {
                            mediaRecorder = new MediaRecorder(stream, { mimeType });
                            console.log('MediaRecorder created with:', mimeType);
                            break;
                        } catch (e2) {
                            console.log(`Failed with ${mimeType}:`, e2.message);
                        }
                    }
                }
            }

            if (!mediaRecorder) {
                throw new Error('Could not create MediaRecorder with any supported format');
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

            mediaRecorder.onstop = () => {
                const finalMimeType = mediaRecorder.mimeType || 'video/webm';
                const blob = new Blob(chunksRef.current, { type: finalMimeType });
                console.log('Video recording stopped. Size:', blob.size, 'bytes');
                setRecordedBlob(blob);
            };

            // === AUDIO-ONLY RECORDER (for transcription - much smaller file) ===
            const audioOnlyStream = new MediaStream(stream.getAudioTracks());
            audioStreamRef.current = audioOnlyStream;
            audioChunksRef.current = [];

            let audioRecorder = null;
            const audioMimeTypes = ['audio/webm', 'audio/webm;codecs=opus', 'audio/ogg', 'audio/mp4'];

            for (const mimeType of audioMimeTypes) {
                if (MediaRecorder.isTypeSupported(mimeType)) {
                    try {
                        audioRecorder = new MediaRecorder(audioOnlyStream, { mimeType });
                        console.log('Audio recorder created with:', mimeType);
                        break;
                    } catch (e) {
                        console.log(`Audio recorder failed with ${mimeType}`);
                    }
                }
            }

            if (audioRecorder) {
                audioRecorderRef.current = audioRecorder;

                audioRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        audioChunksRef.current.push(event.data);
                    }
                };

                audioRecorder.onstop = () => {
                    const audioMimeType = audioRecorder.mimeType || 'audio/webm';
                    const blob = new Blob(audioChunksRef.current, { type: audioMimeType });
                    console.log('Audio recording stopped. Size:', blob.size, 'bytes (for transcription)');
                    setAudioBlob(blob);
                };

                audioRecorder.start(1000);
                console.log('Audio-only recorder started');
            } else {
                console.warn('Could not create audio-only recorder, will use video for transcription');
            }

            // Start video recorder
            mediaRecorder.start(1000);
            console.log('MediaRecorder started successfully!');

            setIsRecording(true);
            setIsPaused(false);
            setDuration(0);

            // Start duration counter
            const startTime = Date.now();
            durationIntervalRef.current = setInterval(() => {
                setDuration(Date.now() - startTime);
            }, 100);

            // Start VAD monitoring
            startVADMonitoring();

        } catch (err) {
            console.error('Recording start error:', err);
            console.error('Error name:', err.name);
            console.error('Error message:', err.message);
            throw err;
        }
    }, []);

    /**
     * Start Voice Activity Detection monitoring
     */
    const startVADMonitoring = useCallback(() => {
        if (!analyserRef.current) return;

        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        let smoothedLevel = 0;

        vadIntervalRef.current = setInterval(() => {
            analyserRef.current.getByteFrequencyData(dataArray);

            // Calculate average volume
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
                sum += dataArray[i];
            }
            const average = sum / bufferLength;

            // Smooth the level
            smoothedLevel = smoothedLevel * VAD_SMOOTHING + average * (1 - VAD_SMOOTHING);

            setAudioLevel(Math.round(smoothedLevel));
            setIsSpeaking(smoothedLevel > VAD_THRESHOLD);
        }, 50); // Check every 50ms
    }, []);

    /**
     * Stop recording
     * @returns {Promise<{videoBlob: Blob, audioBlob: Blob}>} Recorded blobs
     */
    const stopRecording = useCallback(() => {
        console.log('stopRecording called, isRecording:', isRecording);

        return new Promise((resolve) => {
            // Capture final duration before clearing intervals - CRITICAL FIX
            const finalDuration = duration;

            // Clear intervals
            if (durationIntervalRef.current) {
                clearInterval(durationIntervalRef.current);
                durationIntervalRef.current = null;
            }
            if (vadIntervalRef.current) {
                clearInterval(vadIntervalRef.current);
                vadIntervalRef.current = null;
            }

            // Stop audio-only recorder first
            if (audioRecorderRef.current && audioRecorderRef.current.state !== 'inactive') {
                audioRecorderRef.current.stop();
                console.log('Audio-only recorder stopped');
            }

            // Stop and cleanup streams
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => {
                    track.stop();
                });
            }
            if (audioStreamRef.current) {
                audioStreamRef.current.getTracks().forEach(track => {
                    track.stop();
                });
            }

            // Close audio context
            if (audioContextRef.current) {
                audioContextRef.current.close().catch(() => { });
                audioContextRef.current = null;
            }

            // Helper to resolve promise with all data
            const resolveWithData = (videoBlob, audioBlob) => {
                setRecordedBlob(videoBlob);
                setAudioBlob(audioBlob);

                // Reset state
                setIsRecording(false);
                setIsPaused(false);
                setIsSpeaking(false);
                setAudioLevel(0);
                setDuration(0);

                resolve({
                    blob: audioBlob,
                    videoBlob: videoBlob,
                    duration: finalDuration
                });
            };

            // If we have a media recorder that's recording, stop it and wait for data
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                console.log('Stopping MediaRecorder');

                mediaRecorderRef.current.onstop = () => {
                    const mimeType = mediaRecorderRef.current.mimeType || 'video/webm';
                    const videoBlob = new Blob(chunksRef.current, { type: mimeType });
                    console.log('Video blob size:', videoBlob.size, 'bytes');

                    // Create audio blob from audio chunks
                    const audioBlobResult = audioChunksRef.current.length > 0
                        ? new Blob(audioChunksRef.current, { type: 'audio/webm' })
                        : videoBlob; // Fallback to video if no audio chunks
                    console.log('Audio blob size:', audioBlobResult.size, 'bytes');

                    resolveWithData(videoBlob, audioBlobResult);
                };

                mediaRecorderRef.current.stop();
            } else {
                console.log('No active MediaRecorder, resolving with existing chunks');

                const videoBlob = chunksRef.current.length > 0
                    ? new Blob(chunksRef.current, { type: 'video/webm' })
                    : null;
                const audioBlobResult = audioChunksRef.current.length > 0
                    ? new Blob(audioChunksRef.current, { type: 'audio/webm' })
                    : videoBlob;

                resolveWithData(videoBlob, audioBlobResult);
            }
        });
    }, [isRecording, duration]);

    /**
     * Pause recording
     */
    const pauseRecording = useCallback(() => {
        if (mediaRecorderRef.current && isRecording && !isPaused) {
            mediaRecorderRef.current.pause();
            setIsPaused(true);

            if (durationIntervalRef.current) {
                clearInterval(durationIntervalRef.current);
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
    }, [isRecording, isPaused, duration]);

    /**
     * Get audio blob from video recording
     * @param {Blob} videoBlob - Video blob
     * @returns {Promise<Blob>} Audio-only blob
     */
    const extractAudio = useCallback(async (videoBlob) => {
        // For Groq transcription, we can send the WebM directly
        // as it contains the audio track
        return videoBlob;
    }, []);

    /**
     * Get current stream video track
     */
    const getVideoTrack = useCallback(() => {
        if (streamRef.current) {
            const videoTracks = streamRef.current.getVideoTracks();
            return videoTracks.length > 0 ? videoTracks[0] : null;
        }
        return null;
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (durationIntervalRef.current) {
                clearInterval(durationIntervalRef.current);
            }
            if (vadIntervalRef.current) {
                clearInterval(vadIntervalRef.current);
            }
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
        };
    }, []);

    return {
        isRecording,
        isPaused,
        duration,
        audioLevel,
        isSpeaking,
        recordedBlob,
        audioBlob, // Audio-only for transcription (smaller)
        startRecording,
        stopRecording,
        pauseRecording,
        resumeRecording,
        extractAudio,
        getVideoTrack
    };
}

export default useRecorder;
