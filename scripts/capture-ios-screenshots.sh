#!/usr/bin/env bash
# Regenera docs/assets/{home,stock,comidas}.png en simulador iOS.
# Requisitos: app instalada (npx expo run:ios), Metro en LAN, Simulator con accesibilidad para osascript.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
mkdir -p docs/assets

IP="${REACT_NATIVE_PACKAGER_HOSTNAME:-$(ipconfig getifaddr en0 2>/dev/null || echo 127.0.0.1)}"
ENC_URL=$(python3 -c "import urllib.parse; print(urllib.parse.quote('http://${IP}:8081', safe=''))")

echo "Metro: http://${IP}:8081 (arranca con: REACT_NATIVE_PACKAGER_HOSTNAME=${IP} npx expo start --dev-client --lan)"
xcrun simctl bootstatus booted -b 2>/dev/null || true
xcrun simctl openurl booted "exp+comuna-app://expo-development-client/?url=${ENC_URL}"
sleep 14

tap_tab() {
  local frac="$1"
  osascript <<APPLESCRIPT
tell application "Simulator" to activate
delay 0.5
tell application "System Events"
  tell process "Simulator"
    set w to front window
    set {wx, wy} to position of w
    set {ww, wh} to size of w
    click at {wx + (ww * $frac), wy + (wh * 0.91)}
  end tell
end tell
APPLESCRIPT
}

tap_tab 0.22
sleep 12
xcrun simctl io booted screenshot docs/assets/home.png

tap_tab 0.38
sleep 8
xcrun simctl io booted screenshot docs/assets/stock.png

tap_tab 0.54
sleep 10
xcrun simctl io booted screenshot docs/assets/comidas.png

echo "Listo: docs/assets/home.png stock.png comidas.png"
