# Five-minute demo script

Before you start: run `npm run build && npm run preview` (or open your deployed copy), open
<http://localhost:4173/>, and choose **Reset everything** on the instructor **Sessions and results** tab so the demo starts
clean. Keep `samples/SimuLab_Invalid_Example.xlsx` and `samples/SimuLab_Example_RateCycle.xlsx` ready to upload.
Timings are a guide.

## 0:00 – 0:30 Framing (home page)
- "SimuLab is a portfolio project of mine. I rebuilt a small Excel investment game as a web app: the spreadsheet formulas
  became a tested TypeScript engine, and instructors can change the scenarios through Excel without touching code."
- Point at the formula bar on the right: "Every number in the app shows the formula that produced it."
- "It's not an RMIT product, and the instructor view is a demo role switch. The page says so."

## 0:30 – 2:15 Student round (the core loop)
1. **Start the simulation** → type a nickname → **Start round 1**.
2. Read the scenario briefly: "A steady start".
3. Choose **Balanced**. Type allocations Cash 15, Government bonds 25, Diversified global equities 40, Technology equities 20.
   - Before finishing, show the live message: "You have N% left to allocate" and the disabled Submit button.
   - Then type 30 for Cash to show "5% over the limit", and set it back to 15.
4. Point at the projection: "Projection, not submitted". It shows an ending balance of $10,700.00 and a round score of 82.8.
   "That's 7.5% gross, minus the 0.5% fee, on $10,000."
5. **Submit round 1**. In the result, walk through the formula lines: gross return, net return, ending balance, then the three
   scores with weights. "Risk 60 matches the Balanced target exactly, so risk fit is 100."
6. **Continue to round 2**: the allocation carries over. Point out that the opening balance is last round's ending
   balance.

## 2:15 – 2:45 Reliability (one or two of these)
- Reload the page: "Welcome back", same round. Sessions are replayed through the engine when loaded, so an edited
  balance in storage is rejected.
- Mention double submission: "a double click records one round; it's blocked in the component and in the domain."

## 2:45 – 4:15 Instructor (spreadsheet workflow)
1. **Instructor dashboard** → **Scenarios**: change a return, show the unsaved-changes bar and a field error for an
   out-of-range value (for example 600). "Save is blocked until it's valid." Choose **Discard changes**.
2. **Spreadsheet** → **Download a workbook**: "The template has an Instructions sheet generated from the same schema the
   importer uses."
3. Import `SimuLab_Invalid_Example.xlsx`: show the table with sheet, row, column and message: a duplicate asset id, a missing
   title, "five" instead of a number, an unknown asset "gold". "Nothing changed; there are no partial imports. And formulas
   in the workbook are never calculated."
4. Import `SimuLab_Example_RateCycle.xlsx`: show the preview (6 rounds, A$25,000, 0.75% fee) → **Apply configuration** →
   confirm.
5. Back to the student view: "A session already in progress keeps its own settings; new sessions use the new pack."

## 4:15 – 4:45 Results and data
- **Sessions and results**: show the session list and the round history; export the CSV.
  "Text that could be a spreadsheet formula is escaped, and the file opens cleanly in Excel."

## 4:45 – 5:00 Close with testing
- "The engine is checked against the original workbook's saved values for all five rounds, and there are unit, component and
  browser tests, including keyboard-only play and automated accessibility scans. `TESTING.md` lists what is and isn't
  tested: for example, browser tests ran only in Chromium, and I haven't tested with a screen reader."

## If something goes wrong during the demo
- A blank or stuck page: the error screen offers **Reload** and **Clear SimuLab data and reload**.
- The wrong configuration is active: **Reset everything** restores the defaults.
- Have the screenshots in `docs/screenshots/` open in another tab as a fallback.
