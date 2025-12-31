import { useState, useRef, useCallback, useEffect } from 'react';
import { FaceLandmarker, PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

/**
 * Custom hook for MediaPipe face and pose tracking
 * Provides eye contact detection and posture monitoring
 */
export function useMediaPipe() {
    const [isReady, setIsReady] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const faceLandmarkerRef = useRef(null);
    const poseLandmarkerRef = useRef(null);
    const lastProcessTimeRef = useRef(0);

    // Initialize MediaPipe models
    useEffect(() => {
        let mounted = true;

        const initializeMediaPipe = async () => {
            try {
                setIsLoading(true);
                setError(null);

                console.log('Initializing MediaPipe...');

                // Load vision WASM files
                const vision = await FilesetResolver.forVisionTasks(
                    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
                );

                console.log('Vision WASM loaded, creating FaceLandmarker...');

                // Initialize Face Landmarker
                const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
                        delegate: 'GPU'
                    },
                    runningMode: 'VIDEO',
                    numFaces: 1,
                    outputFaceBlendshapes: false,
                    outputFacialTransformationMatrixes: false
                });

                console.log('FaceLandmarker created, creating PoseLandmarker...');

                // Initialize Pose Landmarker
                const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
                        delegate: 'GPU'
                    },
                    runningMode: 'VIDEO',
                    numPoses: 1
                });

                console.log('PoseLandmarker created, MediaPipe ready!');

                if (mounted) {
                    faceLandmarkerRef.current = faceLandmarker;
                    poseLandmarkerRef.current = poseLandmarker;
                    setIsReady(true);
                    setIsLoading(false);
                }
            } catch (err) {
                console.error('MediaPipe initialization error:', err);
                if (mounted) {
                    setError(err.message || 'Failed to initialize MediaPipe');
                    setIsLoading(false);
                }
            }
        };

        initializeMediaPipe();

        return () => {
            mounted = false;
            if (faceLandmarkerRef.current) {
                faceLandmarkerRef.current.close();
            }
            if (poseLandmarkerRef.current) {
                poseLandmarkerRef.current.close();
            }
        };
    }, []);

    /**
     * Process a video frame for face and pose detection
     * Returns the detection results directly
     */
    const processFrame = useCallback((videoElement) => {
        if (!isReady || !videoElement) return null;

        const now = performance.now();

        // Throttle to ~30fps (33ms between frames)
        if (now - lastProcessTimeRef.current < 33) {
            return null;
        }
        lastProcessTimeRef.current = now;

        // Use performance.now() for timestamp (MediaPipe expects milliseconds)
        const timestamp = Math.round(now);

        let eyeContactResult = {
            isLookingAtCamera: true,
            confidence: 1,
            direction: 'center'
        };

        let postureResult = {
            isGood: true,
            score: 100,
            issues: []
        };

        try {
            // Face detection
            if (faceLandmarkerRef.current) {
                const faceResults = faceLandmarkerRef.current.detectForVideo(videoElement, timestamp);

                if (faceResults.faceLandmarks && faceResults.faceLandmarks.length > 0) {
                    const landmarks = faceResults.faceLandmarks[0];
                    eyeContactResult = analyzeEyeContact(landmarks);
                } else {
                    // No face detected
                    eyeContactResult = {
                        isLookingAtCamera: false,
                        confidence: 0,
                        direction: 'no face'
                    };
                }
            }

            // Pose detection
            if (poseLandmarkerRef.current) {
                const poseResults = poseLandmarkerRef.current.detectForVideo(videoElement, timestamp);

                if (poseResults.landmarks && poseResults.landmarks.length > 0) {
                    postureResult = analyzePosture(poseResults.landmarks[0]);
                }
            }

            return { eyeContact: eyeContactResult, posture: postureResult };
        } catch (err) {
            console.error('Frame processing error:', err);
            return null;
        }
    }, [isReady]);

    return {
        isReady,
        isLoading,
        error,
        processFrame
    };
}

