import React, { useEffect, useId, useRef, useState } from 'react';
import { LogOut } from 'lucide-react';

interface ProfileMenuProps {
  email: string;
  onSignOut: () => void;
}

const initialOf = (email: string) => (email.trim()[0] || '?').toUpperCase();

/**
 * The signed-in person's menu, at the right of the header: who they are, the user
 * manager (admins only) and log out. Opens on click, closes on Escape, on a click
 * elsewhere, or when focus leaves it, and arrow keys move between items.
 */
export const ProfileMenu: React.FC<ProfileMenuProps> = ({ email, onSignOut }) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const items = () => Array.from(wrapRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    items()[0]?.focus();

    const onPointerDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const close = (returnFocus = true) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    const items = Array.from(wrapRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(i + 1) % items.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(i - 1 + items.length) % items.length]?.focus();
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className="relative" onKeyDown={onKeyDown}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Account menu for ${email}`}
        onClick={() => setOpen((v) => !v)}
        className="focus-ring-invert flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-white/30 bg-white/15 text-xs font-bold text-white transition-colors hover:bg-white/25"
      >
        {initialOf(email)}
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-full z-40 mt-2 w-64 overflow-hidden rounded border border-[#d8dce0] bg-white text-[#252a2e] shadow-modus-3 animate-[rise-in_160ms_cubic-bezier(0.16,1,0.3,1)] motion-reduce:animate-none"
        >
          <div className="border-b border-[#e7eaef] px-3 py-2.5">
            <p className="text-[11px] text-[#5b6770]">Signed in as</p>
            <p className="truncate text-xs font-semibold" title={email}>
              {email}
            </p>
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close(false);
              onSignOut();
            }}
            className="focus-ring flex w-full cursor-pointer items-center gap-2 border-t border-[#e7eaef] px-3 py-2 text-left text-xs font-semibold text-[#252a2e] transition-colors hover:bg-[#f0f7fb] focus:bg-[#f0f7fb]"
          >
            <LogOut className="h-3.5 w-3.5 text-[#5b6770]" aria-hidden="true" />
            Log out
          </button>
        </div>
      )}
    </div>
  );
};
