# SimuLab user guide

SimuLab is an educational investment simulation. Everything is fictional: the scenarios are invented for teaching, the
money is not real, and the results are not financial advice. Everything is stored in your own browser. There is no
account, no server and no data is sent anywhere.

Screenshots referred to below are in `docs/screenshots/`.

## For students

### Start
1. Open the app and choose **Start the simulation**.
2. Optionally type a nickname (up to 30 characters). It appears in the instructor's session list. Use a nickname, not your
   real name.
3. Choose **Start round 1**.

### Each round
1. Read the scenario at the top: what is happening in the market and what the round is meant to teach.
2. Choose a **risk profile** (for example Conservative, Balanced or Growth). The profile sets a target portfolio risk;
   your risk-fit score measures how close your allocation is to it.
3. Set the **allocation**: whole-number percentages for each asset. Type a number or use the slider beside it.
   The allocations must total exactly **100%**. The message beside the form tells you how much is left, or how far over
   the limit you are, and **Submit** stays disabled until the allocation is valid.
4. The **projection**, beside the decision on wide screens and below it on phones, shows what would happen with your
   current allocation. It has a dashed ochre border, is labelled *Projection, not submitted* and is never recorded.
   Change the allocation as often as you like. The coloured bar under the allocation shows your mix and turns the total
   green when it reaches exactly 100%.
5. Choose **Submit round N**. The result is calculated once and recorded; submitting twice (for example a double click)
   still records one round.
6. The **round result** is marked *Submitted*. It shows your ending balance and round score, a short statement
   (starting balance, gross return, fee, ending balance), the numbered calculation steps with the real numbers filled
   in, and the three scores with a reason each (choose **Show the scoring formulas** for the formulas). The small numbered
   circle next to a figure jumps to the step that calculated it. **What shaped this score** lists the three parts in
   the order of how many points each cost you, with a concrete suggestion. Then choose **Continue to round N**.

The allocation you chose carries over to the next round, so you only change what you want to change. Your ending balance
is the next round's starting balance.

### Scores
Every round produces three scores out of 100, combined into an overall score using the weights the instructor has set
(by default 50% performance, 30% risk fit, 20% diversification):

| Score | Meaning |
|---|---|
| Performance | How well the portfolio did after the fee. 0% net return scores the base (50 by default); each extra percentage point adds 2.5 points; limited to 0–100. |
| Risk fit | How close your portfolio's weighted risk is to the target of your risk profile. Each point of distance costs 1.25 points. |
| Diversification | How evenly the money is spread. An equal split scores 100; everything in one asset scores 0. |

`docs/MODEL_SPEC.md` has the exact formulas with worked examples.

### Finishing
After the last round, the results screen shows your final balance, total return, average scores and a rating
(Strategic thinker 85+, Steady decision-maker 70+, Developing investor 55+, otherwise Learning in progress), a balance
chart and a table of every round. **Export my results (CSV)** downloads your decisions and results. **Start a new
simulation** begins again.

### Interruptions and starting over
- If you reload the page or close the tab, your unfinished simulation is restored when you come back, from the same round,
  with a "Welcome back" message.
- **Start over** asks for confirmation. The unfinished simulation is kept in the instructor's list marked as abandoned.
- If the instructor changes the configuration while you are playing, your simulation keeps the settings it started with.
  A message tells you so. New simulations use the new settings.
- If your browser blocks storage (some private modes), SimuLab still works but says that progress will not be saved.

### Keyboard and accessibility
The whole round can be played with the keyboard. Gains and losses are shown with arrow icons and words, not colour
alone, and every asset colour has the asset's name beside it.
The balance chart is hidden from assistive technology because its caption and the round history table carry the same
data. Automated accessibility checks passed, but no screen reader was used to test the app (see `TESTING.md`).

## For instructors

The instructor workspace is a **demonstration role switch, not access control**. Anyone who opens the app in this
browser can open it. It is meant to show what an instructor workflow looks like, not to protect anything.

Open it with **Open the instructor workspace** on the home page. The header shows the active configuration and whether
you have unsaved changes. It has five tabs; a red number on a tab counts the problems in your unsaved changes there.

### Settings and scoring
Name and description of the simulation, starting balance, **annual management fee**, score weights and the scoring
parameters (performance base score and points per 1% net return; risk-fit penalty per risk point). Also the **risk
profiles** and their target risk (0–100, the same scale as asset risk ratings).
The three weights must total 100%.

