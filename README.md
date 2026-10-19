# MADAR | مدار (v0.4 — foundation + migration)
Personal 3D space for links, built on NEXORA. Desktop (Electron, SQLite) and web/PWA (IndexedDB) share one codebase.

## Run
- Portable: unzip, run `MADAR.exe`. From source: `start.bat`, or `npm install` then `npm start` (`npm run dev` for hot reload).
- Web build: `npm run build:web` -> upload `dist-web/` to any static host.
- Windows installer: GitHub Actions (`.github/workflows/build.yml`) builds it on a Windows runner; or run `npm run dist` on Windows.
- Tests: `npm test` · `npm run typecheck`

## Layout
`src/model` (types, orbit math, migration) · `src/storage` (IPC/SQLite and IndexedDB behind one interface) · `src/ui` (MADAR shell) · `src/i18n` · `src/classic` (the previous NEXORA 2D board, opened from the MADAR header on desktop; read-only archive after migration).
3D engine (`src/engine`, Three.js) arrives in the next phase.

## Data
Desktop data stays in `%APPDATA%\nexora\` (nexora.db, backups\, gfx.json, startup.log, crash.log). Migration is non-destructive: legacy rows are never modified; MADAR stores scenes in a separate table.
Graphics: hardware by default; if the GPU process crashes MADAR switches to software mode and restarts once (Diagnostics shows the mode and can toggle it).

## Security
The vault was not independently audited. Do not rely on it alone for critical accounts. See THREAT_MODEL.md.
