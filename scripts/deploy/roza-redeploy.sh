#!/usr/bin/env bash
# Installed as root-owned /usr/local/sbin/roza-redeploy on the production host.
set -Eeuo pipefail
export PATH=/usr/sbin:/usr/bin:/sbin:/bin

if [[ "$EUID" -ne 0 ]]; then
  echo "Run this script as root (Systems Manager does this automatically)." >&2
  exit 1
fi
for tool in docker curl flock; do
  command -v "$tool" >/dev/null || { echo "Missing required tool: $tool" >&2; exit 1; }
done

exec 9>/run/lock/roza-deploy.lock
flock -n 9 || { echo "Another Roza deployment is already running." >&2; exit 1; }

# This file is created once by the server administrator, never supplied by the workflow.
source /etc/roza-deploy.conf
: "${ROZA_ENV_FILE:?Set ROZA_ENV_FILE in /etc/roza-deploy.conf}"
[[ "$ROZA_ENV_FILE" = /* && -f "$ROZA_ENV_FILE" && -r "$ROZA_ENV_FILE" ]] || {
  echo "ROZA_ENV_FILE must be an absolute path to the existing readable dotenv file." >&2
  exit 1
}

image="esheleyni/roza:latest"
backup="roza-previous"
docker container inspect roza >/dev/null
if docker container inspect "$backup" >/dev/null 2>&1; then
  echo "roza-previous already exists. Inspect the interrupted deployment before trying again." >&2
  exit 1
fi

# Download first. A failed pull leaves the current website running.
docker pull "$image"
# Run the image just pulled, even if another process changes the latest tag locally.
image_id="$(docker image inspect --format '{{.Id}}' "$image")"
echo "Deploying $image ($image_id)"

old_stopped=0
old_renamed=0
rollback() {
  trap - ERR INT TERM
  set +e
  echo "Deployment failed. Attempting to restore the previous container." >&2
  if [[ "$old_renamed" -eq 1 ]]; then
    docker rm -f roza >/dev/null 2>&1
    if docker rename "$backup" roza && docker start roza; then
      echo "Previous container restored. Check https://roza.esheleyni.com." >&2
    else
      echo "Automatic rollback failed. Inspect roza and roza-previous on the server." >&2
    fi
  elif [[ "$old_stopped" -eq 1 ]]; then
    docker start roza || echo "Could not restart the previous container." >&2
  fi
  exit 1
}
trap rollback ERR INT TERM

docker stop --time 30 roza
old_stopped=1
docker rename roza "$backup"
old_renamed=1

# nginx already proxies localhost:3040. Keep the app port private to this host.
docker run --name roza -d --restart unless-stopped \
  --env-file "$ROZA_ENV_FILE" \
  -p 127.0.0.1:3040:3030 \
  "$image_id"

ready=0
for ((attempt=1; attempt<=30; attempt++)); do
  if [[ "$(docker container inspect --format '{{.State.Running}}' roza)" != "true" ]]; then
    break
  fi
  if curl --fail --silent --show-error --max-time 3 \
      http://127.0.0.1:3040/ --output /dev/null 2>/dev/null; then
    ready=1
    break
  fi
  sleep 2
done

if [[ "$ready" -ne 1 ]]; then
  echo "The replacement container did not pass its HTTP startup check." >&2
  rollback
fi

trap - ERR INT TERM
# Remove the stopped backup only after the replacement responds successfully.
docker rm "$backup"
echo "Roza deployment succeeded: $image_id"
