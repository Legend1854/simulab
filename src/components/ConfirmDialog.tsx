import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';

export interface ConfirmOptions {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  tone?: 'danger' | 'primary';
}

interface DialogState extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

function Dialog({ state, onClose }: { state: DialogState; onClose: (confirmed: boolean) => void }) {
  const titleId = useId();
  const bodyId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelRef.current?.focus();
    return () => previous?.focus();
  }, []);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose(false);
      return;
    }
    if (event.key !== 'Tab' || !dialogRef.current) return;
    // Keep keyboard focus inside the dialog while it is open.
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled])'));
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose(false)}>
      <div ref={dialogRef} className="dialog" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={bodyId} onKeyDown={onKeyDown}>
        <h2 id={titleId}>{state.title}</h2>
        <div id={bodyId} className="stack-sm">{typeof state.body === 'string' ? <p>{state.body}</p> : state.body}</div>
        <div className="dialog-actions">
          <button ref={cancelRef} type="button" className="btn" onClick={() => onClose(false)}>
            Cancel
          </button>
          <button type="button" className={`btn ${state.tone === 'danger' ? 'btn-danger-solid' : 'btn-primary'}`} onClick={() => onClose(true)}>
            {state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Promise-based confirmation for destructive or replacing actions:
 *   const { confirm, dialog } = useConfirm();
 *   if (await confirm({...})) doIt();
 * Render {dialog} somewhere in the component.
 */
export function useConfirm(): { confirm: (options: ConfirmOptions) => Promise<boolean>; dialog: ReactNode } {
  const [state, setState] = useState<DialogState | null>(null);
  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => setState({ ...options, resolve })), []);
  const close = useCallback(
    (confirmed: boolean) => {
      state?.resolve(confirmed);
      setState(null);
    },
    [state],
  );
  return { confirm, dialog: state ? <Dialog state={state} onClose={close} /> : null };
}
