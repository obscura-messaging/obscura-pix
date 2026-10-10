# Obscura

End-to-end encrypted messaging built with React Native and ObscuraKit.
Android is the current release target. iOS has signed internal TestFlight
builds and foreground interoperability, but push/background delivery is not
implemented. See
[`docs/IOS_PARITY.md`](docs/IOS_PARITY.md).

## Architecture

```text
React Native application (`src/`)
  ├── Android host bridge → `obscura-native/kotlin`
  └── iOS host bridge     → `obscura-native/swift`
```

- The TypeScript app owns model schemas, payload parsing, recipients, authorization, merge,
  expiry, outbox policy, and rendering.
- ObscuraKit owns authentication, friends/devices, Signal, transport, typing,
  encrypted attachments, the durable inbox, and opaque entry storage.
- The Android and iOS host layers own OS lifecycle, permissions, files, push,
  notifications, and React Native marshalling.

The application domain contract is
[`docs/DOMAIN_CONTRACT.md`](docs/DOMAIN_CONTRACT.md). The native bridge contract
is [`docs/BRIDGE.md`](docs/BRIDGE.md).

## Setup

Start with [`CONTRIBUTING.md`](CONTRIBUTING.md). Platform constraints and
troubleshooting notes are in [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md).

### iOS device build with a personal team

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

## Project layout

```text
src/domain/                 Pure authorization, audience, merge, and drain planning
src/models/schema.ts        Application model declarations
src/state/                  Inbox/outbox effects and Zustand state
src/native/ObscuraModule.ts Typed React Native bridge facade
src/screens/                Shared UI
android/.../obscura/        Android host, bridge, lifecycle, and notifications
ios/Obscura/                iOS host and bridge
obscura-native/             Pinned native source submodule
tools/push-sender/          Real Android push test sender
```

## Checks

```bash
just check
```

The Jest suite covers domain, native facade, and state behavior. It does not
cover rendered UI or physical-device behavior.

## Internal builds

After `main` CI passes, an Obscura owner can run **Actions → Release / Internal**
to send signed builds to Android and iOS testers. This does not publish to
Google Play or the public App Store. See
[Android distribution](docs/ANDROID_DISTRIBUTION.md) and
[iOS distribution](docs/IOS_DISTRIBUTION.md) for signing and tester setup.

## Updating the native pin

```bash
git -C obscura-native fetch origin
git -C obscura-native switch --detach <full-commit-sha>
git -C obscura-native submodule update --init --recursive
git add obscura-native
```

Land coordinated native work in `obscura-native` first, then update this
repository's gitlink.
