import { Fragment, useId, useRef, useState } from 'react';
import { useAppState, useStore } from '../../app/StoreContext';
import { useConfirm } from '../../components/ConfirmDialog';
import { Icon } from '../../components/Icon';
import { Notice } from '../../components/Notice';
import { EXAMPLE_CONFIG } from '../../data/exampleConfig';
import type { SimulationConfig, SpreadsheetImportResult, ValidationIssue } from '../../domain/types';
import { downloadWorkbook, safeFilename } from '../../services/exports/download';
import { workbookBytes } from '../../services/spreadsheets/exportWorkbook';
import { importWorkbook } from '../../services/spreadsheets/importWorkbook';
import { readFileBytes } from '../../services/spreadsheets/readFile';
import { FILE_LIMITS, REQUIRED_SHEETS } from '../../services/spreadsheets/schema';
import { formatCurrency, formatPct } from '../../utils/format';

type Phase =
  | { kind: 'idle' }
  | { kind: 'reading'; fileName: string }
  | { kind: 'done'; fileName: string; result: SpreadsheetImportResult }
  | { kind: 'applied'; name: string };

type StepState = 'done' | 'current' | 'error' | 'upcoming';

const STEP_NAMES = ['Choose a workbook', 'Check every row', 'Preview the changes', 'Apply'] as const;

function stepStates(phase: Phase): StepState[] {
  switch (phase.kind) {
    case 'idle':
      return ['current', 'upcoming', 'upcoming', 'upcoming'];
    case 'reading':
      return ['done', 'current', 'upcoming', 'upcoming'];
    case 'done':
      return phase.result.ok ? ['done', 'done', 'current', 'upcoming'] : ['done', 'error', 'upcoming', 'upcoming'];
    case 'applied':
      return ['done', 'done', 'done', 'done'];
  }
}

const STATE_WORDS: Record<StepState, string> = { done: 'done', current: 'current step', error: 'problems found', upcoming: 'not started' };

