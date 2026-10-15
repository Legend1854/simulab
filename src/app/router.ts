import { useEffect, useState } from 'react';

/** Small hash router: real links, working back button, and static hosting with no server rewrites. */

export const INSTRUCTOR_TABS = ['settings', 'assets', 'scenarios', 'spreadsheet', 'sessions'] as const;
export type InstructorTab = (typeof INSTRUCTOR_TABS)[number];

export type Route = { page: 'home' } | { page: 'student' } | { page: 'instructor'; tab: InstructorTab };

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'student') return { page: 'student' };
  if (parts[0] === 'instructor') {
    const tab = INSTRUCTOR_TABS.find((candidate) => candidate === parts[1]) ?? 'settings';
    return { page: 'instructor', tab };
  }
  return { page: 'home' };
}

export function hrefFor(route: Route): string {
  if (route.page === 'student') return '#/student';
  if (route.page === 'instructor') return `#/instructor/${route.tab}`;
  return '#/';
}

export function navigate(route: Route): void {
  window.location.hash = hrefFor(route);
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
