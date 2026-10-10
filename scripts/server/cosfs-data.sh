#!/usr/bin/env bash
set -euo pipefail

BUCKET="yuanabd0821-1354951624:/data"
MOUNT="/data"
RELEASES="$MOUNT/learn-workbench/releases"
LOG="/var/log/cosfs-data.log"
PROBE_MB=80

log() {
  printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >>"$LOG"
}

is_mounted() {
  mountpoint -q "$MOUNT"
}

mount_data() {
  if is_mounted; then
    log "mount already active"
    return 0
  fi

  log "mounting $BUCKET -> $MOUNT"
  mkdir -p "$MOUNT"
  cosfs "$BUCKET" "$MOUNT" \
    -ourl=http://cos.ap-guangzhou.myqcloud.com \
    -odbglevel=warn \
    -oallow_other \
    -opublic_bucket=1 \
    -oensure_diskfree=4096

  for _ in $(seq 1 20); do
    if is_mounted; then
      log "mount active"
      return 0
    fi
    sleep 1
  done

  log "mount did not become ready within 20s"
  return 1
}

write_probe() {
  local probe="$RELEASES/.cosfs-write-probe.$$"
  local free_kb
  mkdir -p "$RELEASES"
  free_kb="$(df -Pk / | awk 'NR == 2 { print $4 }')"
  if [ -z "$free_kb" ] || [ "$free_kb" -lt 10485760 ]; then
    log "root disk below 10GiB before COS probe; free_kb=$free_kb; pruning Docker build cache"
    if command -v docker >/dev/null 2>&1; then
      docker builder prune -af >>"$LOG" 2>&1 || true
      free_kb="$(df -Pk / | awk 'NR == 2 { print $4 }')"
    fi
    if [ -z "$free_kb" ] || [ "$free_kb" -lt 10485760 ]; then
      log "root disk still below 10GiB; free_kb=$free_kb"
      return 1
    fi
  fi

  log "write probe start: ${PROBE_MB}MiB"
  dd if=/dev/zero of="$probe" bs=1M count="$PROBE_MB" conv=fsync status=none
  if [ "$(stat -c %s "$probe")" != "$((PROBE_MB * 1024 * 1024))" ]; then
    rm -f "$probe" || true
    log "write probe size mismatch"
    return 1
  fi
  rm -f "$probe"
  log "write probe passed"
}

recover_data() {
  if is_mounted && write_probe; then
    return 0
  fi

  if is_mounted; then
    log "COS probe failed; attempting safe unmount"
    if ! umount "$MOUNT" 2>/dev/null; then
      fusermount -u "$MOUNT" 2>/dev/null || true
    fi
    if is_mounted; then
      log "COS mount is busy; recovery deferred"
      return 1
    fi
  fi

  mount_data
  write_probe
}

case "${1:-health}" in
  mount)
    mount_data
    write_probe
    ;;
  health)
    recover_data
    ;;
  status)
    if is_mounted; then
      echo "mounted"
    else
      echo "not-mounted"
      exit 1
    fi
    ;;
  *)
    echo "usage: $0 {mount|health|status}" >&2
    exit 2
    ;;
esac
