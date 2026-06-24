/**
 * The single source of truth for "every page in the app".
 *
 * Mirrors src/app/**\/page.tsx. When you add a route, add it here and the
 * smoke crawl picks it up automatically.
 */
type RouteGroup = 'public' | 'auth' | 'portal';

export interface RouteDef {
  /** Short, stable name used in the test title and screenshot filename. */
  name: string;
  /** URL path to visit. */
  path: string;
  group: RouteGroup;
  /** Portal pages are wrapped in <ProtectedRoute> and need a session. */
  requiresAuth: boolean;
  /** Dynamic [id] routes: a missing record renders not-found, not a crash. */
  dynamic?: boolean;
}

const EVENT_ID = process.env.E2E_EVENT_ID || '1';
const SPORT_ID = process.env.E2E_SPORT_ID || '1';
const ENROLL_ID = process.env.E2E_ENROLL_ID || '1';

export const ROUTES: RouteDef[] = [
  // --- Public / unauthenticated ---
  { name: 'home', path: '/', group: 'public', requiresAuth: false },
  { name: 'privacy', path: '/privacy', group: 'public', requiresAuth: false },
  { name: 'accessibility', path: '/accessibility', group: 'public', requiresAuth: false },
  { name: 'login', path: '/login', group: 'auth', requiresAuth: false },
  { name: 'unauthorized', path: '/unauthorized', group: 'auth', requiresAuth: false },

  // --- Portal (require a logged-in session) ---
  { name: 'dashboard', path: '/dashboard', group: 'portal', requiresAuth: true },
  { name: 'events', path: '/events', group: 'portal', requiresAuth: true },
  { name: 'event-detail', path: `/events/${EVENT_ID}`, group: 'portal', requiresAuth: true, dynamic: true },
  { name: 'sports', path: '/sports', group: 'portal', requiresAuth: true },
  { name: 'sport-detail', path: `/sports/${SPORT_ID}`, group: 'portal', requiresAuth: true, dynamic: true },
  { name: 'users', path: '/users', group: 'portal', requiresAuth: true },
  { name: 'organizations', path: '/organizations', group: 'portal', requiresAuth: true },
  { name: 'organizer-registration', path: '/organizer-registration', group: 'portal', requiresAuth: true },
  { name: 'organizer-roles', path: '/organizer-roles', group: 'portal', requiresAuth: true },
  { name: 'participation', path: '/participation', group: 'portal', requiresAuth: true },
  { name: 'cards', path: '/cards', group: 'portal', requiresAuth: true },
  { name: 'reports', path: '/reports', group: 'portal', requiresAuth: true },
  { name: 'register', path: '/register', group: 'portal', requiresAuth: true },
  { name: 'leader-registration', path: '/leader-registration', group: 'portal', requiresAuth: true },
  { name: 'registrations', path: '/registrations', group: 'portal', requiresAuth: true },
  { name: 'registration-detail', path: `/registrations/${ENROLL_ID}`, group: 'portal', requiresAuth: true, dynamic: true },
  { name: 'by-number', path: '/by-number', group: 'portal', requiresAuth: true },
  { name: 'by-category', path: '/by-category', group: 'portal', requiresAuth: true },
  { name: 'by-sport', path: '/by-sport', group: 'portal', requiresAuth: true },
  { name: 'open-survey', path: '/open-survey', group: 'portal', requiresAuth: true },
  { name: 'open-survey-fields', path: '/open-survey/fields', group: 'portal', requiresAuth: true },
];
