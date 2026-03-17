#!/usr/bin/env node
/**
 * Commit and push changes across all repos (frontend, backend, app).
 * Works with submodule layout:
 *   - frontend: this repo (penally/uiralive)
 *   - backend:  submodule → penally/Uiralive-Backend
 *   - app:      submodule → penally/uiralive-desktop-app
 *
 * Usage: node scripts/commit-all.js [commit message]
 *        npm run commit:all -- "your message"
 */
const { execSync, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..");
const msg = process.argv.slice(2).join(" ") || "Update";

function run(cmd, opts = {}) {
  const options = { stdio: "inherit", shell: true, ...opts };
  return execSync(cmd, options);
}

function runCapture(cmd, opts = {}) {
  const options = { encoding: "utf8", shell: true, ...opts };
  return execSync(cmd, options).trim();
}

function hasChanges(dir) {
  try {
    const out = runCapture("git status --short", { cwd: dir });
    return out.length > 0;
  } catch {
    return false;
  }
}

function isOwnRepo(dir) {
  const gitPath = path.join(dir, ".git");
  if (!fs.existsSync(gitPath)) return false;
  return true; // submodule (.git file) or nested clone (.git dir)
}

function commitAndPush(dir, label) {
  if (!hasChanges(dir)) {
    console.log(`[${label}] No changes to commit.`);
    return false;
  }
  console.log(`\n[${label}] Committing and pushing...`);
  run("git add -A", { cwd: dir });
  run(`git commit -m "${msg.replace(/"/g, '\\"')}"`, { cwd: dir });
  run("git push", { cwd: dir });
  return true;
}

// 1. Commit and push submodules first (backend, app)
const backendDir = path.join(repoRoot, "backend");
const appDir = path.join(repoRoot, "app");

let backendPushed = false;
let appPushed = false;

if (fs.existsSync(backendDir) && isOwnRepo(backendDir)) {
  backendPushed = commitAndPush(backendDir, "backend");
} else if (fs.existsSync(backendDir)) {
  console.log("[backend] Not a separate repo - run migration first (see docs/SPLIT-REPOS.md)");
}

if (fs.existsSync(appDir) && isOwnRepo(appDir)) {
  appPushed = commitAndPush(appDir, "app");
} else if (fs.existsSync(appDir)) {
  console.log("[app] Not a separate repo - run migration first (see docs/SPLIT-REPOS.md)");
}

// 2. Update parent repo (submodule refs + frontend)
if (backendPushed || appPushed) {
  run("git add backend app", { cwd: repoRoot });
}
if (hasChanges(repoRoot)) {
  console.log("\n[frontend/root] Committing and pushing...");
  run("git add -A", { cwd: repoRoot });
  run(`git commit -m "${msg.replace(/"/g, '\\"')}"`, { cwd: repoRoot });
  run("git push", { cwd: repoRoot });
  console.log("\nDone. All changes pushed.");
} else {
  console.log("\n[frontend/root] No changes to commit.");
}
