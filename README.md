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
8. History chat di room `public` direset otomatis setiap hari jam `00:00` WIB.
9. Role tambahan `joko linux exploit` bisa diubah dari CLI dengan `/update-role`.
10. `joko linux exploit` bisa membersihkan history chat jika diminta, tapi server hanya menyediakan aksi terbatas untuk menghapus tabel `messages` room `public`.

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

CREATE TABLE app_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
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
HISTORY_RESET_ENABLED=1
```

Kalau ingin set manual:

```bash
HOST=0.0.0.0 PORT=3000 ./start-server.sh
```

## AI Agent DeepSeek

AI bisa nimbrung tanpa ditag kalau obrolannya cocok. Tag `@ai` tetap bisa dipakai kalau ingin memanggil agent secara langsung:

```text
chat> @ai rangkum obrolan terakhir
chat> joko clear chat
chat> /update-role jawab pakai gaya tongkrongan linux, singkat, agak sarkas
chat> /show-role
chat> /reset-role
```

Joko tidak diberi akses shell, file server, SQL bebas, atau command admin lain. Untuk clear chat, server hanya menerima sinyal internal khusus lalu menjalankan `DELETE FROM messages WHERE room = ?` pada SQLite.

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
AI_TIMEOUT_MS=120000
HISTORY_RESET_ENABLED=1
```

`AI_MAX_TOKENS` sengaja tidak diset supaya server tidak membatasi panjang jawaban Joko. Kalau variabel itu ditambahkan sendiri, nilainya akan dikirim ke DeepSeek sebagai batas output.

## Reset History

Server menghapus isi tabel `messages` untuk room `public` setiap hari jam `00:00` WIB. Kalau service sempat mati saat tengah malam, reset akan dijalankan saat service hidup lagi.

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
/update-role <role>  update role tambahan joko linux exploit
/show-role           lihat role tambahan joko linux exploit
/reset-role          kosongkan role tambahan joko linux exploit
/quit   keluar
```
