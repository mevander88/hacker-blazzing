#!/usr/bin/env bash
set -euo pipefail

clear 2>/dev/null || true

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

auto_update() {
  if ! command -v git >/dev/null 2>&1; then
    echo "Git tidak tersedia, skip auto update."
    return
  fi

  if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "Bukan git repository, skip auto update."
    return
  fi

  local branch
  branch="$(git branch --show-current 2>/dev/null || true)"

  if [ -z "$branch" ]; then
    echo "Branch git tidak terdeteksi, skip auto update."
    return
  fi

  if ! git remote get-url origin >/dev/null 2>&1; then
    echo "Remote origin belum ada, skip auto update."
    return
  fi

  echo "Cek update dari GitHub..."

  if ! git fetch --quiet origin "$branch"; then
    echo "Gagal cek update GitHub, lanjut menjalankan chat."
    return
  fi

  local local_rev remote_rev base_rev
  local_rev="$(git rev-parse HEAD)"
  remote_rev="$(git rev-parse "origin/$branch")"
  base_rev="$(git merge-base HEAD "origin/$branch")"

  if [ "$local_rev" = "$remote_rev" ]; then
    echo "Sudah versi terbaru."
    return
  fi

  if [ "$local_rev" != "$base_rev" ]; then
    echo "Branch lokal berbeda dari GitHub, skip auto update."
    return
  fi

  if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "Ada perubahan lokal, skip auto update agar file tidak tertimpa."
    return
  fi

  echo "Update tersedia, menjalankan git pull..."
  if git pull --ff-only --quiet origin "$branch"; then
    echo "Update selesai."
  else
    echo "Gagal auto update, lanjut menjalankan chat."
  fi
}

auto_update

SERVER="${SERVER:-https://99ruby.info}"
NAME="${1:-${NAME:-}}"

if [ -z "$NAME" ]; then
  read -rp "Nama kamu: " NAME
fi

if [ ! -d node_modules ] || [ package.json -nt node_modules/.package-lock.json ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  echo "Dependency perlu disiapkan. Menjalankan npm install..."
  npm install
  clear 2>/dev/null || true
fi

node client/cli.js --server "$SERVER" --name "$NAME"
