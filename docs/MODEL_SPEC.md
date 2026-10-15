# SimuLab model specification

This document is the reference for every number SimuLab calculates. The code that implements it lives in
`src/domain/` (`calculations.ts`, `scoring.ts`, `progression.ts`, `validation.ts`). Every worked example below is
checked by an automated test; the test file is named next to each example.

> **Scope.** SimuLab is an educational simulation with **hypothetical** scenarios. It is not a market model, a
> financial product or advice. It deliberately leaves out taxes, dividends and distributions, contributions and
> withdrawals, transaction costs, compounding within a round, inflation adjustment and currency effects. The only
> real-world cost it models is a flat annual management fee, because it is intentionally implemented.

## 1. Units and conventions

| Kind of value | Unit in the code | Example |
|---|---|---|
| Fields ending in `Pct` (allocations, returns, fees, weights) | percentage **points** | `8` means 8% |
| `grossReturn`, `netReturn`, `feeRate`, weights `w_i` | decimal **fractions** | `0.08` means 8% |
| Balances | Australian dollars (AUD), unrounded | `10674.999999999998` |
| Scores | 0 to 100, unrounded | `79.6875` |
| Risk ratings and target risk | 0 to 100 scale | `0` = no modelled risk, `100` = highest |

**Rounding.** All calculations use full IEEE 754 double precision. Nothing is rounded inside the engine. Rounding
happens only for display and export:

| Where | Rounding |
|---|---|
| Currency on screen | 2 decimal places (`Intl.NumberFormat('en-AU', AUD)`) |
| Returns on screen | 2 decimal places |
| Scores on screen | 1 decimal place |
| CSV export | balances 2 dp, returns and fees 4 dp, HHI 4 dp, scores 2 dp |
| Final rating | uses the **unrounded** average score |

Because results are never rounded before they are reused, a round's ending balance carries into the next round
exactly. Floating-point artefacts (for example `10674.999999999998` instead of `10675`) disappear at display time
and are why the tests compare with a tolerance instead of exact equality.

## 2. Configuration inputs

| Input | Default | Valid range (enforced by `validateConfig`) |
|---|---|---|
| Starting balance | A$10,000 | greater than 0, up to 1,000,000,000 |
| Annual management fee | 0.5% | 0 to 10 |
| Assets | 4: Cash, Government bonds, Diversified global equities, Technology equities | 2 to 8 assets; unique ids matching `^[a-z][a-z0-9_]{0,31}$` |
| Asset risk ratings | 0, 0, 100, 100 | 0 to 100 |
| Risk profiles (target risk) | Conservative 30, Balanced 60, Growth 80 | 1 to 6 profiles; target 0 to 100 |
| Rounds | 5 scenarios, played in list order | 1 to 12 |
| Scenario returns | see section 7 | -100 to +500 per asset; every scenario needs a return for every asset and none for unknown assets |
| Score weights | performance 50, risk fit 30, diversification 20 | each 0 to 100; total 100 (tolerance 1e-9) |
| Performance base score | 50 | 0 to 100 |
| Performance points per 1% net return | 2.5 | greater than 0, up to 20 |
| Risk-fit penalty per risk point | 1.25 | greater than 0, up to 10 |

**Negative-balance guard.** For every scenario, `worst asset return - annual fee` must be at least `-100`. Otherwise
a student who put everything in the worst asset would end with a negative balance, which this model does not allow.
Example: a -100% return with a 0.5% fee is rejected; -100% with a 0% fee is accepted (the balance can reach exactly 0).

Text fields have length limits (names 60, titles 80, descriptions 400, nicknames 30 characters).

## 3. Decision rules

A student decision is `{ round, riskProfileId, allocationPct }`.

- Each allocation must be a **whole number** from 0 to 100.
- The allocations must total **exactly 100**. Because whole numbers are required, the total is exact, so **no
  tolerance is used**. (Decimal allocations were rejected on purpose: they would need a tolerance such as 1e-9, and
  "99.9999999" is not a meaningful classroom decision.)
- The risk profile must exist.
- The decision must be for exactly the next round.

Errors are reported per field (`fieldErrors[assetId]`) and for the total ("You have 5% left to allocate" or
"5% over the limit").

## 4. Round calculation (`evaluateRound`)

For round `k` with starting balance `B`, allocation weights `w_i = allocationPct_i / 100`, scenario returns
`r_i = returnPct_i / 100` and fee rate `f = annualFeePct / 100`:

