#!/usr/bin/env bash
set -euo pipefail

clear

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

if [ ! -d node_modules ]; then
  echo "Dependency belum ada. Menjalankan npm install..."
  npm install
  clear
fi

npm start
