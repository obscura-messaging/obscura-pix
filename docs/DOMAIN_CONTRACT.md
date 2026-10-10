# Application domain contract

The app-owned semantics in `src/models/`, `src/domain/` and `src/state/`. The
kit stores and sends opaque bytes; what the kit does and does not do is defined
in [`KIT_API.md`](https://github.com/obscura-messaging/obscura-native/blob/3a509ddf2576240a4db0d86956300c18aa50a23c/docs/KIT_API.md).

## Models

| Model           | Merge   | Audience             | Inbound authorization                    |
| --------------- | ------- | -------------------- | ---------------------------------------- |
| `directMessage` | APPEND  | conversation         | conversation names self and sender       |
| `story`         | APPEND  | all accepted friends | none; the transport sender is the author |
| `pix`           | REPLACE | conversation         | conversation names self and sender       |
| `profile`       | REPLACE | all accepted friends | entry ID is `profile_<senderUserId>`     |

`src/models/schema.ts` is the executable source: `audienceFor(model)` for
sending, `fieldsFor(model)` for local writes, and `modelRules()` for the drain.

Each model declares field types (`string`, `string?`, `number`, `number?`;
`?` means optional). They are enforced on local writes, which throw, and on
received entries, which are discarded with `invalid-fields`. Fields starting
with `_` are local-only, never sent and not checked; undeclared fields are
allowed. The screens' entry types are derived from the same declarations.

`_authorUserId` is set by the app, never taken from a payload: on a local write
it is this user, on receipt the transport sender. If the entry already exists
locally, its recorded author is kept, so a `pix` viewed-receipt does not change
the pix's author.

## Audience

The app passes explicit recipient user IDs to `sendEntry`. Resolution
(`src/domain/audience.ts`) throws `DIRECT_ROUTING_UNRESOLVED`, sending nothing,
when a required value is missing or malformed. It never widens to a broadcast.

- No declared audience: every accepted friend.
- `self`: own other devices only; the recipient list is empty.
- `recipient`: a username resolved through accepted friends; an unknown name
  resolves to no external recipient.
- `conversation`: a canonical conversation ID that names the local user,
  intersected with accepted friends.

### Canonical conversation ID

The two participant user IDs, sorted and joined with `_`: `"userIdA_userIdB"`.
User IDs are UUIDs and contain no `_`. `src/domain/conversation.ts` has the one
constructor and one parser. The parser rejects anything noncanonical, including
a reversed pair, rather than guessing an audience.

## Inbound authorization

Any authenticated account can deliver to any device, so the drain authorizes
each entry against the inbox row's `senderUserId`, never a payload field.
Friendship is not required; names are resolved from the friend graph at render
time.

- A conversation entry must name the local user and the sender. For a self-sync
  (sender is the local user) the other participant is the peer.
- A profile entry ID must equal `profile_<senderUserId>`.
- A story has no binding field; the sender is its author.

## Drain

```text
peek -> classify -> parse -> validate fields -> authorize -> merge -> entryPut -> consume
```

A row that can never be processed is discarded with one of these reasons:
`unknown-kind`, `unknown-model`, `missing-fields`, `unparsable-payload`,
`invalid-fields`, `unauthorized-sender`. Transient failures leave rows pending.
A merge loser is consumed without a write. Entry writes and `consume` share no
transaction, so merge must be idempotent.

## Merge

Keyed by entry ID (`src/domain/merge.ts`).

- **APPEND:** the first write for an ID wins; repeats are ignored.
- **REPLACE:** the greater `(sentAt, authorDeviceId)` wins, comparing `sentAt`
  first and then `authorDeviceId` lexicographically. Equal on both is the same
  write.

`authorDeviceId` is the device whose session decrypted the entry, or this
device for a local write.

## Local writes

`src/state/writeEntry.ts`: resolve the audience and validate fields (either may
throw, before anything is stored), write locally, then send. A local write's
`sentAt` is at least one millisecond past the stored copy's, so it wins locally
and remotely even when a peer's clock is ahead. If a send reaches nobody the
entry is kept, marked undelivered in `localMetadata`, and retried on
reconnect, foreground and cold start.

## Expiry

Nothing expires. Stories and entries remain until expiry is implemented and
tested.
