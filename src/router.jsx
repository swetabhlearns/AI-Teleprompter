import { Navigate, createRoute, createRootRoute, createRouter } from '@tanstack/react-router';
import { AppShell } from './app/AppShell';
import ScriptRoute from './features/script/ScriptRoute';
import ExtemporeRoute from './features/extempore/ExtemporeRoute';
import InterviewRoute from './features/interview/InterviewRoute';
import PracticeRoute from './features/practice/PracticeRoute';

const rootRoute = createRootRoute({
  component: AppShell
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => <Navigate to="/script" />
});

const scriptRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'script',
  component: ScriptRoute
});

const extemporeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'extempore',
  component: ExtemporeRoute
});

const interviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'interview',
  component: InterviewRoute
});

const practiceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'practice',
  component: PracticeRoute
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  scriptRoute,
  extemporeRoute,
  interviewRoute,
  practiceRoute
]);

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent'
});