/**
 * Analyze eye contact from face landmarks
 * Determines if user is looking at camera based on iris position within eye bounds
 */
function analyzeEyeContact(landmarks) {
    if (!landmarks || landmarks.length < 478) {
        return { isLookingAtCamera: false, confidence: 0, direction: 'no face' };
    }

    // MediaPipe face mesh landmark indices:
    // Iris: left 468, right 473
    // Left eye corners: outer 33, inner 133
    // Right eye corners: outer 362, inner 263  
    // Left eye top/bottom: 159 (top), 145 (bottom)
    // Right eye top/bottom: 386 (top), 374 (bottom)

    const leftIris = landmarks[468];
    const rightIris = landmarks[473];
    const leftEyeOuter = landmarks[33];
    const leftEyeInner = landmarks[133];
    const rightEyeOuter = landmarks[362];
    const rightEyeInner = landmarks[263];
    const leftEyeTop = landmarks[159];
    const leftEyeBottom = landmarks[145];
    const rightEyeTop = landmarks[386];
    const rightEyeBottom = landmarks[374];
    const noseTip = landmarks[1];
    const foreheadCenter = landmarks[10];
    const chin = landmarks[152];

    // === HEAD POSE CHECK ===
    // If head is turned significantly away from camera, not looking at camera
    const noseX = noseTip?.x || 0.5;
    const headTurn = Math.abs(noseX - 0.5);
    if (headTurn > 0.10) {
        const direction = noseX > 0.5 ? 'right' : 'left';
        return { isLookingAtCamera: false, confidence: 0.8, direction: `head ${direction}` };
    }

    // Check if eyes are open by measuring eye height
    const leftEyeHeight = leftEyeBottom && leftEyeTop ? Math.abs(leftEyeBottom.y - leftEyeTop.y) : 0;
    const rightEyeHeight = rightEyeBottom && rightEyeTop ? Math.abs(rightEyeBottom.y - rightEyeTop.y) : 0;
    const avgEyeHeight = (leftEyeHeight + rightEyeHeight) / 2;

    // If eyes are very closed (blinking or squinting), we can't determine gaze
    // Eye height is relative to face, typical open eye is ~0.02-0.04 of face
    const faceHeight = foreheadCenter && noseTip ? Math.abs(foreheadCenter.y - noseTip.y) : 0.2;
    const eyeOpenRatio = avgEyeHeight / faceHeight;

    if (eyeOpenRatio < 0.05) {
        // Eyes appear closed or nearly closed - assume looking at camera (benefit of doubt)
        return { isLookingAtCamera: true, confidence: 0.3, direction: 'eyes closed' };
    }

    if (!leftIris || !rightIris || !leftEyeOuter || !leftEyeInner || !rightEyeOuter || !rightEyeInner) {
        return { isLookingAtCamera: true, confidence: 0.5, direction: 'center' };
    }

    // Calculate eye widths
    const leftEyeWidth = Math.abs(leftEyeInner.x - leftEyeOuter.x);
    const rightEyeWidth = Math.abs(rightEyeInner.x - rightEyeOuter.x);

    // Calculate horizontal iris position as percentage within eye
    // 0.5 = center, <0.5 = looking outward, >0.5 = looking inward (toward nose)
    const leftIrisPos = (leftIris.x - leftEyeOuter.x) / leftEyeWidth;
    const rightIrisPos = (rightIris.x - rightEyeOuter.x) / rightEyeWidth;

    // For looking at camera, both irises should be roughly centered
    // STRICTER thresholds: 0.42 to 0.58 for centered gaze
    const centerMin = 0.42;
    const centerMax = 0.58;

    const leftCentered = leftIrisPos >= centerMin && leftIrisPos <= centerMax;
    const rightCentered = rightIrisPos >= centerMin && rightIrisPos <= centerMax;

    // Calculate vertical offset (using eye height as reference)
    const leftEyeVertCenter = (leftEyeTop.y + leftEyeBottom.y) / 2;
    const rightEyeVertCenter = (rightEyeTop.y + rightEyeBottom.y) / 2;
    const leftVertOffset = (leftIris.y - leftEyeVertCenter) / leftEyeHeight;
    const rightVertOffset = (rightIris.y - rightEyeVertCenter) / rightEyeHeight;
    const avgVertOffset = (leftVertOffset + rightVertOffset) / 2;

    // Vertical: looking up is negative, looking down is positive
    // Center is roughly -0.2 to 0.2 range  
    const verticalCentered = Math.abs(avgVertOffset) < 0.3;

    // BOTH eyes must be centered (not just one)
    const isLookingAtCamera = leftCentered && rightCentered && verticalCentered;

    // Calculate confidence based on how centered the iris is
    const leftDeviation = Math.abs(leftIrisPos - 0.5);
    const rightDeviation = Math.abs(rightIrisPos - 0.5);
    const avgDeviation = (leftDeviation + rightDeviation) / 2;
    const confidence = Math.max(0, 1 - avgDeviation * 2);

    // Determine direction if not looking at camera
    let direction = 'center';
    if (!isLookingAtCamera) {
        const avgHorizontalPos = (leftIrisPos + rightIrisPos) / 2;

        if (Math.abs(avgVertOffset) > Math.abs(avgHorizontalPos - 0.5)) {
            // Vertical deviation is greater
            direction = avgVertOffset > 0 ? 'down' : 'up';
        } else {
            // Horizontal deviation is greater
            // When mirrored: iris toward nose = looking at their left = our right
            direction = avgHorizontalPos > 0.5 ? 'right' : 'left';
        }
    }

    return {
        isLookingAtCamera,
        confidence: Math.round(confidence * 100) / 100,
        direction
    };
}

