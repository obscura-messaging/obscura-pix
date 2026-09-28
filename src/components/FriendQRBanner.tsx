import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Obscura } from '../native/ObscuraModule';
import { useStore } from '../state/store';
import { toast } from './Toast';
import type { DetectedFriendQR } from '../hooks/useFriendQRScanner';
import { colors } from '../styles';

/**
 * Shown over the camera when a friend QR code is in view. Adding is the user's choice: nothing is
 * sent until they tap Add.
 */
export function FriendQRBanner({ detected, top, onDone }: {
  detected: DetectedFriendQR;
  top: number;
  onDone: () => void;
}) {
  const myUserId = useStore((s) => s.myUserId);
  const isFriend = useStore((s) => s.friends.some((f) => f.userId === detected.userId));
  const isPending = useStore((s) => s.pending.some((f) => f.userId === detected.userId));
  const [sending, setSending] = useState(false);

  const status = detected.userId === myUserId ? "That's your code"
    : isFriend ? 'Already friends'
    : isPending ? 'Request pending'
    : null;

  const add = async () => {
    setSending(true);
    try {
      await Obscura.addFriendByCode(detected.code);
      toast.success(`Friend request sent to ${detected.username}`);
      onDone();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={[fb.banner, { top }]}>
      <View style={fb.textCol}>
        <Text style={fb.label}>Friend code</Text>
        <Text style={fb.name} numberOfLines={1}>{detected.username}</Text>
      </View>
      {status ? (
        <Text style={fb.status}>{status}</Text>
      ) : (
        <TouchableOpacity style={fb.addBtn} onPress={add} disabled={sending} accessibilityLabel="Add friend from QR">
          <Text style={fb.addText}>{sending ? 'Adding…' : 'Add'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const fb = StyleSheet.create({
  banner: {
    position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 16, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.78)',
  },
  textCol: { flex: 1, marginRight: 12 },
  label: { color: '#bbb', fontSize: 12, fontWeight: '600' },
  name: { color: '#fff', fontSize: 17, fontWeight: '700', marginTop: 2 },
  status: { color: '#bbb', fontSize: 14, fontWeight: '600' },
  addBtn: { backgroundColor: colors.accent, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 20 },
  addText: { color: colors.onAccent, fontSize: 15, fontWeight: '700' },
});
