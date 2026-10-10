# Notification privacy and transport contract

Cross-platform rules for push transport and local notification content. Android
implements them; iOS status is in [`IOS_PARITY.md`](IOS_PARITY.md#push-delivery).

## Privacy invariants

The server sends a silent, content-free wake only:

```json
{ "data": { "action": "check" } }
```

It MUST NOT include an alert, title, body, sender, content preview, attachment
metadata, or application identifier.

The device may post only generic local copy:

- `New pix`
- `New message`
- `New friend request`

Notification text and tap metadata MUST NOT contain usernames, captions,
conversation IDs, sender IDs, message IDs, attachment thumbnails, or other
content-derived values. A tap may name only a broad destination such as the
chat list.

These restrictions limit what remains in OS notification databases and device
backups. They apply even when richer previews would be convenient.

## Ownership

| Layer          | Responsibility                                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------------- |
| Server         | Store a token per device and send a silent wake when its queue changes.                                             |
| Kit            | Register the token and process pending encrypted envelopes. Never call OS notification APIs or inspect model names. |
| Native app     | Receive the wake, restore the kit session, drain messages, and post generic local copy when backgrounded.           |
| TypeScript app | Request permission, register refreshed tokens, and interpret committed inbox rows for in-app state.                 |

The kit's wake drain is `processPendingMessages(timeout)` ([Push drain and
events](https://github.com/obscura-messaging/obscura-native/blob/3a509ddf2576240a4db0d86956300c18aa50a23c/docs/KIT_API.md#push-drain-and-events)). Its count is not notification content.

## Server API

```text
PUT /v1/push-tokens
Authorization: Bearer <device-scoped JWT>
Body: { "token": "<fcm-token>" }
```

Registration is per device and idempotent. Deleting the device removes its
token. Invalid tokens are removed when the push provider rejects them.

The default FCM message configuration (target token omitted) is:

```json
{
  "data": { "action": "check" },
  "android": {
    "priority": "HIGH",
    "collapseKey": "obscura_check",
    "ttl": "604800s"
  },
  "apns": {
    "headers": {
      "apns-push-type": "background",
      "apns-priority": "5",
      "apns-collapse-id": "obscura_check"
    },
    "payload": {
      "aps": { "content-available": 1 }
    }
  }
}
```

The TTL is configurable with `OBSCURA_FCM_TTL_SECS`.

The server and app must use the same Firebase project.

## Android

`ObscuraSession` is the process-scoped kit owner and sole
`incomingMessages` consumer. `ObscuraMessagingService` forwards silent wakes to
that owner; `NotificationHelper` is the only local-notification builder. The
session posts notifications only while the app is backgrounded.

## Token lifecycle

Android's explicit permission flow fetches a token only after a grant. Firebase
`onNewToken`, however, forwards rotations without checking notification
permission, and JS registers every received token. Logout clears local session
state but does not delete the server device or its token.

## Release verification

Real-provider tests still need to confirm:

- server payloads remain silent and content-free;
- background wakes drain encrypted envelopes;
- foreground delivery does not post an OS notification;
- local copy and tap metadata contain no identities or content;
- permission denial and later token rotation have an explicit, tested policy;
- explicit device deletion stops later pushes.

## Android manual check

1. Install a build with the real Firebase configuration and log in.
2. Press Home or remove the app from recents. Do not force-stop it; Android
   blocks FCM delivery to force-stopped apps until they are reopened.
3. Send an encrypted entry with [`tools/push-sender`](../tools/push-sender/).
4. Verify generic notification copy and inspect `ObscuraSession`,
   `ObscuraMessagingService`, and `NotificationHelper` in logcat.
