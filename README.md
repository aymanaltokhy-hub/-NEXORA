# MADAR | مدار (v0.6 — phone, tablet and desktop)
Personal 3D space for links, built on NEXORA. Desktop (Electron, SQLite) and web/PWA (IndexedDB) share one codebase.

## Run
- Portable: unzip, run `MADAR.exe`. From source: `start.bat`, or `npm install` then `npm start` (`npm run dev` for hot reload).
- Web build: `npm run build:web` -> upload `dist-web/` to any static host.
- Windows installer: GitHub Actions (`.github/workflows/build.yml`) builds it on a Windows runner; or run `npm run dist` on Windows.
- Tests: `npm test` · `npm run typecheck`

## Layout
`src/model` (types, orbit math, migration) · `src/storage` (IPC/SQLite and IndexedDB behind one interface) · `src/ui` (MADAR shell) · `src/i18n` · `src/classic` (the previous NEXORA 2D board, opened from the MADAR header on desktop; read-only archive after migration).
`src/engine` is the Three.js scene engine (no React inside); `src/ui/Space.tsx` hosts it.

## Data
Desktop data stays in `%APPDATA%\nexora\` (nexora.db, backups\, gfx.json, startup.log, crash.log). Migration is non-destructive: legacy rows are never modified; MADAR stores scenes in a separate table.
Graphics: hardware by default; if the GPU process crashes MADAR switches to software mode and restarts once (Diagnostics shows the mode and can toggle it).

## Security
The vault was not independently audited. Do not rely on it alone for critical accounts. See THREAT_MODEL.md.

## Using the 3D space
Drag = rotate · wheel = zoom · right-drag = pan · click = select (never opens the site; use **Open website**) · **Move** mode shows 3D axis handles for the selected system, and the panel has X/Y/Z fields · arrow keys pan when the canvas has focus.
Shortcuts: Ctrl+Z/Y undo/redo · Ctrl+N new link · F focus selection · Home view all · Esc deselect · Del delete selected link.
Motion: play/pause + speed; motion starts off if your OS asks for reduced motion. Positions are stored as orbit parameters, never per frame.
Backgrounds: Black / Stars / Nebula, color, star density, effect intensity, or a local image (PNG/JPEG/WebP up to 5 MB, stored only on this device).
Export/Import: JSON with XYZ positions, orbits, background and camera. Import is validated (URLs restricted to http/https) and can be undone.
Web build: `npm run build:web`; after the first visit it works offline (service worker).

## One app, every device
- **Web / PWA (phone, tablet, PC):** open the GitHub Pages site, then *Install* (Chrome/Edge: menu ⋯ → Install app; Safari/iOS: Share → Add to Home Screen). Works offline after the first visit. Layout adapts: side panel on wide screens, bottom sheet on phones/tablets; touch gestures (one finger rotate, two fingers zoom/pan, tap to select).
- **Windows desktop:** portable zip / installer from GitHub Actions (same code, data in `%APPDATA%\nexora`).
- Data lives on each device (IndexedDB on the web, SQLite on desktop). There is no cloud sync: use **Export/Import** or the encrypted vault backup to move data between devices.

## Vault (unified)
Same format everywhere: PBKDF2-SHA256 (600,000 iterations) + AES-256-GCM per entry, key kept in memory only, auto-lock, clipboard auto-clear, generator, strength meter, duplicate detection, encrypted backup/restore. Scenes reference entries by id only (no secrets in the 3D scene). Desktop users can import their previous vault (Classic board) with the same master password. **No independent security audit has been done.** See THREAT_MODEL.md.

## Not done yet
Argon2id (WebCrypto has none; PBKDF2 is used) · cloud sync · native app-store builds (the PWA is the phone/tablet app) · dragging a link onto a planet to re-assign it (use the System selector in the panel) · automated GPU performance measurements · installer signing.
