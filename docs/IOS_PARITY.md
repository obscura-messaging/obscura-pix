# iOS status

The iOS React Native app and Swift bridge (`obscura-native/swift`) build in CI
and produce signed internal TestFlight builds. Physical Android↔iOS
interoperability has been exercised for auth, friendship, entries, typing,
attachments, Pix/view receipts, offline queues, cold starts, and reconnects.
It is not production-ready.

[`BRIDGE.md`](BRIDGE.md) is the cross-platform native contract. This file tracks
only iOS-specific status; it is not a second API specification.

## Implemented foundation

- React Native iOS project under `ios/Obscura`.
- Local Swift Package dependency on the pinned `obscura-native` submodule.
- Session ownership and Keychain persistence.
- Swift `RCTEventEmitter` bridge for the shared event stream.
- Auth, friends, link-code generation and approval sending, current-state
  reads, inbox, entry storage, explicit-audience send, typing, attachments,
  image utilities, clipboard, launch intent, app state, and debug-log bridge
  surfaces.
- Simulator launch through the shared TypeScript authentication flow.
- Physical Android↔iOS foreground interoperability for the current app models.

The iOS app is expected to use the same TypeScript model, audience, merge, and
drain code as Android. Native code must not duplicate those semantics.

## Remaining production gaps

### Push delivery

iOS still needs:

1. Firebase Messaging/Core dependencies.
2. APNs entitlement and a provisioned real device.
3. `FirebaseApp` and `MessagingDelegate` setup.
4. APNs-token to FCM-token forwarding.
5. `pushTokenReceived` delivery to the shared bridge.
6. Silent-wake session restore and pending-message drain.
7. Background-only generic local notifications.
8. Tap routing that carries no conversation, sender, or message identifier.

See [`PUSH_NOTIFICATIONS.md`](PUSH_NOTIFICATIONS.md) for privacy and ownership
requirements. Push delivery cannot be validated on the simulator.

### CI

The independent `.github/workflows/ios-ci.yml` workflow builds the libsignal
simulator FFI, prepares the local Swift package, installs pods, and builds
`Obscura.xcworkspace` for a generic simulator on pull requests. Its PR check
is required for merging. A manually requested internal release on tested `main`
builds a signed device archive once and uploads the verified IPA to internal
TestFlight; see
[`IOS_DISTRIBUTION.md`](IOS_DISTRIBUTION.md). iOS does not block Android
testing distribution.

### Device verification

A provisioned device has exercised authentication restore, friend acceptance,
entry round trips, typing, attachments, Pix/view receipts, disconnected queues,
cold starts, and reconnect idempotence. A TestFlight build was installed and
smoke-tested for launch, login, and foreground messaging. Remaining device
work is Swift link approval receipt, background/foreground automation,
FCM-via-APNs delivery, and notification privacy.

## Local development

See [`DEVELOPMENT.md`](DEVELOPMENT.md) for the complete setup and build
commands.

Do not infer production support from the build gate or foreground interop pass.
Until push and the remaining device gaps are verified, Android remains the
only production-ready platform.
