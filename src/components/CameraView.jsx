import { useRef, useEffect, useState, useCallback } from 'react';

/**
 * CameraView Component
 * Displays live camera feed with optional mirroring
 */
export function CameraView({ onStreamReady, isRecording = false, showDebug = false }) {
    const videoRef = useRef(null);
    const [hasCamera, setHasCamera] = useState(true);
    const [error, setError] = useState(null);
    const streamRef = useRef(null);

    // Initialize camera
    useEffect(() => {
        let mounted = true;

        const initCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                        facingMode: 'user'
                    },
                    audio: true
                });

                if (mounted && videoRef.current) {
                    videoRef.current.srcObject = stream;
                    streamRef.current = stream;
                    setHasCamera(true);

                    if (onStreamReady) {
                        onStreamReady(stream);
                    }
                }
            } catch (err) {
                console.error('Camera access error:', err);
                if (mounted) {
                    setHasCamera(false);
                    setError(err.message || 'Unable to access camera');
                }
            }
        };

        initCamera();

        return () => {
            mounted = false;
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, [onStreamReady]);

    /**
     * Get the current video element for processing
     */
    const getVideoElement = useCallback(() => videoRef.current, []);

    if (!hasCamera) {
        return (
            <div className="camera-container flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                <div className="text-center p-8">
                    <div className="text-6xl mb-4">📷</div>
                    <h3 className="text-xl font-semibold text-white mb-2">Camera Access Required</h3>
                    <p className="text-gray-400 text-sm max-w-xs">
                        {error || 'Please allow camera access to use the teleprompter'}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="camera-container">
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="camera-video"
            />

            {/* Recording indicator */}
            {isRecording && (
                <div className="recording-indicator animate-fade-in">
                    <div className="recording-dot" />
                    <span>REC</span>
                </div>
            )}

            {/* Debug overlay for development */}
            {showDebug && (
                <div className="absolute bottom-2 left-2 text-xs text-white/50 font-mono">
                    Debug Mode
                </div>
            )}
        </div>
    );
}

export default CameraView;
