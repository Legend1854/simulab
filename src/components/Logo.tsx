/**
 * The SimuLab mark: a three-by-three block of spreadsheet cells with a balance path running through
 * it and ending in an ochre result point. Cells in, simulated outcome out.
 */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="26" height="26" rx="5.5" fill="#fbfbf8" stroke="#13262b" strokeWidth="1.6" />
      <path d="M9.7 1.8v24.4M18.3 1.8v24.4M1.8 9.7h24.4M1.8 18.3h24.4" stroke="#a9b8b2" strokeWidth="1" />
      <path d="M5.4 22.6 L11.6 15.6 L16.2 17.6 L22.4 6.2" fill="none" stroke="#0d5c63" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="22.4" cy="6.2" r="2.7" fill="#b5830f" stroke="#fbfbf8" strokeWidth="1.2" />
    </svg>
  );
}

/** Data URI of the same mark, used as the favicon in index.html. Kept here so the two stay in sync. */
export const LOGO_SVG_SOURCE =
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 28 28'><rect x='1' y='1' width='26' height='26' rx='5.5' fill='#fbfbf8' stroke='#13262b' stroke-width='1.6'/><path d='M9.7 1.8v24.4M18.3 1.8v24.4M1.8 9.7h24.4M1.8 18.3h24.4' stroke='#a9b8b2'/><path d='M5.4 22.6 11.6 15.6 16.2 17.6 22.4 6.2' fill='none' stroke='#0d5c63' stroke-width='2.3' stroke-linecap='round' stroke-linejoin='round'/><circle cx='22.4' cy='6.2' r='2.7' fill='#b5830f' stroke='#fbfbf8' stroke-width='1.2'/></svg>";
