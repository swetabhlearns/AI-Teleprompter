import { applyCors, jsonResponse } from './lib/http.js';
import { InterviewLiveSessionDO } from './durableObjects/InterviewLiveSessionDO.js';
import { handleAiRoutes } from './routes/ai.js';
import { handleInterviewSessions } from './routes/interviewSessions.js';
import { handleInterviewLiveSessions } from './routes/interviewLiveSessions.js';
import { enforceRequestProtection, protectionErrorResponse } from './lib/protection.js';
import { handleFeedback } from './routes/feedback.js';
import { handleEvents } from './routes/events.js';

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
      'GET /ready',
      'GET /api',
      'POST /api/script/generate',
      'POST /api/script/refine',
      'POST /api/extempore/topics',
      'POST /api/extempore/coach',
      'POST /api/transcribe',
      'POST /api/tts/sarvam',
      'POST /api/tts/elevenlabs/:voiceId?',
      'POST /api/feedback',
      'POST /api/events',
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

      if (request.method === 'GET' && url.pathname === '/ready') {
        try {
          const database = await env.DB.prepare('SELECT 1 AS ready').first();
          return respond(jsonResponse({
            ok: true,
            service: env?.APP_NAME || 'AI Tracker',
            status: database?.ready === 1 ? 'healthy' : 'degraded'
          }, { status: database?.ready === 1 ? 200 : 503 }));
        } catch (error) {
          console.error(JSON.stringify({
            message: 'readiness_check_failed',
            error: error instanceof Error ? error.message : String(error)
          }));
          return respond(jsonResponse({ ok: false, status: 'degraded' }, { status: 503 }));
        }
      }

      if (request.method === 'GET' && url.pathname === '/api') {
        return respond(jsonResponse(buildRouteManifest()));
      }

      const protectionResponse = await enforceRequestProtection(request, env, url);
      if (protectionResponse) return respond(protectionResponse);

      const aiResponse = await handleAiRoutes(request, env, url);
      if (aiResponse) {
        return respond(aiResponse);
      }

      const interviewSessionsResponse = await handleInterviewSessions(request, env, url);
      if (interviewSessionsResponse) {
        return respond(interviewSessionsResponse);
      }

      const feedbackResponse = await handleFeedback(request, env, url);
      if (feedbackResponse) {
        return respond(feedbackResponse);
      }

      const eventsResponse = await handleEvents(request, env, url);
      if (eventsResponse) {
        return respond(eventsResponse);
      }

      const interviewLiveSessionsResponse = await handleInterviewLiveSessions(request, env, url);
      if (interviewLiveSessionsResponse) {
        return respond(interviewLiveSessionsResponse);
      }

      return respond(notFound());
    } catch (error) {
      const protectionResponse = protectionErrorResponse(error);
      if (protectionResponse) return respond(protectionResponse);
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
