const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const files = [
  "balance.js",
  "design-system.css",
  "history.html",
  "scanner.html",
  "simulation-ui.js",
  "simulation.html",
  "trade.html",
];

for (const file of files) {
  const source = path.join(root, "dashboard", file);
  const destination = path.join(root, "www.probinary.site", "dashboard", file);

  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}
