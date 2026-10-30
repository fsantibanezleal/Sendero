type KioskModule = typeof import('../kiosk');
// Dynamic import needs a VM flag in Jest; require re-evaluates the module after resetModules.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const load = (): KioskModule => require('../kiosk');

describe('kiosk wrapper without the native module', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('imports without crashing and degrades to off and no-ops', async () => {
    const kiosk = load();
    expect(kiosk.isDeviceOwner()).toBe(false);
    expect(kiosk.kioskState()).toBe('off');
    expect(kiosk.isKioskEnabled()).toBe(false);
    expect(kiosk.externalMusicDirectory()).toBe('');
    expect(() => kiosk.setKioskEnabled(true)).not.toThrow();
    await expect(kiosk.exitKiosk()).resolves.toBeUndefined();
    await expect(kiosk.releaseDeviceOwner()).resolves.toBeUndefined();
  });

  it('rejects enterKiosk with "kiosk module unavailable"', async () => {
    const kiosk = load();
    await expect(kiosk.enterKiosk()).rejects.toThrow('kiosk module unavailable');
  });
});

describe('kiosk wrapper with a native module', () => {
  const native = {
    isDeviceOwner: jest.fn(() => true),
    kioskState: jest.fn(() => 'locked'),
    enterKiosk: jest.fn(async () => 'locked'),
    exitKiosk: jest.fn(async () => undefined),
    releaseDeviceOwner: jest.fn(async () => undefined),
    externalMusicDirectory: jest.fn(() => '/storage/emulated/0/Android/data/x/files/music'),
    setKioskEnabled: jest.fn(),
    isKioskEnabled: jest.fn(() => true),
  };

  beforeEach(() => {
    jest.resetModules();
    jest.doMock('expo-modules-core', () => ({
      ...jest.requireActual('expo-modules-core'),
      requireOptionalNativeModule: () => native,
    }));
  });

  afterEach(() => {
    jest.dontMock('expo-modules-core');
  });

  it('forwards every call to the native module', async () => {
    const kiosk = load();
    expect(kiosk.isDeviceOwner()).toBe(true);
    expect(kiosk.kioskState()).toBe('locked');
    await expect(kiosk.enterKiosk()).resolves.toBe('locked');
    await kiosk.exitKiosk();
    await kiosk.releaseDeviceOwner();
    expect(kiosk.externalMusicDirectory()).toContain('music');
    kiosk.setKioskEnabled(false);
    expect(native.setKioskEnabled).toHaveBeenCalledWith(false);
    expect(kiosk.isKioskEnabled()).toBe(true);
    expect(native.exitKiosk).toHaveBeenCalledTimes(1);
    expect(native.releaseDeviceOwner).toHaveBeenCalledTimes(1);
  });
});
