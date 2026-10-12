// Very small file-based "database" wrapper.
// Reads/writes data/db.json synchronously — fine for a demo/college project,
// not meant for concurrent production traffic.
const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "data", "db.json");

function readDB() {
  const raw = fs.readFileSync(DB_PATH, "utf-8");
  return JSON.parse(raw);
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function nextId(prefix, list) {
  return `${prefix}${list.length + 1}${Date.now().toString().slice(-4)}`;
}

module.exports = { readDB, writeDB, nextId };
