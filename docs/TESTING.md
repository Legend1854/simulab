# Testing SimuLab

This document describes what is tested, how to run it, and, just as important, what is **not** tested.
Results are recorded in the last section only from runs that were actually performed; nothing here is an estimate.

## Commands

| Command | What it runs |
|---|---|
| `npm run typecheck` | `tsc --noEmit` with strict TypeScript (also part of `npm run build`). |
| `npm test` | Vitest: unit, integration and component tests (jsdom). |
| `npm run test:e2e` | Playwright: builds the app, serves it with `vite preview` on port 4173, runs the browser journeys in Chromium. |
| `npm run test:all` | Typecheck, Vitest, production build, then Playwright. |
| `npm run screenshots` | Regenerates the twelve PNG files in `docs/screenshots/` from the real app (not a test of behaviour). |
| `node --test legacy/marketlab-prototype/tests/simulation.test.mjs` | The original MarketLab prototype's own 10 tests (kept so the baseline stays reproducible). |

First-time Playwright setup on a machine without browsers: `npx playwright install chromium`.
(In the environment this project was built in, Chromium was pre-installed and the install step was not needed.)

## Test layers

| Layer | Location | Environment | Purpose |
|---|---|---|---|
| Unit | `tests/unit/` | jsdom (Node where the file says so) | Formulas, validation, session rules, persistence, spreadsheet import and export, CSV, store actions. |
| Integration | `tests/integration/` | Node | Parity with the legacy Excel workbook; import-then-play flows; seeded random invariants. |
| Component | `tests/component/` | jsdom + React Testing Library | Screens as a user meets them: labels, validation messages, confirmations, recovery. |
| End-to-end | `tests/e2e/` | Chromium via Playwright | The production build in a real browser, including downloads, reloads, keyboard play, a phone-sized screen and automated accessibility checks. |

## What the tests cover

### Calculation engine (`tests/unit/calculations`, `scoring`, `progression`, `explain`)
- Hand-computed rounds: equal split, single-asset, mixed positive and negative returns.
- Per-asset contributions add up to the gross return.
- Boundaries: 0% returns with and without a fee, +500% on every asset (balance ×6, performance clamped at 100), −100% with no fee (balance exactly zero, performance clamped at 0), very large balances.
- The fee is charged on each round's starting balance; a five-round default-fee balance is checked against an independently written calculation.
- Determinism: the same inputs give the same outputs.
- Session rules: the only transition is `submitRound`; wrong round, repeated round, skipped round and invalid allocations are rejected without changing the session; completed sessions refuse further submissions; stored round results are frozen; configuration is snapshotted.
- The projection shown before submission uses the same engine as the submitted result.

### Validation (`tests/unit/validation`)
- Allocations: totals of 99 and 101, decimals, `NaN`, missing values, unknown assets, out-of-range values; messages attach to the right field.
- Configuration: duplicate or invalid identifiers, missing or extra returns, returns outside −100% to +500%, weights that do not total 100%, asset counts outside 2–8, wrong types, unsupported schema version, and a fee that could take the balance below zero.

### Spreadsheet import and export (`tests/unit/spreadsheet`)
- Round trips: the default and example configurations export to a workbook and import back unchanged with no warnings.
- Rejections with readable messages: wrong extension, empty file, oversized file (rejected before parsing), a small zip that would expand to a huge amount of XML (rejected before decompressing), a zip with too many entries, a text file renamed `.xlsx`, a truncated zip, missing sheets, missing columns or settings, unsupported format version.
- Row-level problems with sheet, row, column and the exact cell (for example `Returns!C3`): non-numeric returns, blank required cells, duplicate ids, unknown references, missing or duplicated return rows, out-of-range values, bad weights, round gaps.
- All-or-nothing: a failed import returns no configuration at all. The reported problems are capped at 100.
- Formulas are never calculated: a cached value is used with a warning; a formula without a cached value is rejected. Percent-formatted cells, error values, booleans and dates are rejected.
- Error cascades are avoided: one bad cell is reported once, not again as a dangling reference elsewhere.
- Hostile text (for example an `<img onerror>` payload) is kept as data.

