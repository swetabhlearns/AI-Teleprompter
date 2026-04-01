# Gemini Interview Mode Contract

This document captures the current working live interview flow in `AI Tracker`.
It is intended to be the stable reference for future changes so we do not drift
back into the broken "question first" or payload-mismatch behavior.

## Current Goal

The interview flow should behave like a real conversational interviewer:

1. The user clicks `Start Interview`.
2. The app enters a waiting/listening state.
3. The user says `hello` or gives an opening introduction.
4. Only then does the live interview actually begin.
5. The interviewer continues in turn-based live conversation.

The app should not auto-ask a question before the user speaks in live mode.

## Supported Live Target

- Product label: `Gemini 3.1 Flash Live`
- Runtime model: resolved from the current Gemini model list at startup
- Registry source: `src/utils/geminiLive.js`
- Live adapter: `src/utils/geminiLiveClient.js`

The app hard-fails if the target model is unavailable.
It does not fall back to another live model.

## User Flow

### Setup screen

The setup screen shows the live mode as available only when:

- the Gemini API key is present
- the model has been resolved successfully
- the live session is not currently connecting
- there is no unresolved live error

The setup screen now includes a `Start Interview` button for the live flow.

### Interview screen

The live interview screen starts in a neutral waiting state.
It does not show a fake first interview question.

The user sees:

- connection status
- the live start action
- a neutral prompt telling them to start the interview
- diagnostics when needed

The current working behavior is:

- click `Start Interview`
- the app connects to Gemini Live
- the app enters listening mode
- the user speaks first
- the model responds after the opening greeting

## State Contract

### Interview states

The shared interview state machine lives in `src/hooks/useInterview.js`.

Relevant states:

- `IDLE`
- `SETUP`
- `READY`
- `LISTENING`
- `PROCESSING`
- `EVALUATING`
- `COMPLETE`
- `ERROR`

### Live turn states

The Gemini live turn state machine lives in `src/utils/geminiLive.js`.

Relevant states:

- `idle`
- `prompting`
- `listening`
- `processing`
- `interrupted`
- `reconnecting`
- `recovered`

### Current live entry behavior

For live mode, the app:

1. connects the Gemini session
2. starts the interview record with an intro-only placeholder turn
3. immediately moves to `LISTENING`
4. waits for the user's first spoken words

The live interview should not auto-trigger `askCurrentQuestion()`.

## Model Resolution Contract

Model resolution happens before `live.connect`.

The adapter in `src/utils/geminiLiveClient.js`:

- lists models from `ai.models.list()`
- matches them against the live registry
- resolves the runtime model name
- caches the result per client instance

The matching registry currently targets:

- `gemini-3.1-flash-live-preview`

If the model is not found, the app returns a clear unsupported-model error.

## Live Connection Contract

The session is opened through `connectGeminiLiveSession()` in
`src/utils/geminiLiveClient.js`.

Current connect arguments:

- `model`: resolved runtime model name
- `config.responseModalities`: `['AUDIO']`
- `config.realtimeInputConfig.automaticActivityDetection.disabled`: `false`
- `config.inputAudioTranscription`: `{}`
- `config.outputAudioTranscription`: `{}`
- `config.systemInstruction`: live interview prompt text
- `callbacks.onopen`
- `callbacks.onmessage`
- `callbacks.onerror`
- `callbacks.onclose`

## Prompt and Audio Send Contract

The adapter exposes a small, strict surface:

- `sendGeminiPrompt(session, text)`
- `sendGeminiAudioChunk(session, chunk, mimeType)`
- `endGeminiAudioTurn(session)`

### Prompt payload

Prompt text is sent as:

```js
session.sendRealtimeInput({
  text
});
```

### Audio payload

Audio chunks are sent as PCM 16 kHz audio:

```js
session.sendRealtimeInput({
  audio: {
    data: base64PcmBytes,
    mimeType: 'audio/pcm;rate=16000'
  }
});
```

### End-of-turn signal

The answer turn ends with:

```js
session.sendRealtimeInput({ audioStreamEnd: true });
```

## Prompt Instruction Contract

The live system instruction in `src/hooks/useGeminiLive.js` should keep the model
focused on interview behavior:

- ask one concise question at a time
- stay professional and warm
- do not over-explain
- wait for the candidate's opening greeting or introduction before beginning
- begin the interview after the candidate says hello or introduces themselves
- acknowledge briefly and move to the next question or follow-up

This instruction is important because it preserves the new start/listen flow.

## UI Contract

### Setup screen

The live mode badge and button should reflect the current model and connection
state.

### Session screen

The live session should show:

- connection status
- turn state
- diagnostics
- the current interview cue only after the user has actually started the turn

The current intro cue is hidden from the main question card and replaced with a
neutral waiting card.

## Diagnostics Contract

The live hook logs structured events to the console so troubleshooting is easier.

Relevant log events:

- `connect:start`
- `session:open`
- `session:error`
- `session:close`
- `prompt:start`
- `prompt:resolved`
- `prompt:no-audio`
- `message`
- `turn-finalize-requested`
- `finalizeTurn:start`
- `finalizeTurn:done`
- `answer-capture:start`
- `answer-capture:audio-chunk`
- `answer-capture:stop:start`
- `answer-capture:stop:done`

These logs help us distinguish:

- model resolution failures
- payload rejections
- connection drops
- text-only turns
- no-audio responses

## Relevant Files

- [src/App.jsx](/Users/swetabh/Developer/Antigravity/AITracker/src/App.jsx)
- [src/components/InterviewSession.jsx](/Users/swetabh/Developer/Antigravity/AITracker/src/components/InterviewSession.jsx)
- [src/components/InterviewSetup.jsx](/Users/swetabh/Developer/Antigravity/AITracker/src/components/InterviewSetup.jsx)
- [src/hooks/useInterview.js](/Users/swetabh/Developer/Antigravity/AITracker/src/hooks/useInterview.js)
- [src/hooks/useGeminiLive.js](/Users/swetabh/Developer/Antigravity/AITracker/src/hooks/useGeminiLive.js)
- [src/utils/geminiLive.js](/Users/swetabh/Developer/Antigravity/AITracker/src/utils/geminiLive.js)
- [src/utils/geminiLiveClient.js](/Users/swetabh/Developer/Antigravity/AITracker/src/utils/geminiLiveClient.js)
- [src/utils/geminiAudio.js](/Users/swetabh/Developer/Antigravity/AITracker/src/utils/geminiAudio.js)

## Notes For Future Changes

- Do not re-enable the old auto-ask behavior in live mode.
- Do not send custom audio payloads that do not match the live adapter contract.
- Do not fall back to another live model if `Gemini 3.1 Flash Live` is missing.
- Keep the start button and the waiting state intact, because this is the flow
  that matched the intended interview experience.
- If the live API changes again, update the adapter first, then the hook, then
  the UI labels.

## Snapshot

This document reflects the flow as of `2026-03-30`.
If the behavior changes later, update this file alongside the code change so the
next person can see both the code path and the reasoning behind it.
