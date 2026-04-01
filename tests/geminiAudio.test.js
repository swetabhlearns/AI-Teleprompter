import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  calculateGeminiAudioStartTime,
  decodeBase64Pcm16ToFloat32,
  parseGeminiAudioMimeType
} from '../src/utils/geminiAudio.js';

test('Gemini audio mime types accept PCM and parse the declared sample rate', () => {
  const parsed = parseGeminiAudioMimeType('audio/pcm;rate=48000');

  assert.deepEqual(parsed, {
    mimeType: 'audio/pcm;rate=48000',
    sampleRate: 48000
  });
  assert.equal(parseGeminiAudioMimeType('audio/mp3'), null);
});

test('Gemini audio base64 PCM16 decoding preserves signed 16-bit sample values', () => {
  const pcmBytes = Uint8Array.from([
    0x00, 0x00, // 0
    0x00, 0x80, // -1.0
    0xff, 0x7f  // max positive
  ]);
  const base64 = globalThis.Buffer.from(pcmBytes).toString('base64');
  const decoded = decodeBase64Pcm16ToFloat32(base64);

  assert.equal(decoded.length, 3);
  assert.equal(decoded[0], 0);
  assert.ok(decoded[1] <= -0.9999);
  assert.ok(decoded[2] >= 0.9999);
});

test('Gemini audio start time keeps a small lead while preserving a continuous cursor', () => {
  assert.equal(calculateGeminiAudioStartTime(10, 0), 10.05);
  assert.equal(calculateGeminiAudioStartTime(10, 10.01), 10.05);
  assert.equal(calculateGeminiAudioStartTime(10, 10.2), 10.2);
});
