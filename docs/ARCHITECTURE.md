# SimuLab architecture

SimuLab is a client-side single-page application: React 19 and strict TypeScript, built with Vite. There is no
backend. Everything (configuration, sessions and results) is stored in the browser's `localStorage`.

## Why client-side only

The project needs to be demonstrable from a static URL without API keys, accounts or a server. A backend would add
authentication, hosting and a database without improving what the project is meant to show: turning spreadsheet
rules into dependable, tested application logic. The code is organised so that a backend can be added later without
rewriting the calculation engine (see "Adding a server" below).

## Layers and dependency direction

```
            ┌──────────────────────────────────────────────┐
  UI        │ src/features/*, src/components/*  (React)    │
            └──────────────┬───────────────────────────────┘
                           │ reads state, calls store methods
            ┌──────────────▼───────────────────────────────┐
  App state │ src/app/store.ts  (no React)                 │
            │ src/app/StoreContext.tsx (React binding)     │
            └──────┬───────────────────────┬───────────────┘
                   │                       │
  Services ┌───────▼────────────┐  ┌───────▼───────────────────────────┐
           │ persistence/       │  │ spreadsheets/                     │
           │  storage.ts        │  │  schema.ts  importWorkbook.ts     │
           │  sessionParser.ts  │  │  exportWorkbook.ts  readFile.ts   │
           └───────┬────────────┘  │  ooxml/ (xlsx reader and writer)  │
                   │               │ exports/ csv.ts  download.ts      │
                   │               └───────┬───────────────────────────┘
            ┌──────▼───────────────────────▼───────────────┐
  Domain    │ src/domain/  types, constants, validation,   │
            │ calculations, scoring, progression,          │
            │ explain, configEdits   (pure TypeScript)     │
            └──────────────────────────────────────────────┘
  Data      src/data/defaultConfig.ts, exampleConfig.ts
```

Arrows point to what a layer may import. The domain imports nothing from React, the browser or the spreadsheet code; only
`explain.ts` and `configEdits.ts` use two small pure helpers from `src/utils`. So every formula can be tested in Node
without rendering anything, and it can move unchanged to a server.

## Modules

| Module | Responsibility |
|---|---|
| `domain/types.ts` | The typed model: Asset, Scenario (market scenario), RoundConfig, RiskProfile, ScoringConfig, StudentDecision, RoundOutcome/RoundResult, SimulationSession, ValidationIssue, SpreadsheetImportResult, SessionStats. |
| `domain/constants.ts` | Every limit and rule constant (schema version, ranges, tolerances, rating bands). No other file hard-codes these numbers. |
| `domain/validation.ts` | `validateAllocation`, `validateDecision` and `validateConfig`: the single gate for any configuration from storage, the editor or a workbook. It treats input as `unknown` and does not trust TypeScript types. |
| `domain/calculations.ts` | `evaluateRound` and its pure parts: weighted return, fee, ending balance, portfolio risk, HHI. |
| `domain/scoring.ts` | Performance, risk-fit, diversification and overall scores; rating bands. |
| `domain/progression.ts` | The session state machine: `startSession`, `submitRound` (the only transition that advances a session), `abandonSession`, `projectNextRound`, `sessionStats`. |
| `domain/explain.ts` | Turns an outcome the engine already calculated into formula text and plain-language reasons. It never calculates anything new. |
| `domain/configEdits.ts` | Pure editing operations for the instructor UI (add or remove assets and scenarios, reorder rounds) that keep cross-references consistent. |
| `services/persistence/` | Versioned `localStorage` envelopes; safe loading with notices; session replay verification. `KeyValueStore` is an interface, so tests use `MemoryStore`. |
| `services/spreadsheets/` | `schema.ts` (the documented workbook format), `importWorkbook.ts` (explicit mapping plus validation), `exportWorkbook.ts`, `readFile.ts`. |
| `services/spreadsheets/ooxml/` | The project's own `.xlsx` reader and writer (see below): `xml.ts` (a strict XML parser), `readXlsx.ts`, `writeXlsx.ts`, `numberFormats.ts`, `cellRef.ts` and `sheetEdits.ts` (used by the sample generator). The zip layer is the `fflate` library. |
| `services/exports/` | CSV export with a formula-injection guard; download helpers. |
| `app/store.ts` | All application state and actions. Framework-free and unit-tested. |
| `app/router.ts` | A small hash router (`#/`, `#/student`, `#/instructor/<tab>`). Hash routing works on any static host with no rewrite rules. |
| `features/home/` | The home page and its worked-example figure (`Pipeline.tsx`), which runs the real engine on the active configuration. |
| `features/student/` | Start screen, round workspace (`SimulationScreen`, `ScenarioBrief`, `DecisionForm`, `ProjectionPanel`), review (`RoundReport`, `Evidence`, `ScoreBreakdown`, `Feedback`), results, chart and ledger. |
| `features/instructor/` | Workspace header and validation summary (`InstructorPage`), settings, assets, the scenario return matrix, the guided import, sessions. Lazy-loaded. |
| `components/` | Reusable pieces: Icon (one inline SVG icon set), LogoMark, Notice, ConfirmDialog (`useConfirm`), ErrorBoundary, Change, NumberInput, EmptyState, StepMarker; `viz/` holds the allocation bar, the return bars and the fixed asset colour order. |
| `styles/` | `tokens.css` (every colour, size, space, radius, shadow and timing), then `base.css`, `layout.css`, `components.css` and one file per area (`home.css`, `student.css`, `instructor.css`), imported in that order by `app.css`. See `docs/DESIGN_DECISIONS.md`. |

