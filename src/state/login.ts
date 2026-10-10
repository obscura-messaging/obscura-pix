import { Obscura } from '../native/ObscuraModule';
import { useStore } from './store';

/**
 * Logs in and connects, provisioning this phone as a device when the server has none for it.
 * Resolves `false` when the server rejected the username or password.
 */
export async function logIn(username: string, password: string): Promise<boolean> {
  const scenario = await Obscura.login(username, password);
  switch (scenario) {
    case 'existingDevice':
      break;
    case 'deviceMismatch':
      // The server no longer knows this phone's device, so start over as a fresh install would.
      await Obscura.wipeDevice();
      await Obscura.loginAndProvision(username, password);
      break;
    case 'newDevice':
      await Obscura.loginAndProvision(username, password);
      break;
    case 'invalidCredentials':
      return false;
    default:
      throw new Error(`Unexpected login outcome: ${scenario as string}`);
  }
  await Obscura.connect();
  useStore.getState().setAuthed(true);
  return true;
}
