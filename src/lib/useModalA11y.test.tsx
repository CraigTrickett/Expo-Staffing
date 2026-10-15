// @vitest-environment jsdom
import React, { useState } from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useModalA11y } from './hooks';

const Dialog: React.FC<{ title: string; onClose: () => void; children?: React.ReactNode }> = ({ title, onClose, children }) => {
  const ref = useModalA11y(true, onClose);
  return (
    <div ref={ref} tabIndex={-1} role="dialog" aria-label={title}>
      <button type="button">{title} first</button>
      <input aria-label={`${title} field`} />
      <button type="button" onClick={onClose}>{title} last</button>
      {children}
    </div>
  );
};

const Page: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [inner, setInner] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>Open</button>
      <button type="button">Behind</button>
      {open && (
        <Dialog title="Outer" onClose={() => setOpen(false)}>
          <button type="button" onClick={() => setInner(true)}>Open inner</button>
          {inner && <Dialog title="Inner" onClose={() => setInner(false)} />}
        </Dialog>
      )}
    </div>
  );
};

afterEach(() => cleanup());

describe('a dialog', () => {
  it('moves focus in when it opens, and back to the opener when it closes', async () => {
    const u = userEvent.setup();
    render(<Page />);
    const opener = screen.getByRole('button', { name: 'Open' });
    await u.click(opener);
    expect(screen.getByRole('dialog', { name: 'Outer' }).contains(document.activeElement)).toBe(true);
    await u.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('keeps Tab inside: from the last control it wraps to the first', async () => {
    const u = userEvent.setup();
    render(<Page />);
    await u.click(screen.getByRole('button', { name: 'Open' }));
    const dialog = screen.getByRole('dialog', { name: 'Outer' });
    for (let i = 0; i < 40; i++) {
      await u.tab();
      expect(dialog.contains(document.activeElement), `after ${i + 1} Tab presses`).toBe(true);
    }
  });

  it('keeps Shift+Tab inside too, wrapping from the first control to the last', async () => {
    const u = userEvent.setup();
    render(<Page />);
    await u.click(screen.getByRole('button', { name: 'Open' }));
    const dialog = screen.getByRole('dialog', { name: 'Outer' });
    for (let i = 0; i < 40; i++) {
      await u.tab({ shift: true });
      expect(dialog.contains(document.activeElement), `after ${i + 1} Shift+Tab presses`).toBe(true);
    }
  });

  it('pulls focus back in if it has somehow got outside', async () => {
    const u = userEvent.setup();
    render(<Page />);
    await u.click(screen.getByRole('button', { name: 'Open' }));
    screen.getByRole('button', { name: 'Behind' }).focus();
    await u.tab();
    expect(screen.getByRole('dialog', { name: 'Outer' }).contains(document.activeElement)).toBe(true);
  });

  it('with a dialog over a dialog, Escape closes only the top one, and focus returns to its opener', async () => {
    const u = userEvent.setup();
    render(<Page />);
    await u.click(screen.getByRole('button', { name: 'Open' }));
    const openInner = screen.getByRole('button', { name: 'Open inner' });
    await u.click(openInner);
    expect(screen.getByRole('dialog', { name: 'Inner' })).toBeTruthy();
    await u.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Inner' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Outer' })).toBeTruthy();
    expect(document.activeElement).toBe(openInner);
    await u.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('with a dialog over a dialog, Tab is trapped in the top one only', async () => {
    const u = userEvent.setup();
    render(<Page />);
    await u.click(screen.getByRole('button', { name: 'Open' }));
    await u.click(screen.getByRole('button', { name: 'Open inner' }));
    const inner = screen.getByRole('dialog', { name: 'Inner' });
    for (let i = 0; i < 12; i++) {
      await u.tab();
      expect(inner.contains(document.activeElement)).toBe(true);
    }
  });

  it('does not take focus from a field that already has it', async () => {
    const Auto: React.FC = () => {
      const ref = useModalA11y(true, () => {});
      return (
        <div ref={ref} tabIndex={-1} role="dialog" aria-label="Auto">
          <button type="button">First</button>
          <input aria-label="Name" autoFocus />
        </div>
      );
    };
    render(<Auto />);
    expect(document.activeElement).toBe(screen.getByLabelText('Name'));
  });

  it('a dialog with nothing focusable keeps focus on itself', async () => {
    const u = userEvent.setup();
    const Empty: React.FC = () => {
      const ref = useModalA11y(true, () => {});
      return <div ref={ref} tabIndex={-1} role="dialog" aria-label="Empty">No controls</div>;
    };
    render(<Empty />);
    const dialog = screen.getByRole('dialog');
    expect(document.activeElement).toBe(dialog);
    await u.tab();
    expect(document.activeElement).toBe(dialog);
  });
});
