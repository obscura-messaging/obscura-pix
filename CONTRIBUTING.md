# Contributing

## Workflow

Never commit directly to `main`. Create a branch, open a pull request, and wait
for the required CI jobs before merging.

The TypeScript app owns application semantics. Do not move model parsing,
audience resolution, authorization, merge, expiry, or notification policy into
the native hosts or ObscuraKit. Read [`docs/DOMAIN_CONTRACT.md`](docs/DOMAIN_CONTRACT.md)
and [`docs/BRIDGE.md`](docs/BRIDGE.md) before changing those boundaries.

Changes to ObscuraKit land in `obscura-native` first. After that pull request
merges, update the gitlink here in a separate pull request:

```bash
git -C obscura-native fetch origin
git -C obscura-native switch --detach <full-commit-sha>
git -C obscura-native submodule update --init --recursive
git add obscura-native
```

## Prerequisites

Install [`just`](https://github.com/casey/just), Node 22.11+, and Git. Android
work requires JDK 21, Android SDK 36, and Android NDK `27.1.12297006` (Android
Studio is the easiest way to get them). iOS work requires macOS 13+, Xcode 16+,
Rust stable, CocoaPods 1.17.0, and `protoc`.

On macOS:

```bash
brew install just protobuf
sudo gem install cocoapods -v 1.17.0 -N
```

Node and Java versions are recorded in [`.nvmrc`](.nvmrc) and
[`.java-version`](.java-version). Gradle recipes reject other Java versions and
automatically locate JDK 21 through `java_home` on macOS.

## Setup

```bash
git clone --recurse-submodules https://github.com/obscura-messaging/obscura-pix.git
cd obscura-pix
just setup
just doctor
```

For Android:

```bash
just doctor-android
just android-config
just android-release
```

`android-config` creates the checked-in compile-only Firebase stub only when a
real `android/app/google-services.json` is absent. Real push testing requires
downloading that ignored file from the Firebase project; never commit it.

For iOS:

```bash
just doctor-ios
just ios-build
```

The first iOS bootstrap fetches the libsignal commit pinned by `obscura-native`
and builds its simulator FFI. Later runs reuse that output. Physical-device
signing requires access to Apple team `KY4LCG34B8` and App Group
`group.dev.barrelmaker.obscura`; see [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md)
to sign with your own team.

## Checks

```bash
just check
just android-release
just ios-build
just push-sender-build
```

CI runs these same recipes as separate jobs. `just check` runs Jest,
typecheck, and lint. Jest covers domain, native facade, and state behavior, not
rendered UI or physical-device behavior.
