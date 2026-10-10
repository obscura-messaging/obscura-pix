import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Friend } from '../native/ObscuraModule';
import type { RootStackParamList, StoryGroup } from './types';
import type { Entry } from '../domain/merge';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Open the shared StoryViewer on a set of view-once pix from a single sender.
 *
 * Entries are shown oldest-first so the viewer opens on the first unopened pix
 * and taps forward to the newest. `markViewed` fires a `viewedAt` receipt per
 * pix as the viewer advances, and (in the viewer) disables backward tap-nav so
 * a consumed pix can't be re-viewed.
 *
 * `sender` comes from the friend graph, never from the payload, whose names the peer chooses.
 */
export function openPixViewer(nav: Nav, sender: Friend, entries: Entry[]) {
  if (entries.length === 0) return;
  const stories = [...entries].sort((a, b) => a.sentAt - b.sentAt);
  const group: StoryGroup = {
    userId: sender.userId,
    username: sender.username,
    stories,
    isMe: false,
  };
  nav.navigate('StoryViewer', { groups: [group], startIndex: 0, markViewed: true });
}
