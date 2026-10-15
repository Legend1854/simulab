# Interview guide

Notes for explaining SimuLab in an interview for a role that converts an Excel-based simulation into a web application
(RMIT requisition JR51349). SimuLab is an independent portfolio project built by a student. It is **not** an RMIT product,
it uses no RMIT data or branding, and it has no real users. Say that first; it is the honest framing and it keeps the
conversation on the engineering.

The facts below were checked against the code in this repository. Where something was not done, it is listed under
"Questions I should answer honestly".

## The one-minute version

> I took a small Excel investment game (MarketLab) and rebuilt it as a web app. The formulas became a pure TypeScript
> engine with no UI dependencies, and I tested it against the original workbook's saved values. A student plays five
> rounds, splitting a fictional A$10,000 across four assets; the app shows a live projection, records the result
> and explains each score with its formula. An instructor view lets you edit the scenarios, or import and export an Excel
> workbook with a documented layout, with row-level error messages and no partial imports. It runs entirely in the browser.

## Five decisions worth talking about

### 1. The calculation engine is pure and knows nothing about the UI
`src/domain/` imports no React, no browser APIs and no spreadsheet code. Everything the spreadsheet did is a function from typed
inputs to typed outputs (`evaluateRound`, `submitRound`, `validateConfig`).
- **Why:** the formulas can be tested in Node without rendering anything, reviewed by a non-programmer next to the
  Excel sheet, and moved to a server unchanged. A learning designer who wants to change a rule should be able to find it
  in one file.
- **Trade-off:** more files and a stricter boundary than putting calculations in components.

### 2. Units are explicit, and nothing is rounded until it is displayed
Inputs named `*Pct` are percentage points (8 means 8%); stored rates (`grossReturn`, `feeRate`, weights) are decimal
fractions. Scores are 0–100. Rounding happens only in formatting and export.
- **Why:** the commonest spreadsheet-to-code bug is a percent/fraction mix-up (a test named "uses 4, not 0.04" pins it).
  Intermediate rounding makes a displayed formula fail to reproduce the displayed score.
- **A deviation I chose and documented:** the Excel model rounded the diversification and risk-fit sub-scores to whole
  numbers before combining them. SimuLab keeps full precision. The parity test shows the whole-number decision score still
  matches Excel in all five rounds, while sub-scores differ by less than 0.5. See `MIGRATION_FROM_MARKETLAB.md`.
- **Also found:** the legacy `MODEL_SPEC.md` has a typo in its worked example (diversification 90 where the calculation
  gives 95). The workbook and code agree with each other, so I corrected the new spec and left the legacy file untouched.

### 3. The workbook is a documented contract, and import is all-or-nothing
`schema.ts` is the single source of truth: the importer reads it, the exporter writes the Instructions sheet from it, and
the docs describe it. The importer maps columns explicitly (no "guess the header"), validates every cell, reports the
exact cell (for example `Returns!C3`), and returns either a complete valid configuration or nothing. The instructor sees
a preview of what would change before applying anything.
- **Formulas are never executed.** It reads the value Excel saved and warns. A formula without a saved value is
  rejected. Percent-formatted cells are rejected because `8%` and `0.08` are ambiguous.
- **Why:** instructors will edit these files by hand; the failure that matters is a plausible-looking wrong number, not a
  crash. A rejected import changes nothing.
- **Detail worth mentioning:** one bad cell is reported once, not again as "unknown scenario" everywhere else it is
  referenced (a bug I found by building a deliberately broken sample workbook).

### 4. Saved sessions are verified, not trusted
`localStorage` can be edited by anyone. When a session is loaded it is replayed through the engine, and it is dropped if its
stored balances differ from the recomputed ones. Each session snapshots its configuration, so an instructor edit cannot
change a game in progress. `submitRound` is the only state transition, and double submission is blocked in three places
(a ref guard in the component, a separate review step, and a rejection in the domain).
- **Why:** reproducible results are the point of a graded or taught simulation.
- **Limit:** this protects against accidents and curiosity. It is not security. A student who can run code in their
  own browser can still forge anything stored locally (see decision 5).

### 5. Honest scope: client-only, with the instructor role labelled as a demonstration
There is no backend. The instructor view is a role switch and says so on the page. I documented what would change with a
server (`ARCHITECTURE.md`, "Adding a server"): run `submitRound` on the server so scores cannot be forged, add real
authentication, and store sessions in a database.
- **Why:** the project is meant to be runnable from a static URL and to show the logic translation, not infrastructure.
- **Trade-off:** no sharing between devices and no real access control. Pretending otherwise would be worse than
  saying so.

## Mapping Excel to code (how I would explain the method)

1. **Inventory the workbook:** inputs, assumptions, formulas, outputs. I read the legacy `Inputs`, `Scenarios` and `Model`
   sheets and the prototype's JavaScript.
2. **Write the rules down in prose first** (`MODEL_SPEC.md`), including units and edge cases, then confirm them with worked examples.
3. **Use the workbook as the oracle.** A test loads the legacy file, feeds its inputs to the new engine and compares every
   round with the values Excel saved.
4. **Add hand-computed tests** that do not depend on the workbook, so a shared mistake cannot hide.
5. **Make rules data, not code:** asset list, ratings, scenarios, fee and weights are configuration validated at the
   boundary, which is what lets an instructor change them without a developer.

| Excel | SimuLab |
|---|---|
| `Inputs` sheet | `SimulationConfig` (`types.ts`), validated by `validateConfig` |
| `Scenarios` sheet | `scenarios[].returnsPct`, one return per asset, ordered by round |
| `Model` sheet formulas | `evaluateRound`, `scoring.ts` |
| Fixed allocation per round | `StudentDecision` entered in the UI and validated by `validateAllocation` |
| Workbook as the data store | Versioned `localStorage` envelopes, plus `.xlsx` import and export |

