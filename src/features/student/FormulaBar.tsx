import type { CalculationStep } from '../../domain/explain';

/** The signature element: each step of the round's calculation with the student's numbers substituted in. */
export function FormulaBar({ steps, caption }: { steps: CalculationStep[]; caption: string }) {
  return (
    <section className="formula-bar" aria-label="Calculation">
      <div className="formula-bar-head">
        <span className="fx" aria-hidden="true">fx</span>
        <span>{caption}</span>
      </div>
      <dl className="formula-rows">
        {steps.map((step) => (
          <div className="formula-row" key={step.label}>
            <dt>{step.label}</dt>
            <dd>{step.expression}</dd>
            <dd className="formula-result"><span className="eq" aria-hidden="true">=</span><span className="visually-hidden">equals </span>{step.result}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
