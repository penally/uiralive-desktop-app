const fs = require("fs");
const path = require("path");

const appDir = path.join(__dirname, "..");
const pkgPath = path.join(appDir, "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const parts = pkg.version.split(".").map(Number);
parts[2] = (parts[2] || 0) + 1;
pkg.version = parts.join(".");
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
console.log("Bumped version to", pkg.version);

// Sync version to app/app/package.json if it exists (used by electron-builder)
const nestedPkgPath = path.join(appDir, "app", "package.json");
if (fs.existsSync(nestedPkgPath)) {
  const nested = JSON.parse(fs.readFileSync(nestedPkgPath, "utf8"));
  nested.version = pkg.version;
  fs.writeFileSync(nestedPkgPath, JSON.stringify(nested, null, 2) + "\n");
}
