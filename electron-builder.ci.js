// CI config: x64 only to avoid cross-compilation on x64 runners
const base = require("./electron-builder.config.js");

const x64Only = (target) =>
  Array.isArray(target)
    ? target.map((t) => ({ ...t, arch: ["x64"] }))
    : target;

module.exports = {
  ...base,
  win: { ...base.win, target: x64Only(base.win?.target) },
  linux: { ...base.linux, target: x64Only(base.linux?.target) },
};
