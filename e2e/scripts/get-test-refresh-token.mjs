#!/usr/bin/env node
/**
 * Run this ONCE, manually, by a human, to obtain a refresh token for a
 * dedicated Google test account. This is deliberately NOT something any
 * automated test ever runs — completing Google's consent screen is a
 * one-time setup step, not part of the test suite itself.
 *
 * Usage:
 *   node e2e/scripts/get-test-refresh-token.mjs
 *
 * Requires these env vars (the same OAuth client used by the real app —
 * see FIREBASE_SETUP.md / GOOGLE_CALENDAR_SETUP.md):
 *   E2E_GOOGLE_OAUTH_CLIENT_ID
 *   E2E_GOOGLE_OAUTH_CLIENT_SECRET
 *
 * The OAuth client's "Authorized redirect URIs" must include
 * http://localhost:8912/oauth2callback — add it once in Google Cloud
 * Console alongside the app's real redirect URI.
 *
 * What it does:
 *   1. Starts a tiny local HTTP server on port 8912.
 *   2. Prints a Google consent screen URL — open it in a browser, signed
 *      in as the dedicated test Google account (not your real account).
 *   3. Google redirects back to localhost with an authorization code;
 *      this script exchanges it for a refresh token and prints it.
 *   4. Store that refresh token as E2E_GOOGLE_TEST_REFRESH_TOKEN for the
 *      actual test suite to use from then on — this script only needs
 *      to run again if that token is ever revoked.
 */
import http from 'node:http';
import { URL } from 'node:url';

const CLIENT_ID = process.env.E2E_GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.E2E_GOOGLE_OAUTH_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:8912/oauth2callback';
const PORT = 8912;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Set E2E_GOOGLE_OAUTH_CLIENT_ID and E2E_GOOGLE_OAUTH_CLIENT_SECRET first.');
  process.exit(1);
}

const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
authUrl.searchParams.set('client_id', CLIENT_ID);
authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/calendar.events');
authUrl.searchParams.set('access_type', 'offline');
authUrl.searchParams.set('prompt', 'consent');

console.log('\nOpen this URL in a browser, signed in as your dedicated TEST Google account\n(not a real admin\'s personal account):\n');
console.log(authUrl.toString());
console.log(`\nWaiting for the redirect back to ${REDIRECT_URI} ...\n`);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname !== '/oauth2callback') {
    res.writeHead(404).end();
    return;
  }

  const code = url.searchParams.get('code');
  if (!code) {
    res.writeHead(400).end('No authorization code received.');
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Done — you can close this tab and check your terminal.');
  server.close();

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });
  const json = await tokenRes.json();

  if (!tokenRes.ok || !json.refresh_token) {
    console.error('\nToken exchange failed:', json);
    process.exit(1);
  }

  console.log('\nSuccess. Store this as E2E_GOOGLE_TEST_REFRESH_TOKEN:\n');
  console.log(json.refresh_token);
  console.log('\nThis does not expire from use, but Google may invalidate it if the test account\'s security settings change, or after long inactivity. Re-run this script if the E2E suite starts reporting auth failures.\n');
});

server.listen(PORT);
