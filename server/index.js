const fs = require("fs");
const http = require("http");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const { Server } = require("socket.io");

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 3000);
const ROOM_NAME = process.env.ROOM_NAME || "public";
const HISTORY_LIMIT = Number(process.env.HISTORY_LIMIT || 50);
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "data", "chat.sqlite");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);

function run(sql, params = []) {
  return db.prepare(sql).run(...params);
}

function all(sql, params = []) {
  return db.prepare(sql).all(...params);
}

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room TEXT NOT NULL,
      user_name TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec("CREATE INDEX IF NOT EXISTS idx_messages_room_id ON messages(room, id)");
}

function normalizeName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 24);
}

function normalizeMessage(value) {
  return String(value || "").trim().slice(0, 1000);
}

function activeUsers(io) {
  const users = new Set();
  const room = io.sockets.adapter.rooms.get(ROOM_NAME);

  if (!room) return [];

  for (const socketId of room) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket?.data?.name) users.add(socket.data.name);
  }

  return [...users].sort((a, b) => a.localeCompare(b));
}

function nowIso() {
  return new Date().toISOString();
}

function start() {
  initDb();

  const server = http.createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, room: ROOM_NAME }));
      return;
    }

    res.writeHead(200, { "content-type": "text/plain" });
    res.end("Public CLI chat server is running.\n");
  });

  const io = new Server(server, {
    cors: {
      origin: "*"
    }
  });

  io.on("connection", (socket) => {
    const name = normalizeName(socket.handshake.auth?.name || socket.handshake.query?.name);

    if (!name) {
      socket.emit("system", { body: "Nama wajib diisi." });
      socket.disconnect(true);
      return;
    }

    socket.data.name = name;
    socket.join(ROOM_NAME);

    try {
      run(
        `
          INSERT INTO users (name) VALUES (?)
          ON CONFLICT(name) DO UPDATE SET last_seen_at = CURRENT_TIMESTAMP
        `,
        [name]
      );

      const history = all(
        `
          SELECT id, room, user_name, body, created_at
          FROM messages
          WHERE room = ?
          ORDER BY id DESC
          LIMIT ?
        `,
        [ROOM_NAME, HISTORY_LIMIT]
      );

      socket.emit("ready", {
        room: ROOM_NAME,
        name,
        history: history.reverse(),
        users: activeUsers(io)
      });

      socket.to(ROOM_NAME).emit("system", { body: `${name} bergabung ke room public.` });
      io.to(ROOM_NAME).emit("users", activeUsers(io));
    } catch (err) {
      socket.emit("system", { body: `Server error: ${err.message}` });
      socket.disconnect(true);
      return;
    }

    socket.on("chat", (payload, ack) => {
      const body = normalizeMessage(payload?.body);

      if (!body) {
        if (ack) ack({ ok: false, error: "Pesan kosong." });
        return;
      }

      try {
        const result = run(
          "INSERT INTO messages (room, user_name, body, created_at) VALUES (?, ?, ?, ?)",
          [ROOM_NAME, name, body, nowIso()]
        );

        const [message] = all(
          "SELECT id, room, user_name, body, created_at FROM messages WHERE id = ?",
          [result.lastInsertRowid]
        );

        io.to(ROOM_NAME).emit("chat", message);
        if (ack) ack({ ok: true });
      } catch (err) {
        if (ack) ack({ ok: false, error: err.message });
      }
    });

    socket.on("users:get", () => {
      socket.emit("users", activeUsers(io));
    });

    socket.on("disconnect", () => {
      socket.to(ROOM_NAME).emit("system", { body: `${name} keluar dari room public.` });
      io.to(ROOM_NAME).emit("users", activeUsers(io));
    });
  });

  server.listen(PORT, HOST, () => {
    console.log(`Public CLI chat server running on http://${HOST}:${PORT}`);
    console.log(`Room: ${ROOM_NAME}`);
    console.log(`SQLite: ${DB_PATH}`);
  });
}

try {
  start();
} catch (err) {
  console.error(err);
  process.exit(1);
}
