import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { test } from 'node:test';
import { InterviewLiveSessionDO } from '../worker/src/durableObjects/InterviewLiveSessionDO.js';

test('Interview live audio chunks are not checkpointed to Durable Object storage', async () => {
  const puts = [];
  const state = {
    storage: {
      async get() {
        return null;
      },
      async put(key, value) {
        puts.push({ key, value });
      },
      async deleteAlarm() {},
      async setAlarm() {}
    }
  };

  const doInstance = new InterviewLiveSessionDO(state, {
    GEMINI_API_KEY: 'test-key'
  });

  doInstance.sessionId = 'session-1';
  doInstance.liveConnection = {
    sendRealtimeInput(payload) {
      assert.deepEqual(payload, {
        audio: {
          data: 'YWJj',
          mimeType: 'audio/pcm;rate=16000'
        }
      });
    }
  };

  await doInstance.handleClientMessage({
    type: 'audio-chunk',
    data: Buffer.from('abc').toString('base64'),
    mimeType: 'audio/pcm;rate=16000'
  });

  assert.equal(puts.length, 0);
});
