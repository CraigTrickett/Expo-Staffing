// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/lib/firebase', async (orig) => (await import('@/test/harness')).firebaseMock(await orig()));

import { CreateEventWizard } from './CreateEventWizard';
import { useEventStore } from '@/store/useEventStore';
import { resetDom } from '@/test/harness';

beforeEach(() => {
  resetDom();
  useEventStore.setState({ currentEvent: null, slots: [], roster: [] });
});
afterEach(() => cleanup());

const fill = async (u: ReturnType<typeof userEvent.setup>, over: { start?: string; end?: string } = {}) => {
  await u.type(screen.getByLabelText(/Event & Booth Name/i), 'Dev Summit');
  if (over.start) fireEvent.change(screen.getByLabelText(/Daily Booth Opens/i), { target: { value: over.start } });
  if (over.end) fireEvent.change(screen.getByLabelText(/Daily Booth Closes/i), { target: { value: over.end } });
};
const submit = (u: ReturnType<typeof userEvent.setup>) => u.click(screen.getByRole('button', { name: /Generate event schedule/ }));

describe('the create form guides and protects', () => {
  it('says nothing when the day divides into whole shifts', () => {
    render(<CreateEventWizard onEventCreated={vi.fn()} />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('warns, live, when the last part of each day would have no shift', async () => {
    const u = userEvent.setup();
    render(<CreateEventWizard onEventCreated={vi.fn()} />);
    await u.click(screen.getByRole('button', { name: '90 min' })); // 09:00 to 18:00 is 9 hours: 6 shifts of 90 minutes
    expect(screen.queryByRole('status')).toBeNull();
    fireEvent.change(screen.getByLabelText(/Daily Booth Closes/i), { target: { value: '17:00' } });
    expect(screen.getByRole('status').textContent).toMatch(/The last shift ends at 16:30. The final 30 minutes of each day have no shift./);
  });

  it('blocks daily hours shorter than one shift, with the reason, and creates nothing', async () => {
    const u = userEvent.setup();
    const created = vi.fn();
    render(<CreateEventWizard onEventCreated={created} />);
    await fill(u, { start: '09:00', end: '10:00' });
    await u.click(screen.getByRole('button', { name: '120 min' }));
    expect(screen.getByRole('status').textContent).toMatch(/shorter than one 120-minute shift/);
    await submit(u);
    expect(created).not.toHaveBeenCalled();
    expect(useEventStore.getState().currentEvent).toBeNull();
  });

  it('blocks an event with too many shifts, and says how many', async () => {
    const u = userEvent.setup();
    const created = vi.fn();
    render(<CreateEventWizard onEventCreated={created} />);
    await fill(u, { start: '06:00', end: '22:00' });
    await u.click(screen.getByRole('button', { name: '30 min' }));
    fireEvent.change(screen.getByLabelText(/^End Date/i), { target: { value: '2099-12-31' } });
    expect(screen.getByRole('status').textContent).toMatch(/shifts, and the limit is 2,000/);
    await submit(u);
    expect(created).not.toHaveBeenCalled();
  });

  it('still creates a normal event', async () => {
    const u = userEvent.setup();
    const created = vi.fn();
    render(<CreateEventWizard onEventCreated={created} />);
    await fill(u);
    await submit(u);
    expect(created).toHaveBeenCalledTimes(1);
    expect(useEventStore.getState().slots.length).toBeGreaterThan(0);
  });

  it('the intensive preset no longer leaves half an hour a day uncovered', async () => {
    const u = userEvent.setup();
    render(<CreateEventWizard onEventCreated={vi.fn()} />);
    await u.click(screen.getByRole('button', { name: /Heavy traffic/ }));
    expect(screen.queryByRole('status')).toBeNull();
  });
});
