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

- Export selected data from the currently active tab
- Import and apply data back to the active site
- Fine-grained IndexedDB handling with selection + replace/merge semantics
- Optional export encryption (PBKDF2 (SHA-256) + AES-GCM)

## Security & Privacy

- Backups may contain sensitive data (cookies, storage keys, and IndexedDB records). Store exported files safely and do not share them.
- Export/import operations are performed locally in your browser. No network calls are required for the core features.

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

See `CLAUDE.md` for project conventions and guidelines.

## License

MIT License.

