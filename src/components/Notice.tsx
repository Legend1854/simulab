import type { ReactNode } from 'react';

type Tone = 'info' | 'success' | 'warning' | 'error';

const ICONS: Record<Tone, string> = { info: 'i', success: '✓', warning: '!', error: '✕' };
const LABELS: Record<Tone, string> = { info: 'Information', success: 'Success', warning: 'Warning', error: 'Error' };

interface NoticeProps {
  tone: Tone;
  title?: string;
  children?: ReactNode;
  onDismiss?: () => void;
  /** Use 'alert' for errors that need immediate attention; 'status' for polite updates. */
  role?: 'alert' | 'status';
}

/** Message box. The tone is conveyed by an icon and hidden label as well as colour. */
export function Notice({ tone, title, children, onDismiss, role }: NoticeProps) {
  return (
    <div className={`notice notice-${tone}`} role={role}>
      <span className="notice-icon" aria-hidden="true">{ICONS[tone]}</span>
      <div className="notice-body">
        <span className="visually-hidden">{LABELS[tone]}: </span>
        {title && <strong>{title}</strong>}
        {children}
      </div>
      {onDismiss && (
        <button type="button" className="btn btn-quiet" onClick={onDismiss}>
          Dismiss
        </button>
      )}
    </div>
  );
}
