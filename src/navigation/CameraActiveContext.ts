import { createContext, useContext } from 'react';

/**
 * Whether the record-camera tab should keep its VisionCamera session live.
 *
 * MainTabs provides this as `MainTabs-is-focused && app-is-foreground`:
 *   - stays true across a left/right tab swipe (both tabs live under the same
 *     focused MainTabs), so the camera preview slides in live instead of black;
 *   - flips false when a modal is pushed over MainTabs (e.g. PhotoPreview),
 *     or when the app backgrounds
 *     (screen lock), which is what fixes the black-preview-after-unlock bug.
 *
 * Defaults to true so CameraScreen still works if rendered without a provider.
 */
export const CameraActiveContext = createContext<boolean>(true);

export function useCameraActive(): boolean {
  return useContext(CameraActiveContext);
}
