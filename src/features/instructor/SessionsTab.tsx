import { useState } from 'react';
import { useAppState, useStore } from '../../app/StoreContext';
import { Change } from '../../components/Change';
import { useConfirm } from '../../components/ConfirmDialog';
import { EmptyState } from '../../components/EmptyState';
import { Icon, type IconName } from '../../components/Icon';
import { Notice } from '../../components/Notice';
import { sessionStats } from '../../domain/progression';
import type { SessionStatus, SimulationSession } from '../../domain/types';
import { sessionsToCsv } from '../../services/exports/csv';
import { downloadCsv } from '../../services/exports/download';
import { formatCurrency, formatDateTime, formatScore } from '../../utils/format';
import { RoundLedger } from '../student/RoundLedger';

const STATUS: Record<SessionStatus, { label: string; pill: string; icon: IconName }> = {
  in_progress: { label: 'In progress', pill: 'pill pill-petrol', icon: 'restart' },
  complete: { label: 'Complete', pill: 'pill pill-ok', icon: 'check' },
  abandoned: { label: 'Abandoned', pill: 'pill', icon: 'close' },
};

/** One segment per round, filled for rounds already submitted. The text alternative carries the count. */
function Progress({ done, total }: { done: number; total: number }) {
  return (
    <span className="progress">
      <span className="progress-segments" aria-hidden="true">
        {Array.from({ length: total }, (_, index) => (
          <span key={index} data-done={index < done} />
        ))}
      </span>
      <span className="progress-text">
        {done} of {total}
      </span>
    </span>
  );
}

export function SessionsTab() {
  const { sessions, activeSessionId } = useAppState();
  const store = useStore();
  const { confirm, dialog } = useConfirm();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const selected = sessions.find((session) => session.id === selectedId) ?? null;
  const resultCount = sessions.reduce((sum, session) => sum + session.results.length, 0);
  const ordered = [...sessions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const labelOf = (session: SimulationSession) => session.participantLabel || 'Anonymous';

  const deleteOne = async (id: string, label: string) => {
    const ok = await confirm({ title: 'Delete this session?', body: `${label}'s session and its round history will be removed from this browser.`, confirmLabel: 'Delete session', tone: 'danger' });
    if (!ok) return;
    store.deleteSession(id);
    if (selectedId === id) setSelectedId(null);
    setMessage('Session deleted.');
  };

  const deleteAll = async () => {
    const ok = await confirm({
      title: 'Delete all sessions?',
      body: `All ${sessions.length} sessions stored in this browser, including any simulation in progress, will be removed. The configuration is kept.`,
      confirmLabel: 'Delete all sessions',
      tone: 'danger',
    });
    if (!ok) return;
    store.deleteAllSessions();
    setSelectedId(null);
    setMessage('All sessions deleted.');
  };

  const resetAll = async () => {
    const ok = await confirm({
      title: 'Reset all SimuLab data?',
      body: 'This deletes every session and restores the default configuration, including any imported workbook. It cannot be undone.',
      confirmLabel: 'Reset everything',
      tone: 'danger',
    });
    if (!ok) return;
    store.resetEverything();
    setSelectedId(null);
    setMessage('All data reset. The default configuration is active again.');
  };

  return (
    <div className="stack">
      <section className="sheet" aria-labelledby="sessions-title">
        <div className="sheet-section sheet-head-only">
          <div className="row-between">
            <h2 id="sessions-title">Sessions in this browser</h2>
            <div className="row">
              <button type="button" className="btn btn-sm" disabled={resultCount === 0} onClick={() => downloadCsv(sessionsToCsv(ordered), 'simulab-all-results.csv')}>
                <Icon name="download" size={14} />
                Export all results (CSV)
              </button>
              <button type="button" className="btn btn-sm btn-danger" disabled={sessions.length === 0} onClick={deleteAll}>
                <Icon name="trash" size={14} />
                Delete all sessions
              </button>
            </div>
          </div>
          <p className="muted small">
            Stored only in this browser's local storage. These are demo records, not a secure record: other browsers and devices cannot see them, and clearing site data
            removes them.
          </p>
          {message && (
            <Notice tone="success" role="status" onDismiss={() => setMessage(null)}>
              {message}
            </Notice>
          )}
        </div>
        {sessions.length === 0 ? (
          <EmptyState title="No sessions yet" icon="user" action={<a className="btn" href="#/student">Open the student view</a>}>
            A session appears here when someone starts the simulation in this browser.
          </EmptyState>
        ) : (
          <div className="sheet-section">
            <div className="table-wrap">
              <table className="table sessions-table">
                <caption className="visually-hidden">Sessions, most recently updated first</caption>
                <thead>
                  <tr>
                    <th scope="col">Participant</th>
                    <th scope="col">Status</th>
                    <th scope="col">Rounds</th>
                    <th scope="col" className="num">Balance</th>
                    <th scope="col" className="num">Total return</th>
                    <th scope="col" className="num">Average score</th>
                    <th scope="col">Last updated</th>
                    <th scope="col"><span className="visually-hidden">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {ordered.map((session) => {
                    const stats = sessionStats(session);
                    const label = labelOf(session);
                    const status = STATUS[session.status];
                    const isSelected = session.id === selectedId;
                    return (
                      <tr key={session.id} data-selected={isSelected}>
                        <th scope="row">
                          {label}
                          {session.id === activeSessionId && session.status === 'in_progress' && <span className="muted small"> (open in student view)</span>}
                          <span className="cell-note">{session.config.name}</span>
                        </th>
                        <td>
                          <span className={status.pill}>
                            <Icon name={status.icon} size={12} />
                            {status.label}
                          </span>
                        </td>
                        <td><Progress done={stats.roundsCompleted} total={stats.totalRounds} /></td>
                        <td className="num">{formatCurrency(stats.currentBalance)}</td>
                        <td className="num">{stats.roundsCompleted === 0 ? <span className="muted">None yet</span> : <Change value={stats.totalReturn} kind="fraction" />}</td>
                        <td className="num">
                          {stats.averageScore === null ? <span className="muted">None yet</span> : formatScore(stats.averageScore)}
                          {stats.rating && <span className="cell-note">{stats.rating}</span>}
                        </td>
                        <td className="nowrap">{formatDateTime(session.updatedAt)}</td>
                        <td>
                          <div className="row-actions">
                            <button type="button" className="btn btn-sm" aria-pressed={isSelected} disabled={session.results.length === 0} onClick={() => setSelectedId(isSelected ? null : session.id)}>
                              {isSelected ? 'Hide rounds' : 'Show rounds'}
                              <span className="visually-hidden"> for {label}</span>
                            </button>
                            <button type="button" className="btn btn-sm btn-danger icon-btn" aria-label={`Delete session for ${label}`} onClick={() => deleteOne(session.id, label)}>
                              <Icon name="trash" size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {selected && (
          <div className="sheet-section">
            <RoundLedger session={selected} caption={`Rounds played by ${labelOf(selected)}`} />
          </div>
        )}
      </section>

      <section className="sheet danger-zone" aria-labelledby="reset-title">
        <div className="sheet-section row-between">
          <div>
            <h2 id="reset-title">Reset demo data</h2>
            <p className="muted small">Deletes every session and restores the default configuration. This cannot be undone.</p>
          </div>
          <button type="button" className="btn btn-danger" onClick={resetAll}>
            <Icon name="restart" size={16} />
            Reset everything
          </button>
        </div>
      </section>
      {dialog}
    </div>
  );
}
