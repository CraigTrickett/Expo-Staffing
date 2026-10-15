import { useEffect, useRef } from 'react';

export const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const isShown = (el: HTMLElement) => !el.hidden && el.getAttribute('aria-hidden') !== 'true' && el.closest('[hidden]') === null;

/** Open dialogs, innermost last. Only the innermost one reacts to Escape and Tab. */
const openDialogs: symbol[] = [];

/**
 * What a dialog needs to behave: Escape closes it, focus moves in when it opens, Tab stays inside it
 * (it wraps from the last control to the first and back), and when it closes focus returns to
 * whatever opened it. If one dialog opens over another, only the one on top reacts to Escape and Tab.
 *
 * Takes `isOpen` explicitly rather than assuming "mounted" means "open": several modals stay mounted
 * for their whole session and just toggle an isOpen prop.
 *
 * Returns a ref for the dialog's outermost element, which needs tabIndex={-1}.
 */
export function useModalA11y(isOpen: boolean, onClose: () => void) {
  const containerRef = useRef<HTMLDivElement>(null);
  // The latest onClose, without making the effect re-run (and so re-focus) every time it changes.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    const id = Symbol('dialog');
    openDialogs.push(id);
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const container = containerRef.current;
    const isInnermost = () => openDialogs[openDialogs.length - 1] === id;

    const focusables = () => (container ? Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(isShown) : []);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isInnermost()) return;
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !container) return;
      // Keep Tab inside the dialog: from the last control it wraps to the first, and Shift+Tab the reverse.
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        container.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      const inside = !!active && container.contains(active);
      if (e.shiftKey && (!inside || active === first || active === container)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (!inside || active === last)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    // Move focus into the dialog as soon as it opens, but only if nothing inside it already has focus.
    // A field with its own autoFocus (such as "type your name") runs before this effect, and
    // overriding that would be a regression, not an improvement.
    if (container && !container.contains(document.activeElement)) {
      (focusables()[0] || container).focus();
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      const at = openDialogs.indexOf(id);
      if (at !== -1) openDialogs.splice(at, 1);
      // Give focus back to whatever opened the dialog, so a keyboard user carries on from where they were.
      if (opener && opener !== document.body && document.contains(opener)) opener.focus();
    };
  }, [isOpen]);

  return containerRef;
}

/**
 * For a screen that is a page rather than a dialog. When it appears, focus moves to the page itself and
 * the view returns to the top, so a keyboard or screen reader user starts at the new page and not where
 * the last one left off. Give the container tabIndex={-1} and an accessible name.
 */
export function usePageFocus<T extends HTMLElement = HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    (document.scrollingElement || document.documentElement).scrollTop = 0;
    ref.current?.focus({ preventScroll: true });
  }, []);
  return ref;
}
