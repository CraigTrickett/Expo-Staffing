import { describe, it, expect } from 'vitest';
import { parseLink, classifyLink } from './links';

describe('parseLink', () => {
  it('accepts https and adds the scheme when it is missing', () => {
    expect(parseLink('https://docs.google.com/spreadsheets/d/abc/edit')).toEqual({ ok: true, url: 'https://docs.google.com/spreadsheets/d/abc/edit' });
    expect(parseLink('  example.com/path ')).toEqual({ ok: true, url: 'https://example.com/path' });
  });
  it('refuses anything that is not a web link', () => {
    for (const bad of ['javascript:alert(1)', 'data:text/html,hi', 'file:///etc/passwd', 'ftp://x.com/a', '', '   ', 'not a link', 'localhost']) {
      expect(parseLink(bad).ok).toBe(false);
    }
  });
});

describe('classifyLink', () => {
  it('recognises Google and SharePoint files', () => {
    expect(classifyLink('https://docs.google.com/spreadsheets/d/x/edit').kind).toBe('google-sheet');
    expect(classifyLink('https://docs.google.com/document/d/x').kind).toBe('google-doc');
    expect(classifyLink('https://docs.google.com/presentation/d/x').kind).toBe('google-slides');
    expect(classifyLink('https://drive.google.com/file/d/x').kind).toBe('google-drive');
    expect(classifyLink('https://trimble.sharepoint.com/sites/a').kind).toBe('sharepoint');
  });
  it('falls back to the host name', () => {
    expect(classifyLink('https://www.example.com/x')).toEqual({ kind: 'other', label: 'example.com' });
    expect(classifyLink('nonsense').kind).toBe('other');
  });
});


describe('parseLink: things that look like links but are not safe', () => {
  it('refuses a name or password in the link, where the visible host and the real one differ', () => {
    expect(parseLink('https://user:pass@example.com').ok).toBe(false);
    expect(parseLink('https://trusted.com@evil.com/path').ok).toBe(false);
    expect(parseLink('https://user@example.com').ok).toBe(false);
  });
  it('refuses a link with no scheme that starts with //', () => {
    expect(parseLink('//evil.com')).toEqual({ ok: false, error: 'Start the link with https://' });
  });
  it('refuses a very long link', () => {
    expect(parseLink(`https://example.com/${'a'.repeat(2100)}`)).toEqual({ ok: false, error: 'That link is too long.' });
    expect(parseLink(`https://example.com/${'a'.repeat(100)}`).ok).toBe(true);
  });
  it('still refuses every dangerous scheme, in any case or with stray whitespace', () => {
    for (const bad of ['JAVASCRIPT:alert(1)', ' javascript:alert(1)', 'data:text/html,x', 'vbscript:x', 'file:///etc/passwd', 'blob:https://x.com/1', 'ftp://x.com', 'mailto:a@b.com']) {
      expect(parseLink(bad).ok, bad).toBe(false);
    }
  });
  it('still accepts ordinary links, in any case', () => {
    expect(parseLink('HTTPS://EXAMPLE.COM')).toEqual({ ok: true, url: 'https://example.com/' });
    expect(parseLink('example.com/a b')).toEqual({ ok: true, url: 'https://example.com/a%20b' });
  });
});
