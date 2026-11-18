# Identiti — AI / contributor guide

Browser extension (WXT + React): export/import cookies, local/session storage,
IndexedDB; optional encryption; i18n en/vi.

## Package Manager: **Bun**

- Install dependency: `bun add <pkg>` / dev: `bun add -d <pkg>`
- Run scripts: `bun run <script>` (e.g. `bun run dev`, `bun run build`, `bun run compile`)
- One-off CLI: `bunx <cmd>` (e.g. `bunx wxt build -b firefox`)
- After cloning: `bun install` (runs `postinstall` -> `wxt prepare`, generates `.wxt/types`, etc.)
- Do not mix `npm install` / `pnpm` in the same lockfile; prefer **`bun.lock`** only.

## WXT Repo Structure

| Area | Purpose |
|--------|---------|
| `wxt.config.ts` | `srcDir: "src"`, React + auto-icons modules, `manifest()` (permissions, `_locales`) |
| `src/entrypoints/` | `background.ts`, `content.ts`, `popup/` (HTML, `main.tsx`, `App.tsx`, `style.css`) |
| `src/lib/` | Shared logic: `page-credentials`, `export-crypto`, `indexeddb/` (public API via `index.ts`), `type-guards` |
| `src/popup/` | Popup UI: `CredentialManager`, `credential-manager/*`, `lib/*` |
| `src/components/ui/` | shadcn-style UI primitives (Base UI + Tailwind) |
| `public/_locales/` | `messages.json` (Chrome i18n); popup titles via `__MSG_*__` in HTML/manifest |
| `.wxt/` | **Generated** — do not edit by hand; run `wxt prepare` / `bun install` |

**WXT + `srcDir: "src"`**: all entrypoints must live under `src/entrypoints/` — do not create an `entrypoints/` folder at repo root (WXT won’t bundle from there; easy to drift from the real setup).

Alias: `@/*` → `src/*` (tsconfig + WXT).

## WXT — Key Points

- **Entrypoints**: `defineBackground`, `defineContentScript`, and the popup are separate entrypoints — only under `src/entrypoints/` (see `wxt.config.ts`).
- **`browser` global**: multi-browser extension API; types via `wxt/browser` plus generated files in `.wxt/types` (i18n keys, paths).
- **`import.meta.env`**: `MANIFEST_VERSION`, `BROWSER`, `CHROME`, `FIREFOX`, … (see `.wxt/types/globals.d.ts`).
- **Content script**: runs in the page world; only accesses the page DOM/`window`; IDB dump/apply runs under the **page origin**.
- **Popup / background**: there is no `window` of the target tab — communicate via `browser.tabs.sendMessage`, `browser.scripting`, `browser.cookies`, etc.
- **Build**: `bun run build` (Chrome MV3 by default), `bun run build:firefox` for MV2.
- **Docs**: [wxt.dev](https://wxt.dev) — config API, modules, messaging, storage.

## React (Popup)

- Root: `src/entrypoints/popup/main.tsx` -> `App.tsx` -> `CredentialManager`.
- Heavy state lives in hooks (`useCredentialManagerState`); UI is split into `ExportTab` / `ImportTab`.
- **Do not** import the popup into the content script; keep entrypoint boundaries clear.
- UI i18n: use `browser.i18n.getMessage(...)` directly; never add `|| "fallback"` (including for placeholder/substitution values inside message templates). If you need a visible fallback, add a dedicated i18n key instead.
- TanStack Form: use `form.Subscribe` for action buttons whose `disabled/loading` depends on form state (e.g. `canSubmit` / `isSubmitting`).
- TanStack Form: prefer field-provided info (e.g. `field.name`) for `id` / `htmlFor` instead of hardcoding.
- Popup layout: avoid `vw`/`vh`-based sizing in the extension popup container (because the popup viewport can report `0` during first render); prefer fixed/preset sizes (e.g. `w-[420px]`, `max-h-[720px]`) and let inner scroll areas handle overflow.
- List cards in popup: when rendering scrollable lists inside fixed-height `Card`s, prefer `h-[...]` on the card + `ScrollArea` with `h-full`, and use `flex flex-col gap-*` for vertical spacing (avoid `space-y-*`).
- Toast: **Sonner** (`sonner`) — `import { toast } from "sonner"`; `<Toaster />` from `@/components/ui/sonner` in `App.tsx`; `@import "sonner/dist/styles.css"` in `popup/style.css`. Use `toast.success` / `toast.error` / `toast.warning` / `toast.message`; call `toast.dismiss()` when refreshing the popup.

## UI / Tailwind / shadcn

- Tailwind v4 + `@import "shadcn/tailwind.css"` in `popup/style.css`; theming via CSS variables (`:root` / `.dark`).
- shadcn-style UI + **Base UI** (`@base-ui/react`); configure via `components.json`.
- Adding new UI blocks: prefer `bunx shadcn@latest add …` when supported by the registry; adjust the `@/components` import alias.
- Color policy: use only semantic presets/tokens that already exist in `src/entrypoints/popup/style.css` (e.g. `bg-background`, `text-foreground`, `border-border`, `bg-destructive`, `text-destructive`, `ring-ring`, `text-muted-foreground`, `bg-muted/40`, etc). Never introduce new/custom colors via `#hex`, `rgb()/hsl()`, `bg-[#...]` / arbitrary Tailwind colors, or Tailwind palette classes like `bg-amber-*`, `text-amber-*`, etc.

## Code Quality

- **Biome**: `bun run format` (or `biome check --write` via `package.json`). Ignore folder: `src/components/ui` (see `biome.json`).
- **TypeScript**: `bun run compile` (`tsc --noEmit`).
- **IndexedDB**: use the **`idb`** promise-based library under `src/lib/indexeddb/` — avoid rewriting raw open/tx/cursor logic unless absolutely necessary.
- Tailwind v4 build: đảm bảo có `postcss.config.js` dùng `@tailwindcss/postcss` để build/inline CSS cho popup hoạt động đúng (không được để Tailwind directives như `@apply/@utility/@theme` lọt vào output).
- `cn()` usage: only use `cn()` when composing conditional/variant classes; for a static class list, use `className="..."` directly.
- Avoid wrapper functions that only cast with `as` without adding meaning; prefer type guards (`src/lib/type-guards.ts`) when narrowing `unknown`/`JSON`.

## Security / Privacy

- Exports contain credentials; do not log sensitive data to `console` in production; remind the user in `_locales`.
- `host_permissions: <all_urls>` + `cookies` + `scripting`: only use for the described features; review when adding new APIs.

## Do Not Do (Unless Requested)

- Do not add additional markdown guide files beyond what the user explicitly asked for.
- Avoid broad refactors unrelated to the task; do not change import/entrypoint conventions unnecessarily.

## Contributor Rules

- Do not modify anything under `src/components/ui/`.
- If you need UI changes, update the consumer components (e.g. `src/popup/...`) or add new components rather than changing the UI primitives themselves.

## Cookie & Credential Retrieval
- Cookies: when exporting cookies for a tab, ensure you export the correct cookie `storeId` (normal vs incognito) by selecting it via `browser.cookies.getAllCookieStores()` + `tabId`.
- Include subdomain cookies by also querying with `cookies.getAll({ domain: <registrableDomain> })` (best-effort).
- Include 3rd-party/partitioned cookies by querying `cookies.getAll` with `partitionKey` (e.g. `topLevelSite` + `hasCrossSiteAncestor`).
