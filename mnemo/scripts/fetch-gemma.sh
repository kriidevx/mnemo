#!/usr/bin/env bash
# Fetch a Gemma GGUF for on-device inference and push it to the Android device.
# Usage: ./scripts/fetch-gemma.sh [huggingface-gguf-url]
# Needs: curl, adb (device connected, USB debugging on), app installed once (for the app dir to exist).
set -euo pipefail

MODEL_URL="${1:-}"
OUT="gemma-4-e2b-it.gguf"
APP_ID="$(node -p "require('./app.json').expo.android?.package ?? 'com.anonymous.mnemo'")"

if [ -z "$MODEL_URL" ]; then
  echo "Usage: $0 <gguf-url>"
  echo "Pick a Gemma instruction-tuned GGUF (Q4_K_M quant ≈ 2-3 GB fits phones) from huggingface.co"
  echo "Example: $0 'https://huggingface.co/.../gemma-4-e2b-it-Q4_K_M.gguf?download=true'"
  exit 1
fi

if [ ! -f "$OUT" ]; then
  echo "Downloading model..."
  curl -L --fail -o "$OUT" "$MODEL_URL"
fi

echo "Pushing to device (app: $APP_ID)..."
adb shell mkdir -p "/sdcard/Android/data/$APP_ID/files/models" 2>/dev/null || true
adb push "$OUT" "/sdcard/Android/data/$APP_ID/files/models/gemma-4-e2b-it.gguf"
echo "Done. Open Mnemo → Settings → Gemma status should show modelFile: true."