/** The import workflow as a sequence, so it is always clear what has happened and what comes next. */
function ImportSteps({ phase }: { phase: Phase }) {
  const states = stepStates(phase);
  return (
    <ol className="flow" aria-label="Import progress">
      {STEP_NAMES.map((name, index) => {
        const state = states[index] ?? 'upcoming';
        return (
          <li key={name} className="flow-step" data-state={state} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="flow-node" aria-hidden="true">
              {state === 'done' ? <Icon name="check" size={14} /> : state === 'error' ? <Icon name="close" size={14} /> : index + 1}
            </span>
            <span className="flow-name">
              {name}
              <span className="visually-hidden">, {STATE_WORDS[state]}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

const where = (issue: ValidationIssue): string => {
  const location = issue.location;
  if (!location?.sheet) return 'Workbook';
  if (location.cell) return `${location.sheet}!${location.cell}`;
  if (location.row) return `${location.sheet}, row ${location.row}`;
  return location.sheet;
};

function IssueTable({ issues, caption, tone }: { issues: ValidationIssue[]; caption: string; tone: 'error' | 'warning' }) {
  return (
    <div className="table-wrap">
      <table className={`table table-compact issue-table issue-table-${tone}`}>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Where</th>
            <th scope="col">Column</th>
            <th scope="col">Problem</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((issue, index) => (
            <tr key={`${issue.code}-${index}`}>
              <td><span className="ref">{where(issue)}</span></td>
              <td>{issue.location?.column ?? ''}</td>
              <td>{issue.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const weightsText = (config: SimulationConfig) =>
  `${config.scoring.weights.performancePct} / ${config.scoring.weights.riskFitPct} / ${config.scoring.weights.diversificationPct}`;

/** Side-by-side comparison of the saved configuration and the workbook, so "apply" is an informed choice. */
function ChangeTable({ current, next }: { current: SimulationConfig; next: SimulationConfig }) {
  const rows: Array<[string, string, string]> = [
    ['Name', current.name, next.name],
    ['Starting balance', formatCurrency(current.startingBalance), formatCurrency(next.startingBalance)],
    ['Annual fee', formatPct(current.annualFeePct), formatPct(next.annualFeePct)],
    ['Rounds', String(current.scenarios.length), String(next.scenarios.length)],
    ['Assets', current.assets.map((a) => a.name).join(', '), next.assets.map((a) => a.name).join(', ')],
    ['Risk profiles', current.riskProfiles.map((p) => `${p.name} ${p.targetRisk}`).join(', '), next.riskProfiles.map((p) => `${p.name} ${p.targetRisk}`).join(', ')],
    ['Weights (performance / risk fit / diversification)', weightsText(current), weightsText(next)],
  ];
  return (
    <div className="table-wrap">
      <table className="table table-compact change-table">
        <caption>What changes if you apply this workbook</caption>
        <thead>
          <tr>
            <th scope="col">Setting</th>
            <th scope="col">Current</th>
            <th scope="col">In this workbook</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, before, after]) => {
            const changed = before !== after;
            return (
              <tr key={label} data-changed={changed}>
                <th scope="row">{label}</th>
                <td>{before}</td>
                <td>
                  {after}
                  {changed && <span className="pill pill-ochre change-flag">Changes</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function SpreadsheetTab() {
  const state = useAppState();
  const store = useStore();
  const { confirm, dialog } = useConfirm();
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const inputRef = useRef<HTMLInputElement>(null);
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);
  const id = useId();

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setPhase({ kind: 'reading', fileName: file.name });
    let result: SpreadsheetImportResult;
    if (file.size > FILE_LIMITS.maxFileBytes) {
      // Checked before the file is read into memory.
      result = { ok: false, issues: [{ code: 'file_too_large', severity: 'error', message: `The file is ${(file.size / (1024 * 1024)).toFixed(1)} MB; the limit is ${FILE_LIMITS.maxFileBytes / (1024 * 1024)} MB.` }] };
    } else {
      try {
        result = importWorkbook(await readFileBytes(file), file.name);
      } catch {
        result = { ok: false, issues: [{ code: 'unreadable', severity: 'error', message: 'The file could not be read by the browser.' }] };
      }
    }
    setPhase({ kind: 'done', fileName: file.name, result });
    if (inputRef.current) inputRef.current.value = ''; // so the same file can be chosen again after fixing it
    requestAnimationFrame(() => resultHeadingRef.current?.focus());
  };

  const apply = async () => {
    if (phase.kind !== 'done' || !phase.result.ok) return;
    const { config } = phase.result;
    const ok = await confirm({
      title: 'Replace the current configuration?',
      body: (
        <>
          <p>"{config.name}" will become the configuration for new simulations.</p>
          {state.draft && <p>Your unsaved edits on the other tabs will be discarded.</p>}
          <p>Simulations already in progress keep the settings they started with.</p>
        </>
      ),
      confirmLabel: 'Apply configuration',
    });
    if (!ok) return;
    const saved = store.saveConfiguration(config);
    if (saved.ok) setPhase({ kind: 'applied', name: config.name });
    else setPhase({ kind: 'done', fileName: phase.fileName, result: { ok: false, issues: saved.issues ?? [] } });
  };

  const result = phase.kind === 'done' ? phase.result : null;
  const downloadCurrent = () => downloadWorkbook(workbookBytes(state.config), `${safeFilename(state.config.name, 'simulab-configuration')}.xlsx`);

  return (
    <div className="stack">
      <section className="sheet" aria-labelledby="export-title">
        <div className="sheet-section sheet-head-only">
          <h2 id="export-title">Start from a workbook</h2>
          <p className="muted small">
            Every workbook has an Instructions sheet that lists each column, whether it is required and its valid range. Edit a copy in Excel, LibreOffice or Google
            Sheets and save it as .xlsx.
          </p>
        </div>
        <div className="sheet-section download-grid">
          <div className="download-item">
            <Icon name="sheet" size={22} />
            <div>
              <h3>Current configuration</h3>
              <p className="muted small">
                The saved configuration{state.draft ? ' (your unsaved edits are not included until you save them)' : ''}. Edit it and import it back.
              </p>
            </div>
            <button type="button" className="btn btn-primary" onClick={downloadCurrent}>
              <Icon name="download" size={16} />
              Download current configuration (.xlsx)
            </button>
          </div>
          <div className="download-item">
            <Icon name="layers" size={22} />
            <div>
              <h3>Example scenario pack</h3>
              <p className="muted small">A fictional six-round pack with graded risk ratings. Import it to see the format in use.</p>
            </div>
            <button type="button" className="btn" onClick={() => downloadWorkbook(workbookBytes(EXAMPLE_CONFIG), 'SimuLab_Example_RateCycle.xlsx')}>
              <Icon name="download" size={16} />
              Download example workbook (.xlsx)
            </button>
          </div>
        </div>
      </section>

      <section className="sheet" aria-labelledby="import-title">
        <div className="sheet-section sheet-head-only">
          <h2 id="import-title">Import a workbook</h2>
          <p className="muted small">Each row is checked before anything changes. A workbook with any problem is rejected as a whole, so the configuration is never half-updated.</p>
        </div>
        <div className="sheet-section">
          <ImportSteps phase={phase} />
          <div className="file-drop">
            <label htmlFor={`${id}-file`} className="field-label">Choose an .xlsx workbook</label>
            <input id={`${id}-file`} ref={inputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" aria-describedby={`${id}-file-hint`} onChange={(event) => void onFile(event.target.files?.[0])} />
            <p id={`${id}-file-hint`} className="hint">
              Required sheets:{' '}
              {REQUIRED_SHEETS.map((name, index) => (
                <Fragment key={name}>
                  {index > 0 && ' '}
                  <span className="ref">{name}</span>
                </Fragment>
              ))}
              . Up to{' '}
              {FILE_LIMITS.maxFileBytes / (1024 * 1024)} MB. Formulas are never calculated: SimuLab reads the value last saved in each cell. Macros are never opened.
            </p>
          </div>
          <div aria-live="polite" className="import-live">
            {phase.kind === 'reading' && <p className="muted">Checking {phase.fileName}…</p>}
            {phase.kind === 'applied' && (
              <Notice tone="success" title="Configuration applied">
                "{phase.name}" is now the configuration for new simulations. Simulations already in progress keep their original settings.
              </Notice>
            )}
          </div>
        </div>

        {result && !result.ok && phase.kind === 'done' && (
          <div className="sheet-section stack-sm">
            <h3 ref={resultHeadingRef} tabIndex={-1}>Import failed: {phase.fileName}</h3>
            <Notice tone="error" role="alert" title={`The workbook was not imported. Fix ${result.issues.length === 1 ? 'this problem' : `these ${result.issues.length} problems`} and try again.`}>
              The current configuration has not changed.
            </Notice>
            <IssueTable issues={result.issues} caption="Problems found" tone="error" />
          </div>
        )}

        {result && result.ok && phase.kind === 'done' && (
          <div className="sheet-section stack">
            <div className="row-between">
              <h3 ref={resultHeadingRef} tabIndex={-1}>Preview: {result.summary.configName}</h3>
              <span className="pill pill-ok">
                <Icon name="check" size={14} />
                Valid, not yet applied
              </span>
            </div>
            {result.warnings.length > 0 && (
              <>
                <Notice tone="warning" title={`${result.warnings.length} ${result.warnings.length === 1 ? 'warning' : 'warnings'}`}>
                  These do not stop the import, but check them before applying.
                </Notice>
                <IssueTable issues={result.warnings} caption="Warnings" tone="warning" />
              </>
            )}
            <ChangeTable current={state.config} next={result.config} />
            <div className="table-wrap">
              <table className="table table-compact">
                <caption>Scenario returns by round (percentage points)</caption>
                <thead>
                  <tr>
                    <th scope="col">Round</th>
                    <th scope="col">Scenario</th>
                    {result.config.assets.map((asset) => (
                      <th scope="col" className="num" key={asset.id}>
                        {asset.name} <span className="muted">(risk {asset.riskRating})</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.config.scenarios.map((scenario, index) => (
                    <tr key={scenario.id}>
                      <th scope="row">{index + 1}</th>
                      <td>{scenario.title}</td>
                      {result.config.assets.map((asset) => {
                        const value = scenario.returnsPct[asset.id] ?? 0;
                        return (
                          <td className={`num ${value < 0 ? 'change-loss' : ''}`} key={asset.id}>
                            {formatPct(value, 2, true)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="row">
              <button type="button" className="btn btn-primary" onClick={apply}>
                Apply configuration
              </button>
              <button type="button" className="btn" onClick={() => setPhase({ kind: 'idle' })}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
      {dialog}
    </div>
  );
}
