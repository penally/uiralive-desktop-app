# Split Repos Setup

Backend and app are **not** committed to uiralive (they're in `.gitignore`). They live in separate repos:

| Folder   | Repo                                      |
|----------|-------------------------------------------|
| frontend | https://github.com/penally/uiralive       |
| backend  | https://github.com/penally/Uiralive-Backend |
| app      | https://github.com/penally/uiralive-desktop-app |

You can keep `backend/` and `app/` locally for development—they just won't be pushed to uiralive. Clone them from their repos if needed.

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

`commit:all` only applies when backend and app are submodules.
