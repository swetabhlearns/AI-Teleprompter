export const PREFLIGHT_STATUS = {
  IDLE: 'idle',
  CHECKING: 'checking',
  PASSED: 'passed',
  FAILED: 'failed'
};

export function getPreflightSummary(checks = {}) {
  const requiredChecks = ['browser', 'worker', 'microphone', 'speaker'];
  const values = requiredChecks.map((key) => checks[key]?.status || PREFLIGHT_STATUS.IDLE);
  const failed = values.filter((status) => status === PREFLIGHT_STATUS.FAILED).length;
  const checking = values.filter((status) => status === PREFLIGHT_STATUS.CHECKING).length;
  const passed = values.filter((status) => status === PREFLIGHT_STATUS.PASSED).length;

  return {
    total: requiredChecks.length,
    passed,
    failed,
    checking,
    isReady: passed === requiredChecks.length,
    canRetry: failed > 0 && checking === 0
  };
}

export function getBrowserMediaReadiness(scope = globalThis) {
  const hasMediaDevices = Boolean(scope?.navigator?.mediaDevices?.getUserMedia);
  const AudioContextClass = scope?.AudioContext || scope?.webkitAudioContext;
  const hasAudioContext = typeof AudioContextClass === 'function';

  if (!hasMediaDevices || !hasAudioContext) {
    return {
      status: PREFLIGHT_STATUS.FAILED,
      message: 'This browser does not provide the audio features required for a live interview.'
    };
  }

  return {
    status: PREFLIGHT_STATUS.PASSED,
    message: 'Browser audio features are available.'
  };
}

export function stopMediaStream(stream) {
  for (const track of stream?.getTracks?.() || []) {
    track.stop();
  }
}
