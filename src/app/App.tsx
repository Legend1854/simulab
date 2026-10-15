import { lazy, Suspense, useEffect, useRef } from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Logo } from '../components/Logo';
import { Notice } from '../components/Notice';
import { HomePage } from '../features/home/HomePage';
import { StudentPage } from '../features/student/StudentPage';
import { hrefFor, useRoute, type Route } from './router';
import { StoreProvider, useAppState, useStore } from './StoreContext';
import type { AppStore } from './store';

// The instructor dashboard (and SheetJS, which only it uses) is loaded on demand, keeping the student bundle small.
const InstructorPage = lazy(() => import('../features/instructor/InstructorPage').then((module) => ({ default: module.InstructorPage })));

function NavLink({ route, current, children }: { route: Route; current: Route; children: React.ReactNode }) {
  return (
    <a href={hrefFor(route)} aria-current={route.page === current.page ? 'page' : undefined}>
      {children}
    </a>
  );
}

function Layout() {
  const route = useRoute();
  const state = useAppState();
  const store = useStore();
  const firstRender = useRef(true);

  useEffect(() => {
    // After the first page load, route changes count as in-app navigation (used for focus management).
    if (firstRender.current) firstRender.current = false;
    else document.body.dataset.navigated = 'true';
  }, [route]);

  return (
    <>
      <a className="skip-link" href="#main" onClick={(event) => { event.preventDefault(); document.getElementById('main')?.focus(); }}>
        Skip to content
      </a>
      <header className="site-header">
        <div className="shell">
          <a className="wordmark" href="#/">
            <Logo />
            SimuLab
          </a>
          <nav className="site-nav" aria-label="Main">
            <ul>
              <li><NavLink route={{ page: 'home' }} current={route}>Home</NavLink></li>
              <li><NavLink route={{ page: 'student' }} current={route}>Student</NavLink></li>
              <li><NavLink route={{ page: 'instructor', tab: 'settings' }} current={route}>Instructor <span className="role-tag">(demo)</span></NavLink></li>
            </ul>
          </nav>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        <div className="shell">
          {(state.notices.length > 0 || state.saveError) && (
            <div className="notice-list">
              {state.saveError && <Notice tone="error" role="alert" title="Not saved">{state.saveError}</Notice>}
              {state.notices.map((notice) => (
                <Notice key={notice.id} tone={notice.tone} onDismiss={() => store.dismissNotice(notice.id)}>{notice.text}</Notice>
              ))}
            </div>
          )}
          {route.page === 'home' && <HomePage />}
          {route.page === 'student' && <StudentPage />}
          {route.page === 'instructor' && (
            <Suspense fallback={<p className="muted" role="status">Loading the instructor dashboard…</p>}>
              <InstructorPage tab={route.tab} />
            </Suspense>
          )}
        </div>
      </main>
      <footer className="site-footer">
        <div className="shell">
          <p>Educational simulation with hypothetical scenarios. It is not financial advice and does not use real market data.</p>
          <p>An independent student portfolio project. It is not affiliated with or endorsed by any university. Results are stored only in this browser.</p>
        </div>
      </footer>
    </>
  );
}

export function App({ store, onResetData }: { store: AppStore; onResetData: () => void }) {
  return (
    <ErrorBoundary onResetData={onResetData}>
      <StoreProvider store={store}>
        <Layout />
      </StoreProvider>
    </ErrorBoundary>
  );
}
