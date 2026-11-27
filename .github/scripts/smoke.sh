#!/usr/bin/env bash
# Installs the APK, launches it twice and prints what matters from the system log.
set -u
APK=app/android/app/build/outputs/apk/release/app-release.apk
PKG=app.burrowcinema

adb install -r "$APK"
for run in 1 2; do
  adb logcat -c
  adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 > /dev/null
  sleep 25
  adb logcat -d > "smoke-logcat-$run.txt"
  adb shell screencap -p /sdcard/shot.png && adb pull /sdcard/shot.png "smoke-screen-$run.png" > /dev/null || true
  echo "===== run $run: app process ====="
  adb shell pidof "$PKG" || echo "APP NOT RUNNING"
  echo "===== run $run: crashes and errors ====="
  grep -E "FATAL|AndroidRuntime|ReactNativeJS|ReactNative|DEBUG  |libc  |Abort|SIGSEGV|SIGABRT|$PKG|Expo" "smoke-logcat-$run.txt" | grep -v "ActivityManager: Process .* has died" | tail -150
done
exit 0
