import { describe, it, expect } from 'vitest';
import { createNote, createOtherLink, newestFirst, normaliseOther } from './other';
import { addLink, getEssentials, removeLink, setContact, updateLink, createEmptyEssentials, presetFor } from './essentials';

const NOW = new Date('2026-10-14T12:00:00');

describe('other', () => {
  it('creates a note and a link, and refuses an unsafe link', () => {
    expect(createNote({ title: ' Parking ', body: ' Ask venue ' }, NOW)).toMatchObject({ title: 'Parking', body: 'Ask venue' });
    const ok = createOtherLink({ title: '', url: 'https://drive.google.com/file/d/x' }, NOW);
    expect(ok.ok && ok.link.title).toBe('https://drive.google.com/file/d/x');
    expect(createOtherLink({ title: 'x', url: 'javascript:alert(1)' }, NOW).ok).toBe(false);
  });
  it('sorts newest first and copes with missing data', () => {
    const a = { createdAt: '2026-01-01' }, b = { createdAt: '2026-02-01' };
    expect(newestFirst([a, b])).toEqual([b, a]);
    expect(normaliseOther(null)).toEqual({ notes: [], links: [] });
  });
});

describe('module essentials', () => {
  const sarah = { id: 'stk_sarah', name: 'Sarah Chen' };

  it('keeps links and the contact per module, independently', () => {
    let d = createEmptyEssentials();
    const r = addLink(d, 'badging-registration', 'Signup questionnaire', 'https://docs.google.com/spreadsheets/d/abc/edit');
    expect(r.ok).toBe(true);
    if (r.ok) d = r.data;
    d = setContact(d, 'badging-registration', sarah);
    expect(getEssentials(d, 'badging-registration')).toMatchObject({ contact: sarah });
    expect(getEssentials(d, 'badging-registration').links).toHaveLength(1);
    expect(getEssentials(d, 'swag')).toEqual({ links: [] });
  });

  it('refuses a bad or duplicate link', () => {
    const first = addLink(createEmptyEssentials(), 'swag', 'x', 'example.com/a');
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(addLink(first.data, 'swag', 'y', 'https://example.com/a').ok).toBe(false);
    expect(addLink(first.data, 'swag', 'y', 'javascript:1').ok).toBe(false);
  });

  it('edits and removes a link, and clears the contact', () => {
    const first = addLink(createEmptyEssentials(), 'swag', 'Old', 'example.com/a');
    if (!first.ok) throw new Error('setup');
    const id = getEssentials(first.data, 'swag').links[0].id;
    const upd = updateLink(first.data, 'swag', id, 'New', 'example.com/b');
    expect(upd.ok && getEssentials(upd.data, 'swag').links[0]).toMatchObject({ label: 'New', url: 'https://example.com/b' });
    expect(getEssentials(removeLink(first.data, 'swag', id), 'swag').links).toEqual([]);
    expect(getEssentials(setContact(setContact(first.data, 'swag', sarah), 'swag', null), 'swag').contact).toBeUndefined();
  });

  it('words Badging for its questionnaire and leaves other modules plain', () => {
    expect(presetFor('badging-registration').linkLabel).toBe('Signup questionnaire');
    expect(presetFor('swag').linkLabel).toBe('Link');
  });
});
