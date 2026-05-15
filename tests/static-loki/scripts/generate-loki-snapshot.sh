#!/usr/bin/env bash
#
# Build a deterministic Loki snapshot used by the static-data e2e setup.
#
# Spins up a Loki container, runs the bundled generator in static mode
# (fixed clock + seeded RNG), waits for the generator to finish, asks Loki
# to flush its in-memory chunks to filesystem storage, then copies the
# contents of /tmp/loki out of the container and zips them into:
#
#     tests/static-loki/provisioning/loki/data.zip
#
# Re-running this script overwrites the existing zip. The resulting file is
# committed to the repository; the e2e Loki image (Dockerfile.loki-static-data)
# unzips it back into /tmp/loki at build time.
#
# Usage:
#   pnpm run generate:loki-snapshot
#
# Requirements: docker, docker compose v2, zip, curl.
#
# The grafana/loki:3.6 image is distroless, so we cannot exec a healthcheck
# or wget inside it. Instead we publish port 3199 -> 3100 and poll/flush
# from the host.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"

COMPOSE_FILE="$ROOT_DIR/tests/static-loki/docker/docker-compose.snapshot.yaml"
PROVISIONING_DIR="$ROOT_DIR/tests/static-loki/provisioning/loki"
ZIP_PATH="$PROVISIONING_DIR/data.zip"

PROJECT_NAME="logs-drilldown-snapshot"
LOKI_HOST_URL="http://localhost:3199"

for tool in zip curl; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "error: '$tool' is required on the host." >&2
    exit 1
  fi
done

mkdir -p "$PROVISIONING_DIR"

compose() {
  docker compose \
    --project-directory "$ROOT_DIR" \
    --project-name "$PROJECT_NAME" \
    -f "$COMPOSE_FILE" \
    "$@"
}

cleanup() {
  echo "==> Tearing down snapshot containers"
  compose down --volumes --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT

cleanup

echo "==> Building containers"
compose build

echo "==> Starting Loki"
compose up -d snapshot-loki

echo "==> Waiting for Loki to report ready on $LOKI_HOST_URL/ready"
deadline=$(($(date +%s) + 120))
while true; do
  if curl -fsS "$LOKI_HOST_URL/ready" >/dev/null 2>&1; then
    echo "    Loki is ready"
    break
  fi
  if [ "$(date +%s)" -ge "$deadline" ]; then
    echo "error: Loki did not become ready within 120s" >&2
    compose logs snapshot-loki | tail -100 >&2
    exit 1
  fi
  sleep 1
done

echo "==> Running generator (static mode) until it exits"
compose run --rm snapshot-generator

echo "==> Asking Loki to flush ingester chunks to filesystem"
curl -fsS -X POST -H 'X-Scope-OrgID: 1' "$LOKI_HOST_URL/flush" || true

# Give Loki a moment to write chunks and update the index on disk.
sleep 5

echo "==> Sanity check: tenant 1 returns labels for the static window"
START_NS=1777201200000000000   # 2026-04-26T11:00:00Z
END_NS=1777205100000000000     # 2026-04-26T12:05:00Z
LABELS_JSON="$(curl -fsS -H 'X-Scope-OrgID: 1' "$LOKI_HOST_URL/loki/api/v1/labels?start=$START_NS&end=$END_NS" || true)"
if [ -z "$LABELS_JSON" ] || ! echo "$LABELS_JSON" | grep -q 'service_name'; then
  echo "error: tenant 1 has no service_name label inside the static window" >&2
  echo "labels response: $LABELS_JSON" >&2
  exit 1
fi
echo "    labels endpoint OK"

# Use a temp dir under /tmp for the extracted snapshot.
TMP_DIR="$(mktemp -d -t loki-snapshot-XXXXXX)"
final_cleanup() {
  rm -rf "$TMP_DIR"
  cleanup
}
trap final_cleanup EXIT

echo "==> Copying /tmp/loki out of the container into $TMP_DIR"
# `docker cp` works on distroless containers because it streams a tar
# archive; no shell required inside the target.
compose cp snapshot-loki:/tmp/loki/. "$TMP_DIR"

if [ -z "$(ls -A "$TMP_DIR" 2>/dev/null)" ]; then
  echo "error: copied data directory is empty - aborting" >&2
  exit 1
fi

echo "==> Compressing snapshot to $ZIP_PATH"
rm -f "$ZIP_PATH"
( cd "$TMP_DIR" && zip -qr "$ZIP_PATH" . )

SIZE="$(du -h "$ZIP_PATH" | cut -f1)"
echo "==> Snapshot written: $ZIP_PATH ($SIZE)"
