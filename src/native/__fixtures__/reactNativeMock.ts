/**
 * The `react-native` module as Jest sees it, so tests exercise the real `ObscuraModule.ts` against
 * `FakeObscuraBridge`. Implements only what the tested modules touch.
 */

import { FakeObscuraBridge } from './FakeObscuraBridge';

/**
 * One bridge instance for the whole module registry, mutated in place between tests.
 *
 * A singleton rather than a per-test instance because `ObscuraModule.ts` captures the reference at
 * import and caches a `NativeEventEmitter` built from it; a fresh instance per test would leave the
 * module talking to the previous one. `FakeObscuraBridge.__reset()` exists to make this safe.
 */
export const fakeBridge = new FakeObscuraBridge();

/** The fake the module under test is talking to. */
export function getFakeBridge(): FakeObscuraBridge {
  return fakeBridge;
}

export const TurboModuleRegistry = {
  get(name: string): unknown {
    return name === 'ObscuraBridge' ? fakeBridge : null;
  },
  getEnforcing(name: string): unknown {
    const m = TurboModuleRegistry.get(name);
    if (!m) throw new Error(`TurboModuleRegistry.getEnforcing(${name}): not found in the RN mock`);
    return m;
  },
};

/**
 * Minimal `NativeEventEmitter`.
 *
 * The real one requires the native module to expose `addListener` / `removeListeners`; the fake
 * bridge implements both, and this delegates to them, so the subscribe/unsubscribe path that
 * `onObscuraEvent` depends on is genuinely exercised rather than stubbed.
 */
export class NativeEventEmitter {
  constructor(private readonly nativeModule: FakeObscuraBridge) {}

  addListener(eventName: string, handler: (event: any) => void): { remove: () => void } {
    return this.nativeModule.addListener(eventName, handler);
  }
}

export const Platform = { OS: 'ios', select: (o: Record<string, unknown>) => o.ios ?? o.default };
