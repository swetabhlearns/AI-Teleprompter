import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Custom hook for audio/video recording with Voice Activity Detection
 * Provides recording controls and VAD for teleprompter scroll speed
 */
export function useRecorder() {
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [duration, setDuration] = useState(0);
    const [audioLevel, setAudioLevel] = useState(0);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [recordedBlob, setRecordedBlob] = useState(null);

    const mediaRecorderRef = useRef(null);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const streamRef = useRef(null);
    const chunksRef = useRef([]);
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
                    console.log('Recorded chunk:', event.data.size, 'bytes');
                }
            };

            mediaRecorder.onerror = (event) => {
                console.error('MediaRecorder error:', event.error);
            };

            mediaRecorder.onstop = () => {
                const finalMimeType = mediaRecorder.mimeType || 'video/webm';
                const blob = new Blob(chunksRef.current, { type: finalMimeType });
                console.log('Recording stopped. Total blob size:', blob.size, 'Type:', blob.type);
                setRecordedBlob(blob);
            };

            // Start recording - use timeslice to get chunks
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
     * @returns {Promise<Blob>} Recorded media blob
     */
    const stopRecording = useCallback(() => {
        console.log('stopRecording called, isRecording:', isRecording);

        return new Promise((resolve) => {
            // Clear intervals
            if (durationIntervalRef.current) {
                clearInterval(durationIntervalRef.current);
                durationIntervalRef.current = null;
            }
            if (vadIntervalRef.current) {
                clearInterval(vadIntervalRef.current);
                vadIntervalRef.current = null;
            }

            // Stop and cleanup stream
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => {
                    track.stop();
                    console.log('Stopped track:', track.kind);
                });
            }

            // Close audio context
            if (audioContextRef.current) {
                audioContextRef.current.close().catch(() => { });
                audioContextRef.current = null;
            }

            // If we have a media recorder that's recording, stop it and wait for data
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                console.log('Stopping MediaRecorder, state:', mediaRecorderRef.current.state);

                mediaRecorderRef.current.onstop = () => {
                    const mimeType = mediaRecorderRef.current.mimeType || 'video/webm';
                    const blob = new Blob(chunksRef.current, { type: mimeType });
                    console.log('MediaRecorder stopped, blob size:', blob.size, 'type:', blob.type);
                    setRecordedBlob(blob);

                    // Reset state
                    setIsRecording(false);
                    setIsPaused(false);
                    setIsSpeaking(false);
                    setAudioLevel(0);

                    resolve(blob);
                };

                mediaRecorderRef.current.stop();
            } else {
                console.log('No active MediaRecorder, resolving with existing chunks');

                // Create blob from any existing chunks
                const blob = chunksRef.current.length > 0
                    ? new Blob(chunksRef.current, { type: 'video/webm' })
                    : null;

                console.log('Created blob from chunks:', blob?.size || 0);
                setRecordedBlob(blob);

                // Reset state
                setIsRecording(false);
                setIsPaused(false);
                setIsSpeaking(false);
                setAudioLevel(0);

                resolve(blob);
            }
        });
    }, [isRecording]);

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
        startRecording,
        stopRecording,
        pauseRecording,
        resumeRecording,
        extractAudio,
        getVideoTrack
    };
}

export default useRecorder;
