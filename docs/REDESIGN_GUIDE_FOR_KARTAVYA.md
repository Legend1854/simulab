# Redesign guide for Kartavya

A plain-language guide to the October 2026 redesign: what changed, where things live, how to change them, how to
check your work, and what to study so you can explain all of it in your own words.

## How this was made, and what that means for you

The redesign, the new `.xlsx` reader and writer and the updated tests were produced in a working session with Claude,
an AI model, from your upgrade brief. That is fine to say, and you should say it if asked: "I used an AI assistant for
a large part of the implementation; I set the brief, reviewed the screenshots and the code, and I can walk you through
how each part works." What would not be fine is presenting it as hand-written from scratch.

The practical consequence: before you show this to anyone, read the files listed below until you could rebuild each
idea yourself. The "What to study" section is ordered for that.

## What changed, in one paragraph

The interface now has its own visual identity: pale green "ledger paper" pages, white working sheets, deep blue-green
ink, petrol for anything committed or clickable, and ochre for anything provisional (the projection, the current
round). The home page has a figure that works through round 1 from the real configuration. The student round shows the
scenario, the decision and a clearly marked projection side by side; the result reads like an analyst's note with a
money statement, numbered calculation steps and feedback ordered by points lost. The instructor workspace has a status
header, problem counts on tabs, a validation summary that jumps to the field, a scenario return matrix, and a guided
four-step import. SheetJS was replaced by a small reader and writer in the project, which removed the `npm audit`
advisory.

## Key files

| What | File |
|---|---|
| Every colour, font size, space, radius, shadow and timing | `src/styles/tokens.css` |
| Reset, typography, small helpers (`.stack`, `.row`, `.muted`) | `src/styles/base.css` |
| Header, footer, page width | `src/styles/layout.css` |
| Buttons, inputs, notices, pills, tables, dialogs | `src/styles/components.css` |
| Home, student and instructor screens | `src/styles/home.css`, `student.css`, `instructor.css` |
| The order the stylesheets load in | `src/styles/app.css` |
| Icons | `src/components/Icon.tsx` |
| Logo and favicon | `src/components/Logo.tsx`, `index.html` |
| Asset colours, allocation bar, return bars | `src/components/viz/` |
| Home page and its figure | `src/features/home/HomePage.tsx`, `Pipeline.tsx` |
| Student round | `src/features/student/SimulationScreen.tsx` (state), `ScenarioBrief.tsx`, `DecisionForm.tsx`, `ProjectionPanel.tsx` |
| Student result | `RoundReport.tsx`, `Evidence.tsx`, `ScoreBreakdown.tsx`, `Feedback.tsx`, `RoundReview.tsx` |
| Text for formulas and feedback | `src/domain/explain.ts` |
| Instructor header, tabs, validation summary | `src/features/instructor/InstructorPage.tsx` |
| Labelled inputs and their element ids | `src/features/instructor/fields.tsx` |
| Scenario matrix | `src/features/instructor/ScenariosTab.tsx` |
| Guided import | `src/features/instructor/SpreadsheetTab.tsx` |
| `.xlsx` reading and writing | `src/services/spreadsheets/ooxml/` |
| Why each design choice was made | `docs/DESIGN_DECISIONS.md` |

## Changing the look

Almost everything visual comes from the tokens, so most changes are one line.

**Example: a different primary colour.** In `src/styles/tokens.css` change `--petrol` (and `--petrol-deep`, the hover
shade). Then check contrast: white text on the new colour must reach 4.5:1 and the colour as text on `--sheet` must
reach 4.5:1. Any WCAG contrast checker works; paste the two hex values. Then run the accessibility tests
(`npm run test:e2e`), which include axe-core colour-contrast checks.

**Example: bigger body text.** Change `--text-base` (15 px now). Headings use their own tokens (`--text-md` to
`--text-2xl`).

**Example: rounder corners.** `--radius-control` for inputs and buttons, `--radius-sheet` for the white panels.

Rules worth keeping when you change things:

- Petrol means committed or actionable; ochre means provisional. Do not use ochre for a submitted result.
- Gains and losses always have an arrow and a word as well as a colour.
- Asset colours come from `assetColor(index)` in a fixed order. Do not pick asset colours by hand.
- Breakpoints are literal numbers in media queries (1080, 760, 400 px); they are listed at the top of `tokens.css`.

## How the SVG artwork works

SVG is a text format for drawings: a `viewBox` sets up a coordinate system, and shapes are placed on it.

- **Icons** (`Icon.tsx`): every icon is one `path` on a 24 × 24 grid, drawn with a stroke rather than a fill, so all
  icons share a line weight. A path's `d` attribute is a list of drawing commands: `M x y` moves the pen, `L x y` draws
  a straight line, `a` draws an arc, `z` closes the shape. To add an icon, add an entry to `PATHS` and use
  `<Icon name="..." />`. If the icon is the only thing that says what something means, give it a `label`.
- **Logo** (`Logo.tsx`): a 28 × 28 drawing: a rounded square, two vertical and two horizontal grid lines (the cells),
  a petrol polyline (the balance path) and an ochre circle (the result). The favicon in `index.html` is the same SVG,
  URL-encoded. If you change one, change the other; `tests/unit/logo.test.ts` fails if they differ.