## Data flow: one round

1. The student edits the allocation. `RoundWorkspace` keeps the draft as text (so "", "-" or "1." can exist while
   typing), parses it to numbers, and runs `validateAllocation` (field errors) and `projectNextRound` (live projection)
   inside `useMemo`.
2. On submit, a ref guard blocks repeat calls, then `store.submitDecision(decision)` runs.
3. The store calls `submitRound(session, decision, now)`. It validates, calls `evaluateRound`, freezes the result and
   returns a new session object. The store replaces the session, persists it and notifies subscribers.
4. `useSyncExternalStore` re-renders. `StudentPage` shows `RoundReview` for that round; "Continue" shows the next
   round's workspace, keyed by round number so its draft starts from the previous allocation.

## Data flow: workbook import

`File` → size check → `readFileBytes` → `importWorkbook(bytes, name)` → either `{ ok: false, issues }`, shown as a
table of cell reference (for example `Returns!C3`), column and problem, or `{ ok: true, config, warnings, summary }`,
shown as a preview with a table of what would change compared with the saved configuration. "Apply configuration"
opens a confirmation, then `store.saveConfiguration(config)` validates again and persists. The importer never touches
application state, which is why a failed import cannot partly change anything. The screen shows the four stages
(choose, check, preview, apply) as a step indicator so it is clear which one the import reached.

## Reading and writing .xlsx files

An `.xlsx` file is a zip archive of XML parts. SimuLab reads and writes them with its own small module
(`services/spreadsheets/ooxml/`) on top of `fflate`, a dependency-free zip library. It replaced SheetJS `xlsx@0.18.5`,
whose npm release has two unfixed high-severity advisories (the fixed releases are only published on the SheetJS CDN,
which this project's build environment could not reach).

- **Reading:** follows the package relationships to find each sheet, reads shared strings, inline strings, numbers,
  booleans, error cells and ISO dates, and uses the cell's number format to tell a typed `8%` (stored as 0.08) from a
  typed `8`. For a formula cell it reads the value the spreadsheet application last saved; it never evaluates formulas
  and never opens macro parts.
- **Limits before work:** the zip directory is checked first: at most 1,000 entries, 10 MB per XML part and 25 MB in
  total, judged from the sizes the archive declares, before anything is decompressed. Only `.xml` and `.rels` parts
  are ever decompressed. The XML parser rejects `<!DOCTYPE` (so no entity expansion) and unknown entities.
- **Writing:** inline strings, a style table for bold headers, wrapped text and number formats, frozen header rows and
  column widths. A fixed timestamp option makes the sample workbooks byte-for-byte reproducible.
- **Checked against other software:** tests read a workbook of awkward cell types written by openpyxl, the same file
  re-saved by LibreOffice Calc, and SimuLab's own template after LibreOffice opened and re-saved it (fixtures in
  `tests/fixtures/crosscheck/`, rebuilt by `scripts/crosscheck/build-fixtures.sh`). Microsoft Excel itself was not
  available to test with.

