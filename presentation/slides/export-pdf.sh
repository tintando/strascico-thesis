#!/usr/bin/env bash
# Export the deck to PDF, one 1280x720 page per slide (960x720 in 4:3).
# The PDF is the submission copy and the emergency deck for a foreign machine.
# Fragments load over HTTP, so this boots the dev server on a throwaway port,
# prints /?print via headless Chrome, then shuts the server down.
#
# Usage: export-pdf.sh [slides]   e.g. `export-pdf.sh 1,4-6` for a subset
#        (1-based, filename order; same syntax as the viewer's ?slides= flag)
#        export-pdf.sh --all      the whole matrix, both ratios x all four
#                                 themes, into portable/
# Env:   THEME=tinted|classic|day|night  RATIO=16:9|4:3  OUT=path/to.pdf
#        A persisted theme never reaches a PDF; only an explicit one does, so
#        the plain run stays Night Feed whatever the browser last displayed.
set -euo pipefail
cd "$(dirname "$0")"

ALL=""
[ "${1:-}" = "--all" ] && { ALL=1; shift; }
SLIDES="${1:-}"
THEME="${THEME:-tinted}"
RATIO="${RATIO:-16:9}"
OUT="${OUT:-deck.pdf}"

command -v node >/dev/null 2>&1 || { echo "node >= 20 required" >&2; exit 1; }

if [ -z "${BROWSER:-}" ]; then
  for c in chromium chromium-browser google-chrome google-chrome-stable chrome; do
    if command -v "$c" >/dev/null 2>&1; then BROWSER="$c"; break; fi
  done
fi
if [ -z "${BROWSER:-}" ]; then
  echo "No Chrome/Chromium found. Install one, or open http://localhost:8080/?print" >&2
  echo "and print to PDF (destination: PDF, margins: none, background graphics: on)." >&2
  exit 1
fi

PORT="${PDF_PORT:-8123}"
PORT="$PORT" node server/server.js >/dev/null 2>&1 &
SERVER=$!
trap 'kill "$SERVER" 2>/dev/null || true' EXIT

# wait until the server answers
node -e '
  const u = process.argv[1];
  const t = setInterval(() => fetch(u).then(r => { if (r.ok) { clearInterval(t); process.exit(0); } }).catch(() => {}), 100);
  setTimeout(() => { console.error("server did not come up"); process.exit(1); }, 5000);
' "http://127.0.0.1:$PORT/api/slides"

# one PDF: theme, ratio, destination
render() {
  theme="$1"; ratio="$2"; out="$3"
  url="http://127.0.0.1:$PORT/?print&theme=$theme"
  [ "$ratio" = "4:3" ] && url="$url&ratio=43"
  [ -n "$SLIDES" ] && url="$url&slides=$SLIDES"
  mkdir -p "$(dirname "$out")"
  "$BROWSER" --headless --disable-gpu --force-color-profile=srgb \
    --no-pdf-header-footer --virtual-time-budget=15000 \
    --print-to-pdf="$out" "$url"
  echo "wrote $(cd "$(dirname "$out")" && pwd)/$(basename "$out")"
}

if [ -n "$ALL" ]; then
  # The matrix lands beside the portable deck, so one folder is the whole
  # emergency kit: a directory per aspect ratio, a file per theme. No ':' in
  # the names, so they survive a FAT32 stick and a Windows machine.
  for ratio in 16:9 4:3; do
    dir="../portable/${ratio/:/-}"
    for theme in tinted classic day night; do
      render "$theme" "$ratio" "$dir/deck-$theme.pdf"
    done
  done
else
  render "$THEME" "$RATIO" "$OUT"
fi
