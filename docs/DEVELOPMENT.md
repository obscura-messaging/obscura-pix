# Platform development notes

Setup and checks are in [`CONTRIBUTING.md`](../CONTRIBUTING.md). This file
records platform constraints that help when setup or builds fail.

## Android

Set `JAVA_HOME` to JDK 21 and `ANDROID_HOME` to the Android SDK. The
`just android-*` recipes find JDK 21 on macOS and the standard SDK directory on
macOS or Linux; Linux users must set `JAVA_HOME`. Direct `android/gradlew`
commands inherit the shell environment, so set both variables or use the
recipes.

The Firebase Gradle plugin requires `android/app/google-services.json`; see
[`CONTRIBUTING.md`](../CONTRIBUTING.md) for the stub and the real file.

## iOS

The libsignal FFI, local Swift package and CocoaPods outputs are generated on
the first build, cached locally, and gitignored. The simulator build does not
validate APNs, background delivery, or release signing.

### Device build with a personal team

Without access to the project team, sign with your own team through
command-line overrides. No tracked files change. The App Group is dropped, and
the app falls back to its private container.

```bash
just ios-build   # once, to prepare dependencies
./obscura-native/swift/scripts/bootstrap-libsignal.sh ios-device
cd ios && mkdir -p build
printf '<plist version="1.0"><dict/></plist>' > build/Personal.entitlements
xcodebuild -workspace Obscura.xcworkspace -scheme Obscura \
  -destination 'generic/platform=iOS' -configuration Release \
  -allowProvisioningUpdates \
  -derivedDataPath build/personal \
  DEVELOPMENT_TEAM=<TEAM_ID> PRODUCT_BUNDLE_IDENTIFIER=<your.bundle.id> \
  CODE_SIGN_ENTITLEMENTS=build/Personal.entitlements build
xcrun devicectl device install app --device <DEVICE_ID> \
  build/personal/Build/Products/Release-iphoneos/Obscura.app
```

## Environment and data

- Both app hosts target `https://obscura.barrelmaker.dev`; there is no local or
  staging override. Development accounts and messages use that server.
- Until the first public release, schema changes require clearing app data;
  prototype migrations are not kept.
