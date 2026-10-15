# From MarketLab to SimuLab

SimuLab started from the MarketLab prototype (vanilla HTML, CSS and JavaScript with a formula-driven Excel reference
workbook). The original files are kept unchanged in `legacy/marketlab-prototype/`. This document records what was
inspected, what was kept, and what changed and why.

## What the prototype had (inspected 15 October 2026)

| Item | State in MarketLab |
|---|---|
| `simulation.js` | Pure calculation functions for validation, weighted return, diversification, risk fit, decision score and rating. Worked. |
| `app.js` | DOM rendering, state, an SVG chart, history table and CSV export. Worked for one session; no persistence. |
| `tests/simulation.test.mjs` | 10 Node test-runner tests. Ran and passed (10 of 10) before any changes. |
| `MarketLab_Reference_Model.xlsx` | Inputs, Scenarios and Model sheets with real formulas, plus a fixed allocation over five rounds. |
| `MODEL_SPEC.md` | Formulas and one worked reference case. |
| Missing | Configuration editing, spreadsheet import, persistence, instructor view, fees, component or browser tests. |

## Assumptions carried over unchanged

| MarketLab assumption | Where it lives in SimuLab |
|---|---|
| Starting capital A$10,000 | `DEFAULT_CONFIG.startingBalance` |
| Five scenarios with identical titles and returns | `DEFAULT_CONFIG.scenarios` |
| Allocations are whole numbers 0 to 100 and total exactly 100 | `validateAllocation` |
| Weighted return `Σ (alloc/100) × (return/100)` | `weightedReturn` |
| Ending capital = starting capital × (1 + return), carried to the next round | `evaluateRound`, `submitRound` |
| Return score `clamp(50 + return × 250, 0, 100)` | `performanceScore` with base 50 and 2.5 points per percentage point (the same rule written in percentage points) |
| Diversification `100 × (1 − HHI) / (1 − 1/4)` | `diversificationScore` (generalised to n assets) |
| Risk fit `100 − 1.25 × \|risky exposure − target\|` | `riskFitScore`, with risky exposure expressed through risk ratings (below) |
| Risk targets Conservative 30, Balanced 60, Growth 80 | `DEFAULT_CONFIG.riskProfiles` |
| Weights 50% return, 20% diversification, 30% risk fit | `scoring.weights` 50 / 30 / 20 (same values, listed in a different order) |
| Rating bands 85 / 70 / 55 | `RATING_BANDS` |
| Allocation may change every round | Unchanged |
| CSV export of the session | Extended to many sessions and more columns |

## Deliberate changes

| Change | Reason |
|---|---|
| **Sub-scores are no longer rounded before they are combined.** MarketLab rounded diversification and risk fit to whole numbers, then rounded the decision score. SimuLab keeps full precision and rounds only for display. | Rounding intermediate values adds up to ±0.5 error per component and means the displayed formula (for example `0.5 × 68.75 + 0.2 × 95.33 + 0.3 × 100`) does not reproduce the displayed score. Full precision with display rounding is the rule for the whole engine. The parity test shows the rounded whole-number decision scores still match the workbook in all five rounds. |
| **Risk is expressed through asset risk ratings** (0 to 100) and profile target risk, instead of the fixed "Broad market + Technology" sum. | The fixed sum only works for those two named assets. Ratings work for any imported asset list. The default ratings 0, 0, 100, 100 reproduce MarketLab's rule exactly. |
| **Diversification is normalised by the number of assets n**, not a fixed 4. | Imported configurations may have 2 to 8 assets. For 4 assets the formula is identical. |
| **Annual management fee added** (default 0.5%, configurable 0 to 10%). | Required by the brief. Setting it to 0 reproduces MarketLab exactly, which the parity test relies on. |
| **Asset ids renamed:** `market` → `global_equities`, `technology` → `tech_equities`; display names "Diversified global equities" and "Technology equities"; "Bonds" → "Government bonds". | The brief names these four asset classes. Ids are now stable identifiers referenced by the workbook. |
| **Default allocation is an even split** (25 / 25 / 25 / 25) instead of 15 / 25 / 40 / 20. | The default must work for any imported asset list. The legacy allocation is kept as a test fixture (`LEGACY_ALLOCATION`). |
| **"Years" became "rounds".** | Rounds are what the configuration defines; nothing in the model is tied to calendar years. |
| **Validation at boundaries** for configuration, storage and workbooks. | MarketLab's data was hard-coded, so it never needed this. |

## A discrepancy found in the legacy documentation

MarketLab's `MODEL_SPEC.md` reference case says
`Decision score = round(0.5 * 68.75 + 0.2 * 90 + 0.3 * 100) = 83`, but the diversification score it computes two
lines earlier is **95**, not 90. With 90 the result would be 82; with 95 it is 83, which matches the workbook
(`Model!J4`) and the code. The legacy file is kept as it was; SimuLab's `MODEL_SPEC.md` uses the correct values.

## How parity is verified

`tests/integration/reference-workbook.test.ts` reads the inputs from the legacy workbook's `Inputs` and `Scenarios`
sheets, runs them through the SimuLab engine with the fee set to 0, and compares the results with the values Excel
saved in the `Model` sheet:

- portfolio return, starting capital, change and ending capital for all five rounds: equal within 1 × 10⁻⁸;
- return score: equal within 1 × 10⁻¹⁰;
- diversification and risk fit: within 0.5 of the workbook's rounded integers (the documented change above);
- the whole-number decision score: identical in all five rounds.

The legacy tests still run on their own: `node --test legacy/marketlab-prototype/tests/simulation.test.mjs`.
