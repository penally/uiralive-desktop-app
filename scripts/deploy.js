
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const appDir = path.join(__dirname, "..");
const repoRoot = appDir;

const skipBuild = process.argv.includes('--skip-build');

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
if (!fileExists(lockPath)) {
  console.error("ERROR: app/package-lock.json is missing. Run npm install in app first.");
  process.exit(1);
}


console.log("Step 1: Installing app dependencies (with dev dependencies)...");
run("npm ci --include=dev", { cwd: appDir });


console.log("\nStep 2: Verifying electron-builder is available...");
run("npx --no-install electron-builder --version", { cwd: appDir });


if (!skipBuild) {
  console.log("\nStep 3: Building app (bumps version)...");
  run("npm run build", { cwd: appDir });
}


const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const version = pkg.version;

console.log("\nStep 4: Syncing package-lock.json version to", version);
const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
lock.version = version;
if (lock.packages && lock.packages[""]) {
  lock.packages[""].version = version;
}
fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n");

const tag = `v${version}`;
console.log("\nStep 5: Git commit and tag", tag);

run("git add -f package.json package-lock.json", { cwd: repoRoot });
const status = runCapture("git status --short -- package.json package-lock.json", { cwd: repoRoot });
if (!status) {
  console.log("No version changes to commit (package.json and package-lock.json unchanged).");
  console.log("Creating tag anyway in case you want to re-trigger release...");
} else {
  run(`git commit -m "Release ${tag}"`, { cwd: repoRoot });
}


try {
  run(`git tag -d ${tag}`, { cwd: repoRoot, stdio: "pipe" });
} catch (_) {}

run(`git tag ${tag}`, { cwd: repoRoot });

const branch = runCapture("git branch --show-current", { cwd: repoRoot });
if (!branch) {
  console.error("ERROR: Could not determine current git branch.");
  process.exit(1);
}

console.log("\nStep 6: Pushing to origin...");
run(`git push --force origin ${branch}`, { cwd: repoRoot });
run(`git push origin ${tag} --force`, { cwd: repoRoot });

console.log("\n=== Done! Release", tag, "triggered. Check GitHub Actions. ===");
