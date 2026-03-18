#!/usr/bin/env node
/**
 * Extracts semver version from GITHUB_REF tag.
 * Supports: v1.2.3, app-v1.2.3, 1.2.3, v1.2.3-beta, v1.0.0-alpha.1, etc.
 */
const ref = process.env.GITHUB_REF || "";
const tag = ref.replace(/^refs\/tags\//, "");
let version = tag
  .replace(/^app-/, "")
  .replace(/^v/, "")
  .replace(/^release\//, "")
  .trim();

// Full semver: X.Y.Z with optional -prerelease and +build
const semverRe = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/;
if (!semverRe.test(version)) {
  console.error(`ERROR: Tag '${tag}' did not produce valid semver. Got '${version}'`);
  process.exit(1);
}

if (process.env.GITHUB_OUTPUT) {
  const fs = require("fs");
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\n`);
}
console.log("Building version", version);
