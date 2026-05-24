#!/usr/bin/env bash
set -euo pipefail

clear

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

SERVER="${SERVER:-https://99ruby.info}"
NAME="${1:-${NAME:-}}"

if [ -z "$NAME" ]; then
  read -rp "Nama kamu: " NAME
fi

if [ ! -d node_modules ]; then
  echo "Dependency belum ada. Menjalankan npm install..."
  npm install
  clear
fi

node client/cli.js --server "$SERVER" --name "$NAME"
