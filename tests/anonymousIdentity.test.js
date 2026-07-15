import assert from 'node:assert/strict';
import test from 'node:test';
import { Buffer } from 'node:buffer';

function createStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value)
  };
}

test('anonymous capability persists a stable id and secret', async () => {
  globalThis.btoa = (value) => Buffer.from(value, 'binary').toString('base64');
  const { getAnonymousCapability, getAnonymousCapabilityHeaders } = await import('../src/utils/anonymousIdentity.js');
  const storage = createStorage();
  const first = getAnonymousCapability(storage);
  const second = getAnonymousCapability(storage);
  const headers = getAnonymousCapabilityHeaders(storage);

  assert.deepEqual(second, first);
  assert.equal(headers['X-AITracker-Client-ID'], first.clientId);
  assert.equal(headers['X-AITracker-Client-Secret'], first.clientSecret);
  assert.ok(first.clientSecret.length >= 40);
});
