import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildSarvamAudioBlob,
  decodeBase64ToUint8Array,
  extractSarvamErrorMessage
} from '../src/utils/sarvamTts.js';

test('Sarvam TTS base64 decoding preserves byte order', () => {
  const base64 = globalThis.Buffer.from(Uint8Array.from([0, 127, 255])).toString('base64');
  const bytes = decodeBase64ToUint8Array(base64);

  assert.deepEqual(Array.from(bytes), [0, 127, 255]);
});

test('Sarvam TTS audio blobs are emitted as wav data', () => {
  const base64 = globalThis.Buffer.from(Uint8Array.from([1, 2, 3, 4])).toString('base64');
  const blob = buildSarvamAudioBlob(base64);

  assert.equal(blob.type, 'audio/wav');
  assert.equal(blob.size, 4);
});

test('Sarvam TTS error extraction prefers API detail messages', () => {
  assert.equal(
    extractSarvamErrorMessage({ detail: { message: 'quota exceeded' } }),
    'quota exceeded'
  );
  assert.equal(
    extractSarvamErrorMessage({ error: 'bad request' }),
    'bad request'
  );
  assert.equal(
    extractSarvamErrorMessage(null, 'fallback'),
    'fallback'
  );
});