/**
 * Analyze posture from pose landmarks
 */
function analyzePosture(landmarks) {
    const issues = [];
    let score = 100;

    if (!landmarks || landmarks.length < 13) {
        return { isGood: true, score: 100, issues: [] };
    }

    // Key landmarks (MediaPipe pose)
    // 0: nose, 7: left ear, 8: right ear, 11: left shoulder, 12: right shoulder
    const nose = landmarks[0];
    const leftEar = landmarks[7];
    const rightEar = landmarks[8];
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];

    if (!leftShoulder || !rightShoulder) {
        return { isGood: true, score: 100, issues: [] };
    }

    // Check shoulder alignment (should be level)
    const shoulderDiff = Math.abs(leftShoulder.y - rightShoulder.y);
    if (shoulderDiff > 0.05) {
        issues.push('Uneven shoulders - try to level them');
        score -= 15;
    }

    // Check head position relative to shoulders
    const shoulderCenterX = (leftShoulder.x + rightShoulder.x) / 2;

    if (nose) {
        const headOffset = Math.abs(nose.x - shoulderCenterX);
        if (headOffset > 0.08) {
            issues.push('Head tilted - try centering');
            score -= 10;
        }
    }

    // Check for forward head posture (slouching)
    if (leftEar && rightEar) {
        const shoulderCenterY = (leftShoulder.y + rightShoulder.y) / 2;
        const avgEarY = (leftEar.y + rightEar.y) / 2;

        // Ears should be above shoulders (smaller Y value)
        // If ears are at same level or below shoulders, person is slouching
        if (avgEarY > shoulderCenterY - 0.08) {
            issues.push('Sit up straight - chin up!');
            score -= 25;
        }
    }

    // Check distance from camera
    const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
    if (shoulderWidth > 0.55) {
        issues.push('Move back a bit');
        score -= 10;
    } else if (shoulderWidth < 0.18) {
        issues.push('Move closer to camera');
        score -= 10;
    }

    return {
        isGood: issues.length === 0,
        score: Math.max(0, score),
        issues
    };
}

export default useMediaPipe;
