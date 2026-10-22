#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

ready() {
  local response
  response="$(curl --silent --show-error --fail --max-time 2 http://127.0.0.1:5173/ 2>/dev/null)" || return 1
  [[ "$response" == *'<title>welgain — Frame playground</title>'* ]]
}

if ready; then
  echo 'welgain is already running on port 5173.'
  exit 0
fi

nohup npm run dev -- --port 5173 --strictPort > /tmp/welgain-vite.log 2>&1 < /dev/null &
for attempt in {1..40}; do
  if ready; then
    echo 'welgain is ready on port 5173. Open it from the Ports tab.'
    exit 0
  fi
  sleep 0.25
done

echo 'welgain did not start. Server output:' >&2
cat /tmp/welgain-vite.log >&2
exit 1
