import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

type Tone = 'info' | 'success' | 'warning' | 'error';

const ICONS: Record<Tone, IconName> = { info: 'info', success: 'check', warning: 'alert', error: 'error' };
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
      <Icon name={ICONS[tone]} size={18} />
      <div className="notice-body">
        <span className="visually-hidden">{LABELS[tone]}: </span>
        {title && <strong>{title}</strong>}
        {children}
      </div>
      {onDismiss && (
        <button type="button" className="btn btn-quiet btn-sm" onClick={onDismiss}>
          Dismiss
        </button>
      )}
    </div>
  );
}