| Step | Formula | Code |
|---|---|---|
| 1. Starting balance | `B` = previous round's ending balance, or the configured starting balance in round 1 | `currentBalanceOf` |
| 2. Validate weights | section 3 | `validateAllocation` |
| 3. Gross return | `grossReturn = Σ w_i × r_i` | `weightedReturn` |
| 4. Deduct fee | `netReturn = grossReturn − f` (fee charged on the round's starting balance) | `netReturnAfterFee` |
| 5. Ending balance | `endingBalance = B × (1 + netReturn)` | `endingBalanceFor` |
| 6a. Portfolio risk | `portfolioRisk = Σ w_i × riskRating_i` | `portfolioRiskFor` |
| 6b. Concentration | `HHI = Σ w_i²` | `herfindahlIndex` |
| 7. Scores | section 5 | `scoring.ts` |
| 8. Record | an immutable (`Object.freeze`) `RoundResult` with the decision, every intermediate value and a timestamp | `submitRound` |
| 9. Advance | only when steps 2 to 8 succeed | `submitRound` |

Each round also stores per-asset contributions `w_i × returnPct_i` (in percentage points), which add up to the gross
return and are shown in the formula bar.

**Error conditions:** missing scenario for the round; starting balance negative or not finite; unknown risk profile;
invalid allocation; a scenario without a valid return for an asset; a result below zero (this cannot happen with a
validated configuration, but the engine still refuses rather than produce one). A result between 0 and
`-1e-9 × B` (floating-point dust after a total loss) is set to exactly 0.

## 5. Scoring

### 5.1 Performance score

`performanceScore = clamp(base + pointsPerPct × netReturnPercentage, 0, 100)`

`netReturnPercentage` is in percentage points (4% is `4`, not `0.04`). Defaults: base 50, 2.5 points per point.
A 0% net return scores 50; +20% or more scores 100; −20% or worse scores 0.

### 5.2 Risk-fit score

`riskFitScore = clamp(100 − penalty × |portfolioRisk − targetRisk|, 0, 100)`

**Scale and normalisation.** Asset risk ratings and profile targets share a 0 to 100 scale. Portfolio risk is the
allocation-weighted average of the asset ratings, so it is also 0 to 100: a portfolio entirely in 0-rated assets has
risk 0 and one entirely in 100-rated assets has risk 100. With the default penalty of 1.25, every point of distance
from the target costs 1.25 score points, and a distance of 80 or more scores 0.

The default ratings (0, 0, 100, 100) make portfolio risk equal to "the percentage held in equities", which is exactly
MarketLab's "risky exposure" rule (see `MIGRATION_FROM_MARKETLAB.md`). Graded ratings such as the example workbook's
0, 25, 70, 100 express that bonds carry some risk and diversified equities less than a single sector.

### 5.3 Diversification score

`HHI = Σ w_i²`  and  `diversificationScore = clamp(100 × (1 − HHI) / (1 − 1/n), 0, 100)`

where `n` is the number of assets in the configuration (`n = 4` by default, giving `÷ 0.75`). An even split gives the
lowest possible HHI (`1/n`) and scores 100; everything in one asset gives HHI 1 and scores 0. The clamp removes
floating-point drift such as `100.00000000000001`.

**Strengths:** simple, explainable with one line of arithmetic, rewards spreading money out, comparable across
decisions, and standard (the Herfindahl-Hirschman Index is a widely used concentration measure).

**Limitations, which students should be told:** it counts asset *classes*, not correlations, so 50% in two equity
funds that move together scores the same as 50% in equities and 50% in cash; it treats all assets as equally distinct;
it rewards an even split even when an even split does not suit the student's goal (the risk-fit score partly
counterbalances this); and its meaning depends on `n`, so scores are only comparable between configurations with the
same number of assets.

### 5.4 Overall round score

`overallScore = (wP/100) × performance + (wR/100) × riskFit + (wD/100) × diversification`

with weights in percent (default 50, 30, 20) converted to fractions. The result is clamped to 0 to 100.

### 5.5 Final rating

Average score = arithmetic mean of the unrounded overall scores of all rounds. Shown only for a completed session.

| Average | Rating |
|---|---|
| 85 and above | Strategic thinker |
| 70 to below 85 | Steady decision-maker |
| 55 to below 70 | Developing investor |
| below 55 | Learning in progress |

## 6. Progression rules (`progression.ts`)

A session has a status: `in_progress`, `complete` or `abandoned`.

1. `startSession` snapshots the current configuration into the session. Later instructor edits never change a running
   session, so its results stay reproducible.
2. `submitRound` is the only way a session advances. It rejects the decision unless the session is in progress, the
   decision is for exactly the next round, and the decision is valid. It never mutates its input.
