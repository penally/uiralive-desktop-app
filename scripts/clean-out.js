const fs = require("fs");
const path = require("path");

const outDir = path.join(__dirname, "..", "out");
if (fs.existsSync(outDir)) {
  fs.rmSync(outDir, { recursive: true });
  console.log("Cleaned out/");
}
