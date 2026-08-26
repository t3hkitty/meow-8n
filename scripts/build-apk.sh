#!/usr/bin/env bash
# ==============================================================================
# build-apk.sh
# Google Antigravity (AGV) compilation workflow for n8n Local Android APK
# ==============================================================================

set -e

echo "==> Step 1: Installing Capacitor core & native CLI dependencies..."
npm install

echo "==> Step 2: Copying web assets to native Android project directory..."
npx cap copy android

echo "==> Step 3: Synchronizing Capacitor plugins..."
npx cap sync android

echo "==> Step 4: Compiling Android Debug APK via Gradle..."
cd android
chmod +x gradlew
./gradlew assembleDebug

echo "==> Step 5: Build Completed Successfully!"
echo "APK Output: android/app/build/outputs/apk/debug/app-debug.apk"