3. Submitting the last round sets the status to `complete`; further submissions are rejected.
4. Starting a new session while one is in progress marks the old one `abandoned` (it is kept, not deleted).
5. Results are deterministic: the same configuration, starting balance and decisions always give identical results.
   Stored sessions are re-validated on load by replaying their decisions through the engine (section 9).

**Double-submit protection** has three layers: the submit handler uses a ref guard that blocks a second call before
React re-renders; after a submission the screen changes to a separate review step, so a second click cannot land on
the next round's submit button; and `submitRound` itself rejects a second decision for the same round.

## 7. Default scenarios

Carried over unchanged from MarketLab. Returns in percentage points.

| Round | Scenario | Cash | Government bonds | Diversified global equities | Technology equities |
|---:|---|---:|---:|---:|---:|
| 1 | A steady start | 2 | 4 | 8 | 15 |
| 2 | A sudden sell-off | 2 | −1 | −14 | −28 |
| 3 | Recovery takes hold | 2 | 4 | 12 | 22 |
| 4 | Inflation pressures | 3 | 1 | −4 | −9 |
| 5 | A stronger expansion | 2 | 3 | 9 | 16 |

## 8. Worked examples

Expected values are written into the tests as literals. On 15 October 2026 every value in this section was re-checked
with a separate Python script using exact fractions and no SimuLab code; all matched.
**Tolerance:** tests use `toBeCloseTo(value, 9)` (absolute difference below 5 × 10⁻¹⁰) for returns, balances and
scores unless noted; the five-round fee path uses 6 decimal places because its expected value was recorded to 11
significant figures.

### Example A: even split, round 1, default fee 0.5% (`tests/unit/calculations.test.ts`)

Allocation 25 / 25 / 25 / 25, Balanced profile (target 60), starting balance A$10,000.

| Quantity | Working | Expected |
|---|---|---|
| Gross return | 0.25 × 2% + 0.25 × 4% + 0.25 × 8% + 0.25 × 15% | 7.25% |
| Net return | 7.25% − 0.5% | 6.75% |
| Ending balance | 10,000 × 1.0675 | A$10,675.00 |
| Portfolio risk | 0.25 × 0 + 0.25 × 0 + 0.25 × 100 + 0.25 × 100 | 50 |
| HHI | 4 × 0.25² | 0.25 |
| Performance | 50 + 2.5 × 6.75 | 66.875 |
| Risk fit | 100 − 1.25 × \|50 − 60\| | 87.5 |
| Diversification | 100 × (1 − 0.25) / 0.75 | 100 |
| Overall | 0.5 × 66.875 + 0.3 × 87.5 + 0.2 × 100 | 79.6875 |

### Example B: 100% technology equities, round 1, fee 0.5%

Gross 15%, net 14.5%, ending A$11,450, risk 100 (40 from target), HHI 1. Performance 86.25, risk fit 50,
diversification 0, overall **58.125**.

### Example C: mixed positive and negative returns, round 2, fee 0.5%

Allocation 15 / 25 / 40 / 20 from A$10,000. Gross −11.15%, net −11.65%, ending **A$8,835.00** (a loss of
A$1,165.00). Performance 20.875, risk fit 100, HHI 0.285, diversification 95.333…, overall **59.504166…**

### Example D: zero returns

All returns 0%: with a 0% fee the balance is unchanged and performance is exactly 50; with a 0.5% fee the balance
falls to **A$9,950.00** and performance is 48.75.

### Example E: extreme but valid inputs

+500% on every asset with no fee multiplies the balance by 6 (A$60,000) and performance clamps at 100. −100% with no
fee takes the balance to exactly A$0 and performance clamps at 0. −100% with any fee is rejected by validation.

### Example F: five sequential rounds (`tests/unit/progression.test.ts`, `tests/integration/reference-workbook.test.ts`)

Allocation 15 / 25 / 40 / 20 every round, Balanced.

| Round | Ending balance, fee 0% (matches the MarketLab workbook) | Overall score, fee 0% |
|---:|---:|---:|
| 1 | 10,750.00 | 83.4417 |
| 2 | 9,551.375 | 60.1292 |
| 3 | 10,554.269375 | 87.1917 |
| 4 | 10,269.304101875 | 70.6917 |
| 5 | 11,075.444473872187 | 83.8792 |

Average 77.07, rating "Steady decision-maker". With the default 0.5% fee the final balance is **A$10,805.887026…**
(shown as A$10,805.89), which the end-to-end test also checks in the browser.

### Invariant checks (`tests/integration/import-and-play.test.ts`)

500 seeded random valid allocations confirm that every score stays within 0 to 100, that
`endingBalance = start × (1 + netReturn)`, that `netReturn = grossReturn − fee`, and that per-asset contributions add
up to the gross return.

