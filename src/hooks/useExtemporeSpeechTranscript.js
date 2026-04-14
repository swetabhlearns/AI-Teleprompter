import { useCallback, useEffect, useRef, useState } from 'react';
import {
  buildSpeechRecognitionSnapshot,
  getSpeechRecognitionConstructor
} from '../utils/speechRecognition.js';

const DEFAULT_LANGUAGE = 'en-US';

export function useExtemporeSpeechTranscript({
  enabled = false,
  language = DEFAULT_LANGUAGE
} = {}) {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcriptText, setTranscriptText] = useState('');
  const [interimTranscriptText, setInterimTranscriptText] = useState('');
  const [fragments, setFragments] = useState([]);
  const [error, setError] = useState('');

  const recognitionRef = useRef(null);
  const shouldListenRef = useRef(false);
  const activeLanguageRef = useRef(language);

  const stop = useCallback(() => {
    shouldListenRef.current = false;
    setIsListening(false);

    const recognition = recognitionRef.current;
    recognitionRef.current = null;

    if (recognition) {
      try {
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        recognition.abort();
      } catch {
        try {
          recognition.stop();
        } catch {
          // ignore stop failures
        }
      }
    }
  }, []);

  const start = useCallback(() => {
    const RecognitionCtor = getSpeechRecognitionConstructor();

    if (!RecognitionCtor) {
      setIsSupported(false);
      setError('Speech recognition is not supported in this browser.');
      return false;
    }

    if (recognitionRef.current) {
      shouldListenRef.current = true;
      setIsListening(true);
      return true;
    }

    try {
      const recognition = new RecognitionCtor();
      recognition.lang = activeLanguageRef.current || DEFAULT_LANGUAGE;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event) => {
        const snapshot = buildSpeechRecognitionSnapshot(event.results);
        setTranscriptText(snapshot.transcriptText);
        setInterimTranscriptText(snapshot.interimTranscriptText);
        setFragments(snapshot.fragments);
        setError('');
      };

      recognition.onerror = (event) => {
        setError(event?.error || 'Speech recognition error');
        setIsListening(false);
      };

      recognition.onend = () => {
        if (shouldListenRef.current) {
          window.setTimeout(() => {
            try {
              recognition.start();
              setIsListening(true);
            } catch {
              setIsListening(false);
            }
          }, 120);
          return;
        }

        setIsListening(false);
      };

      shouldListenRef.current = true;
      recognitionRef.current = recognition;
      setIsSupported(true);
      setIsListening(true);
      setError('');
      recognition.start();
      return true;
    } catch (startErr) {
      setError(startErr?.message || 'Failed to start speech recognition');
      setIsListening(false);
      recognitionRef.current = null;
      shouldListenRef.current = false;
      return false;
    }
  }, []);

  const reset = useCallback(() => {
    setTranscriptText('');
    setInterimTranscriptText('');
    setFragments([]);
    setError('');
  }, []);

  useEffect(() => {
    activeLanguageRef.current = language;
  }, [language]);

  useEffect(() => {
    if (!enabled) {
      const stopTimer = window.setTimeout(() => {
        stop();
      }, 0);

      return () => window.clearTimeout(stopTimer);
    }

    const startTimer = window.setTimeout(() => {
      const started = start();

      if (!started) {
        stop();
      }
    }, 0);

    return () => {
      window.clearTimeout(startTimer);
      stop();
    };
  }, [enabled, start, stop]);

  useEffect(() => () => stop(), [stop]);

  return {
    isSupported,
    isListening,
    transcriptText,
    interimTranscriptText,
    combinedTranscriptText: [transcriptText, interimTranscriptText].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim(),
    fragments,
    error,
    start,
    stop,
    reset
  };
}

export default useExtemporeSpeechTranscript;
