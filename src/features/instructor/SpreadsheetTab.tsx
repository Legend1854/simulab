import { useId, useRef, useState } from 'react';
import { useAppState, useStore } from '../../app/StoreContext';
import { useConfirm } from '../../components/ConfirmDialog';
import { Notice } from '../../components/Notice';
import { EXAMPLE_CONFIG } from '../../data/exampleConfig';
import type { SpreadsheetImportResult, ValidationIssue } from '../../domain/types';
import { downloadWorkbook, safeFilename } from '../../services/exports/download';
import { workbookBytes } from '../../services/spreadsheets/exportWorkbook';
import { importWorkbook } from '../../services/spreadsheets/importWorkbook';
import { readFileBytes } from '../../services/spreadsheets/readFile';
import { FILE_LIMITS, SHEET_NAMES } from '../../services/spreadsheets/schema';
import { formatCurrency, formatPct } from '../../utils/format';

type Phase =
  | { kind: 'idle' }
  | { kind: 'reading'; fileName: string }
  | { kind: 'done'; fileName: string; result: SpreadsheetImportResult };

function IssueTable({ issues, caption }: { issues: ValidationIssue[]; caption: string }) {
  return (
    <div className="table-wrap">
      <table className="table table-compact issue-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Sheet</th>
            <th scope="col" className="num">Row</th>
            <th scope="col">Column</th>
            <th scope="col">Problem</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((issue, index) => (
            <tr key={`${issue.code}-${index}`}>
              <td>{issue.location?.sheet ?? 'Workbook'}</td>
              <td className="num">{issue.location?.row ?? ''}</td>
              <td>{issue.location?.column ?? ''}</td>
              <td>{issue.message}</td>
            </tr>
          ))}
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
  const [applied, setApplied] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);
  const id = useId();

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setApplied(null);
    setPhase({ kind: 'reading', fileName: file.name });
    let result: SpreadsheetImportResult;
    if (file.size > FILE_LIMITS.maxFileBytes) {
      // Checked before reading the file into memory.
      result = { ok: false, issues: [{ code: 'file_too_large', severity: 'error', message: `The file is ${(file.size / (1024 * 1024)).toFixed(1)} MB; the limit is ${FILE_LIMITS.maxFileBytes / (1024 * 1024)} MB.` }] };
    } else {
      try {
        result = importWorkbook(await readFileBytes(file), file.name);
      } catch {
        result = { ok: false, issues: [{ code: 'unreadable', severity: 'error', message: 'The file could not be read by the browser.' }] };
      }
    }
    setPhase({ kind: 'done', fileName: file.name, result });
    if (inputRef.current) inputRef.current.value = ''; // allow choosing the same file again after fixing it
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
    if (saved.ok) {
      setApplied(config.name);
      setPhase({ kind: 'idle' });
    } else {
      setPhase({ kind: 'done', fileName: phase.fileName, result: { ok: false, issues: saved.issues ?? [] } });
    }
  };

  const result = phase.kind === 'done' ? phase.result : null;

  return (
    <div className="stack">
      <section className="panel" aria-labelledby="export-title">
        <div className="panel-section">
          <div className="section-title">
            <h2 id="export-title">Download a workbook</h2>
            <p>Each workbook includes an Instructions sheet describing every column and valid range.</p>
          </div>
          <div className="row">
            <button type="button" className="btn btn-primary" onClick={() => downloadWorkbook(workbookBytes(state.config), `${safeFilename(state.config.name, 'simulab-configuration')}.xlsx`)}>
              Download current configuration (.xlsx)
            </button>
            <button type="button" className="btn" onClick={() => downloadWorkbook(workbookBytes(EXAMPLE_CONFIG), 'SimuLab_Example_RateCycle.xlsx')}>
              Download example workbook (.xlsx)
            </button>
          </div>
          <p className="hint" style={{ marginTop: 8 }}>
            The current configuration is the saved one{state.draft ? '; your unsaved edits on the other tabs are not included until you save them' : ''}. The example is a fictional six-round pack you can import to see the format in use.
          </p>
        </div>
      </section>

      <section className="panel" aria-labelledby="import-title">
        <div className="panel-section">
          <div className="section-title">
            <h2 id="import-title">Import a workbook</h2>
            <p>Checked row by row first. Nothing changes until you apply it.</p>
          </div>
          <div className="file-drop">
            <label htmlFor={`${id}-file`} className="field-label">Choose an .xlsx workbook</label>
            <input id={`${id}-file`} ref={inputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" aria-describedby={`${id}-file-hint`} onChange={(event) => void onFile(event.target.files?.[0])} />
            <p id={`${id}-file-hint`} className="hint">
              Required sheets: {[SHEET_NAMES.settings, SHEET_NAMES.assets, SHEET_NAMES.riskProfiles, SHEET_NAMES.scenarios, SHEET_NAMES.returns].join(', ')}. Up to {FILE_LIMITS.maxFileBytes / (1024 * 1024)} MB.
              Formulas are not calculated: SimuLab reads the values last saved in the file. Macros are ignored.
            </p>
          </div>
          <div aria-live="polite" style={{ marginTop: 16 }}>
            {phase.kind === 'reading' && <p className="muted">Checking {phase.fileName}…</p>}
            {applied && (
              <Notice tone="success" title="Configuration applied">
                "{applied}" is now the configuration for new simulations. Simulations already in progress keep their original settings.
              </Notice>
            )}
          </div>
        </div>

        {result && !result.ok && phase.kind === 'done' && (
          <div className="panel-section stack-sm">
            <h3 ref={resultHeadingRef} tabIndex={-1}>Import failed: {phase.fileName}</h3>
            <Notice tone="error" role="alert" title={`The workbook was not imported. Fix ${result.issues.length === 1 ? 'this problem' : `these ${result.issues.length} problems`} and try again.`}>
              The current configuration has not changed.
            </Notice>
            <IssueTable issues={result.issues} caption="Problems found" />
          </div>
        )}

        {result && result.ok && phase.kind === 'done' && (
          <div className="panel-section stack">
            <div className="row-between">
              <h3 ref={resultHeadingRef} tabIndex={-1}>Preview: {result.summary.configName}</h3>
              <span className="badge badge-ok">✓ Valid, not yet applied</span>
            </div>
            <dl className="preview-stats">
              <div className="stat"><dt>Rounds</dt><dd>{result.summary.scenarioCount}</dd></div>
              <div className="stat"><dt>Assets</dt><dd>{result.summary.assetCount}</dd></div>
              <div className="stat"><dt>Risk profiles</dt><dd>{result.summary.riskProfileCount}</dd></div>
              <div className="stat"><dt>Starting balance</dt><dd className="num">{formatCurrency(result.summary.startingBalance)}</dd></div>
              <div className="stat"><dt>Annual fee</dt><dd className="num">{formatPct(result.summary.annualFeePct)}</dd></div>
            </dl>
            {result.warnings.length > 0 && (
              <>
                <Notice tone="warning" title={`${result.warnings.length} ${result.warnings.length === 1 ? 'warning' : 'warnings'}`}>
                  These do not stop the import, but check them before applying.
                </Notice>
                <IssueTable issues={result.warnings} caption="Warnings" />
              </>
            )}
            <div className="table-wrap">
              <table className="table table-compact">
                <caption>Scenario returns by round (percentage points)</caption>
                <thead>
                  <tr>
                    <th scope="col">Round</th>
                    <th scope="col">Scenario</th>
                    {result.config.assets.map((asset) => (
                      <th scope="col" className="num" key={asset.id}>{asset.name} <span className="muted">(risk {asset.riskRating})</span></th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.config.scenarios.map((scenario, index) => (
                    <tr key={scenario.id}>
                      <th scope="row">{index + 1}</th>
                      <td>{scenario.title}</td>
                      {result.config.assets.map((asset) => (
                        <td className="num" key={asset.id}>{formatPct(scenario.returnsPct[asset.id] ?? 0, 2, true)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="small muted">
              Score weights: performance {result.config.scoring.weights.performancePct}%, risk fit {result.config.scoring.weights.riskFitPct}%, diversification{' '}
              {result.config.scoring.weights.diversificationPct}%. Risk profiles: {result.config.riskProfiles.map((p) => `${p.name} (target ${p.targetRisk})`).join(', ')}.
            </p>
            <div className="row">
              <button type="button" className="btn btn-primary" onClick={apply}>Apply configuration</button>
              <button type="button" className="btn" onClick={() => setPhase({ kind: 'idle' })}>Cancel</button>
            </div>
          </div>
        )}
      </section>
      {dialog}
    </div>
  );
}
