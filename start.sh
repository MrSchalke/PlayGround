#!/usr/bin/env bash
# Build the static game into ./dist and serve it in the foreground.
# The controller reads deployment-output.json, so keep it in sync with the
# directory that is actually served.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

PORT="${PORT:-3000}"
WEB_DIR="${OPENCODE_WEB_DIR:-/home/runner/work/_temp/omgithub-web}"
DIST="$ROOT/dist"
OUTPUT="$WEB_DIR/deployment-output.json"

timed() {
  echo "+ $*" >&2
  /usr/bin/time -p "$@"
}

mkdir -p "$WEB_DIR"

# Install dependencies only when package.json actually declares some. This
# project is a plain ES-module site, so a normal startup does no network work.
if timed node -e '
  const fs = require("node:fs");
  const pkg = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  const count = Object.keys({ ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }).length;
  process.exit(count > 0 ? 0 : 1);
' "$ROOT/package.json"; then
  if [[ -f "$ROOT/package-lock.json" ]]; then
    timed npm ci --no-audit --no-fund
  else
    timed npm install --no-audit --no-fund
  fi
else
  echo "No runtime dependencies declared; skipping install." >&2
fi

# Static build: copy the public runtime files into dist. Keep the output inside
# the project so the controller can serve and inspect it directly.
timed rm -rf "$DIST"
timed mkdir -p "$DIST"
for entry in index.html styles.css ui.css src vendor assets; do
  timed cp -R "$ROOT/$entry" "$DIST/$entry"
done

# Publish deployment metadata only for the directory that is served.
timed node -e '
  const fs = require("node:fs");
  const path = require("node:path");
  const [project, directory, output] = process.argv.slice(1);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify({ project, directory }) + "\n");
' "$ROOT" "$DIST" "$OUTPUT"
timed test -f "$DIST/index.html"

echo "Serving $DIST on http://0.0.0.0:$PORT" >&2
exec /usr/bin/time -p python3 -m http.server "$PORT" --bind 0.0.0.0 --directory "$DIST"
