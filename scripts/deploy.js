#!/usr/bin/env node
/**
 * Deployer for the desktop app. Bumps version, commits, tags, and pushes to uiralive-desktop-app.
 * GitHub Actions in that repo builds and publishes the release.
 * Run from app directory: node scripts/deploy.js (or npm run deploy from uiralive root)
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const appDir = path.join(__dirname, "..");

function run(cmd, opts = {}) {
  const options = { stdio: "inherit", shell: true, ...opts };
  return execSync(cmd, options);
}

function runCapture(cmd, opts = {}) {
  const options = { encoding: "utf8", shell: true, ...opts };
  return execSync(cmd, options).trim();
}

function fileExists(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

console.log("=== Uira Live Desktop Deploy ===\n");

const pkgPath = path.join(appDir, "package.json");
const lockPath = path.join(appDir, "package-lock.json");
if (!fileExists(pkgPath)) {
  console.error("ERROR: package.json is missing.");
  process.exit(1);
}

// 1. Bump version
console.log("Step 1: Bumping version...");
run("node scripts/bump-version.js", { cwd: appDir });

// 2. Sync package-lock.json version
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const version = pkg.version;

console.log("\nStep 2: Syncing package-lock.json version to", version);
if (fileExists(lockPath)) {
  const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
  lock.version = version;
  if (lock.packages && lock.packages[""]) {
    lock.packages[""].version = version;
  }
  fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n");
}

// 3. Git add, commit, tag, push (to uiralive-desktop-app)
const tag = `v${version}`;
console.log("\nStep 3: Git commit and tag", tag);

const filesToAdd = ["package.json"];
if (fileExists(lockPath)) filesToAdd.push("package-lock.json");
if (fileExists(path.join(appDir, ".github/workflows/release-desktop.yml"))) {
  filesToAdd.push(".github/workflows/release-desktop.yml");
}
run(`git add ${filesToAdd.join(" ")}`, { cwd: appDir });
const status = runCapture(`git status --short -- ${filesToAdd.join(" ")}`, { cwd: appDir });
if (!status) {
  console.log("No version changes to commit.");
  console.log("Creating tag anyway in case you want to re-trigger release...");
} else {
  run(`git commit -m "Release ${tag}"`, { cwd: appDir });
}

// Delete tag if it exists locally (e.g. re-deploy)
try {
  run(`git tag -d ${tag}`, { cwd: appDir, stdio: "pipe" });
} catch (_) {}

run(`git tag ${tag}`, { cwd: appDir });

const branch = runCapture("git branch --show-current", { cwd: appDir });
if (!branch) {
  console.error("ERROR: Could not determine current git branch. Is app a git repo?");
  process.exit(1);
}

console.log("\nStep 4: Pushing to origin...");
run(`git push origin ${branch}`, { cwd: appDir });
run(`git push origin ${tag} --force`, { cwd: appDir });

console.log("\n=== Done! Release", tag, "triggered. Check GitHub Actions on uiralive-desktop-app. ===");
