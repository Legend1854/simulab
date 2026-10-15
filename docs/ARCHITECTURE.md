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
           │ persistence/       │  │ spreadsheets/ (SheetJS)           │
           │  storage.ts        │  │  schema.ts  importWorkbook.ts     │
           │  sessionParser.ts  │  │  exportWorkbook.ts  readFile.ts   │
           └───────┬────────────┘  │ exports/ csv.ts  download.ts      │
                   │               └───────┬───────────────────────────┘
            ┌──────▼───────────────────────▼───────────────┐
  Domain    │ src/domain/  types, constants, validation,   │
            │ calculations, scoring, progression,          │
            │ explain, configEdits   (pure TypeScript)     │
            └──────────────────────────────────────────────┘
  Data      src/data/defaultConfig.ts, exampleConfig.ts
```

Arrows point to what a layer may import. The domain imports nothing from React, the browser or SheetJS; only
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
| `services/exports/` | CSV export with a formula-injection guard; download helpers. |
| `app/store.ts` | All application state and actions. Framework-free and unit-tested. |
| `app/router.ts` | A small hash router (`#/`, `#/student`, `#/instructor/<tab>`). Hash routing works on any static host with no rewrite rules. |
| `features/student/` | Start, decision workspace, review, results; chart and ledger. |
| `features/instructor/` | Settings, assets, scenarios, spreadsheet import and export, sessions. Lazy-loaded. |
| `components/` | Reusable pieces: Notice, ConfirmDialog (`useConfirm`), ErrorBoundary, Change, NumberInput, EmptyState, Logo. |
| `styles/` | Design tokens (`tokens.css`) and one stylesheet (`app.css`). |

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

`File` → `readFileBytes` → `importWorkbook(bytes, name)` → either `{ ok: false, issues }`, shown as a table of sheet,
row, column and problem, or `{ ok: true, config, warnings, summary }`, shown as a preview. "Apply configuration"
opens a confirmation, then `store.saveConfiguration(config)` validates again and persists. The importer never touches
application state, which is why a failed import cannot partly change anything.

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
  UI says this on the home page and the dashboard.
- No secrets, keys or credentials exist in the code.
- Imported text is rendered as React text nodes; there is no `dangerouslySetInnerHTML` anywhere. A test imports an
  `<img onerror>` payload and checks it shows as text.
- Workbook formulas and macros are never executed. File size, sheet size and every cell are validated.
- CSV export guards against formula injection.
- No personal data is collected. Nicknames are optional, and the UI asks people not to use real names. Nothing is
  sent anywhere.
- Known dependency issue: the npm build of SheetJS (`xlsx@0.18.5`) has two published advisories (prototype pollution
  and ReDoS when parsing crafted files). The fixed versions are only distributed from the SheetJS CDN, which this
  project's build environment could not reach. See the README for the one-line upgrade and the mitigations in place.

## Performance

- The instructor dashboard and SheetJS are lazy-loaded, so the first page load fetches the app code, React and Recharts:
  about 173 KB of gzipped JavaScript (app 21.3 KB, React 60.4 KB, Recharts 91.4 KB) plus 5.1 KB of gzipped CSS and the
  font. The instructor chunk (14.9 KB) and SheetJS (141.5 KB) are fetched only when the dashboard opens. These figures
  are Vite's build output from 15 October 2026, not load-time measurements.
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
