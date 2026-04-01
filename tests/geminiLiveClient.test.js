import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  classifyGeminiLiveError,
  GEMINI_LIVE_ERROR_CATEGORIES
} from '../src/utils/geminiLive.js';
import {
  endGeminiAudioTurn,
  resolveGeminiLiveModel,
  sendGeminiAudioChunk,
  sendGeminiPrompt
} from '../src/utils/geminiLiveClient.js';

test('Gemini Live model resolution finds Gemini 3.1 Flash Live Preview from the model list', async () => {
  const ai = {
    models: {
      list: async function* list() {
        yield { name: 'models/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash' };
        yield { name: 'models/gemini-3.1-flash-live-preview', displayName: 'Gemini 3.1 Flash Live Preview' };
      }
    }
  };

  const resolved = await resolveGeminiLiveModel({ ai });

  assert.equal(resolved.productLabel, 'Gemini 3.1 Flash Live');
  assert.equal(resolved.model, 'gemini-3.1-flash-live-preview');
  assert.equal(resolved.displayName, 'Gemini 3.1 Flash Live Preview');
});

test('Gemini Live model resolution fails when the target model is unavailable', async () => {
  const ai = {
    models: {
      list: async () => ([
        { name: 'models/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash' }
      ])
    }
  };

  await assert.rejects(
    resolveGeminiLiveModel({ ai }),
    /Gemini 3.1 Flash Live Preview is unavailable/
  );
});

test('Gemini Live prompt and audio send paths use the docs-supported request shapes', () => {
  const promptSession = {
    sendRealtimeInput(payload) {
      assert.deepEqual(payload, {
        text: 'Hello, world'
      });
    }
  };

  const audioSession = {
    sendRealtimeInput(payload) {
      assert.deepEqual(payload, {
        audio: {
          data: 'cGNtLWJ5dGVz',
          mimeType: 'audio/pcm;rate=16000'
        }
      });
    }
  };

  const endSession = {
    sendRealtimeInput(payload) {
      assert.deepEqual(payload, { audioStreamEnd: true });
    }
  };

  sendGeminiPrompt(promptSession, 'Hello, world');
  sendGeminiAudioChunk(audioSession, Uint8Array.from([112, 99, 109, 45, 98, 121, 116, 101, 115]));
  endGeminiAudioTurn(endSession);
});

test('Gemini Live error classification keeps model and transport failures in stable buckets', () => {
  assert.equal(
    classifyGeminiLiveError(new Error('unsupported model name')),
    GEMINI_LIVE_ERROR_CATEGORIES.MODEL_UNSUPPORTED
  );

  assert.equal(
    classifyGeminiLiveError(new Error('bad request payload')),
    GEMINI_LIVE_ERROR_CATEGORIES.BAD_REQUEST_PAYLOAD
  );

  assert.equal(
    classifyGeminiLiveError({ code: 1006, message: 'websocket disconnected' }),
    GEMINI_LIVE_ERROR_CATEGORIES.CONNECTION_DROPPED
  );

  assert.equal(
    classifyGeminiLiveError(new Error('no audio response')),
    GEMINI_LIVE_ERROR_CATEGORIES.NO_AUDIO_RESPONSE
  );
});
