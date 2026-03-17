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

The app loads `http://localhost:5173` in dev mode (Vite dev server).

## Build

```bash
cd app && npm run build
```

The app loads https://uira.live when packaged (no frontend build needed). Each build auto-increments the version. Output goes to `app/out/`.

### Updates (until GitHub)

The app checks for updates at `UPDATE_SERVER_URL` (set in `.env`). To test locally:

1. Set `UPDATE_SERVER_URL=http://YOUR_IP:8080` in `.env` (use your machine's IP, not localhost)
2. Build and install (e.g. v1.0.1)
3. Run `npm run serve:updates` in the app folder to serve `out/` on port 8080
4. Build again (v1.0.2) — `out/` now has the new version
5. In the installed app: Settings → App → Check for updates → Download → Restart to install

### GitHub Releases (auto-deploy)

Releases are published to [penally/uiralive-desktop-app](https://github.com/penally/uiralive-desktop-app).

1. Add `DESKTOP_APP_TOKEN` secret to the main repo (Settings → Secrets): a PAT with `repo` scope and access to penally/uiralive-desktop-app.
2. To release: `git tag v1.0.5` then `git push origin v1.0.5`
3. GitHub Actions builds Windows, macOS, and Linux installers and publishes them.


## App Settings

When running in the desktop app, open Settings → **App** to see:
- Built-in extension status (always active)
- Platform (Windows/macOS/Linux)
- App version
