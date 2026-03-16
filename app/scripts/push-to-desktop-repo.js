#!/usr/bin/env node
/**
 * Prints release instructions for uiralive-desktop-app.
 * Releases are built and published automatically when you push a tag.
 */
console.log(`
=== Uira Live Desktop - Release Instructions ===

Releases are published to: https://github.com/penally/uiralive-desktop-app

To create a new release:
  1. Update version in app/package.json (or let the workflow use the tag)
  2. From repo root: git tag v1.0.5
  3. git push origin v1.0.5

GitHub Actions will:
  - Build the frontend and Electron app
  - Publish installers to penally/uiralive-desktop-app releases

Required: Add DESKTOP_APP_TOKEN secret to this repo (Settings → Secrets):
  - Create a PAT at https://github.com/settings/tokens
  - Scope: repo (full control)
  - Must have push access to penally/uiralive-desktop-app
`);
