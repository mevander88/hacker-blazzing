# Public CLI Chat

Realtime chat room public untuk banyak user via terminal.

Butuh Node.js 24 atau lebih baru untuk server karena SQLite memakai `node:sqlite` bawaan Node.

## Flow

1. Admin menjalankan server dengan `./start-server.sh`.
2. Server bind ke `HOST=0.0.0.0` dan `PORT=3000` secara default.
3. Client menjalankan `./join.sh nama`.
4. Client otomatis masuk ke satu room tetap: `public`.
5. Server mengirim history chat terakhir dari SQLite.
6. Semua pesan baru disimpan ke SQLite dan dibroadcast realtime ke semua user di room `public`.
7. Setelah pesan user masuk, server membaca history chat terbaru dari SQLite dan meminta DeepSeek memutuskan apakah `joko linux exploit` perlu nimbrung atau diam.

## Schema SQLite

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room TEXT NOT NULL,
  user_name TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_messages_room_id ON messages(room, id);
```

## Jalankan Server

```bash
chmod +x start-server.sh join.sh
./start-server.sh
```

Di server ini, chat juga sudah bisa dijalankan sebagai systemd service:

```bash
systemctl status public-cli-chat.service
systemctl restart public-cli-chat.service
```

Default:

```text
HOST=0.0.0.0
PORT=3000
DB_PATH=./data/chat.sqlite
ROOM_NAME=public
HISTORY_LIMIT=50
DEEPSEEK_MODEL=deepseek-v4-flash
AI_TRIGGER=@ai
AI_AUTONOMOUS=1
AI_CONTEXT_LIMIT=30
```

Kalau ingin set manual:

```bash
HOST=0.0.0.0 PORT=3000 ./start-server.sh
```

## AI Agent DeepSeek

AI bisa nimbrung tanpa ditag kalau obrolannya cocok. Tag `@ai` tetap bisa dipakai kalau ingin memanggil agent secara langsung:

```text
chat> @ai rangkum obrolan terakhir
```

Token DeepSeek jangan dicommit ke GitHub. Simpan di `.env` pada server:

```bash
cp .env.example .env
nano .env
systemctl restart public-cli-chat.service
```

Variabel penting:

```text
DEEPSEEK_API_KEY=token_deepseek
DEEPSEEK_MODEL=deepseek-v4-flash
AI_NAME=joko linux exploit
AI_TRIGGER=@ai
AI_AUTONOMOUS=1
AI_NO_REPLY=NO_REPLY
AI_CONTEXT_LIMIT=30
AI_MAX_TOKENS=500
AI_TIMEOUT_MS=30000
```

## Join dari Client

Server default project ini memakai nginx proxy di server ini:

```text
https://99ruby.info
```

Di mesin server sendiri atau dari komputer teman:

```bash
./join.sh budi
```

Setiap `join.sh` dijalankan, script akan cek update dari GitHub dan menjalankan `git pull --ff-only` otomatis jika ada update yang aman diterapkan.

Override server kalau pakai domain/IP lain:

```bash
SERVER="http://IP-SERVER:3000" ./join.sh budi
```

Contoh:

```bash
SERVER="http://192.168.1.10:3000" ./join.sh budi
```

Client akan otomatis clear terminal, menampilkan warna, prompt berwarna, banner, dan spinner reconnect.

Matikan warna atau animasi jika terminal tidak cocok:

```bash
NO_COLOR=1 ./join.sh budi
NO_ANIMATION=1 ./join.sh budi
```

## Command Client

```text
/help   tampilkan bantuan
/users  lihat info user online
/quit   keluar
```
