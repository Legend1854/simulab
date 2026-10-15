import { useEffect, useMemo, useState } from 'react';
import { hrefFor, type InstructorTab } from '../../app/router';
import { useAppState, useStore } from '../../app/StoreContext';
import { usePageTitle } from '../../app/usePageTitle';
import { useConfirm } from '../../components/ConfirmDialog';
import { Notice } from '../../components/Notice';
import type { SimulationConfig } from '../../domain/types';
import { issuesByPath, validateConfig } from '../../domain/validation';
import { AssetsTab } from './AssetsTab';
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

export function InstructorPage({ tab }: { tab: InstructorTab }) {
  const state = useAppState();
  const store = useStore();
  const { confirm, dialog } = useConfirm();
  const [flash, setFlash] = useState<string | null>(null);
  const current = TABS.find((item) => item.id === tab) ?? TABS[0]!;
  usePageTitle(`Instructor: ${current.label}`);

  const editing = state.draft ?? state.config;
  const validation = useMemo(() => (state.draft ? validateConfig(state.draft) : null), [state.draft]);
  const errors = useMemo(() => (validation && !validation.ok ? issuesByPath(validation.issues) : {}), [validation]);
  const problemCount = validation && !validation.ok ? validation.issues.length : 0;

  // Unsaved edits live in memory; warn before a reload or tab close would lose them.
  useEffect(() => {
    if (!state.draft) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [state.draft]);

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

  return (
    <>
      <div className="page-head">
        <h1 id="page-title" tabIndex={-1}>Instructor dashboard</h1>
        <p>Configure the simulation, import or export workbooks, and review the sessions stored in this browser.</p>
      </div>
      <div className="notice-list">
        <Notice tone="info" title="Demonstration role">
          This view is a demo role switch, not access control. Anyone using this browser can open it, and nothing here is protected by a login.
        </Notice>
      </div>

      <nav className="tablist" aria-label="Instructor sections">
        {TABS.map((item) => (
          <a key={item.id} className="tab" href={hrefFor({ page: 'instructor', tab: item.id })} aria-current={item.id === tab ? 'page' : undefined}>
            {item.label}
          </a>
        ))}
      </nav>

      {state.draft && (
        <div className="draft-bar" role="region" aria-label="Unsaved changes">
          <span>
            <strong>Unsaved changes.</strong>{' '}
            {problemCount > 0 ? `Fix ${problemCount} ${problemCount === 1 ? 'problem' : 'problems'} before saving.` : 'Ready to save.'}
          </span>
          <span className="row">
            <button type="button" className="btn" onClick={discard}>Discard changes</button>
            <button type="button" className="btn btn-primary" onClick={save} disabled={problemCount > 0}>Save configuration</button>
          </span>
        </div>
      )}
      {flash && (
        <div className="notice-list">
          <Notice tone="success" role="status" onDismiss={() => setFlash(null)}>{flash}</Notice>
        </div>
      )}
      {editsConfig && !state.draft && (
        <p className="hint" style={{ marginBottom: 16 }}>Edits are kept as unsaved changes until you save them. Validation runs as you type.</p>
      )}

      {tab === 'settings' && <SettingsTab config={editing} errors={errors} onChange={change} />}
      {tab === 'assets' && <AssetsTab config={editing} errors={errors} onChange={change} />}
      {tab === 'scenarios' && <ScenariosTab config={editing} errors={errors} onChange={change} />}
      {tab === 'spreadsheet' && <SpreadsheetTab />}
      {tab === 'sessions' && <SessionsTab />}
      {dialog}
    </>
  );
}
