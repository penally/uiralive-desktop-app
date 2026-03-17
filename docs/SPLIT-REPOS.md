# Split Repos Setup

Backend and app are **not** committed to uiralive (they're in `.gitignore`). They live in separate repos:

| Folder   | Repo                                      |
|----------|-------------------------------------------|
| frontend | https://github.com/penally/uiralive       |
| backend  | https://github.com/penally/Uiralive-Backend |
| app      | https://github.com/penally/uiralive-desktop-app |

## App releases (uiralive-desktop-app)

The release workflow lives in `app/.github/workflows/release-desktop.yml`. To deploy:

1. **Set up app as a git repo** (if not already):
   ```bash
   cd app
   git init
   git remote add origin https://github.com/penally/uiralive-desktop-app.git
   git add -A
   git commit -m "Initial"
   git branch -M main
   git push -u origin main
   ```

2. **Deploy** (bumps version, commits, tags, pushes to uiralive-desktop-app):
   ```bash
   cd app && npm run deploy
   ```
   Or from uiralive root: `npm run app:deploy`

   GitHub Actions in uiralive-desktop-app will build and publish the release.

## Daily workflow

### Run everything (backend + frontend)

```bash
npm run dev
```

### Commit uiralive changes (frontend only)

```bash
git add -A
git commit -m "your message"
git push
```
