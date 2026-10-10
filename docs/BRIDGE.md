# Obscura bridge contract

The JS-to-native bridge. [`src/native/ObscuraModule.ts`](../src/native/ObscuraModule.ts)
is authoritative for method and event shapes; Android, iOS, the test fixture and
this document must match it. Kit semantics behind the bridge are defined in
[`KIT_API.md`][kit]. iOS gaps are in [`IOS_PARITY.md`](IOS_PARITY.md).

## Design principles

- **Paths, not bytes.** Files cross as absolute paths; no base64.
- **Payloads are opaque JSON strings.** Neither bridge parses `data` or
  `payload`. The app parses them; `src/models/schema.ts` never crosses.
- **The caller names recipients.** `sendEntry` and the typing methods take
  user IDs; audience resolution is `src/domain/audience.ts`.
- **Identity comes from the envelope.** `senderUserId` / `senderDeviceId` come
  from the kit ([Envelope identity][kit-identity]); a bridge never derives
  them from payload content.
- **One event stream.** All native-to-JS events are `ObscuraEvent`,
  discriminated by `type`.
- **Promises for calls, events for changes.**

## Rejections

A rejection carries a `code`. Kit failures use one of `NOT_AUTHENTICATED`
`NOT_PROVISIONED` `NOT_FRIENDS` `NO_DEVICES` `NO_MESSENGER` `TIMEOUT`
`DEVICE_LINK_FAILED` `SEND_FAILED`; anything else gets a per-method code
(`INBOX_PEEK_ERROR`, `ENTRY_PUT_ERROR`, ...). `DIRECT_ROUTING_UNRESOLVED` is an
app error and never crosses the bridge.

## Methods

All methods return a `Promise`.

### Auth and state

| Method                                  | Args    | Returns           | Platforms |
| --------------------------------------- | ------- | ----------------- | --------- |
| `registerUser(username, password)`      | strings | `void`            | both      |
| `login(username, password)`             | strings | `LoginScenario`   | both      |
| `loginAndProvision(username, password)` | strings | `void`            | both      |
| `connect()`                             | —       | `void`            | both      |
| `logout()`                              | —       | `void`            | both      |
| `wipeDevice()`                          | —       | `void`            | both      |
| `getConnectionState()`                  | —       | `ConnectionState` | both      |
| `getAuthState()`                        | —       | `AuthState`       | both      |
| `getUserId()`                           | —       | `string \| null`  | both      |
| `getUsername()`                         | —       | `string \| null`  | both      |
| `getDeviceId()`                         | —       | `string \| null`  | both      |

`LoginScenario` outcomes are defined in [Login][kit-login]. `wipeDevice` erases
this install's identity, sessions, friends, entries and inbox, and logs out.
`ConnectionState`: `disconnected` `connecting` `reconnecting` `connected`.
`AuthState`: `loggedOut` `authenticated` `pendingApproval`. The drain stores
nothing until `getUserId` returns a value, since it cannot authorize without it.

### Friends and devices

| Method                         | Args   | Returns                                | Platforms |
| ------------------------------ | ------ | -------------------------------------- | --------- |
| `acceptFriend(userId)`         | string | `void`                                 | both      |
| `getFriendCode()`              | —      | `string` (base64-wrapped JSON `{n,u}`) | both      |
| `addFriendByCode(code)`        | string | `void`                                 | both      |
| `getFriends()`                 | —      | `Friend[]`                             | both      |
| `generateLinkCode()`           | —      | `string`                               | both      |
| `validateAndApproveLink(code)` | string | `void`                                 | both      |

`Friend = { userId, username, status: 'pending_sent' | 'pending_received' | 'accepted' }`.
The friend graph is the app's only source of display names.

### Inbox and entries

| Method                                                                     | Args                                                 | Returns         | Platforms |
| -------------------------------------------------------------------------- | ---------------------------------------------------- | --------------- | --------- |
| `inboxPeek(limit)`                                                         | number                                               | `InboxRow[]`    | both      |
| `inboxConsume(ids)`                                                        | number[]                                             | `void`          | both      |
| `inboxDiscard(ids, reason)`                                                | number[], string                                     | `void`          | both      |
| `inboxDepth()`                                                             | —                                                    | `number`        | both      |
| `entryPut(model, id, dataJson, sentAt, authorDeviceId, localMetadataJson)` | string, string, string, number, string, string\|null | `void`          | both      |
| `entryAll(model)`                                                          | string                                               | `StoredEntry[]` | both      |
| `entryErase(model, id)`                                                    | string, string                                       | `void`          | both      |

