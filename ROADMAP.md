# Roadmap

What's built, what's next.

## Done

- [x] Auth (register, login, session restore)
- [x] Friends (codes, add, accept, pending/accepted states)
- [x] Chat (encrypted messages, conversation-scoped)
- [x] Typing indicators (animated dots, cross-platform)
- [x] Stories (post, feed) — **but they do not expire**, see below
- [x] Profiles (display name, bio, synced to friends)
- [x] Encrypted attachments (upload, download, AES-GCM)
- [x] Auto-reconnect (ping keepalive, exponential backoff)
- [x] Session persistence (survives app restart)
- [x] Debug log (in-app, Profile tab)
- [x] **Camera + send photo** — vision-camera + photo preview + recipient picker
- [x] **Ephemeral pix viewing** — view-once with display-duration timer + opened/delivered status
- [x] **Disappearing messages** — messages and pix erase on every device 15 minutes after
      the recipient sees them (30 days if never seen), driven by seen receipts
- [x] **Android push notifications** — FCM silent wakes, generic local notifications, and a
      broad chat-list destination on tap
- [x] **React Navigation** — native-stack + bottom tabs, real back stack
- [x] **Zustand state** — single store + useModelEntries hook, no prop-drilling
- [x] **App-owned domain** — merge, audience resolution and the inbox drain in TypeScript
      (`src/domain/`)

## Current gaps

- [ ] **24-hour story expiry.** Nothing expires on either platform.
- [ ] **Device linking UI.** The kits and both bridges support linking
      (`generateLinkCode`, `validateAndApproveLink`), but the app has no screen
      for it. A new iOS device cannot receive link approval.
- [ ] **iOS push and release gate.** See [`docs/IOS_PARITY.md`](docs/IOS_PARITY.md).

## Phase 2: Ephemeral viewing polish

- [ ] 1x or 2x view option (sender chooses)
- [ ] Screenshot detection + notification to sender

## Phase 3: Rich Chat

- [ ] Send photos in chat (inline, not just Pix)
- [ ] Voice notes (record + send as encrypted attachment)
- [ ] "Screenshotted" status in chat

## Phase 4: Stories V2

- [ ] Multiple snaps per story (swipeable)
- [ ] View count + who viewed
- [ ] Reply to story (opens chat with that friend)
- [ ] Close friends / custom audience for stories

## Phase 5: Streaks

- [ ] Daily snap exchange counter per friend
- [ ] Fire emoji + streak count display
- [ ] Streak expiry warning (approaching 24h without exchange)
- [ ] Streak reminders via push notification

## Not Planned

- AR filters / lenses
- Drawing on photos
- Video calls
- Snap Map / location
- Memories / saved snaps
- Bitmoji
- Snap score
- Chat wallpapers
