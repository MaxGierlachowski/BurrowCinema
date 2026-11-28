#!/usr/bin/env bash
# Smoke test on an emulator: starts the mock Jellyfin with generated media, installs the APK,
# launches it twice, runs the UI driver for the mode (phone or tv) and checks the mock's report.
# Exits non zero when any step fails.
set -u
MODE=${1:-phone}
APK=${APK:-app/android/app/build/outputs/apk/release/app-release.apk}
PKG=app.burrowcinema
SCRIPTS=.github/scripts
export MEDIA_DIR=${MEDIA_DIR:-/tmp/bc-media}
failed=0
fail() {
  echo "::error::$1"
  failed=1
}

bash "$SCRIPTS/make-media.sh" || fail "test media could not be generated"
node "$SCRIPTS/mock-jellyfin.cjs" > "smoke-$MODE-mock.txt" 2>&1 &
for _ in $(seq 20); do curl -sf http://127.0.0.1:8096/System/Info/Public > /dev/null && break; sleep 0.5; done
adb install -r "$APK" || fail "adb install failed"
# The first full screen video shows a system hint that takes the focus; real devices show it once.
adb shell settings put secure immersive_mode_confirmations confirmed

if [ "$MODE" = tv ]; then
  CATEGORY=android.intent.category.LEANBACK_LAUNCHER
  adb shell cmd package query-activities --brief -a android.intent.action.MAIN -c "$CATEGORY" | grep "$PKG" || fail "no LEANBACK_LAUNCHER activity"
else
  CATEGORY=android.intent.category.LAUNCHER
fi

# Crashes of our process only; the emulator's own apps log FATAL lines too.
crashes() {
  grep -E "Process: $PKG|pid [0-9]+ \($PKG\)|>>> $PKG <<<" "$1" | head -40
}

for run in 1 2; do
  adb logcat -c
  adb shell monkey -p "$PKG" -c "$CATEGORY" 1 > /dev/null
  sleep 25
  adb logcat -d > "smoke-$MODE-logcat-$run.txt"
  adb shell screencap -p /sdcard/shot.png && adb pull /sdcard/shot.png "smoke-$MODE-screen-$run.png" > /dev/null || true
  echo "===== run $run: app process ====="
  adb shell pidof "$PKG" || fail "app not running after start $run"
  echo "===== run $run: visible texts ====="
  adb shell uiautomator dump /sdcard/ui.xml > /dev/null 2>&1 && adb shell cat /sdcard/ui.xml | grep -o 'text="[^"]\+"' | head -40
  echo "===== run $run: errors ====="
  grep -E "FATAL|E AndroidRuntime|ReactNativeJS|E ReactNative|SIGSEGV|SIGABRT" "smoke-$MODE-logcat-$run.txt" | grep -v "ActivityManager: Process .* has died" | tail -80
  [ -n "$(crashes "smoke-$MODE-logcat-$run.txt")" ] && fail "crash during start $run"
done

echo "===== driver ($MODE) ====="
adb logcat -c
adb logcat > "smoke-$MODE-logcat-driver.txt" 2>&1 &
logcat_pid=$!
if [ "$MODE" = tv ]; then driver=drive_tv.py; else driver=drive.py; fi
python3 "$SCRIPTS/$driver" || fail "driver checks failed"
kill "$logcat_pid" 2> /dev/null
adb shell screencap -p /sdcard/shot.png && adb pull /sdcard/shot.png "smoke-$MODE-screen-end.png" > /dev/null || true

echo "===== driver: errors ====="
grep -E "FATAL|E AndroidRuntime|E ReactNativeJS|E ReactNative|SIGSEGV|SIGABRT" "smoke-$MODE-logcat-driver.txt" | tail -120
crash=$(crashes "smoke-$MODE-logcat-driver.txt")
[ -n "$crash" ] && { echo "$crash"; fail "crash while driving"; }

curl -s http://127.0.0.1:8096/__report > "smoke-$MODE-report.json"
python3 "$SCRIPTS/check_report.py" "$MODE" "smoke-$MODE-report.json" || fail "report checks failed"
exit $failed