### The `.xlsx` reader and writer (`tests/unit/ooxml/`)
- XML parser: elements, attributes, entities and character references, whitespace kept only inside `<t>` text, CDATA,
  a byte-order mark; `<!DOCTYPE` is rejected so entity-expansion attacks cannot happen.
- Writing then reading every kind of cell gives back exactly what was written; invalid sheet names and non-finite
  numbers are refused.
- Structures other programs produce: absolute relationship targets, a missing root relationships part, cells without
  references, rich-text runs, shared formulas, ISO dates, chart sheets; a damaged workbook gets a specific reason.
- Number formats: only a real percent sign (not a quoted or escaped one) makes a format a percentage.
- Cross-checks with independent tools, using committed fixtures built by `scripts/crosscheck/build-fixtures.sh`: a
  workbook of awkward cells written by openpyxl, the same file re-saved by LibreOffice Calc, and SimuLab's template
  after LibreOffice re-saved it (it must import unchanged).

### Persistence (`tests/unit/persistence`)
- Defaults when nothing is stored; round trips inside a versioned envelope.
- Corrupted JSON, a different schema version and an invalid configuration all fall back to defaults with a notice.
- An in-progress session is restored exactly and can continue.
- A session whose stored balance was edited is dropped, because stored sessions are replayed through the engine; good sessions survive a damaged neighbour.
- A failed write (for example a full storage quota) is reported rather than thrown.

### Reference-model parity (`tests/integration/reference-workbook`)
- Reads the inputs from the legacy `MarketLab_Reference_Model.xlsx`, runs them through the SimuLab engine with the fee set to 0, and compares with the values Excel saved. Return, change and ending capital agree within 1 × 10⁻⁸; the return score within 1 × 10⁻¹⁰; diversification and risk fit within 0.5 of the workbook's rounded integers (a documented change, see `MIGRATION_FROM_MARKETLAB.md`); the whole-number decision score is identical in all five rounds.
- Caveat: the workbook's cached values are what Excel last saved. The tests do not recalculate the workbook in Excel or LibreOffice.

### Randomised invariants (`tests/integration/import-and-play`)
- 500 seeded random allocations and returns: scores stay within 0–100 and balances follow the formulas. The seed is fixed, so failures are reproducible. This is a sanity check, not a proof.

### Components (`tests/component/`)
- Student: validation beside the field, live projection, submit and review, double-click records one round, full five-round completion with a rating, resume after reload, confirmation before abandoning (Escape cancels), imported text rendered as text.
- Instructor: honest role label and workspace heading, saved/unsaved status, unsaved-changes bar, live validation with save blocked and a validation summary, a problem marked on the matrix cell, its row and its tab, jumping from the summary to the field on another tab (focus checked), scenario add/reorder/delete with confirmation, invalid workbook (exact cell reference, step indicator state) and valid workbook (preview of what changes) flows, wrong extension, session comparison and delete-all confirmation.
- Logo: the favicon in `index.html` is the same drawing as the logo component.
- Resilience: corrupted storage notice; an error boundary replaces a crashed page with recovery actions.

### End-to-end (`tests/e2e/`)
The ten journeys requested in the project brief map to these tests:

| Journey | Test |
|---|---|
| 1 Load the application | `student.spec` "load, choose the student experience, play all five rounds and export the results" |
| 2 Select the student experience | same test |
| 3 Change allocations (projection updates) | same test |
| 4 Submit a valid decision | same test |
| 5 See the calculated result | same test |
| 6 Progress to the next round | same test |
| 7 Complete the simulation | same test |
| 8 Export results (CSV contents checked) | same test |
| 9 Import a valid workbook | `instructor.spec` "downloads the template and imports it back…" and "an imported example workbook changes the next simulation" |
| 10 Reject an invalid workbook | `instructor.spec` "rejects an invalid workbook with readable, row-level errors" and "rejects a file that is not really a workbook" |

