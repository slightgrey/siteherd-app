#!/usr/bin/env bash
# Deploys the dashboard to the server (see README → Deploying).
#
#   npm run deploy                 build, upload, migrate, switch, health-check
#   npm run deploy -- --rollback   switch back to the previous release
#   npm run deploy -- --build-only build the release tarball and stop
#
# The app is built in a Linux container here (the server is too small to build),
# uploaded to /opt/siteherd/releases/<timestamp>, and run by the "siteherd"
# systemd service from /opt/siteherd/current. Migrations run from this machine
# through an SSH tunnel to the server's Postgres.
#
# Settings (environment, all optional):
#   DEPLOY_HOST     SSH host (default: vinceLayte, from ~/.ssh/config)
#   DEPLOY_URL      public URL to check after deploying (default: https://siteherd.vincelayte.me)
#   DEPLOY_CA_FILE  extra CA bundle for the build container, e.g. when antivirus intercepts HTTPS
set -euo pipefail
export MSYS_NO_PATHCONV=1 # Git Bash on Windows: don't rewrite /opt/... arguments

HOST="${DEPLOY_HOST:-vinceLayte}"
URL="${DEPLOY_URL:-https://siteherd.vincelayte.me}"
APP_DIR=/opt/siteherd
KEEP=3
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/.deploy"
TARBALL="$OUT/release.tar.gz"

log() { printf '\n\033[1m▸ %s\033[0m\n' "$*"; }
die() { printf '\n\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

remote() { ssh -o BatchMode=yes "$HOST" "$@"; }

# Switch "current" to a release and restart. Runs on the server.
switch_to() {
  remote "sudo ln -sfn '$APP_DIR/releases/$1' '$APP_DIR/current.tmp' && sudo mv -Tf '$APP_DIR/current.tmp' '$APP_DIR/current' && sudo systemctl restart siteherd"
}

# Wait up to 60 s for the app to answer on the server itself.
healthy() {
  remote 'for i in $(seq 1 30); do code=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3100/login || true); [ "$code" = 200 ] && exit 0; sleep 2; done; exit 1'
}

# /opt/siteherd is readable by root and the app only, hence sudo.
current_release() { remote "sudo readlink -f $APP_DIR/current | xargs -r basename" 2>/dev/null || true; }

rollback() {
  local current previous
  current="$(current_release)"
  previous="$(remote "sudo ls -1 $APP_DIR/releases | sort" | grep -v -x "$current" | tail -n 1 || true)"
  [ -n "$previous" ] || die "No earlier release to roll back to."
  log "Rolling back: $current → $previous"
  switch_to "$previous"
  healthy || die "The previous release didn't start either. Check: ssh $HOST 'journalctl -u siteherd -n 50'"
  log "Rolled back to $previous."
}

build() {
  log "Building in a Linux container"
  mkdir -p "$OUT"
  local ca_mount=() ca_env=()
  if [ -n "${DEPLOY_CA_FILE:-}" ]; then
    ca_mount=(-v "$(cygpath -w "$DEPLOY_CA_FILE" 2>/dev/null || echo "$DEPLOY_CA_FILE"):/extra-ca.pem:ro")
    ca_env=(-e NODE_EXTRA_CA_CERTS=/extra-ca.pem -e npm_config_cafile=/extra-ca.pem)
  fi
  # Send only tracked and new (non-ignored) files, so local node_modules/.next/.env stay out.
  (cd "$ROOT" && git ls-files -co --exclude-standard . | tar -cf - -T -) |
    docker run -i --rm "${ca_mount[@]}" "${ca_env[@]}" \
      -e DATABASE_URL=postgres://build@127.0.0.1:1/build -e NEXT_TELEMETRY_DISABLED=1 \
      node:22-bookworm sh -c '
        set -e
        mkdir /app && cd /app && tar -xf -
        npm ci --no-audit --no-fund >&2
        npm run build >&2
        mkdir -p release/.next
        cp -a .next/standalone/. release/
        cp -a .next/static release/.next/static
        [ -d public ] && cp -a public release/public
        tar -czf - -C release .
      ' >"$TARBALL"
  [ -s "$TARBALL" ] || die "Build produced no output."
  log "Built $(du -h "$TARBALL" | cut -f1) release tarball"
}

upload_and_install() {
  local release="$1"
  log "Uploading release $release"
  scp -q "$TARBALL" "$HOST:/tmp/siteherd-$release.tar.gz"
  remote "set -e
    sudo mkdir -p '$APP_DIR/releases/$release'
    sudo tar -xzf '/tmp/siteherd-$release.tar.gz' -C '$APP_DIR/releases/$release'
    rm -f '/tmp/siteherd-$release.tar.gz'
    # Next writes its cache here; the release itself stays read-only for the app.
    sudo rm -rf '$APP_DIR/releases/$release/.next/cache'
    sudo ln -s '$APP_DIR/shared/cache' '$APP_DIR/releases/$release/.next/cache'
    sudo chown -R root:siteherd '$APP_DIR/releases/$release'
    sudo chmod -R u=rwX,g=rX,o= '$APP_DIR/releases/$release'"
}

migrate() {
  log "Applying database migrations"
  local url port=5433 tunnel
  url="$(remote "sudo grep '^DATABASE_URL=' /etc/siteherd.env" | cut -d= -f2-)"
  [ -n "$url" ] || die "DATABASE_URL not found in /etc/siteherd.env on $HOST."
  # Same credentials, through the tunnel: ...@127.0.0.1:5432/... → ...@127.0.0.1:5433/...
  url="$(printf '%s' "$url" | sed -E "s#@[^/]+/#@127.0.0.1:$port/#")"
  ssh -o BatchMode=yes -o ExitOnForwardFailure=yes -N -L "$port:127.0.0.1:5432" "$HOST" &
  tunnel=$!
  trap 'kill $tunnel 2>/dev/null || true' RETURN
  sleep 3
  (cd "$ROOT" && DATABASE_URL="$url" npx drizzle-kit migrate)
}

# Keep the newest $KEEP releases (and always the current one).
prune() {
  local current
  current="$(current_release)"
  remote "sudo ls -1 '$APP_DIR/releases' | sort | head -n -$KEEP | while read -r r; do [ \"\$r\" != '$current' ] && sudo rm -rf -- '$APP_DIR/releases/'\"\$r\"; done; true"
}

case "${1:-}" in
  --rollback) rollback; exit 0 ;;
  --build-only) build; exit 0 ;;
  "") ;;
  *) die "Unknown option: $1" ;;
esac

[ -z "$(cd "$ROOT" && git status --porcelain .)" ] || echo "Note: deploying uncommitted changes."
release="$(date -u +%Y%m%d-%H%M%S)"
previous="$(current_release)"

build
upload_and_install "$release"
migrate
log "Switching to $release"
switch_to "$release"
if ! healthy; then
  if [ -n "$previous" ] && [ "$previous" != "current" ]; then
    printf '\n\033[31m✗ The new release did not start. Switching back to %s.\033[0m\n' "$previous" >&2
    switch_to "$previous"
  fi
  die "Deploy failed. Logs: ssh $HOST 'journalctl -u siteherd -n 50'"
fi
prune
code="$(curl -s -o /dev/null -w '%{http_code}' "$URL/login" || true)"
log "Deployed $release. $URL/login answers HTTP $code."
