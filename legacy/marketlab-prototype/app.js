import { STARTING_CAPITAL, SCENARIOS, ASSET_KEYS, validateAllocation, calculateDiversificationScore, runSimulationRound, getFinalRating } from "./simulation.js";

const ASSET_LABELS = { cash: "Cash", bonds: "Bonds", market: "Broad market", technology: "Technology" };
const money = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compactMoney = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });
const percent = (value) => `${value > 0 ? "+" : ""}${(value * 100).toFixed(2)}%`;
const wholePercent = (value) => `${value > 0 ? "+" : ""}${value.toFixed(0)}%`;
const $ = (id) => document.getElementById(id);

const INPUT_IDS = { cash: "cashAllocation", bonds: "bondsAllocation", market: "marketAllocation", technology: "techAllocation" };
const inputs = Object.fromEntries(ASSET_KEYS.map((key) => [key, $(INPUT_IDS[key])]));
const state = { capital: STARTING_CAPITAL, history: [], roundIndex: 0 };

function currentAllocation() {
  return Object.fromEntries(ASSET_KEYS.map((key) => [key, Number(inputs[key].value)]));
}
function currentRiskProfile() { return $("riskProfile").value; }
function currentScenario() { return SCENARIOS[state.roundIndex]; }
function averageScore() {
  if (!state.history.length) return null;
  return state.history.reduce((sum, row) => sum + row.decisionScore, 0) / state.history.length;
}
function showToast(message) {
  const toast = $("toast"); toast.textContent = message; toast.hidden = false;
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => { toast.hidden = true; }, 2600);
}
function renderAllocationStatus() {
  const allocation = currentAllocation();
  const check = validateAllocation(allocation);
  const total = check.total;
  $("allocationTotal").textContent = `${total}%`;
  $("allocationState").textContent = check.valid ? "100% allocated" : `${total}% allocated`;
  $("allocationState").classList.toggle("invalid", !check.valid);
  $("validationMessage").textContent = check.message;
  $("validationMessage").classList.toggle("invalid", !check.valid);
  $("runYearBtn").disabled = !check.valid || state.roundIndex >= SCENARIOS.length;
  return check;
}
function renderScenario() {
  const scenario = currentScenario();
  const isComplete = !scenario;
  if (isComplete) {
    $("scenarioEyebrow").textContent = "CHALLENGE COMPLETE";
    $("scenarioTitle").textContent = "Your five-year review";
    $("scenarioDescription").textContent = "All market rounds are complete. Review the decision trail and your final portfolio outcome below.";
    $("scenarioLesson").innerHTML = "<strong>Next step</strong><br>Explain which decisions helped, which hurt and what you would change in a new run.";
    $("marketReturnGrid").innerHTML = "";
    $("runYearBtn").textContent = "Challenge complete";
    $("runYearBtn").disabled = true;
    $("allocationState").textContent = "Challenge complete";
    $("allocationState").classList.remove("invalid");
    $("validationMessage").textContent = "Reset the session to try a different strategy.";
    $("validationMessage").classList.remove("invalid");
    $("riskProfile").disabled = true;
    Object.values(inputs).forEach((input) => { input.disabled = true; });
    return;
  }
  $("scenarioEyebrow").textContent = `YEAR ${scenario.id} / ${SCENARIOS.length} · ${scenario.phase}`;
  $("scenarioTitle").textContent = scenario.title;
  $("scenarioDescription").textContent = scenario.description;
  $("scenarioLesson").innerHTML = `<strong>Learning focus</strong><br>${scenario.lesson}`;
  $("marketReturnGrid").innerHTML = ASSET_KEYS.map((key) => {
    const result = scenario.returns[key];
    return `<div class="return-tile"><span>${ASSET_LABELS[key]}</span><strong class="${result >= 0 ? "positive" : "negative"}">${wholePercent(result)}</strong></div>`;
  }).join("");
  $("runYearBtn").textContent = `Run Year ${scenario.id} ↗`;
}
function renderProgress() {
  const complete = state.roundIndex;
  const fraction = complete / SCENARIOS.length * 100;
  $("progressBar").style.width = `${fraction}%`;
  $("progressLabel").textContent = complete === SCENARIOS.length ? "Challenge complete · 5 of 5" : `Year ${complete + 1} of ${SCENARIOS.length}`;
  const level = complete >= 4 ? "LEVEL 5 · FINAL REVIEW" : complete >= 3 ? "LEVEL 4 · ADAPTATION" : complete >= 2 ? "LEVEL 3 · RECOVERY" : complete >= 1 ? "LEVEL 2 · MARKET SHIFTS" : "LEVEL 1 · FOUNDATIONS";
  $("levelPill").textContent = level;
  $("yearsCompleted").innerHTML = `${complete} <small>/ 5</small>`;
  $("historyCount").textContent = `${state.history.length} ${state.history.length === 1 ? "entry" : "entries"}`;
  $("exportBtn").disabled = state.history.length === 0;
}
function renderMetrics() {
  const gain = state.capital - STARTING_CAPITAL;
  $("portfolioValue").textContent = money.format(state.capital);
  $("totalReturn").textContent = percent(gain / STARTING_CAPITAL);
  $("totalReturn").className = gain >= 0 ? "positive" : "negative";
  $("returnDollars").textContent = `${money.format(gain)} ${gain >= 0 ? "gain" : "loss"}`;
  const average = averageScore();
  $("averageScore").textContent = average === null ? "—" : `${average.toFixed(0)}/100`;
  $("chartCurrentValue").textContent = compactMoney.format(state.capital);
  $("chartChange").textContent = state.history.length ? `${percent(gain / STARTING_CAPITAL)} since start` : "No rounds completed";
  $("chartEndLabel").textContent = `Year ${state.history.length}`;
}
function renderHistory() {
  if (!state.history.length) {
    $("historyBody").innerHTML = '<tr class="empty-row"><td colspan="6">Your decisions and results will be recorded here after each round.</td></tr>';
    return;
  }
  $("historyBody").innerHTML = state.history.map((row) => {
    const retClass = row.portfolioReturn >= 0 ? "positive" : "negative";
    const allocations = ASSET_KEYS.map((key) => `${ASSET_LABELS[key]} ${row.allocation[key]}%`).join(" · ");
    return `<tr><td><strong>Year ${row.round}</strong></td><td>${row.scenario}</td><td><span class="allocation-summary">${allocations}</span></td><td class="${retClass}"><strong>${percent(row.portfolioReturn)}</strong></td><td><strong>${money.format(row.endingCapital)}</strong></td><td><span class="score-chip">${row.decisionScore}/100</span></td></tr>`;
  }).join("");
}
function renderChart() {
  const container = $("portfolioChart");
  if (!state.history.length) {
    container.innerHTML = '<div class="chart-empty"><span class="chart-empty-icon">⌁</span><span>Your performance line will appear after Year 1.</span></div>';
    container.setAttribute("aria-label", "No rounds completed yet.");
    return;
  }
  const values = [STARTING_CAPITAL, ...state.history.map((row) => row.endingCapital)];
  const width = 620, height = 155, left = 12, right = 12, top = 12, bottom = 18;
  const min = Math.min(...values) * 0.985;
  const max = Math.max(...values) * 1.015;
  const span = Math.max(max - min, 1);
  const points = values.map((value, i) => ({
    x: left + (width - left - right) * i / Math.max(values.length - 1, 1),
    y: top + (height - top - bottom) * (1 - (value - min) / span), value
  }));
  const line = points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L${points[points.length - 1].x},${height - bottom} L${points[0].x},${height - bottom} Z`;
  const grid = [0.25, 0.5, 0.75].map((ratio) => {
    const y = top + (height - top - bottom) * ratio;
    return `<line x1="${left}" y1="${y}" x2="${width-right}" y2="${y}" stroke="#eaf0f1" stroke-dasharray="3 4"/>`;
  }).join("");
  const dots = points.map((p, i) => `<circle cx="${p.x}" cy="${p.y}" r="${i === points.length - 1 ? 4.4 : 3}" fill="${i === points.length - 1 ? "#087f78" : "#8fc9bd"}" stroke="#fff" stroke-width="2"/>`).join("");
  container.innerHTML = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" focusable="false" aria-hidden="true"><defs><linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#64b9a8" stop-opacity=".25"/><stop offset="100%" stop-color="#64b9a8" stop-opacity=".015"/></linearGradient></defs>${grid}<path d="${area}" fill="url(#areaFill)"/><path d="${line}" fill="none" stroke="#087f78" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>${dots}</svg>`;
  container.setAttribute("aria-label", `Portfolio values by year: ${values.map((v, i) => `year ${i}: ${money.format(v)}`).join(", ")}.`);
}
function renderFinalReview() {
  const target = $("finalReview");
  if (state.roundIndex !== SCENARIOS.length) { target.hidden = true; target.innerHTML = ""; return; }
  const average = averageScore() ?? 0;
  const gain = state.capital - STARTING_CAPITAL;
  target.hidden = false;
  target.innerHTML = `<h3>Final rating: ${getFinalRating(average)}</h3><p>You finished with <strong>${money.format(state.capital)}</strong>, a total return of <strong>${percent(gain / STARTING_CAPITAL)}</strong> and an average decision score of <strong>${average.toFixed(1)}/100</strong>. Scores reward the combination of simulated return, diversification and alignment with your stated risk approach. The results are specific to these illustrative assumptions.</p>`;
}
function renderAll() {
  renderAllocationStatus(); renderScenario(); renderProgress(); renderMetrics(); renderHistory(); renderChart(); renderFinalReview();
}
function runYear() {
  const allocation = currentAllocation();
  const check = validateAllocation(allocation);
  if (!check.valid) { showToast(check.message); return; }
  const scenario = currentScenario();
  if (!scenario) return;
  const result = runSimulationRound({ capital: state.capital, allocation, scenario, riskProfile: currentRiskProfile() });
  state.capital = result.endingCapital;
  state.history.push({ round: scenario.id, scenario: scenario.title, allocation: { ...allocation }, ...result });
  state.roundIndex += 1;
  renderAll();
  if (state.roundIndex === SCENARIOS.length) showToast("Challenge complete. Review your five-year decision trail.");
  else showToast(`Year ${scenario.id} recorded. ${SCENARIOS[state.roundIndex].title} is now unlocked.`);
}
function resetSession() {
  state.capital = STARTING_CAPITAL; state.history = []; state.roundIndex = 0;
  inputs.cash.value = "15"; inputs.bonds.value = "25"; inputs.market.value = "40"; inputs.technology.value = "20";
  $("riskProfile").value = "balanced"; $("riskProfile").disabled = false;
  Object.values(inputs).forEach((input) => { input.disabled = false; });
  $("finalReview").hidden = true; renderAll(); showToast("Session reset. Try a different strategy.");
}
Object.values(inputs).forEach((input) => input.addEventListener("input", renderAllocationStatus));
$("riskProfile").addEventListener("change", renderAllocationStatus);
$("runYearBtn").addEventListener("click", runYear);
$("resetBtn").addEventListener("click", resetSession);
$("exportBtn").addEventListener("click", () => {
  if (!state.history.length) return;
  const headers = ["Round", "Scenario", "Cash allocation (%)", "Bonds allocation (%)", "Broad market allocation (%)", "Technology allocation (%)", "Portfolio return (%)", "Change (AUD)", "Ending capital (AUD)", "Diversification score", "Risk-fit score", "Decision score"];
  const quote = (value) => `"${String(value).replaceAll('"', '""')}"`;
  const rows = state.history.map((row) => [row.round, row.scenario, row.allocation.cash, row.allocation.bonds, row.allocation.market, row.allocation.technology, (row.portfolioReturn * 100).toFixed(4), row.change.toFixed(2), row.endingCapital.toFixed(2), row.diversificationScore, row.riskFitScore, row.decisionScore]);
  const csv = [headers, ...rows].map((row) => row.map(quote).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = "marketlab-session-results.csv";
  document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
  showToast("Session results exported as CSV.");
});

// Render the first round when the page loads.
$("startingCapital").textContent = compactMoney.format(STARTING_CAPITAL);
renderAll();
