import { useEffect, useMemo, useState } from 'react';
import { hrefFor, navigate, type InstructorTab } from '../../app/router';
import { useAppState, useStore } from '../../app/StoreContext';
import { usePageTitle } from '../../app/usePageTitle';
import { useConfirm } from '../../components/ConfirmDialog';
import { Icon } from '../../components/Icon';
import { Notice } from '../../components/Notice';
import type { SimulationConfig, ValidationIssue } from '../../domain/types';
import { issuesByPath, validateConfig } from '../../domain/validation';
import { AssetsTab } from './AssetsTab';
import { fieldId } from './fields';
import { ScenariosTab } from './ScenariosTab';
import { SessionsTab } from './SessionsTab';
import { SettingsTab } from './SettingsTab';
import { SpreadsheetTab } from './SpreadsheetTab';

const TABS: Array<{ id: InstructorTab; label: string }> = [
  { id: 'settings', label: 'Settings and scoring' },
  { id: 'assets', label: 'Assets' },
  { id: 'scenarios', label: 'Scenarios' },
  { id: 'spreadsheet', label: 'Spreadsheet' },
  { id: 'sessions', label: 'Sessions and results' },
];

/** Which tab edits a configuration path. Paths come from validateConfig, e.g. `scenarios[2].returnsPct.cash`. */
function tabForPath(path: string): InstructorTab {
  if (path.startsWith('assets')) return 'assets';
  if (path.startsWith('scenarios')) return 'scenarios';
  return 'settings';
}

/**
 * The element to focus for a path. Some paths have no input of their own (a whole scenario row,
 * the weights group), so fall back to the closest parent path that has one.
 */
function elementForPath(path: string): HTMLElement | null {
  let candidate = path;
  while (candidate) {
    const element = document.getElementById(fieldId(candidate));
    if (element) return element;
    const shorter = candidate.replace(/(\.[^.[\]]+|\[\d+\])$/, '');
    if (shorter === candidate) break;
    candidate = shorter;
  }
  return null;
}