Additional browser tests: an invalid allocation cannot be submitted; a rapid double click records the round once; an interrupted session is restored after reload; the whole round can be played with the keyboard only; editing the fee changes the next simulation; deleting all sessions needs confirmation; the validation summary takes a keyboard user to the field to fix, across tabs; a round can be completed on a phone-sized screen (Pixel 7 profile) without horizontal scrolling; axe-core scans (WCAG 2.1 A and AA rules) of the home page, start screen, a round, the round review, the final results, every instructor tab, the import-error view, the import preview and the editor with an unsaved problem.

Layout checks (`tests/e2e/layout.spec.ts`): every student page (home, start, a round with a valid allocation, the round
result, final results) and every instructor tab plus the import-error view are loaded at 1440 × 900, 1280 × 800,
820 × 1180, 390 × 844 and 360 × 800, and the page must not scroll sideways. Wide tables may scroll inside their own
container; that is allowed and intended. These checks measure overflow only; how the pages look was reviewed by eye
from screenshots.

## Known gaps (not tested)

- **No code-coverage measurement was run.** No coverage figure is claimed anywhere in this project.
- **No performance benchmarks** were run. Statements about bundle size come from the build output only.
- **Browsers:** end-to-end tests run in Chromium only. Firefox and Safari were not tested.
- **Assistive technology:** automated axe-core scans (WCAG 2.1 A/AA rules) and keyboard-only play are covered. Automated scans find only a subset of accessibility problems; no screen reader (NVDA, VoiceOver, JAWS) was used and no manual accessibility audit was done.
- **Real devices:** the mobile test emulates a phone in Chromium; no physical device was used.
- **Excel compatibility:** the reader is tested against files from openpyxl and LibreOffice Calc. Files saved by Microsoft Excel itself (other than the original MarketLab reference workbook) and by Google Sheets were not tested.
- **Deployment:** the GitHub Actions workflows in `.github/workflows/` were written but have not run on GitHub from this environment.
- **Load, concurrency and multi-tab behaviour:** not tested. Two tabs editing the same browser storage can overwrite each other.
- **Security testing:** no penetration test and no fuzzing of the `.xlsx` reader beyond the hand-written hostile cases above.
- **Visual regression:** screenshots are regenerated on request and reviewed by eye; they are not compared automatically.
- **Real phones and tablets:** layout widths are emulated in Chromium.

## Recorded results

See "Last recorded run" below. It is updated only after a run is actually performed.

### Last recorded run

15 October 2026, Linux container, Node 22.22.0, npm 10.9.4, in a fresh copy of the project with no `node_modules`,
`dist` or test output, starting with `npm ci`:

| Step | Command | Result |
|---|---|---|
| Install | `npm ci` | Succeeded; "found 0 vulnerabilities" |
| Typecheck | `npm run typecheck` | Exit code 0, no errors |
| Unit, integration, component | `npm test` | 18 test files, 216 tests, 216 passed |
| Production build | `npm run build` | Succeeded (Vite 7.3.7, 833 modules) |
| End-to-end | `npm run test:e2e` | 25 tests, 25 passed (24 desktop Chromium, 1 mobile Chromium profile) |
| Screenshots | `npm run screenshots` | 1 capture run passed; 12 PNG files written |
| Legacy prototype | `node --test legacy/marketlab-prototype/tests/simulation.test.mjs` | 10 tests, 10 passed |
| Dependency audit | `npm audit` | 0 vulnerabilities |

Tests per file in that run: spreadsheet 44, validation 19, ooxml/xml 19, calculations 18, progression 16, scoring 16,
ooxml/workbook 15, persistence 11, instructor component 11, explain 10, store 9, student-flow component 7,
configEdits 6, csv 4, import-and-play 4, reference-workbook 4, resilience component 2, logo 1.

End-to-end tests per file: layout 10 (two per width), instructor 7, student 5, accessibility 2, mobile 1.
