# MarketLab calculation and rules specification

## Scope

MarketLab is an original educational prototype that illustrates how spreadsheet-style assumptions, formulas and progression rules can be implemented in a browser. Its scenarios and returns are illustrative only; they are not market forecasts, a financial product, or investment advice. It is not a copy of an RMIT-provided simulation or any proprietary workbook.

## Inputs

- Starting capital: AUD 10,000.
- Each round, the user chooses integer percentage allocations for Cash, Bonds, Broad Market and Technology.
- Each allocation must be between 0% and 100%, and all four must total exactly 100%.
- Risk profiles set target risky exposure (Broad Market + Technology): Conservative 30%, Balanced 60%, Growth 80%.
- The selected allocation is applied to the current round only; users may change it before the next round.

## Portfolio-return formula

For asset `i`, let `allocation_i` be its percent allocation and `return_i` be the current scenario's return as a percentage.

`portfolio_return = SUM((allocation_i / 100) * (return_i / 100))`

`change = starting_capital * portfolio_return`

`ending_capital = starting_capital + change`

The next round starts with the previous round's ending capital.

## Decision score

The round score is the rounded weighted sum of three values:

1. **Return score (50%):** clamp `50 + portfolio_return * 250` to the range 0-100.
2. **Diversification score (20%):** use the normalised inverse Herfindahl-style concentration measure. Let `w_i = allocation_i / 100` and `HHI = SUM(w_i^2)`. Score is `clamp((1 - HHI) / (1 - 1/4) * 100, 0, 100)`, rounded to a whole number.
3. **Risk-fit score (30%):** `clamp(100 - abs((market_allocation + technology_allocation) - target_risky_exposure) * 1.25, 0, 100)`, rounded to a whole number.

`decision_score = round(0.5 * return_score + 0.2 * diversification_score + 0.3 * risk_fit_score)`

Average decision score is the arithmetic mean of completed-round scores. The end rating is Strategic thinker (85+), Steady decision-maker (70-84.99), Developing investor (55-69.99), or Learning in progress (below 55).

## Scenario table

| Round | Scenario | Cash | Bonds | Broad market | Technology |
|---:|---|---:|---:|---:|---:|
| 1 | A steady start | 2% | 4% | 8% | 15% |
| 2 | A sudden sell-off | 2% | -1% | -14% | -28% |
| 3 | Recovery takes hold | 2% | 4% | 12% | 22% |
| 4 | Inflation pressures | 3% | 1% | -4% | -9% |
| 5 | A stronger expansion | 2% | 3% | 9% | 16% |

## Reference case for manual parity checks

With the default allocation (Cash 15%, Bonds 25%, Broad Market 40%, Technology 20%) in Round 1:

- Return = `0.15 * 0.02 + 0.25 * 0.04 + 0.40 * 0.08 + 0.20 * 0.15 = 0.075` (7.5%).
- Starting capital AUD 10,000; change AUD 750; ending capital AUD 10,750.
- Risky exposure = 40% + 20% = 60%, so Balanced risk-fit score = 100.
- Diversification score = round(((1 - (0.15² + 0.25² + 0.40² + 0.20²)) / 0.75) * 100) = 95.
- Return score = 50 + 0.075 * 250 = 68.75.
- Decision score = round(0.5 * 68.75 + 0.2 * 90 + 0.3 * 100) = 83.

The automated tests include these return and capital checks plus validation, diversification, risk fit, scoring bounds, rating thresholds and scenario-data completeness.
