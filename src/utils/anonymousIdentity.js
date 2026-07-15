const STORAGE_KEY = 'ai-tracker.anonymous-capability.v1';

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function generateSecret() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

function isValidCapability(value) {
  return Boolean(
    value
    && typeof value.clientId === 'string'
    && value.clientId.length >= 16
    && typeof value.clientSecret === 'string'
    && value.clientSecret.length >= 40
  );
}

export function getAnonymousCapability(storage = globalThis.localStorage) {
  try {
    const stored = JSON.parse(storage?.getItem(STORAGE_KEY) || 'null');
    if (isValidCapability(stored)) return stored;
  } catch {
    // Replace malformed or unavailable storage with a fresh capability.
  }

  const capability = {
    clientId: crypto.randomUUID(),
    clientSecret: generateSecret(),
    createdAt: new Date().toISOString()
  };

  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(capability));
  } catch {
    // The capability remains valid for this page even when persistence is blocked.
  }

  return capability;
}

export function getAnonymousCapabilityHeaders(storage) {
  const capability = getAnonymousCapability(storage);
  return {
    'X-AITracker-Client-ID': capability.clientId,
    'X-AITracker-Client-Secret': capability.clientSecret
  };
}

export { STORAGE_KEY as ANONYMOUS_CAPABILITY_STORAGE_KEY };
