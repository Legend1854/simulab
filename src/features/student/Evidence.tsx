import type { CalculationStep } from '../../domain/explain';

/**
 * The calculation behind a result, one numbered step per line: what is being worked out, the general
 * formula, the same formula with this round's numbers, and the result. Laid out like a ledger pad.
 * Step ids let headline figures point at the step that produced them (see StepMarker).
 */
export function Evidence({ steps, idPrefix, title }: { steps: CalculationStep[]; idPrefix: string; title: string }) {
  return (
    <section className="evidence" aria-labelledby={`${idPrefix}-evidence-title`}>
      <h3 id={`${idPrefix}-evidence-title`} className="evidence-title">{title}</h3>
      <ol className="evidence-steps">
        {steps.map((step, index) => (
          <li key={step.label} id={`${idPrefix}-step-${index + 1}`} tabIndex={-1} className="evidence-step">
            <span className="evidence-n" aria-hidden="true">{index + 1}</span>
            <div className="evidence-body">
              <p className="evidence-label">
                {step.label} <span className="evidence-formula">= {step.formula}</span>
              </p>
              <p className="evidence-expr">{step.expression}</p>
            </div>
            <p className="evidence-result">
              <span className="visually-hidden">equals </span>
              {step.result}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
