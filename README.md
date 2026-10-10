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

Contracts: [`docs/DOMAIN_CONTRACT.md`](docs/DOMAIN_CONTRACT.md) (app
semantics), [`docs/BRIDGE.md`](docs/BRIDGE.md) (React Native bridge), and
[`KIT_API.md`](https://github.com/obscura-messaging/obscura-native/blob/3a509ddf2576240a4db0d86956300c18aa50a23c/docs/KIT_API.md) (kit).

## Setup

Start with [`CONTRIBUTING.md`](CONTRIBUTING.md), which also covers checks and
updating the native pin. Platform notes are in
[`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md).

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

## Internal builds

After `main` CI passes, an Obscura owner can run **Actions → Release / Internal**
to send signed builds to Android and iOS testers. This does not publish to
Google Play or the public App Store. See
[Android distribution](docs/ANDROID_DISTRIBUTION.md) and
[iOS distribution](docs/IOS_DISTRIBUTION.md) for signing and tester setup.
