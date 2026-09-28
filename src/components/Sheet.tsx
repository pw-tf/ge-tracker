import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';

/** Bottom sheet dialog for mobile. Closes on Escape or a tap on the scrim. */
export function Sheet({
  title,
  onClose,
  headerExtra,
  footer,
  children,
}: {
  title: string;
  onClose: () => void;
  headerExtra?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus();
    };
  }, [onClose]);

  return (
    <>
      <div className="scrim" onClick={onClose} aria-hidden="true" />
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={ref}>
        <div className="sheet-handle">
          <span />
        </div>
        <div className="sheet-head">
          <h2 id={titleId}>{title}</h2>
          <div className="row" style={{ gap: 2 }}>
            {headerExtra}
            <button type="button" className="icon-btn ghost" style={{ width: 44, height: 44 }} aria-label="Close" onClick={onClose}>
              <Icon name="close" size={20} />
            </button>
          </div>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </>
  );
}
