#!/usr/bin/env bash
# Converte gravações (wav/m4a/ogg/mp3) para MP3 mono normalizado em public/audio.
#
#   ./scripts/normalizar-audio.sh ~/gravacoes
#
# O nome do arquivo precisa ser o id do card (ver src/data/cards.ts):
#   agua.wav -> public/audio/agua.mp3
set -euo pipefail

ORIGEM="${1:?uso: $0 <pasta-com-gravacoes>}"
DESTINO="$(dirname "$0")/../public/audio"
mkdir -p "$DESTINO"

shopt -s nullglob nocaseglob
for arquivo in "$ORIGEM"/*.{wav,m4a,ogg,mp3,aac,flac}; do
  id="$(basename "${arquivo%.*}")"
  ffmpeg -hide_banner -loglevel error -y \
    -i "$arquivo" \
    -af "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,loudnorm=I=-16:TP=-1.5:LRA=11" \
    -ac 1 -ar 44100 -b:a 64k \
    "$DESTINO/$id.mp3"
  echo "✓ $id.mp3"
done
