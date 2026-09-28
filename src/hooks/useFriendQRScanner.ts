import { useEffect, useRef, useState } from 'react';
import { useBarcodeScanner, type Barcode, type Highlight } from '@mgcrea/vision-camera-barcode-scanner';
import { Worklets, useSharedValue } from 'react-native-worklets-core';
import { decodeFriendCode, parseFriendQR, type FriendCodeTarget } from '../friendQR';

/** How long a detected code stays on screen after it leaves the frame. */
const LINGER_MS = 2500;

export interface DetectedFriendQR extends FriendCodeTarget {
  code: string;
}

/**
 * Recognise Obscura friend QR codes in the main camera. Detection only: the caller shows the
 * result and the user decides whether to add the friend.
 *
 * Uses a frame-processor plugin rather than VisionCamera's built-in `codeScanner`, which cannot run
 * alongside the video output the record camera needs. Non-Obscura QR codes are ignored.
 *
 * `enabled` pauses scanning (e.g. while recording). Returns props to spread onto `<Camera>`, the
 * on-screen highlights for the detected code, and the detected friend (if any).
 */
export function useFriendQRScanner(enabled: boolean) {
  const enabledRef = useSharedValue(enabled);
  useEffect(() => { enabledRef.value = enabled; }, [enabled, enabledRef]);

  const [detected, setDetected] = useState<DetectedFriendQR | null>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The plugin creates its frame processor once and keeps the first callback, so the JS handler
  // must not depend on anything from a later render.
  const onValuesJS = useRef(Worklets.createRunOnJS((values: string[]) => {
    for (const value of values) {
      const code = parseFriendQR(value);
      const target = code ? decodeFriendCode(code) : null;
      if (!code || !target) continue;
      setDetected((prev) => (prev?.code === code ? prev : { code, ...target }));
      if (clearTimer.current) clearTimeout(clearTimer.current);
      clearTimer.current = setTimeout(() => setDetected(null), LINGER_MS);
      return;
    }
  })).current;

  useEffect(() => () => { if (clearTimer.current) clearTimeout(clearTimer.current); }, []);
  useEffect(() => { if (!enabled) setDetected(null); }, [enabled]);

  const { props, highlights } = useBarcodeScanner({
    fps: 10,
    barcodeTypes: ['qr'],
    scanMode: 'continuous',
    isMountedRef: enabledRef,
    onBarcodeScanned: (barcodes: Barcode[]) => {
      'worklet';
      const values: string[] = [];
      for (const b of barcodes) if (b.value) values.push(b.value);
      if (values.length > 0) onValuesJS(values);
    },
  });

  // The scanner reports boxes per frame, and a frame that misses the code reports none. Holding the
  // last box while the code counts as detected keeps it steady instead of blinking; a fixed key
  // lets it move rather than being re-created.
  const lastBox = useRef<Highlight | null>(null);
  if (highlights.length > 0) lastBox.current = { ...highlights[0], key: 'friend-qr' };
  if (!detected) lastBox.current = null;
  const shown: Highlight[] = lastBox.current ? [lastBox.current] : [];
  return { cameraProps: props, highlights: shown, detected, dismiss: () => setDetected(null) };
}
