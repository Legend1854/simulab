# Design decisions

This document explains the visual and interaction design introduced in the October 2026 redesign: what each choice
is, why it was made, and where it lives in the code. The aim was an interface that reads like an analyst's
working notes rather than a generic dashboard, because the product's whole point is that every number can be traced
back to its inputs.

## Concept: an analyst's computation pad

| Material | In the interface | Why |
|---|---|---|
| Ledger paper | The page background (`--paper`, a pale green-grey) with faint ruled lines behind the home figure | Spreadsheets and accounting pads are where these rules came from |
| Sheets | White working surfaces (`.sheet`) with a thin rule, not a shadow | Each sheet is one piece of work: a scenario brief, a decision, a report |
| Ink | Deep blue-green text (`--ink`) and the ink panels (draft bar, "Play the simulation") | Strong contrast without pure black |
| Petrol | The colour of anything committed or actionable: primary buttons, the "Submitted" pill, completed timeline steps, the current tab | One colour means "this is real" |
| Ochre | The colour of anything provisional or contextual: the projection, the current round, the scenario phase, changed values in the import preview | One colour means "this is not recorded yet" or "look here" |

The petrol/ochre split is the most important rule in the system. A projection and a submitted result show the same
kinds of figures, so they are told apart by colour, border, label and position:

- **Projection:** dashed ochre border, an ochre "Projection, not submitted" pill with a formula icon, in the side
  column of the round workspace, with the sentence "Nothing is recorded until you submit."
- **Submitted result:** solid sheet, a petrol "Submitted" pill with a check icon, a heading "Round N result" and the
  words "Recorded and final."

The paper is deliberately cool rather than cream, and the accent is ochre rather than terracotta, so the palette does not
fall back on the warm-cream-and-clay look that many generated pages share.

## Colour tokens and contrast

Colours are custom properties in `src/styles/tokens.css`. The exceptions are a handful of hover and tint shades
written directly in the stylesheets beside the token they derive from (eleven values at the time of writing), and the
balance chart and logo, which need hex values in SVG attributes (named constants that mirror the tokens).

Contrast ratios below were calculated with the WCAG 2.x relative-luminance formula on 15 October 2026. Normal text
needs 4.5:1; large text and the boundaries of controls and data marks need 3:1.

| Foreground | Background | Ratio | Used for |
|---|---|---|---|
| `--ink` #13262b | `--sheet` #fbfbf8 | 15.1:1 | Body text |
| `--ink` | `--paper` #e8ede7 | 13.2:1 | Text on the page background |
| `--ink-2` #3c4d52 | `--paper` | 7.5:1 | Secondary text |
| `--muted` #56666a | `--sheet` / `--paper` | 5.8:1 / 5.1:1 | Hints, captions |
| `--petrol` #0d5c63 | `--sheet` | 7.4:1 | Links, petrol text |
| white | `--petrol` | 7.7:1 | Primary buttons |
| `--ochre-ink` #7a5508 | `--sheet` / `--ochre-wash` | 6.5:1 / 5.7:1 | Ochre text and pills |
| `--gain` #22703f / `--loss` #a33a2b | `--sheet` | 5.9:1 / 6.3:1 | Gains and losses (always with an arrow and a word) |
| `--error-ink` #9e2f24 | `--error-bg` #f9e7e3 | 6.1:1 | Error messages |
| `--ok-ink` #1f6638 | `--ok-bg` #e3f0e6 | 5.9:1 | Success messages |
| `--rule-strong` #788783 | `--sheet` | 3.6:1 | Input and control borders |
| `--ochre` #b5830f | `--sheet` | 3.3:1 | Ochre marks (not text) |
| `--on-ink-dim` #b9cbc6 | `--ink` | 9.3:1 | Secondary text on ink panels |

Status colours (success, warning, error) are never used for asset data, and every status is also shown with an icon
and words.

## Data colours

Assets get colours from a fixed eight-slot categorical palette (`--series-1` to `--series-8`), assigned by the asset's
position in the configuration (`src/components/viz/assetColors.ts`). Rules:

- The order is fixed and never cycled. Configurations allow at most eight assets, and `assetColor()` throws beyond
  that rather than inventing a colour.
- A colour follows its asset everywhere: the scenario brief, the allocation sliders, the allocation bar, the round
  ledger, the instructor matrix.
- Colours identify; they never carry text. Asset names always appear next to the colour (legends, row labels).
- Adjacent segments in the allocation bar are separated by a 2px gap, so neighbouring colours never touch.

The palette was checked with a colour-vision-deficiency validator (OKLab ΔE between adjacent slots, simulated for
protan, deutan and tritan vision) against the sheet colour #fbfbf8. Result: all checks passed. Worst adjacent pair
ΔE 12.2 under deuteranopia and 24.2 for normal vision; every slot is at least 3:1 against the sheet. The tritan
separation of the first two slots is 6.0, which is in the acceptable-with-secondary-encoding band, and the names
beside every colour are that secondary encoding.

## Typography

- **Public Sans** (variable, bundled from `@fontsource-variable/public-sans`) for everything people read. It is a
  plain, open-source sans with good tabular figures, chosen so numbers line up in columns (`font-variant-numeric:
  tabular-nums` is applied to every figure and table number).
- **IBM Plex Mono** (`@fontsource/ibm-plex-mono`, weights 400 and 500) only for formulas, cell references such as
  `Returns!C3`, and identifiers. Monospace marks "this is something you could type into a spreadsheet". It is not used
  for labels or decoration.
