/** Only web links are accepted: anything else (javascript:, data:, file:) is refused. */
export type LinkSuccess = { ok: true; url: string };
export type LinkFailure = { ok: false; error: string };
export type LinkParse = LinkSuccess | LinkFailure;

/** A type predicate rather than checking `ok` directly, so narrowing works without strict mode. */
export function isLinkFailure(parsed: LinkParse): parsed is LinkFailure {
  return parsed.ok === false;
}

/** Long enough for any real link, short enough that one cannot fill the storage. */
export const MAX_LINK_LENGTH = 2048;

export function parseLink(input: string): LinkParse {
  const raw = input.trim();
  if (!raw) return { ok: false, error: 'Enter a link.' };
  if (raw.length > MAX_LINK_LENGTH) return { ok: false, error: 'That link is too long.' };
  // "//host" has no scheme to go on, and guessing one is how a link ends up somewhere unintended.
  if (raw.startsWith('//')) return { ok: false, error: 'Start the link with https://' };
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return { ok: false, error: 'That does not look like a web link.' };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, error: 'Only http and https links can be added.' };
  }
  if (!url.hostname.includes('.')) return { ok: false, error: 'That does not look like a web link.' };
  // https://trusted.com@elsewhere.com sends you to elsewhere.com. Links never need a name or password in them.
  if (url.username || url.password) return { ok: false, error: 'Links with a name or password in them are not accepted.' };
  return { ok: true, url: url.toString() };
}

export type LinkKind = 'google-sheet' | 'google-doc' | 'google-slides' | 'google-drive' | 'sharepoint' | 'other';

export function classifyLink(url: string): { kind: LinkKind; label: string } {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { kind: 'other', label: 'Link' };
  }
  const host = u.hostname.toLowerCase();
  if (host === 'docs.google.com') {
    if (u.pathname.startsWith('/spreadsheets')) return { kind: 'google-sheet', label: 'Google Sheet' };
    if (u.pathname.startsWith('/document')) return { kind: 'google-doc', label: 'Google Doc' };
    if (u.pathname.startsWith('/presentation')) return { kind: 'google-slides', label: 'Google Slides' };
  }
  if (host === 'drive.google.com') return { kind: 'google-drive', label: 'Google Drive' };
  if (host.endsWith('sharepoint.com') || host.endsWith('onedrive.live.com') || host === '1drv.ms') {
    return { kind: 'sharepoint', label: 'SharePoint / OneDrive' };
  }
  return { kind: 'other', label: host.replace(/^www\./, '') };
}