/** Lists every problem in the unsaved configuration, each one a button that opens the field that needs attention. */
function ValidationSummary({ issues, onGo }: { issues: ValidationIssue[]; onGo: (path: string) => void }) {
  return (
    <section className="sheet validation-summary" aria-labelledby="validation-title">
      <div className="sheet-section">
        <h2 id="validation-title" className="validation-title">
          <Icon name="alert" size={18} />
          {issues.length === 1 ? '1 problem to fix before saving' : `${issues.length} problems to fix before saving`}
        </h2>
        <ul className="validation-list">
          {issues.map((issue, index) => {
            const path = issue.location?.path ?? '';
            const tabLabel = TABS.find((item) => item.id === tabForPath(path))?.label ?? '';
            return (
              <li key={`${path}-${issue.code}-${index}`}>
                <span className="validation-where">{tabLabel}</span>
                <button type="button" className="link-btn" onClick={() => onGo(path)}>
                  {issue.message}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export function InstructorPage({ tab }: { tab: InstructorTab }) {
  const state = useAppState();
  const store = useStore();
  const { confirm, dialog } = useConfirm();
  const [flash, setFlash] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ path: string; at: number } | null>(null);
  const current = TABS.find((item) => item.id === tab) ?? TABS[0]!;
  usePageTitle(`Instructor: ${current.label}`);

  const editing = state.draft ?? state.config;
  const validation = useMemo(() => (state.draft ? validateConfig(state.draft) : null), [state.draft]);
  const issues = useMemo(() => (validation && !validation.ok ? validation.issues : []), [validation]);
  const errors = useMemo(() => issuesByPath(issues), [issues]);
  const problemsByTab = useMemo(() => {
    const counts: Partial<Record<InstructorTab, number>> = {};
    for (const item of issues) {
      const target = tabForPath(item.location?.path ?? '');
      counts[target] = (counts[target] ?? 0) + 1;
    }
    return counts;
  }, [issues]);

  // Unsaved edits live in memory; warn before a reload or tab close would lose them.
  useEffect(() => {
    if (!state.draft) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [state.draft]);

  // After "go to field", wait for the target tab (and, for scenario details, the selected round) to render, then focus.
  useEffect(() => {
    if (!focusRequest) return;
    let frame = 0;
    let attempts = 0;
    const tryFocus = () => {
      const element = elementForPath(focusRequest.path);
      if (element) {
        element.scrollIntoView?.({ block: 'center' }); // not implemented in every environment (jsdom)
        element.focus({ preventScroll: true });
        return;
      }
      if (++attempts < 20) frame = requestAnimationFrame(tryFocus);
    };
    frame = requestAnimationFrame(tryFocus);
    return () => cancelAnimationFrame(frame);
  }, [focusRequest, tab]);

  const goTo = (path: string) => {
    const target = tabForPath(path);
    if (target !== tab) navigate({ page: 'instructor', tab: target });
    setFocusRequest({ path, at: Date.now() });
  };

  const change = (next: SimulationConfig) => {
    setFlash(null);
    store.setDraft(next);
  };

  const save = () => {
    if (!state.draft) return;
    const result = store.saveConfiguration(state.draft);
    if (result.ok) setFlash('Configuration saved. New simulations use it; simulations already in progress keep the settings they started with.');
  };

  const discard = async () => {
    const ok = await confirm({ title: 'Discard unsaved changes?', body: 'Your edits will be lost and the saved configuration will be shown again.', confirmLabel: 'Discard changes', tone: 'danger' });
    if (ok) {
      store.setDraft(null);
      setFlash(null);
    }
  };

  const editsConfig = tab === 'settings' || tab === 'assets' || tab === 'scenarios';
  const problemCount = issues.length;

  return (
    <>
      <header className="ws-head">
        <div className="ws-title">
          <h1 id="page-title" tabIndex={-1}>Instructor workspace</h1>
          <p className="muted">Set up the scenarios students play, move them in and out of Excel, and review the sessions stored in this browser.</p>
        </div>
        <dl className="ws-status">
          <div>
            <dt>Active configuration</dt>
            <dd>{state.config.name}</dd>
          </div>
          <div>
            <dt>Rounds and assets</dt>
            <dd>
              {state.config.scenarios.length} rounds, {state.config.assets.length} assets
            </dd>
          </div>
          <div>
            <dt>Editor</dt>
            <dd>
              {!state.draft ? (
                <span className="pill pill-ok">
                  <Icon name="check" size={12} />
                  All changes saved
                </span>
              ) : problemCount > 0 ? (
                <span className="pill pill-error">
                  <Icon name="alert" size={12} />
                  Unsaved, {problemCount} {problemCount === 1 ? 'problem' : 'problems'}
                </span>
              ) : (
                <span className="pill pill-ochre">
                  <Icon name="pencil" size={12} />
                  Unsaved changes
                </span>
              )}
            </dd>
          </div>
        </dl>
      </header>
      <p className="demo-note">
        <Icon name="info" size={16} />
        <span>
          <strong>Demo role, no login.</strong> Anyone using this browser can open this workspace. It is a role switch for the demonstration, not access control.
        </span>
      </p>

      <nav className="tablist" aria-label="Instructor sections">
        {TABS.map((item) => {
          const count = problemsByTab[item.id] ?? 0;
          return (
            <a key={item.id} className="tab" href={hrefFor({ page: 'instructor', tab: item.id })} aria-current={item.id === tab ? 'page' : undefined}>
              {item.label}
              {count > 0 && (
                <span className="tab-count">
                  {count}
                  <span className="visually-hidden"> {count === 1 ? 'problem' : 'problems'}</span>
                </span>
              )}
            </a>
          );
        })}
      </nav>

      {state.draft && (
        <div className="draft-bar" role="region" aria-label="Unsaved changes">
          <p className="draft-text">
            <Icon name={problemCount > 0 ? 'alert' : 'pencil'} size={18} />
            <span>
              <strong>Unsaved changes.</strong>{' '}
              {problemCount > 0 ? `Fix ${problemCount} ${problemCount === 1 ? 'problem' : 'problems'} before saving.` : 'Everything checks out. Save to use these settings for new simulations.'}
            </span>
          </p>
          <span className="row">
            <button type="button" className="btn btn-on-ink" onClick={discard}>Discard changes</button>
            <button type="button" className="btn btn-primary" onClick={save} disabled={problemCount > 0}>Save configuration</button>
          </span>
        </div>
      )}
      {flash && (
        <div className="notice-list">
          <Notice tone="success" role="status" onDismiss={() => setFlash(null)}>{flash}</Notice>
        </div>
      )}
      {problemCount > 0 && <ValidationSummary issues={issues} onGo={goTo} />}
      {editsConfig && !state.draft && <p className="hint ws-hint">Edits stay as unsaved changes until you save them, and every field is checked as you type.</p>}

      <div className="ws-body">
        {tab === 'settings' && <SettingsTab config={editing} errors={errors} onChange={change} />}
        {tab === 'assets' && <AssetsTab config={editing} errors={errors} onChange={change} />}
        {tab === 'scenarios' && <ScenariosTab config={editing} errors={errors} onChange={change} focusPath={focusRequest?.path ?? null} />}
        {tab === 'spreadsheet' && <SpreadsheetTab />}
        {tab === 'sessions' && <SessionsTab />}
      </div>
      {dialog}
    </>
  );
}
