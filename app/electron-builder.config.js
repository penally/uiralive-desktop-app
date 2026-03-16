require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const pkg = require("./package.json");
const updateUrl = process.env.UPDATE_SERVER_URL || "http://localhost:8080";
module.exports = {
  ...pkg.build,
  publish: {
    provider: "generic",
    url: updateUrl,
  },
};
