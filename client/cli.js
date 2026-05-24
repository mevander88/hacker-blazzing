const readline = require("readline");
const { io } = require("socket.io-client");

const args = process.argv.slice(2);
const isTty = Boolean(process.stdout.isTTY);
const useColor = isTty && !process.env.NO_COLOR;
const useAnimation = isTty && !process.env.NO_ANIMATION;
const frames = ["-", "\\", "|", "/"];
const TIME_ZONE = "Asia/Jakarta";
let spinner = null;

const ansi = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
  blue: "\x1b[34m",
  gray: "\x1b[90m",
  bgBlue: "\x1b[44m",
  bgGreen: "\x1b[42m"
};

const userColors = [ansi.cyan, ansi.green, ansi.yellow, ansi.magenta, ansi.blue];

function c(style, value) {
  if (!useColor) return String(value);
  return `${style}${value}${ansi.reset}`;
}

function readArg(name, fallback) {
  const index = args.indexOf(`--${name}`);
  if (index !== -1 && args[index + 1]) return args[index + 1];
  return fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clearScreen() {
  process.stdout.write("\x1Bc");
}

function colorForName(value) {
  let hash = 0;
  for (const char of value) hash = (hash + char.charCodeAt(0)) % userColors.length;
  return userColors[hash];
}

function formatTime(value) {
  const date = parseTimestamp(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE
  });
}

function parseTimestamp(value) {
  if (typeof value !== "string") return new Date(value);

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
    return new Date(`${value.replace(" ", "T")}Z`);
  }

  return new Date(value);
}

function drawRule() {
  console.log(c(ansi.gray, "------------------------------------------------------------"));
}

async function drawBanner(serverUrl, room, name) {
  clearScreen();

  const title = " PUBLIC CLI CHAT ";
  const badge = `${c(ansi.bgBlue + ansi.bold, title)}`;
  console.log("");
  console.log(`  ${badge}`);
  console.log(`  ${c(ansi.gray, "Realtime public room via Socket.IO + SQLite")}`);
  drawRule();

  const rows = [
    ["Server", serverUrl],
    ["Room", room],
    ["Nama", name]
  ];

  for (const [label, value] of rows) {
    console.log(`  ${c(ansi.gray, label.padEnd(7))} ${c(ansi.bold, value)}`);
    if (useAnimation) await sleep(70);
  }

  drawRule();
  console.log(`  ${c(ansi.dim, "Ketik pesan lalu Enter. Command: /users, /help, /quit")}`);
  console.log("");
}

function stopSpinner() {
  if (!spinner) return;
  clearInterval(spinner);
  spinner = null;
  readline.clearLine(process.stdout, 0);
  readline.cursorTo(process.stdout, 0);
}

function startSpinner(label) {
  stopSpinner();

  if (!useAnimation) {
    console.log(c(ansi.yellow, label));
    return;
  }

  let index = 0;
  spinner = setInterval(() => {
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
    process.stdout.write(`${c(ansi.yellow, frames[index % frames.length])} ${label}`);
    index += 1;
  }, 90);
}

function makeLinePrinter(rl) {
  return function line(text = "") {
    stopSpinner();
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
    console.log(text);
    rl.prompt(true);
  };
}

function clearSubmittedInputLine() {
  if (!isTty) return;

  readline.moveCursor(process.stdout, 0, -1);
  readline.clearLine(process.stdout, 0);
  readline.cursorTo(process.stdout, 0);
}

function formatMessage(message, selfName) {
  const time = c(ansi.gray, formatTime(message.created_at).padStart(5));
  const isSelf = message.user_name === selfName;
  const nameStyle = isSelf ? ansi.bgGreen + ansi.bold : colorForName(message.user_name) + ansi.bold;
  const displayName = isSelf ? ` ${message.user_name} ` : message.user_name;
  const body = isSelf ? c(ansi.green, message.body) : message.body;

  return `${time} ${c(nameStyle, displayName)} ${body}`;
}

async function main() {
  const serverUrl = readArg("server", process.env.SERVER || "http://localhost:3000");
  const name = readArg("name", process.env.NAME || "");
  const room = "public";

  if (!name.trim()) {
    console.error("Nama wajib diisi. Contoh: ./join.sh budi");
    process.exit(1);
  }

  await drawBanner(serverUrl, room, name);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: c(ansi.cyan + ansi.bold, "chat> ")
  });

  const line = makeLinePrinter(rl);

  function printMessage(message) {
    line(formatMessage(message, name));
  }

  const socket = io(serverUrl, {
    auth: { name },
    reconnectionAttempts: Infinity,
    timeout: 10000
  });

  startSpinner("Menghubungkan ke server...");

  socket.on("connect", () => {
    line(`${c(ansi.green, "connected")} ${c(ansi.gray, socket.id)}`);
  });

  socket.on("connect_error", (err) => {
    line(`${c(ansi.red, "gagal connect")} ${err.message}`);
    startSpinner("Mencoba reconnect...");
  });

  socket.on("disconnect", (reason) => {
    line(`${c(ansi.red, "terputus")} ${reason}`);
    if (reason !== "io client disconnect") startSpinner("Mencoba reconnect...");
  });

  socket.on("ready", (payload) => {
    line(`${c(ansi.green, "masuk")} room ${c(ansi.bold, payload.room)} sebagai ${c(ansi.bold, payload.name)}`);

    if (payload.history.length) {
      line(c(ansi.gray, "History terakhir"));
      for (const message of payload.history) printMessage(message);
    } else {
      line(c(ansi.gray, "Belum ada history chat."));
    }

    line(`${c(ansi.cyan, "online")} ${payload.users.join(", ") || "-"}`);
  });

  socket.on("chat", printMessage);

  socket.on("system", (message) => {
    line(`${c(ansi.magenta, "*")} ${c(ansi.dim, message.body)}`);
  });

  socket.on("users", (users) => {
    line(`${c(ansi.cyan, "online")} ${users.join(", ") || "-"}`);
  });

  rl.on("line", (input) => {
    clearSubmittedInputLine();

    const text = input.trim();

    if (!text) {
      rl.prompt();
      return;
    }

    if (text === "/quit" || text === "/exit") {
      stopSpinner();
      socket.disconnect();
      rl.close();
      return;
    }

    if (text === "/help") {
      line(`${c(ansi.bold, "Command")} /users, /help, /quit`);
      return;
    }

    if (text === "/users") {
      socket.emit("users:get");
      line(c(ansi.gray, "Mengambil daftar user online..."));
      return;
    }

    socket.emit("chat", { body: text }, (ack) => {
      if (!ack?.ok) line(`${c(ansi.red, "gagal kirim")} ${ack?.error || "unknown error"}`);
    });
  });

  rl.on("close", () => {
    stopSpinner();
    console.log("");
    process.exit(0);
  });

  rl.prompt();
}

main().catch((err) => {
  stopSpinner();
  console.error(err);
  process.exit(1);
});
