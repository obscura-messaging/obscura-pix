import { logIn } from '../login';
import { useStore } from '../store';
import { getFakeBridge } from '../../native/__fixtures__/reactNativeMock';

const bridge = getFakeBridge();

beforeEach(() => {
  useStore.getState().reset();
});

describe('logIn', () => {
  it('connects an existing device without provisioning', async () => {
    expect(await logIn('alice', 'password-1234')).toBe(true);

    expect(bridge.__calls).toEqual(['login', 'connect']);
    expect(useStore.getState().authed).toBe(true);
  });

  it('provisions a new device, then connects', async () => {
    bridge.__setLoginScenario('newDevice');

    expect(await logIn('alice', 'password-1234')).toBe(true);

    expect(bridge.__calls).toEqual(['login', 'loginAndProvision', 'connect']);
    expect(useStore.getState().authed).toBe(true);
  });

  it('wipes a device the server no longer knows, then provisions and connects', async () => {
    bridge.__setLoginScenario('deviceMismatch');

    expect(await logIn('alice', 'password-1234')).toBe(true);

    expect(bridge.__calls).toEqual(['login', 'wipeDevice', 'loginAndProvision', 'connect']);
    expect(bridge.authState).toBe('authenticated');
    expect(useStore.getState().authed).toBe(true);
  });

  it('does not provision when the wipe fails', async () => {
    bridge.__setLoginScenario('deviceMismatch');
    bridge.__failNext('wipeDevice', 'WIPE_ERROR');

    await expect(logIn('alice', 'password-1234')).rejects.toMatchObject({ code: 'WIPE_ERROR' });

    expect(bridge.__calls).toEqual(['login', 'wipeDevice']);
    expect(useStore.getState().authed).toBe(false);
  });

  it('reports rejected credentials without touching the device', async () => {
    bridge.__setLoginScenario('invalidCredentials');

    expect(await logIn('alice', 'password-1234')).toBe(false);

    expect(bridge.__calls).toEqual(['login']);
    expect(useStore.getState().authed).toBe(false);
  });
});
