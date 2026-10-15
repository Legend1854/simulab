import { CartesianGrid, ComposedChart, LabelList, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { balanceHistory } from '../../domain/progression';
import type { SimulationSession } from '../../domain/types';
import { formatCurrency, formatCurrencyWhole } from '../../utils/format';

// SVG presentation attributes cannot read CSS variables, so the chart mirrors these tokens from tokens.css.
const LINE = '#0d5c63'; // --petrol: recorded results
const INK = '#13262b'; // --ink
const RULE = '#d3dbd5'; // --rule
const MUTED = '#56666a'; // --muted
const SURFACE = '#fbfbf8'; // --sheet

const compactCurrency = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', notation: 'compact', maximumFractionDigits: 1 });

/**
 * Evenly spaced, round-number axis ticks (1, 2 or 5 x 10^n steps) that bracket the data.
 * The axis does not start at zero (balances are compared with each other, not with zero), so no
 * area fill is drawn: shading down to a truncated baseline would exaggerate the changes.
 */
export function niceTicks(min: number, max: number, target = 4): number[] {
  const span = Math.max(max - min, Math.abs(max) * 0.02, 1);
  const rough = span / target;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((candidate) => candidate >= rough) ?? 10 * magnitude;
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let value = start; value <= end + step / 2; value += step) ticks.push(Number(value.toFixed(6)));
  if (ticks.length < 2) ticks.push(start + step);
  return ticks;
}

interface Point {
  label: string;
  balance: number;
  last: boolean;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload?: Point }> }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="chart-tooltip">
      <span className="muted">{point.label === 'Start' ? 'Starting balance' : point.label.replace('R', 'After round ')}</span>
      <strong className="num">{formatCurrency(point.balance)}</strong>
    </div>
  );
}

/** Portfolio value after each submitted round. Single series, so the title names it and there is no legend. */
export function BalanceChart({ session, title = 'Portfolio value by round', headingLevel = 2 }: { session: SimulationSession; title?: string; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const history = balanceHistory(session);
  const data: Point[] = history.map((entry, index) => ({
    label: entry.round === 0 ? 'Start' : `R${entry.round}`,
    balance: entry.balance,
    last: index === history.length - 1,
  }));
  const ticks = niceTicks(Math.min(...data.map((point) => point.balance)), Math.max(...data.map((point) => point.balance)));
  const lowest = history.reduce((low, entry) => (entry.balance < low.balance ? entry : low));
  const last = history[history.length - 1];

  const summary =
    history.length < 2
      ? `No rounds submitted yet. The portfolio starts at ${formatCurrency(session.config.startingBalance)}.`
      : `Portfolio value went from ${formatCurrency(session.config.startingBalance)} to ${formatCurrency(last?.balance ?? 0)} over ${history.length - 1} ${history.length === 2 ? 'round' : 'rounds'}` +
        (lowest.round > 0 && lowest.balance < session.config.startingBalance ? `, with a low of ${formatCurrency(lowest.balance)} after round ${lowest.round}.` : '.');

  return (
    <figure className="sheet sheet-section chart-figure">
      <Heading className="chart-title">{title}</Heading>
      {history.length < 2 ? (
        <p className="muted small">{summary} The chart appears after your first submitted round.</p>
      ) : (
        <>
          <div className="chart-box" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              {/* The SVG is decorative for assistive technology (the caption and history table carry the data), so its keyboard layer is off. */}
              <ComposedChart data={data} margin={{ top: 20, right: 64, bottom: 4, left: 4 }} accessibilityLayer={false}>
                <CartesianGrid vertical={false} stroke={RULE} strokeWidth={1} />
                <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: RULE }} tick={{ fill: MUTED, fontSize: 12 }} />
                <YAxis
                  domain={[ticks[0] ?? 0, ticks[ticks.length - 1] ?? 1]}
                  ticks={ticks}
                  tickFormatter={(value: number) => compactCurrency.format(value)}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: MUTED, fontSize: 12 }}
                  width={56}
                />
                <ReferenceLine y={session.config.startingBalance} stroke={MUTED} strokeWidth={1} label={{ value: 'Start', position: 'right', fill: MUTED, fontSize: 11 }} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: MUTED, strokeWidth: 1 }} isAnimationActive={false} />
                <Line
                  type="linear"
                  dataKey="balance"
                  stroke={LINE}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  dot={{ r: 4, fill: LINE, stroke: SURFACE, strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: LINE, stroke: SURFACE, strokeWidth: 2 }}
                  isAnimationActive={false}
                >
                  <LabelList
                    dataKey="balance"
                    content={(props) => {
                      const { x, y, index } = props as { x?: number; y?: number; index?: number };
                      if (index !== data.length - 1 || x === undefined || y === undefined) return null;
                      return (
                        <text x={Number(x) + 10} y={Number(y) + 4} fill={INK} fontSize={12} fontWeight={650}>
                          {formatCurrencyWhole(data[data.length - 1]?.balance ?? 0)}
                        </text>
                      );
                    }}
                  />
                </Line>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <figcaption>{summary} Exact figures are in the round history table.</figcaption>
        </>
      )}
    </figure>
  );
}
