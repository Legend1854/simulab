import { useMemo, useRef, useState } from 'react';
import { useAppState, useStore } from '../../app/StoreContext';
import { usePageTitle } from '../../app/usePageTitle';
import { useConfirm } from '../../components/ConfirmDialog';
import { parseNumber } from '../../components/NumberInput';
import { Notice } from '../../components/Notice';
import { equalSplitAllocation } from '../../domain/calculations';
import { nextRoundOf, projectNextRound } from '../../domain/progression';
import type { SimulationSession, StudentDecision } from '../../domain/types';
import { validateAllocation } from '../../domain/validation';
import { formatCurrency } from '../../utils/format';
import { BalanceChart } from './BalanceChart';
import { DecisionForm } from './DecisionForm';
import { OutcomePanel } from './OutcomePanel';
import { RoundLedger } from './RoundLedger';
import { RoundSteps } from './RoundSteps';
import { ScenarioBrief } from './ScenarioBrief';
import { StatRow } from './StatRow';

function initialDraft(session: SimulationSession): { texts: Record<string, string>; riskProfileId: string } {
  const last = session.results[session.results.length - 1];
  const { config } = session;
  // Carry the previous decision forward so students adjust rather than re-enter it.
  const allocation = last ? last.decision.allocationPct : equalSplitAllocation(config.assets);
  const fallbackProfile = config.riskProfiles.find((p) => p.id === 'balanced') ?? config.riskProfiles[0];
  return {
    texts: Object.fromEntries(config.assets.map((asset) => [asset.id, String(allocation[asset.id] ?? 0)])),
    riskProfileId: last?.decision.riskProfileId ?? fallbackProfile?.id ?? '',
  };
}

/** One round's decision workspace. Keyed by round number, so its draft resets for each new round. */
function RoundWorkspace({ session, round, onSubmitted }: { session: SimulationSession; round: number; onSubmitted: (round: number) => void }) {
  const store = useStore();
  const { config } = session;
  const scenario = config.scenarios[round - 1];
  const [draft, setDraft] = useState(() => initialDraft(session));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // A ref, not state: it blocks a second submit even before React re-renders.
  const submittingRef = useRef(false);

  const decision: StudentDecision = useMemo(
    () => ({ round, riskProfileId: draft.riskProfileId, allocationPct: Object.fromEntries(Object.entries(draft.texts).map(([id, text]) => [id, parseNumber(text)])) }),
    [draft, round],
  );
  const check = useMemo(() => validateAllocation(decision.allocationPct, config.assets), [decision, config.assets]);
  const projection = useMemo(() => (check.valid ? projectNextRound(session, decision) : null), [check.valid, session, decision]);

  if (!scenario) return null;

  const submit = () => {
    if (submittingRef.current || !check.valid) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    const result = store.submitDecision(decision);
    if (result.ok) {
      onSubmitted(result.value.round);
    } else {
      submittingRef.current = false;
      setSubmitting(false);
      setError(result.error);
    }
  };

  const last = session.results[session.results.length - 1];

  return (
    <div className="sim-grid">
      <div className="sim-col">
        <ScenarioBrief scenario={scenario} round={round} config={config} />
        <DecisionForm
          config={config}
          round={round}
          texts={draft.texts}
          riskProfileId={draft.riskProfileId}
          check={check}
          submitting={submitting}
          error={error}
          projection={projection}
          onTextChange={(assetId, text) => setDraft((current) => ({ ...current, texts: { ...current.texts, [assetId]: text } }))}
          onProfileChange={(riskProfileId) => setDraft((current) => ({ ...current, riskProfileId }))}
          onSubmit={submit}
        />
      </div>
      <div className="sim-col">
        <StatRow session={session} />
        {projection ? (
          <OutcomePanel outcome={projection} config={config} variant="projection" headingId="projection-title" />
        ) : (
          <section className="projection" aria-labelledby="projection-empty-title">
            <div className="projection-body">
              <h2 id="projection-empty-title">Projected result for round {round}</h2>
              <p className="muted">Your projection appears here once the allocation is valid and totals 100%.</p>
            </div>
          </section>
        )}
        {last && (
          <section className="panel panel-body" aria-labelledby="previous-title">
            <h2 id="previous-title">Previous round</h2>
            <p className="small" style={{ marginTop: 6 }}>
              Round {last.round}, {last.scenarioTitle}: ended at <strong className="num">{formatCurrency(last.endingBalance)}</strong> with a score of{' '}
              <strong className="num">{last.scores.overall.toFixed(1)}</strong>.
            </p>
            <details className="disclosure" style={{ marginTop: 12 }}>
              <summary>Show how round {last.round} was scored</summary>
              <OutcomePanel outcome={last} config={config} variant="submitted" headingLevel={3} />
            </details>
          </section>
        )}
        <BalanceChart session={session} />
      </div>
    </div>
  );
}

export function SimulationScreen({ session, onSubmitted }: { session: SimulationSession; onSubmitted: (round: number) => void }) {
  const state = useAppState();
  const store = useStore();
  const { confirm, dialog } = useConfirm();
  const round = nextRoundOf(session);
  const scenario = round ? session.config.scenarios[round - 1] : undefined;
  usePageTitle(round ? `Round ${round}` : 'Simulation');
  const configChanged = useMemo(() => JSON.stringify(session.config) !== JSON.stringify(state.config), [session.config, state.config]);

  if (!round || !scenario) return null;

  const restart = async () => {
    const ok = await confirm({
      title: 'Start over?',
      body: `Your current simulation will be marked as abandoned after ${session.results.length} of ${session.config.scenarios.length} rounds. It stays in the instructor's session list but cannot be continued.`,
      confirmLabel: 'Abandon and start over',
      tone: 'danger',
    });
    if (ok) store.abandonActiveSession();
  };

  return (
    <>
      <div className="row-between" style={{ marginBottom: 16 }}>
        <p className="muted small">
          {session.participantLabel ? `Playing as ${session.participantLabel}. ` : ''}
          {session.config.name}
        </p>
        <button type="button" className="btn" onClick={restart}>Start over</button>
      </div>
      <div className="notice-list">
        {state.resumed && (
          <Notice tone="info" title="Welcome back" onDismiss={() => store.dismissResumed()}>
            Your simulation was restored from this browser. You have completed {session.results.length} of {session.config.scenarios.length} rounds and can continue with round {round}.
          </Notice>
        )}
        {configChanged && (
          <Notice tone="info">
            The instructor has changed the configuration since this simulation started. This simulation keeps the settings it started with so its results stay consistent. Start over to use the new settings.
          </Notice>
        )}
      </div>
      <RoundSteps config={session.config} completed={session.results.length} current={round} />
      <RoundWorkspace key={round} session={session} round={round} onSubmitted={onSubmitted} />
      <section className="panel" style={{ marginTop: 24 }} aria-label="Round history">
        <div className="panel-body">
          <RoundLedger session={session} />
        </div>
      </section>
      {dialog}
    </>
  );
}
