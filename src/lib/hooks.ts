import { useEffect, useRef } from 'react';

/**
 * Standard modal accessibility behavior that was missing across every
 * modal in this app: pressing Escape closes it, and focus moves into the
 * modal as soon as it opens (rather than silently staying on whatever
 * was focused before, behind the overlay).
 *
 * Takes `isOpen` explicitly rather than assuming "mounted" means "open" —
 * several of this app's modals stay mounted for their whole session and
 * just toggle an isOpen prop, so a mount-only effect would only ever
 * fire once and silently stop working on every open after the first.
 *
 * Returns a ref to attach to the modal's outermost focusable element (or
 * a wrapping div with tabIndex={-1} if nothing inside should be focused
 * by default).
 */
export function useModalA11y(isOpen: boolean, onClose: () => void) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    // Move focus into the modal as soon as it opens — but only if nothing
    // inside it already has focus. A field with its own autoFocus (e.g.
    // "type your name" being more useful to land on than a close button)
    // runs before this effect; forcibly overriding that would be a
    // regression, not an improvement.
    const container = containerRef.current;
    if (container && !container.contains(document.activeElement)) {
      const focusable = container.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      (focusable || container).focus();
    }

    return () => document.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  return containerRef;
}
