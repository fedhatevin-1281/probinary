const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const files = [
  "balance.js",
  "bot.html",
  "design-system.css",
  "history.html",
  "scanner.html",
  "simulation-chart.js",
  "simulation-ui.js",
  "simulation.html",
  "trade.html",
];
const filesToSync = [
  ...files.map((file) => path.join("dashboard", file)),
  path.join("auth", "login.html"),
];

for (const file of filesToSync) {
  const source = path.join(root, file);
  const destination = path.join(root, "www.probinary.site", file);

  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}
