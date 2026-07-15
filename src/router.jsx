import { Navigate, createRoute, createRootRoute, createRouter } from '@tanstack/react-router';
import { AppShell } from './app/AppShell';
import ScriptRoute from './features/script/ScriptRoute';
import { ExtemporeLiveRoute, ExtemporeSelectionRoute } from './features/extempore/ExtemporeRoute';
import InterviewRoute from './features/interview/InterviewRoute';
import PracticeRoute from './features/practice/PracticeRoute';
import HistoryRoute from './features/history/HistoryRoute';

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
  component: ExtemporeSelectionRoute
});

const extemporeLiveRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'extempore/live',
  component: ExtemporeLiveRoute
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

const historyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'history',
  component: HistoryRoute
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  scriptRoute,
  extemporeRoute,
  extemporeLiveRoute,
  interviewRoute,
  practiceRoute,
  historyRoute
]);

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent'
});
