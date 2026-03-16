require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const pkg = require("./package.json");


const RELEASE_OWNER = "penally";
const RELEASE_REPO = "uiralive-desktop-app";

module.exports = {
  ...pkg.build,
  publish: {
    provider: "github",
    owner: RELEASE_OWNER,
    repo: RELEASE_REPO,
    releaseType: "release",
    vPrefixedTagName: true,
  },
};
