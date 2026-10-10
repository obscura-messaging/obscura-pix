# Obscura

## Read first

- [`README.md`](README.md#architecture): who owns what.
- [`docs/DOMAIN_CONTRACT.md`](docs/DOMAIN_CONTRACT.md): application semantics.
- [`docs/BRIDGE.md`](docs/BRIDGE.md): React Native bridge behavior.
- [`KIT_API.md`](https://github.com/obscura-messaging/obscura-native/blob/3a509ddf2576240a4db0d86956300c18aa50a23c/docs/KIT_API.md): the kit contract.

Do not move application semantics into native code.

## Application entry points

| Responsibility                   | File                          |
| -------------------------------- | ----------------------------- |
| Models                           | `src/models/schema.ts`        |
| Conversation IDs                 | `src/domain/conversation.ts`  |
| Audience                         | `src/domain/audience.ts`      |
| Authorization and drain planning | `src/domain/drain.ts`         |
| Merge                            | `src/domain/merge.ts`         |
| Inbox effects                    | `src/state/drainInbox.ts`     |
| Local write and send ordering    | `src/state/writeEntry.ts`     |
| Session and reactive state       | `src/state/store.ts`          |
| Native facade                    | `src/native/ObscuraModule.ts` |

## Checks

```bash
npm test
npm run typecheck
npm run lint
```