## State management

- One store object owns `config`, `draft` (unsaved instructor edits, memory only), `sessions`, `activeSessionId`,
  `resumed`, `notices`, `persistent` and `saveError`.
- State is replaced, never mutated. Domain functions return new objects, and stored round results are frozen.
- Purely local UI state stays in components: allocation drafts, the review step, dialogs, the selected scenario.
- Sessions snapshot their configuration. Instructor changes apply to new sessions only, and the student view says so
  when the configuration has changed since a session started.

## Error handling

| Situation | Behaviour |
|---|---|
| Invalid decision | Field-level messages; submit is disabled; the domain rejects it anyway |
| Invalid configuration edit | Live field-level messages; "Save" is disabled with a count of problems |
| Invalid workbook | Row-level problem table; configuration unchanged |
| Damaged or outdated storage | Defaults loaded and a dismissible notice shown |
| Storage unavailable or full | App works in memory; a warning or "Not saved" message is shown |
| Unexpected rendering error | `ErrorBoundary` offers "Reload" and "Clear SimuLab data and reload" |

## Security notes (client-side scope)

- The instructor view is a **demonstration role switch, not access control**. Anyone with the page can open it. The
  UI says this on the home page and in the instructor workspace.
- No secrets, keys or credentials exist in the code.
- Imported text is rendered as React text nodes; there is no `dangerouslySetInnerHTML` anywhere. A test imports an
  `<img onerror>` payload and checks it shows as text.
- Workbook formulas and macros are never executed. File size, sheet size and every cell are validated.
- CSV export guards against formula injection.
- No personal data is collected. Nicknames are optional, and the UI asks people not to use real names. Nothing is
  sent anywhere.
- Workbook parsing uses the in-repo reader described above, with size limits checked before decompression. `npm audit`
  reported 0 vulnerabilities after SheetJS was removed (15 October 2026).

## Performance

- The instructor workspace, including the `.xlsx` reader and writer, is lazy-loaded. The first page load fetches the app
  code, React and Recharts: about 179 KB of gzipped JavaScript (app 27.7 KB, React 60.4 KB, Recharts 91.4 KB) plus
  10.2 KB of gzipped CSS and the two fonts. The instructor chunk (30.0 KB gzipped, spreadsheet code and `fflate`
  included) is fetched only when the workspace opens; before the redesign it was 14.9 KB plus 141.5 KB for SheetJS.
  These figures are Vite's build output from 15 October 2026, not load-time measurements.
- Recharts is loaded even on the home page, which does not draw a chart. Lazy-loading the chart is a possible
  improvement that has not been made.
- The projection and validation are memoised and cost microseconds; there is no debouncing because none is needed.
- Tables use stable keys (round numbers and ids). Storage keeps at most 50 sessions.

## Adding a server (what would change)

1. Replace `KeyValueStore` usage in `store.ts` with an async repository (`loadConfig`, `saveSessions` and so on) that
   calls an API. Store actions become async; the UI already handles failures through `ActionResult`.
2. Move `domain/` into a shared package. The server runs `submitRound` itself and stores the result, so clients cannot
   forge scores. The client keeps using `projectNextRound` for the live projection.
3. Add real authentication and role checks on the server (instructor endpoints), and remove the demo role switch.
4. Store sessions in a relational database (sessions, rounds and configurations as versioned rows) with the
   configuration snapshot referenced by version.
5. Keep `validateConfig` and `importWorkbook` as the boundary checks on the server as well as the client.
