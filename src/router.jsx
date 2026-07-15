import { lazy } from 'react';
import { Navigate, createRoute, createRootRoute, createRouter } from '@tanstack/react-router';
import { AppShell } from './app/AppShell';
import { RouteError } from './components/ui/RouteError';
import { RouteSuspense } from './components/ui/RouteSuspense';

const ScriptRoute = lazy(() => import('./features/script/ScriptRoute'));
const InterviewRoute = lazy(() => import('./features/interview/InterviewRoute'));
const PracticeRoute = lazy(() => import('./features/practice/PracticeRoute'));
const HistoryRoute = lazy(() => import('./features/history/HistoryRoute'));
const PrivacyRoute = lazy(() => import('./features/privacy/PrivacyRoute'));
const ExtemporeSelectionRoute = lazy(() =>
  import('./features/extempore/ExtemporeRoute').then((module) => ({
    default: module.ExtemporeSelectionRoute
  }))
);
const ExtemporeLiveRoute = lazy(() =>
  import('./features/extempore/ExtemporeRoute').then((module) => ({
    default: module.ExtemporeLiveRoute
  }))
);

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
  component: () => <RouteSuspense><ScriptRoute /></RouteSuspense>
});

const extemporeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'extempore',
  component: () => <RouteSuspense><ExtemporeSelectionRoute /></RouteSuspense>
});

const extemporeLiveRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'extempore/live',
  component: () => <RouteSuspense><ExtemporeLiveRoute /></RouteSuspense>
});

const interviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'interview',
  validateSearch: (search) => ({
    report: typeof search.report === 'string' ? search.report : undefined
  }),
  component: () => <RouteSuspense><InterviewRoute /></RouteSuspense>
});

const practiceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'practice',
  component: () => <RouteSuspense><PracticeRoute /></RouteSuspense>
});

const historyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'history',
  component: () => <RouteSuspense><HistoryRoute /></RouteSuspense>
});

const privacyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'privacy',
  component: () => <RouteSuspense><PrivacyRoute /></RouteSuspense>
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  scriptRoute,
  extemporeRoute,
  extemporeLiveRoute,
  interviewRoute,
  practiceRoute,
  historyRoute,
  privacyRoute
]);

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  defaultErrorComponent: RouteError
});