- **Home balance path** (`Pipeline.tsx`, `BalancePath`): the balances after each round become points. Two small
  functions map them into the drawing: `x(index)` spreads rounds evenly across the width, and `y(value)` maps the
  lowest balance to the bottom and the highest to the top (SVG's y axis points down, hence `1 - ...`). The path is
  `M` to the first point and `L` to each next one. The dashed line is the starting balance.
- **Allocation bar** (`viz/AllocationBar.tsx`): not SVG, just a flex row of `span`s whose widths are the percentages,
  with 2 px gaps. Any unallocated share is drawn as a hatched segment.
- **Return bars** (`viz/ReturnBars.tsx`): a table where each row's bar starts at the middle (50%) and grows right for
  a positive return or left for a negative one, scaled by the largest return in the whole configuration so bars are
  comparable between rounds.

## Running and checking

Run these in the `simulab` folder (the one with `package.json`). Node 22.12+ or Node 24 is required.

```bash
npm ci                   # install exact versions
npm run dev              # development server at http://localhost:5173
npm run typecheck        # strict TypeScript
npm test                 # unit, integration and component tests (Vitest)
npm run build            # production build into dist/
npm run test:e2e         # browser tests in Chromium (builds and serves the app itself)
npm run screenshots      # recaptures docs/screenshots/*.png from the real app
```

First time on a new machine, Playwright needs a browser: `npx playwright install chromium`.

**Screenshots.** `npm run screenshots` runs `tests/screenshots/capture.spec.ts`, which plays through the app at
1440 × 900 (and 390 × 844 for the phone images) and saves twelve PNG files in `docs/screenshots/`. Open them in any
image viewer. They are real captures of the running app; if you change the design, rerun the command rather than
editing images.

**Layout checks.** `tests/e2e/layout.spec.ts` loads every student and instructor page at 1440, 1280, 820, 390 and
360 px wide and fails if the page scrolls sideways. If you add a wide table, put it inside `<div className="table-wrap">`
so it scrolls on its own instead.

**Accessibility checks.** `tests/e2e/accessibility.spec.ts` runs axe-core on every main view. Axe catches many problems
(missing labels, low contrast, invalid ARIA) but not all; it is worth trying the app with only a keyboard, and with a
screen reader (NVDA on Windows is free) before an interview.

## The `.xlsx` story (likely interview question)

`npm audit` reported a high-severity advisory on SheetJS `xlsx@0.18.5`, the version on the npm registry. The fixed
versions are published only on SheetJS's own CDN, and that site was blocked from the build environment. Rather than
forcing an upgrade blindly or leaving a known risk, the project now has its own small reader and writer for the
parts of the format it uses, on top of `fflate` (a zip library with no dependencies):

- An `.xlsx` file is a zip of XML files. The reader finds the sheets through the relationship files, reads strings,
  numbers, booleans, errors and dates, and uses each cell's number format to tell a typed `8%` (stored as 0.08) from a
  typed `8`.
- It never evaluates formulas (it reads the value Excel last saved) and never opens macros.
- Before decompressing anything it checks the sizes the zip declares (at most 1,000 files, 10 MB per XML part, 25 MB
  in total), which guards against "zip bombs". The XML parser refuses `<!DOCTYPE`, which blocks entity-expansion
  attacks.
- It was tested against files written by openpyxl and re-saved by LibreOffice. It has not been tested with files
  saved by Microsoft Excel itself; doing that is a good next step (see below).

## What to study, in order

1. **CSS custom properties and the cascade:** how `var(--petrol)` works, why the stylesheets load in a fixed order,
   and how selector specificity decides which rule wins (look at `.matrix tr[data-selected='true'] > *`).
2. **CSS grid and flexbox:** the round workspace (`.workspace`), the settings rows (`.field-row`), the allocation bar.
3. **`position: sticky`:** the projection panel, the unsaved-changes bar and the matrix's round column.
4. **SVG basics:** `viewBox`, `path` commands, `stroke` versus `fill`.
5. **Accessibility fundamentals:** labels, `aria-describedby` for error messages, `role="status"` live regions, focus
   management after an action, why a heading gets `tabIndex={-1}`. Read the WCAG "contrast minimum" and "focus
   visible" success criteria.
6. **Colour for data:** why categorical colours have a fixed order, what colour-vision deficiency does to red and
   green, why every colour has a text label beside it.
7. **React state patterns used here:** `useSyncExternalStore` (the store), `useMemo` for the projection, a ref as a
   double-submit guard, `key` to reset a component between rounds.
8. **The OOXML format:** unzip a `.xlsx` yourself (rename it to `.zip`) and read `xl/workbook.xml`,
   `xl/worksheets/sheet1.xml` and `xl/sharedStrings.xml`. Then read `ooxml/readXlsx.ts` with those files open.
9. **Playwright:** role-based locators (`getByRole('button', { name: ... })`) and why they double as accessibility
   checks.

## Questions you should be ready for

- "Why two accent colours?" Petrol for committed, ochre for provisional; the projection and the result must never
  be confused.
- "How do you know the numbers are right?" The engine is pure TypeScript with unit tests and a parity test against the
  saved values in the original Excel workbook; the explanations only format numbers the engine produced.
- "What happens with a bad workbook?" It is checked completely before anything changes; every problem is listed with
  its cell; nothing is applied until you confirm a preview.
- "Is it secure?" It is a client-side demo with no login; the instructor view is a role switch, not access control.
  Files are size-checked before parsing, formulas and macros are never run, and text is rendered as text.
- "What would you do next?" See below.

## Unfinished, and the safest next steps

1. **Open the generated workbooks in Microsoft Excel** (template, example, and an exported configuration), save them
   from Excel, and import them back. If anything fails, save the file as a test fixture and add a test.
2. **Try a screen reader** on one full round and on the import flow, and note anything confusing.
3. **Test on a real phone**, especially the scenario matrix (it scrolls sideways) and the sliders.
4. **Lazy-load the balance chart** so Recharts is not part of the first page load.
5. **Show asset names instead of IDs** in return validation messages in the browser editor.
6. Keep running `npm audit` after any dependency change, and never run `npm audit fix --force` without reading what it
   would change.