Semantics: [Inbox][kit-inbox] and [Entry store][kit-entry-store].
`InboxRow` and `StoredEntry` are the kit records with `payload` / `data` and
`localMetadata` as strings. `entryPut` is a blind upsert: the app merges first
(`src/domain/merge.ts`). It emits no event; the app refreshes itself.

### Send and typing

| Method                                                                | Args                                     | Returns | Platforms |
| --------------------------------------------------------------------- | ---------------------------------------- | ------- | --------- |
| `sendEntry(recipientUserIds, modelKey, entryId, sentAt, payloadJson)` | string[], string, string, number, string | `void`  | both      |
| `sendTyping(recipientUserIds, conversationId)`                        | string[], string                         | `void`  | both      |
| `stopTyping(recipientUserIds, conversationId)`                        | string[], string                         | `void`  | both      |
| `observeTyping(conversationId)`                                       | string                                   | `void`  | both      |
| `stopObservingTyping(conversationId)`                                 | string                                   | `void`  | both      |

Semantics: [Send][kit-send].
An empty `recipientUserIds` is a self-sync to the author's other devices. The
sender gets no inbox row for its own send and writes its own entry.
`conversationId` is an opaque UI context. While an observation is active the
bridge emits [`typingChanged`](#typingchanged).

### Attachments and images

| Method                                      | Args             | Returns                     | Platforms |
| ------------------------------------------- | ---------------- | --------------------------- | --------- |
| `uploadAttachment(filePath)`                | string           | `{ id, contentKey, nonce }` | both      |
| `downloadAttachment(id, contentKey, nonce)` | strings          | absolute file path          | both      |
| `purgeAttachment(id)`                       | string           | `void`                      | both      |
| `resizeImage(srcPath, maxDim, quality)`     | string, int, int | `{ path, width, height }`   | both      |
| `writeTestImage(width, height)`             | ints             | `{ path, width, height }`   | both      |

Encryption: [Attachments][kit-attachments].
`contentKey` and `nonce` are base64; the app stores the triple in its own
payload. `uploadAttachment` leaves the source file alone.

`downloadAttachment` decrypts to `<cacheDir>/attachments/<safeId>.<ext>`, with
`ext` `jpg`, `mp4` or `mov` chosen from the content. This file cache is the
only decrypted copy; `purgeAttachment` deletes it (all three extensions and
their temp files), and the expiry sweep calls it before erasing a pix.
Implementations MUST:

- sanitize the id to a safe filename;
- return an existing non-empty cached file without downloading;
- publish atomically (write a sibling temp file, then rename), so a concurrent
  call never sees a partial file.

Server blobs expire after 30 days and inbox rows do not, so an undrained row can
outlive its media.

`resizeImage` re-encodes as JPEG so the largest side is at most `maxDim` px.
Implementations MUST:

- apply EXIF orientation, so output pixels are in display orientation;
- bound peak memory for large sources (Android: two-pass `inSampleSize`
  decode; iOS: ImageIO thumbnailing);
- reject `maxDim <= 0` and clamp `quality` to `1..100`;
- reject on out-of-memory rather than hang.

`writeTestImage` writes a solid-color JPEG for the no-camera fallback in
`CameraScreen` and rejects zero or very large dimensions. Neither method
modifies its source.

### Push and launch

| Method                     | Args   | Returns                      | Platforms                      |
| -------------------------- | ------ | ---------------------------- | ------------------------------ |
| `requestPushPermission()`  | —      | `boolean` (granted)          | both; token event Android only |
| `registerPushToken(token)` | string | `void`                       | both                           |
| `getLaunchIntent()`        | —      | `{ screen: string } \| null` | both; iOS returns null         |

`requestPushPermission` shows the OS prompt if undecided and resolves `true`
only on a grant. On Android a grant also fetches the FCM token and emits
[`pushTokenReceived`](#pushtokenreceived); see [`PUSH_NOTIFICATIONS.md`](PUSH_NOTIFICATIONS.md).

`getLaunchIntent` returns the cold-start deep-link target once (later calls
return null). JS calls it on mount, because the bridge does not exist yet when
a cold start is handled. Warm starts arrive as [`launchedFrom`](#launchedfrom).

### Misc

| Method                   | Args   | Returns    | Platforms                          |
| ------------------------ | ------ | ---------- | ---------------------------------- |
| `getDebugLog()`          | —      | `string[]` | both                               |
| `prewarmAudioSession()`  | —      | `void`     | both; no-op on Android             |
| `deleteFile(path)`       | string | `void`     | both                               |
| `setClipboard(text)`     | string | `void`     | both                               |
| `addListener(eventName)` | string | —          | Android; iOS via `RCTEventEmitter` |
| `removeListeners(count)` | number | —          | Android; iOS via `RCTEventEmitter` |

`prewarmAudioSession` activates the iOS audio session so recording starts
without a ~1.4 s delay; it is idempotent. `deleteFile`
is best-effort and resolves for a missing file. `addListener` and
`removeListeners` are the no-op stubs `NativeEventEmitter` requires.

## Events

One stream, `ObscuraEvent`. `OBSCURA_EVENT_TYPES` in `ObscuraModule.ts` is the
name list and mirrors the `BridgeEvent` enums in both bridges. These nine types
are the whole set.

| Event                                             | Fields                                     | Emitted when                                                           | JS reaction                                                                            |
| ------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| <a id="connectionchanged"></a>`connectionChanged` | `state: ConnectionState`                   | the WebSocket state changes                                            | on `connected`, drain the inbox and flush the outbox                                   |
| <a id="authstatechanged"></a>`authStateChanged`   | `state: AuthState`                         | login, logout, pending-approval transitions                            | `loggedOut` resets the session; `authenticated` loads it and runs the cold-start drain |
| <a id="authfailed"></a>`authFailed`               | `reason: string`                           | token refresh exhausted its retries                                    | reset the session                                                                      |
| <a id="appstatechanged"></a>`appStateChanged`     | `state: 'active' \| 'background'`          | process foreground/background; Android also replays it to a new bridge | on `active`, drain and flush                                                           |
| <a id="launchedfrom"></a>`launchedFrom`           | `screen: string`                           | a notification tap while running                                       | navigate                                                                               |
| <a id="friendschanged"></a>`friendsChanged`       | —                                          | the friend graph changes                                               | call `getFriends()`                                                                    |
| <a id="messagereceived"></a>`messageReceived`     | `model: string`                            | an `APP_ENTRY` row was persisted                                       | drain                                                                                  |
| <a id="typingchanged"></a>`typingChanged`         | `conversationId: string, typers: string[]` | an observed conversation's typer set changes                           | show `typers` (display names)                                                          |
| <a id="pushtokenreceived"></a>`pushTokenReceived` | `token: string`                            | a push token is available or rotated (Android only)                    | call `registerPushToken`                                                               |

`messageReceived` is a wake-up, not a delivery: it may be dropped, so the app
also drains on cold start, reconnect and foreground.

## Naming and shape rules

- `type` is a camelCase string.
- Event fields are flat scalars or arrays of scalars.
- Method arguments are scalars, arrays of scalars, or JSON strings for
  free-form objects (`entryPut(..., dataJson, ...)`), so neither bridge parses
  nested data.

## Adding to the contract

1. Add the method or event to [`ObscuraModule.ts`](../src/native/ObscuraModule.ts).
   For an event also add it to `OBSCURA_EVENT_TYPES`; `_AssertEventTypesMatch`
   makes drift a compile error.
2. Implement it in `ObscuraBridgeModule.kt`.
3. Implement it in `ObscuraBridge.swift` **and declare it in `ObscuraBridge.m`**;
   without the `.m` line it compiles but is invisible at runtime.
4. Add a row here.
5. Mirror it in `src/native/__fixtures__/FakeObscuraBridge.ts`, which models
   this contract, not kit internals.
6. Emit events through each bridge's single `emit` helper.

[kit]: https://github.com/obscura-messaging/obscura-native/blob/3a509ddf2576240a4db0d86956300c18aa50a23c/docs/KIT_API.md
[kit-identity]: https://github.com/obscura-messaging/obscura-native/blob/3a509ddf2576240a4db0d86956300c18aa50a23c/docs/KIT_API.md#envelope-identity
[kit-login]: https://github.com/obscura-messaging/obscura-native/blob/3a509ddf2576240a4db0d86956300c18aa50a23c/docs/KIT_API.md#login
[kit-inbox]: https://github.com/obscura-messaging/obscura-native/blob/3a509ddf2576240a4db0d86956300c18aa50a23c/docs/KIT_API.md#inbox
[kit-entry-store]: https://github.com/obscura-messaging/obscura-native/blob/3a509ddf2576240a4db0d86956300c18aa50a23c/docs/KIT_API.md#entry-store
[kit-send]: https://github.com/obscura-messaging/obscura-native/blob/3a509ddf2576240a4db0d86956300c18aa50a23c/docs/KIT_API.md#send
[kit-attachments]: https://github.com/obscura-messaging/obscura-native/blob/3a509ddf2576240a4db0d86956300c18aa50a23c/docs/KIT_API.md#attachments