### Assets
Between 2 and 8 assets, each with an id, name, description and **risk rating** (0 = no risk, 100 = highest risk).
Adding an asset adds a 0% return for it to every scenario; removing one removes its returns everywhere.

### Scenarios
Between 1 and 12 rounds, shown as a table: one row per round, one column per asset. Edit titles and **returns** (in
percent: 8 means 8%; allowed range −100 to +500) directly in the table; an arrow inside each field shows whether the
return is a gain or a loss. Use the arrow buttons to reorder rounds, **Details** to edit a round's phase label,
market description and learning focus below the table, and the bin button to delete a round (with confirmation).

### Editing safely
- Edits are an **unsaved draft**. A dark bar at the top shows that there are unsaved changes and how many problems
  there are. A summary lists every problem; choose one to go straight to the field, even on another tab. Invalid fields
  are also marked where they are.
- **Save configuration** is disabled while there are problems. **Discard changes** throws the draft away.
- Saving affects **new** simulations only. Students already playing keep the settings they started with.
- Leaving the page with unsaved changes asks for confirmation.
- A fee and returns that could take a balance below zero are rejected (the worst case, a −100% return plus the fee, is not
  allowed).

### Spreadsheet
**Start from a workbook** offers the current saved configuration as an Excel file (`.xlsx`), or the fictional example
"Rate-cycle pack" (6 rounds, A$25,000). The template and examples are also in the `samples/` folder:

| File | Purpose |
|---|---|
| `SimuLab_Template.xlsx` | The default configuration with an **Instructions** sheet describing every column. |
| `SimuLab_Example_RateCycle.xlsx` | A valid alternative scenario pack. |
| `SimuLab_Invalid_Example.xlsx` | Four deliberate mistakes, to see how errors are reported. |

**Import a workbook** shows four steps: choose a workbook, check every row, preview the changes, apply.
1. Choose an `.xlsx` file. It is read in your browser and checked first; nothing changes yet.
2. If there are problems, a table lists each one with **where it is** (the exact cell, such as `Returns!C3`, or the
   sheet and row), the column and what is wrong. Fix the workbook and choose it again. A workbook with any problem is
   rejected as a whole; there are no partial imports.
3. If it is valid, a **preview** compares it with the current configuration (name, starting balance, fee, rounds,
   assets, risk profiles, score weights), flags each setting that would change, lists the returns of every scenario and
   shows any warnings. Choose **Apply configuration** and confirm, or **Cancel**. Nothing is saved until you apply.

Rules to know when editing a workbook (full details are on the **Instructions** sheet and in `MODEL_SPEC.md`):
- Sheets: Instructions (optional, ignored), Settings, Assets, RiskProfiles, Scenarios, Returns.
- `ReturnPct` is in percentage points: write `8` for 8%, not `0.08` and not a cell formatted as a percentage. Percent-formatted
  cells are rejected because `8%` and `0.08` are ambiguous.
- Ids use lower-case letters, digits and underscores and must be unique. Every scenario/asset pair needs exactly one row on the
  Returns sheet.
- **Formulas are never calculated.** SimuLab reads the value Excel last saved and warns that it did so. A formula with no
  saved value is rejected. Paste values if you want to be sure.
- Limits: 2 MB, 500 rows per sheet, 20 columns. Only the first 100 problems are shown.

### Sessions and results
Lists the demo sessions stored in this browser for comparison: participant, status (in progress, complete, abandoned),
rounds played (with a small progress bar), balance, total return, average score (and the rating once complete), the
configuration it used and when it was last updated. **Show rounds** opens a session's round-by-round history. You can export all results as CSV, delete one session, **Delete all sessions** (the configuration is kept) or
**Reset everything**, which removes all sessions and restores the default configuration, including any imported
workbook. Each of these asks for confirmation first.

CSV files begin with a byte-order mark so Excel reads the characters correctly, and text that could be read as a formula
(starting with `=`, `+`, `-`, `@`, a tab or a carriage return) is prefixed with an apostrophe so opening the file cannot run anything.

## Limits of this demo
- Data lives in one browser on one device. Clearing site data removes it. Two people on two computers do not share sessions.
- There is no real login. The instructor view is not secure.
- The model is a teaching simplification. Returns are invented, not forecasts.
