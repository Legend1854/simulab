/** Wordmark: a 3 x 2 grid of spreadsheet cells, with one cell "calculated" in teal. */
export function Logo() {
  return (
    <svg width="26" height="20" viewBox="0 0 26 20" aria-hidden="true" focusable="false">
      <rect x="0.5" y="0.5" width="25" height="19" rx="3" fill="#fff" stroke="#102a3a" />
      <path d="M9 0.5v19M17 0.5v19M0.5 10h25" stroke="#102a3a" />
      <rect x="17.5" y="10.5" width="8" height="9" rx="0" fill="#0b7a75" />
    </svg>
  );
}