## Testing, in a minute

- 216 Vitest tests at the last measured run (unit, integration, component), 25 Playwright browser tests including
  axe-core accessibility scans and layout checks at five screen widths, plus the 10 original prototype tests. Exact
  commands and results are in `TESTING.md`.
- Layers: formulas and boundaries (0%, −100%, +500%, large balances), validation, import rejections, persistence recovery,
  parity with the Excel reference, 500 seeded random invariants, user-facing component tests, and browser journeys.
- Floating point: money and returns are `number`s with relative tolerances in tests (1 × 10⁻⁸ against Excel's saved values);
  no rounding inside the engine; fixed-point formatting only on output. For a real-money system I would use integer
  minor units or a decimal library, and I would say that if asked. Here the model is educational.
- Bugs found by testing, which make good stories: cascading import errors; a formula cell without a saved value being
  read as "empty"; a mobile layout overflowing by 345 px because visually hidden text escaped a scroll box; an axe
  violation from the chart's keyboard layer; and, in the redesign, a feedback rule that suggested moving money out of
  an asset the student did not hold (a unit test caught it before it reached the screen).

## Replacing a vulnerable dependency (a good story)

`npm audit` flagged SheetJS `xlsx@0.18.5` (prototype pollution and ReDoS on crafted files). The fixed releases are not on
the npm registry, only on the SheetJS CDN, which the build environment could not reach. Options were: leave the risk and
document it, switch to another library, or read and write the small subset of `.xlsx` that SimuLab needs. Another
library (`read-excel-file`) was considered and rejected because it does not report cell number formats, so a typed
`8%` (stored as 0.08) would have been imported silently as 0.08%. The project now has its own reader and writer on `fflate` (a zip library): strict XML parsing
with no DOCTYPE, size limits checked before decompression, formulas and macros never run. It is tested against
workbooks written by openpyxl and re-saved by LibreOffice, and `npm audit` reports 0 vulnerabilities. What I would
still do: test files saved by Microsoft Excel itself.

## The redesign (if asked about the interface)

- **Two accents with fixed meanings:** petrol for committed and actionable, ochre for provisional. The projection and
  the submitted result show the same kinds of numbers, so they must never look alike.
- **Traceability on screen:** numbered step markers link a headline figure to the calculation step that produced it,
  and feedback is ordered by the points each score component lost.
- **Instructor safety:** problems are counted per tab, a summary jumps to the field, the import shows a preview of what
  would change, and destructive actions need confirmation.
- **Checked, not assumed:** contrast ratios calculated for every text token, the asset palette checked for
  colour-vision deficiency, axe-core scans and layout checks at five screen widths in the browser tests.
  `docs/DESIGN_DECISIONS.md` has the details.

## Working with non-technical stakeholders

- The spec is written in plain language with worked examples a learning designer can check with a calculator.
- Every score in the UI shows its formula with the actual numbers, so an academic can verify a result without reading code.
- Errors name the sheet, row and column, in words an instructor can act on.
- Defaults: if a requirement is ambiguous, I made a documented choice and listed it (`MIGRATION_FROM_MARKETLAB.md`) rather than silently deciding.
- Questions I would ask a real learning designer: are scenarios fictional or historical? Should results be anonymous? Is the
  score used for assessment (which changes the security requirements)? How many students at once?

## If it had to support many students

1. Server-side engine (reuse `domain/` as a shared package) so scores cannot be forged.
2. Authentication and roles (for example the university's single sign-on), replacing the demo switch.
3. A database with sessions, rounds and configuration versions as rows; keep the snapshot-per-session idea.
4. Server-side validation of imported workbooks (the same `importWorkbook`), with an audit trail of who applied which file.
5. Privacy review: nicknames only today; real identities would bring retention, consent and access rules.
6. Operational concerns: monitoring, backups, accessibility sign-off, load testing.

## Questions I should answer honestly

- **Is it deployed?** Deployment configuration exists (`BASE_PATH` support and a GitHub Pages workflow) but, from the build
  environment, I did not publish it and the workflow has not run on GitHub. Do not claim a live URL unless you have created one.
- **Does it have real users or feedback?** No. There are no users, customers or endorsements.
- **What is the code coverage?** Not measured. Do not quote a figure.
- **Performance?** Not benchmarked. The build output shows the sizes of the files; that is all that was measured.
- **Browsers?** Browser tests ran in Chromium only.
- **Screen readers?** Not tested. Automated axe-core checks and keyboard play are.
- **Dependencies and security?** SheetJS was replaced by an in-repo reader and writer, and `npm audit` reported 0
  vulnerabilities afterwards. The reader has not been tested with files saved by Microsoft Excel itself, only openpyxl
  and LibreOffice. There is no login, so this is not a secure system; see decision 5.
- **Did you use AI?** Yes, and say so plainly: this project was built with an AI coding assistant (Claude). Be ready to
  explain every file, because the point of the exercise is that you understand the logic. Read `MODEL_SPEC.md` and
  `ARCHITECTURE.md` until you can reproduce a worked example by hand.

## Practice questions

1. Where would you change the risk-fit rule? What tests would fail?
2. What happens if an instructor imports a workbook with `8%` formatted cells? Why?
3. How do you know your engine matches the spreadsheet?
4. Why does a session keep its own copy of the configuration?
5. What would you change first if 400 students used it at once?
6. A number looks wrong to an academic. How would you investigate it?
7. Why is the allocation whole-number and exactly 100 with no tolerance?
8. Why did you write your own `.xlsx` reader instead of using a library? What are the risks of doing that?
9. How does the interface keep a projection from being mistaken for a recorded result?
10. How did you check the colours work for people with colour-vision deficiency?
