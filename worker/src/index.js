import { applyCors, jsonResponse } from './lib/http.js';
import { InterviewLiveSessionDO } from './durableObjects/InterviewLiveSessionDO.js';
import { handleAiRoutes } from './routes/ai.js';
import { handleInterviewSessions } from './routes/interviewSessions.js';
import { handleInterviewLiveSessions } from './routes/interviewLiveSessions.js';

function notFound() {
  return jsonResponse(
    {
      ok: false,
      error: 'not_found'
    },
    { status: 404 }
  );
}

function buildRouteManifest() {
  return {
    ok: true,
    service: 'ai-tracker-worker',
    routes: [
      'GET /health',
      'GET /api',
      'POST /api/script/generate',
      'POST /api/script/refine',
      'POST /api/extempore/topics',
      'POST /api/extempore/coach',
      'POST /api/transcribe',
      'POST /api/tts/sarvam',
      'POST /api/tts/elevenlabs/:voiceId?',
      'GET /api/interview/sessions',
      'POST /api/interview/sessions',
      'PATCH /api/interview/sessions/:id',
      'DELETE /api/interview/sessions/:id',
      'POST /api/interview/live-sessions',
      'GET /api/interview/live-sessions/:id',
      'GET /api/interview/live-sessions/:id/log',
      'POST /api/interview/live-sessions/:id/complete',
      'POST /api/interview/live-sessions/:id/fail',
      'GET /api/interview/live-sessions/:id/ws'
    ]
  };
}

export default {
  async fetch(request, env) {
    const respond = (response) => applyCors(response, request, env);
    try {
      const url = new URL(request.url);

      if (request.method === 'OPTIONS') {
        return respond(new Response(null, { status: 204 }));
      }

      if (request.method === 'GET' && url.pathname === '/health') {
        return respond(jsonResponse({
          ok: true,
          service: env?.APP_NAME || 'AI Tracker',
          status: 'healthy'
        }));
      }

      if (request.method === 'GET' && url.pathname === '/api') {
        return respond(jsonResponse(buildRouteManifest()));
      }

      const aiResponse = await handleAiRoutes(request, env, url);
      if (aiResponse) {
        return respond(aiResponse);
      }

      const interviewSessionsResponse = await handleInterviewSessions(request, env, url);
      if (interviewSessionsResponse) {
        return respond(interviewSessionsResponse);
      }

      const interviewLiveSessionsResponse = await handleInterviewLiveSessions(request, env, url);
      if (interviewLiveSessionsResponse) {
        return respond(interviewLiveSessionsResponse);
      }

      return respond(notFound());
    } catch (error) {
      return respond(jsonResponse(
        {
          ok: false,
          error: {
            code: 'worker_error',
            message: error?.message || 'Worker request failed'
          }
        },
        { status: 500 }
      ));
    }
  }
};

export { InterviewLiveSessionDO };
