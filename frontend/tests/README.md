# Tab session regression tests

Authentication uses `sessionStorage` through `src/lib/tab-session.ts`. The
React auth provider, Axios client, and authenticated fetch wrapper all read
the current tab's token. React Query data is cleared on login, logout, and
session expiry. Late responses from a replaced session are ignored.

## Browser behavior

- A fresh tab starts signed out; admin and shop accounts can run side by side.
- Refreshing a tab preserves its login. Signing out affects only that tab.
- Duplicating a tab or opening one with an opener can copy its initial session.
  After that copy, the sessions are independent. Sign out of the copied tab
  to select a different account without signing out the original.
- Sessions normally end when a tab closes. Browser restore can restore tab
  storage, so explicit logout and backend token expiry remain authoritative.
- The first load after this change removes the old shared authentication keys
  from `localStorage`. Existing tabs need a fresh login. Shared theme and
  workspace preferences are preserved.

## Running the tests

From `frontend`, install a Playwright browser once, then run the test suite:

```sh
npx playwright install chromium
npm run test:auth
```

To use an installed Chrome instead, in PowerShell:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'chrome'
npm.cmd run test:auth
```

The tests reuse or start Vite at `http://127.0.0.1:5174`. Set
`PLAYWRIGHT_BASE_URL` to use another local port.

The suite opens multiple tabs in **one browser context**, exercising shared
`localStorage` and separate `sessionStorage`. It covers login, reload, logout,
cache clearing, all API clients, expiry, account suspension, ordinary permission
errors, late responses, old storage cleanup, and corrupt cached user recovery.
Backend responses are mocked: no customer records or real credentials are used.
