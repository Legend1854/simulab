import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export function EmptyState({ title, children, action, icon = 'sheet' }: { title: string; children?: ReactNode; action?: ReactNode; icon?: IconName }) {
  return (
    <div className="empty">
      <Icon name={icon} size={28} className="empty-mark" />
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
