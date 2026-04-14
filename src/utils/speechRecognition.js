function normalizeTranscriptText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

export function getSpeechRecognitionConstructor() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function buildSpeechRecognitionSnapshot(results = []) {
  const finalParts = [];
  const interimParts = [];
  const fragments = [];

  for (let index = 0; index < results.length; index += 1) {
    const result = results[index];
    const transcript = normalizeTranscriptText(result?.[0]?.transcript || '');

    if (!transcript) {
      continue;
    }

    const fragment = {
      index,
      text: transcript,
      isFinal: Boolean(result?.isFinal)
    };

    fragments.push(fragment);

    if (fragment.isFinal) {
      finalParts.push(transcript);
    } else {
      interimParts.push(transcript);
    }
  }

  const transcriptText = normalizeTranscriptText(finalParts.join(' '));
  const interimTranscriptText = normalizeTranscriptText(interimParts.join(' '));
  const combinedTranscriptText = normalizeTranscriptText([transcriptText, interimTranscriptText].filter(Boolean).join(' '));

  return {
    transcriptText,
    interimTranscriptText,
    combinedTranscriptText,
    fragments
  };
}
