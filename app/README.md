# Uira Live Desktop App

Electron desktop app with built-in extension support. Extension-required sources (Pasmells, Vixsrc, Videasy) work without installing a browser extension.

## Development

1. Start the frontend dev server:
   ```bash
   cd ../frontend && npm run dev
   ```

2. In another terminal, start the Electron app:
   ```bash
   cd app && npm run dev
   ```

The app loads `http://localhost:4173` in dev mode (Vite preview).

## Build

```bash
cd app && npm run build
```

Each build auto-increments the version (1.0.0 → 1.0.1). Output goes to `app/out/`.

### Updates (until GitHub)

The app checks for updates at `UPDATE_SERVER_URL` (set in `.env`). To test locally:

1. Set `UPDATE_SERVER_URL=http://YOUR_IP:8080` in `.env` (use your machine's IP, not localhost)
2. Build and install (e.g. v1.0.1)
3. Run `npm run serve:updates` in the app folder to serve `out/` on port 8080
4. Build again (v1.0.2) — `out/` now has the new version
5. In the installed app: Settings → App → Check for updates → Download → Restart to install

When you have GitHub, switch to `provider: "github"` in `electron-builder.config.js`.


## App Settings

When running in the desktop app, open Settings → **App** to see:
- Built-in extension status (always active)
- Platform (Windows/macOS/Linux)
- App version
