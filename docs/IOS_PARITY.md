# iOS status

The iOS app and Swift bridge build in CI and produce signed internal TestFlight
builds. They use the same TypeScript app and the same [bridge contract](BRIDGE.md)
as Android; this file tracks only iOS-specific status. iOS is not
production-ready.

## Working

- Every bridge method and event except the push and notification-tap paths
  below. Sessions persist in the Keychain.
- Physical Android↔iOS foreground interoperability: auth restore, friends,
  entries, typing, attachments, Pix and view receipts, offline queues, cold
  starts, and reconnects.
- A TestFlight build smoke-tested for launch, login, and foreground messaging.

## Gaps

### Push delivery

Not wired. iOS needs:

1. Firebase Messaging/Core dependencies.
2. APNs entitlement and a provisioned real device.
3. `FirebaseApp` and `MessagingDelegate` setup.
4. APNs-token to FCM-token forwarding.
5. `pushTokenReceived` delivery to the bridge.
6. Silent-wake session restore and pending-message drain.
7. Background-only generic local notifications.
8. Notification tap routing (`getLaunchIntent` and `launchedFrom`).

The privacy rules are in [`PUSH_NOTIFICATIONS.md`](PUSH_NOTIFICATIONS.md). Push
cannot be validated on the simulator.

### Other

- The Swift kit cannot receive device-link approval, so a new iOS device cannot
  be linked.
- No background/foreground automation on device.

## CI

`.github/workflows/ios-ci.yml` builds the libsignal simulator FFI, prepares the
Swift package, installs pods, and builds `Obscura.xcworkspace` for a generic
simulator; its PR check is required. Internal releases build and upload a
signed IPA to TestFlight ([`IOS_DISTRIBUTION.md`](IOS_DISTRIBUTION.md)). iOS
does not block Android testing distribution.
