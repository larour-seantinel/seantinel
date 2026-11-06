#!/bin/bash
# Same as mic-test.sh but goes through the bridge (same path the APK uses).
# Run with the Assistant APK CLOSED / backgrounded — tests whether the APK
# itself is stealing audio focus.
set -e
SECS=${1:-5}

echo "=== bridge /record/start ==="
curl -s -X POST http://127.0.0.1:8787/record/start
echo
echo "    SPEAK LOUDLY for ${SECS}s"
for s in $(seq 1 "$SECS"); do printf "    %ds\n" "$s"; sleep 1; done

echo
echo "=== bridge /record/stop ==="
curl -s -X POST "http://127.0.0.1:8787/record/stop?sid=start&tab=Tab1"
echo
echo
echo "=== log line ==="
tail -1 ~/tmp/bridge-mic.log
