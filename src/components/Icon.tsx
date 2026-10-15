/**
 * SimuLab's icon set: a few 24-unit line icons drawn for this project, stroked in currentColor so they
 * take the colour of the text beside them. Decorative by default (hidden from assistive technology);
 * pass `label` when an icon carries meaning on its own.
 */

const PATHS = {
  check: 'M5 12.5l4.5 4.5L19 7.5',
  alert: 'M12 3.8 21.2 19.6H2.8Z M12 9.6v4.6 M12 17.2v.01',
  error: 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18Z M9 9l6 6 M15 9l-6 6',
  info: 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18Z M12 11v5.5 M12 7.8v.01',
  up: 'M12 19V5 M6.5 10.5 12 5l5.5 5.5',
  down: 'M12 5v14 M6.5 13.5 12 19l5.5-5.5',
  flat: 'M5 12h14',
  download: 'M12 4v11 M7.5 10.5 12 15l4.5-4.5 M5 20h14',
  upload: 'M12 15V4 M7.5 8.5 12 4l4.5 4.5 M5 20h14',
  chevronRight: 'M9.5 6l6 6-6 6',
  chevronUp: 'M6.5 14.5 12 9l5.5 5.5',
  chevronDown: 'M6.5 9.5 12 15l5.5-5.5',
  plus: 'M12 5v14 M5 12h14',
  close: 'M6.5 6.5l11 11 M17.5 6.5l-11 11',
  trash: 'M4.5 7h15 M9.5 7V4.5h5V7 M6.5 7l1 13h9l1-13 M10 11v5.5 M14 11v5.5',
  restart: 'M4.5 12a7.5 7.5 0 1 0 2.2-5.3 M4.5 4.5v4h4',
  sheet: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z M4 9.5h16 M4 15h16 M10 4v16',
  pencil: 'M4.5 19.5h4l10-10-4-4-10 10Z M13 7.5l4 4',
  formula: 'M15 5.5h-1.8a2.2 2.2 0 0 0-2.2 2l-1.3 9a2.2 2.2 0 0 1-2.2 2H6 M7.5 11h7 M15 13l4 4.5 M19 13l-4 4.5',
  user: 'M12 12a3.8 3.8 0 1 0 0-7.6A3.8 3.8 0 0 0 12 12Z M4.5 20a7.5 7.5 0 0 1 15 0',
  layers: 'M12 4 3.5 8.5 12 13l8.5-4.5Z M3.5 12.5 12 17l8.5-4.5 M3.5 16.5 12 21l8.5-4.5',
} as const;

export type IconName = keyof typeof PATHS;

interface IconProps {
  name: IconName;
  size?: number;
  /** When set, the icon is announced with this text; otherwise it is decorative. */
  label?: string;
  className?: string;
}

export function Icon({ name, size = 16, label, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={size <= 14 ? 2.2 : 1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