- Both fonts are bundled with the app; there are no requests to font services.
- Scale (in `tokens.css`): 12, 13, 15, 17, 22, 30 and 44 px. The 44 px size is used once, for the home headline.
- Sentence case everywhere, no all-caps labels, no letter-spaced eyebrows.

## Layout

- One content column, at most 1240 px wide (`--shell`), with a 24 px side margin (16 px on phones).
- The round workspace is two columns on wide screens: scenario and decision on the left, the projection on the right
  (sticky so it stays visible while the allocation changes). Below 1081 px it becomes one column.
- Sheets are flat. Only things that float over content get a shadow: dialogs and the sticky unsaved-changes bar.
- Controls (6 px radius) are tighter than the sheets they sit on (10 px), so the hierarchy reads at a glance.
- Breakpoints: wide ≥ 1081 px, tablet 761 to 1080 px, phone ≤ 760 px, narrow phone ≤ 400 px. CSS variables cannot be
  used inside media queries, so these are written as literal values and listed in a comment in `tokens.css`.
- Tables that are wider than a phone scroll inside their own container (`.table-wrap`); the page itself never scrolls
  sideways. The scenario matrix keeps its round column pinned while it scrolls, and on phones a hint says the table
  scrolls.

## Traceability devices

- **Step markers:** small numbered circles next to a headline figure (for example the ending balance) that link to the
  matching numbered step in "How this result was calculated". Activating one opens the evidence and moves focus to
  that step (`src/components/StepMarker.tsx`).
- **Evidence steps:** each step shows the formula in words, the same formula with the real numbers substituted (in
  monospace) and the result. The formula text comes from `src/domain/explain.ts`, which formats values the engine has
  already calculated and never calculates anything itself.
- **Round statement:** a short money statement (starting balance, gross return, fee, ending balance) set like an
  account statement, so gross, fee and net are never blurred together.
- **Feedback ordered by points lost:** "What shaped this score" lists the three score components in the order of how
  many points each cost, with one concrete, number-based suggestion each.

## Icons and artwork

- **Icons:** one set of simple stroke icons drawn on a 24-unit grid as SVG path data in `src/components/Icon.tsx`.
  No icon font, no emoji. Decorative icons are hidden from assistive technology; an icon that carries meaning on its
  own (for example the problem marker on a matrix row) has a text label.
- **Logo mark** (`src/components/Logo.tsx`): a three-by-three block of spreadsheet cells with a petrol balance path
  running through it and ending in an ochre point: cells in, simulated outcome out. The favicon in `index.html` is
  the same drawing, and a unit test checks the two stay identical.
- **Home figure** (`src/features/home/Pipeline.tsx`): the "spreadsheet → engine → outcome" illustration is not a
  picture. It is drawn from the active configuration: a miniature returns sheet with column letters, round 1 worked
  through by the real engine with an even split, and a small SVG line of the balance after each round. If an instructor
  changes the configuration, the figure changes with it.
- **Charts:** the balance chart on the results and history views uses Recharts with the token colours. The home
  figure's small balance path is hand-written SVG, because it needs no axes or interaction.

## Motion

Motion only answers an action: button presses, the disclosure chevron, meter and weight-bar changes, all 120 to 200
ms. There are no entrance animations. `prefers-reduced-motion: reduce` turns transitions off.

## Instructor workspace

- **Status ledger:** the header shows the active configuration, its size, and an editor state pill: "All changes
  saved", "Unsaved changes" or "Unsaved, N problems".
- **Problems are counted per tab** with a small red count on the tab, so a problem on another tab is not missed.
- **Validation summary:** while the unsaved configuration has problems, a summary lists each one as a button. Choosing
  one switches to the right tab and moves focus to the field (for scenario details it also opens that round).
  Saving is disabled until the list is empty.
- **Scenario matrix:** rounds are rows and assets are columns, so a whole market story can be read across. Each return
  field shows a small up or down arrow, so positive and negative values differ by shape as well as by sign. Problems
  turn the cell red, put a marker on the row and are listed in full under the table, because the messages are too
  long for a table cell.
- **Guided import:** a four-step indicator (choose a workbook, check every row, preview the changes, apply). Problems
  are shown with an exact cell reference such as `Returns!C3`. A valid workbook shows a table of what would change
  compared with the saved configuration, with changed values flagged, before anything is applied.
- **Destructive actions** (delete a round, remove an asset, delete sessions, reset everything) always open a
  confirmation dialog with a red top edge and a specific button label, and Escape cancels.

## Accessibility decisions

- Every control has a visible label; table-cell inputs have full labels for assistive technology ("Round 2
  Technology equities return").
- Focus is visible everywhere (a 3 px petrol outline). Headings that receive focus after navigation do not show a ring,
  because they are not interactive.
- After a submission, focus moves to the result heading; after an import, to the result heading; after choosing a
  problem in the validation summary, to the field.
- Live regions announce the allocation total, the weights total and import progress.
- In Windows high-contrast mode (forced colours) sheets, notices and data marks keep visible borders and fills.
- Automated axe-core scans run in the browser tests (see `docs/TESTING.md`). No screen reader was used to test the
  redesign.

## Not done, and known compromises

- There is no dark theme. The tokens would allow one, but it has not been designed or tested.
- Validation messages for returns name the asset by its identifier (`"tech_equities"`), which matches the workbook's
  `AssetId` column but is less friendly than the asset name in the browser editor.
- On phones the scenario matrix scrolls sideways; a card layout per round was considered and not built.
- Recharts is still part of the first page load, although only the student screens draw a chart.
