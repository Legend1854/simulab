import { useState } from 'react';
import { useAppState, useStore } from '../../app/StoreContext';
import { useConfirm } from '../../components/ConfirmDialog';
import { EmptyState } from '../../components/EmptyState';
import { Notice } from '../../components/Notice';
import { sessionStats } from '../../domain/progression';
import type { SessionStatus } from '../../domain/types';
import { sessionsToCsv } from '../../services/exports/csv';
import { downloadCsv } from '../../services/exports/download';
import { formatCurrency, formatDateTime, formatScore } from '../../utils/format';
import { RoundLedger } from '../student/RoundLedger';

const STATUS_LABEL: Record<SessionStatus, string> = { in_progress: 'In progress', complete: 'Complete', abandoned: 'Abandoned' };
const STATUS_BADGE: Record<SessionStatus, string> = { in_progress: 'badge badge-teal', complete: 'badge badge-ok', abandoned: 'badge' };

export function SessionsTab() {
  const { sessions, activeSessionId } = useAppState();
  const store = useStore();
  const { confirm, dialog } = useConfirm();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const selected = sessions.find((session) => session.id === selectedId) ?? null;
  const resultCount = sessions.reduce((sum, session) => sum + session.results.length, 0);
  const ordered = [...sessions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

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
      <section className="panel" aria-labelledby="sessions-title">
        <div className="panel-section">
          <div className="section-title">
            <h2 id="sessions-title">Demo sessions in this browser</h2>
            <div className="row">
              <button type="button" className="btn" disabled={resultCount === 0} onClick={() => downloadCsv(sessionsToCsv(ordered), 'simulab-all-results.csv')}>
                Export all results (CSV)
              </button>
              <button type="button" className="btn btn-danger" disabled={sessions.length === 0} onClick={deleteAll}>Delete all sessions</button>
            </div>
          </div>
          <p className="muted small">
            Sessions are stored only in this browser's local storage. They are demo data, not a secure record, and other browsers or devices cannot see them.
          </p>
          {message && <div style={{ marginTop: 12 }}><Notice tone="success" role="status" onDismiss={() => setMessage(null)}>{message}</Notice></div>}
        </div>
        {sessions.length === 0 ? (
          <EmptyState title="No sessions yet" action={<a className="btn" href="#/student">Open the student view</a>}>
            Sessions appear here when someone starts the simulation in this browser.
          </EmptyState>
        ) : (
          <div className="panel-section">
            <div className="table-wrap">
              <table className="table">
                <caption className="visually-hidden">Sessions, most recently updated first</caption>
                <thead>
                  <tr>
                    <th scope="col">Participant</th>
                    <th scope="col">Status</th>
                    <th scope="col">Configuration</th>
                    <th scope="col" className="num">Rounds</th>
                    <th scope="col" className="num">Balance</th>
                    <th scope="col" className="num">Average score</th>
                    <th scope="col">Last updated</th>
                    <th scope="col"><span className="visually-hidden">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {ordered.map((session) => {
                    const stats = sessionStats(session);
                    const label = session.participantLabel || 'Anonymous';
                    return (
                      <tr key={session.id} data-selected={session.id === selectedId}>
                        <th scope="row">
                          {label}
                          {session.id === activeSessionId && session.status === 'in_progress' && <span className="muted small"> (active)</span>}
                        </th>
                        <td><span className={STATUS_BADGE[session.status]}>{STATUS_LABEL[session.status]}</span></td>
                        <td>{session.config.name}</td>
                        <td className="num">{stats.roundsCompleted} / {stats.totalRounds}</td>
                        <td className="num">{formatCurrency(stats.currentBalance)}</td>
                        <td className="num">{stats.averageScore === null ? 'None' : formatScore(stats.averageScore)}</td>
                        <td>{formatDateTime(session.updatedAt)}</td>
                        <td>
                          <div className="row-actions">
                            <button type="button" className="btn" aria-pressed={session.id === selectedId} onClick={() => setSelectedId(session.id === selectedId ? null : session.id)}>
                              {session.id === selectedId ? 'Hide history' : 'View history'}<span className="visually-hidden"> for {label}</span>
                            </button>
                            <button type="button" className="btn btn-danger" onClick={() => deleteOne(session.id, label)}>
                              Delete<span className="visually-hidden"> session for {label}</span>
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
          <div className="panel-section">
            <RoundLedger session={selected} caption={`Round history: ${selected.participantLabel || 'Anonymous'}`} />
          </div>
        )}
      </section>

      <section className="panel" aria-labelledby="reset-title">
        <div className="panel-section row-between">
          <div>
            <h2 id="reset-title">Reset demo data</h2>
            <p className="muted small" style={{ marginTop: 4 }}>Deletes all sessions and restores the default configuration.</p>
          </div>
          <button type="button" className="btn btn-danger" onClick={resetAll}>Reset everything</button>
        </div>
      </section>
      {dialog}
    </div>
  );
}
