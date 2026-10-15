# MarketLab: Spreadsheet-to-Web Investment Simulation

**Portfolio project prototype | HTML, CSS, JavaScript (ES modules), Node.js built-in test runner**

MarketLab is an original, responsive browser simulation that demonstrates the core work of translating spreadsheet-style formulas and progression rules into a web application. A player allocates a simulated portfolio across four asset classes, sees the current scenario assumptions, runs each of five years, and reviews their balance, return, diversification, risk-fit and decision score.

> Educational prototype only. All scenario returns are invented for demonstration and are not market forecasts or investment advice. This is not a copy of an RMIT-provided workbook.

## Features

- Responsive layout for desktop and mobile screens.
- Allocation form with input validation; invalid or incomplete allocations cannot be run.
- Five staged market scenarios with distinct asset returns and contextual learning prompts.
- Separate, testable calculation functions for weighted portfolio return, balance progression, diversification, risk fit and decision scoring.
- Per-round audit trail, performance chart, progress indicator, final review and CSV export of session results.
- No framework, external API, build step, package install or runtime network access required.
- Automated tests for calculation logic, validation boundaries and scoring behaviour.

## Run the app

Use Python's local static server from this folder. This avoids browser restrictions on JavaScript ES modules when opening `index.html` directly.

```bash
python -m http.server 8000
```

Then open `http://localhost:8000` in a browser. Stop the server with `Ctrl+C`.

## Run tests

Node.js 18+ is recommended. From this folder:

```bash
node --test tests/simulation.test.mjs
```

The app itself needs only a modern browser; Node.js is only needed for the test suite.

## Files

- `index.html` - page structure and accessible controls.
- `styles.css` - responsive visual design and layout.
- `app.js` - UI state, events, rendering, chart and history.
- `simulation.js` - pure simulation calculations and scenario data.
- `tests/simulation.test.mjs` - calculation and validation regression tests.
- `MODEL_SPEC.md` - formulas, scoring rules, scenarios and a worked reference case.
- `MarketLab_Reference_Model.xlsx` - editable formula-driven spreadsheet benchmark with Inputs, Scenarios and Model tabs.

## How the model works

Each round's portfolio return is the sum of each allocation weight multiplied by that asset's scenario return. The percentage return is applied to the current balance. The decision score combines (a) a normalised return score, (b) a diversification score derived from allocation concentration, and (c) fit between risky exposure and the selected risk profile. See `MODEL_SPEC.md` for the exact formulas and worked reference case.

## Validation and next iteration

The browser prototype and reference workbook share the same formula definitions and a documented worked reference case. With the default allocation, Round 1 returns 7.5% and takes the balance from AUD 10,000 to AUD 10,750 in both models. The workbook applies one fixed allocation across all five rounds; the browser app permits the allocation to change between rounds.

Recommended next steps are keyboard-only walkthrough and screen-reader testing, plus mapping each formula from any real source workbook to explicit test cases before replacing the illustrative model.

## Portfolio walkthrough

Be ready to explain why the calculation logic lives separately from the UI, how invalid allocations are blocked, how state advances only after a valid decision, what the score weights mean, and how the tests detect a regression in a calculation. Do not describe the illustrative assumptions as real market data.
