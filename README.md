# Identiti

[![Bun](https://img.shields.io/badge/Bun-232323?style=flat&logo=bun&logoColor=white)](https://bun.sh/)
[![WXT](https://img.shields.io/badge/WXT-4B5563?style=flat&logo=wxt&logoColor=white)](https://wxt.dev/)
[![React](https://img.shields.io/badge/React-61DAFB?style=flat&logo=react&logoColor=white)](https://react.dev/)
[![Tailwind%20CSS](https://img.shields.io/badge/Tailwind%20CSS-06B6D4?style=flat&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](#license)

Identiti is a browser extension that lets you export and import site data locally:

- Cookies
- `localStorage`
- `sessionStorage`
- IndexedDB snapshots (dump / apply / merge)

Export files can be optionally encrypted.

## Features

- Capture cookies (including same-site subdomains and supported partitions), local and session storage, and IndexedDB for the active site.
- Restore only to the original HTTP(S) origin, using the destination tab's cookie store. Current exports replace cookies and web storage, plus the IndexedDB stores they contain. Older v1/v2 files and profiles merge instead.
- Restore IndexedDB without upgrading existing databases. Failed writes roll back that database's transaction; uncovered stores keep their data.
- Create a safety backup before changing a session. Undo is available only in the same tab, origin, and cookie store, and only until a newer change to that site or a browser restart. Undo leaves empty schemas in place when a restore created a database.
- Use optional PBKDF2 (SHA-256) + AES-GCM encryption for single-site files. Bulk profile exports are plaintext.

Identiti only clears cookies present in the safety backup. New cookie identities created after capture are left alone; if a captured cookie remains, Identiti reports a partial restore. It does not clear Cache Storage or unregister service workers. Some sites expire, bind, or reject transferred sessions, and browser-specific data may not be portable. Identiti stops if it cannot make a safe backup.

Requires Chromium 130+ or Firefox 132+.

## Security & Privacy

- Backups may contain sensitive data (cookies, storage keys, and IndexedDB records). Store exported files safely and do not share them.
- Export/import operations are performed locally in your browser. No network calls are required for the core features.
- Deleted accounts move to a local trash and can be restored; nothing is transmitted anywhere.
- Permissions used: `storage` and `unlimitedStorage` (profiles and safety backups), `tabs` and `<all_urls>` (identify and communicate with the active site), `cookies` (read/write the destination cookie store), `contextMenus` (open Identiti for the current site).

## Tech Stack

- WXT (extension framework) + React
- Bun (package manager)
- Tailwind v4 + Base UI (`@base-ui/react`) / shadcn-style UI primitives
- Sonner for toasts
- IndexedDB helpers via the `idb` library

## Architecture (high level)

- The popup coordinates the workflow with the content script.
- The content script reads/writes storage in the **page origin context**.
- IndexedDB actions are executed by helpers under `src/lib/indexeddb/` (dump / apply / merge).

## Quick Start

```sh
bun install
bun run dev
```

## Build

Chrome build (default):

```sh
bun run build
```

Firefox build:

```sh
bun run build:firefox
```

## Type-check

```sh
bun run compile
```

## Format / Lint

```sh
bun run lint
bun run format
```

## Project Structure

- `src/entrypoints/`: WXT entrypoints (popup + background/content)
- `src/popup/`: React popup UI (Export / Import)
- `src/lib/`: shared logic (IndexedDB, crypto envelopes, helpers)

## Contributing

See `AGENTS.md` for project conventions and guidelines.

## License

MIT License.

