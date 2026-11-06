#!/bin/bash
# Record 5s from the mic, measure amplitude, run whisper. Prints the verdict.
# Usage: ./mic-test.sh            # auto-stops after 5s
#        ./mic-test.sh 8          # 8s recording
set -e
cd "$(dirname "$0")"

SECS=${1:-5}
M4A=~/tmp/mic-test.m4a
WAV=~/tmp/mic-test.wav
mkdir -p ~/tmp
rm -f "$M4A" "$WAV"

termux-microphone-record -q >/dev/null 2>&1 || true
sleep 0.2

echo "=== recording ${SECS}s — SPEAK A FULL SENTENCE LOUDLY ==="
termux-microphone-record -f "$M4A" -l 0 >/dev/null
# wait for mic to actually arm
for _ in $(seq 1 20); do
  termux-microphone-record -i 2>/dev/null | grep -q '"isRecording": true' && break
  sleep 0.1
done
echo "    mic armed. go."
for s in $(seq 1 "$SECS"); do printf "    %ds\n" "$s"; sleep 1; done
termux-microphone-record -q >/dev/null 2>&1

echo
echo "=== source info ==="
# ask for info once more to see the source string
termux-microphone-record -i 2>/dev/null || true

echo
echo "=== file ==="
ls -la "$M4A"

echo
echo "=== amplitude (ffmpeg volumedetect) ==="
ffmpeg -y -i "$M4A" -ar 16000 -ac 1 "$WAV" >/dev/null 2>&1
ffmpeg -i "$WAV" -af volumedetect -f null - 2>&1 | grep -E 'mean_volume|max_volume|n_samples' | sed 's/^/    /'

echo
echo "=== whisper ==="
~/whisper.cpp/build/bin/whisper-cli \
  -m ~/whisper.cpp/models/ggml-base.bin \
  -f "$WAV" -l en -nt --no-prints 2>/dev/null | sed 's/^/    /'

echo
echo "=== verdict ==="
# volumedetect line: "[... @ 0x...] max_volume: -14.1 dB"
# grab the second-to-last token ("-14.1") from that specific line.
MAX=$(ffmpeg -i "$WAV" -af volumedetect -f null - 2>&1 \
      | awk '/max_volume:/ {print $(NF-1); exit}')
if [ -z "$MAX" ]; then
  echo "    no amplitude info — something broke above."
elif awk "BEGIN{exit !($MAX < -30)}"; then
  echo "    MIC IS SILENT (max_volume=${MAX} dB). Audio routing is wrong — not a whisper problem."
elif awk "BEGIN{exit !($MAX < -18)}"; then
  echo "    mic is weak (max_volume=${MAX} dB). Transcription will be flaky."
else
  echo "    mic is OK (max_volume=${MAX} dB). Problem is downstream of capture."
fi
