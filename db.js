const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(path.join(__dirname, 'submissions.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS contacts (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT NOT NULL,
    email        TEXT NOT NULL,
    project_type TEXT,
    message      TEXT,
    created_at   TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS chats (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    email      TEXT NOT NULL,
    message    TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS quotes (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    email        TEXT NOT NULL,
    type         TEXT,
    size         TEXT,
    timeline     TEXT,
    budget       TEXT,
    estimate     TEXT,
    est_timeline TEXT,
    created_at   TEXT DEFAULT (datetime('now'))
  );
`);

const insertContact = db.prepare(
  `INSERT INTO contacts (name, email, project_type, message)
   VALUES (?, ?, ?, ?)`
);

const insertChat = db.prepare(
  `INSERT INTO chats (name, email, message)
   VALUES (?, ?, ?)`
);

const insertQuote = db.prepare(
  `INSERT INTO quotes (email, type, size, timeline, budget, estimate, est_timeline)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
);

module.exports = { insertContact, insertChat, insertQuote, db };
