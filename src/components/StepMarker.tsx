/**
 * A small numbered marker that ties a headline figure to the calculation step that produced it,
 * like a footnote in a research report. It is a link, so it works with the keyboard and screen readers.
 */
export function StepMarker({ step, targetId, label }: { step: number; targetId: string; label: string }) {
  return (
    <a className="step-marker" href={`#${targetId}`} aria-label={`${label}: see calculation step ${step}`} onClick={(event) => {
      const target = document.getElementById(targetId);
      if (!target) return;
      event.preventDefault();
      // Open the calculation if it is collapsed, then move focus to the step.
      const details = target.closest('details');
      if (details && !details.open) details.open = true;
      target.focus();
      target.scrollIntoView?.({ block: 'nearest' });
    }}>
      {step}
    </a>
  );
}