## 9. Persistence format

Browser `localStorage` keys: `simulab.config`, `simulab.sessions`, `simulab.activeSession`. Each value is an envelope
`{ "schemaVersion": 1, "savedAt": "<ISO time>", "data": … }`.

On load:

- missing data → defaults, silently;
- invalid JSON, wrong shape or another schema version → defaults (or no sessions) and a visible notice;
- a configuration is accepted only if `validateConfig` passes;
- a session is accepted only if its configuration snapshot is valid **and** replaying its stored decisions through the
  engine reproduces each stored ending balance within a relative tolerance of 1 × 10⁻⁶. Edited or corrupted
  sessions are dropped with a notice; valid ones are kept.

At most 50 sessions are kept. If a write fails (for example a full storage quota), the app keeps working in memory and
shows "Not saved".

## 10. Workbook format (version 1)

Defined in `src/services/spreadsheets/schema.ts`. Sheet and column names are matched case-insensitively and ignore
surrounding spaces. Every exported workbook also contains an **Instructions** sheet generated from the same schema.

| Sheet | Columns (required in bold) | Notes |
|---|---|---|
| Instructions | any | Ignored on import |
| Settings | **Key**, **Value**, Notes | One row per key: SchemaVersion (must be 1), ConfigName, StartingBalance, AnnualFeePct, WeightPerformancePct, WeightRiskFitPct, WeightDiversificationPct, PerformanceBaseScore, PerformancePointsPerReturnPct, RiskFitPenaltyPerRiskPoint. All keys are required. |
| Assets | **AssetId**, **Name**, Description, **RiskRating** | |
| RiskProfiles | **ProfileId**, **Name**, Description, **TargetRisk** | |
| Scenarios | **ScenarioId**, **Round**, **Title**, Phase, Description, Lesson | Round: whole numbers 1 to n, unique, no gaps. Rows may be in any order. |
| Returns | **ScenarioId**, **AssetId**, **ReturnPct** | Exactly one row per scenario and asset. Long format, so adding an asset does not change any sheet's columns. |

**Import pipeline** (`importWorkbook`), stopping at the first stage that finds errors:

1. File checks before parsing: `.xlsx` extension, not empty, at most 2 MB, starts with the ZIP signature.
2. Parse with SheetJS: values, number formats and formula text only; macros (`bookVBA`) off; at most 500 rows read
   per sheet; sheets over 500 rows or 20 columns are rejected.
3. Structure: required sheets, required header columns, duplicate headers. Unknown columns produce a warning.
4. Cells: required values, numbers, whole numbers, text. Numbers stored as text (including thousands separators) are
   accepted. Percent-formatted cells are rejected (a cell showing "8%" holds 0.08, which is ambiguous). Error values
   (`#DIV/0!`), booleans and dates are rejected.
5. Identifiers and cross-sheet references: duplicate ids, round numbering, returns for unknown scenarios or assets,
   duplicate scenario-and-asset pairs, and missing pairs. A row with a valid id but another bad cell still counts as a
   known id, so one bad cell does not cascade into "not listed" errors elsewhere.
6. Mapping to the typed `SimulationConfig`.
7. The shared model rules from `validateConfig` (ranges, weights total, negative-balance guard), with each problem
   mapped back to its sheet.

Every problem names the sheet, the Excel row number (the header is row 1) and the column where it can. At most 100
problems are listed. The result is all-or-nothing: either a complete valid configuration with a preview, or a list
of problems, never a partial import. Nothing is applied until the instructor confirms.

**Unsupported, and documented as such:**

- **Formulas are never calculated.** SheetJS is not a formula engine. For a formula cell SimuLab reads the value
  Excel last saved in the file and shows a warning; a formula with no saved value (for example from a generator that
  never calculated it) is rejected with advice to open and save the file in Excel.
- Macros (`.xlsm`), legacy `.xls`, `.ods`, CSV, password-protected workbooks, merged cells inside tables, data on
  extra sheets, charts and images.
- Arbitrary workbook layouts. Only this schema is mapped; translating another workbook means writing an explicit
  mapping for it (see `INTERVIEW_GUIDE.md`).

## 11. CSV results export

One row per submitted round across any number of sessions, with columns for session id, nickname, status,
configuration name, round, scenario, risk profile, each asset's allocation, starting balance, gross return, fee,
net return, ending balance, portfolio risk, target risk, HHI, the four scores and the submission time (UTC). Text
that starts with `=`, `+`, `-`, `@`, tab or carriage return is prefixed with `'` so spreadsheet programs do not run it
as a formula. The file starts with a UTF-8 byte-order mark so Excel reads it correctly.
