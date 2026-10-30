import { applyPrivacy, INTERNET_PERMISSION, networkAllowed } from '../privacy';

describe('privacy rule of the build', () => {
  it('blocks INTERNET by default and keeps the camera permission', () => {
    const out = applyPrivacy({ permissions: ['android.permission.CAMERA', INTERNET_PERMISSION] }, {});
    expect(out.permissions).toEqual(['android.permission.CAMERA']);
    expect(out.blockedPermissions).toContain(INTERNET_PERMISSION);
  });

  it('keeps INTERNET available only when SENDERO_DEV_NETWORK is exactly "1"', () => {
    expect(networkAllowed({ SENDERO_DEV_NETWORK: '1' })).toBe(true);
    expect(networkAllowed({ SENDERO_DEV_NETWORK: 'true' })).toBe(false);
    const out = applyPrivacy({ blockedPermissions: [INTERNET_PERMISSION] }, { SENDERO_DEV_NETWORK: '1' });
    expect(out.blockedPermissions).not.toContain(INTERNET_PERMISSION);
  });

  it('never requests INTERNET, even in a debug session', () => {
    const out = applyPrivacy({ permissions: [INTERNET_PERMISSION] }, { SENDERO_DEV_NETWORK: '1' });
    expect(out.permissions).not.toContain(INTERNET_PERMISSION);
  });

  it('keeps other blocked permissions', () => {
    const out = applyPrivacy({ blockedPermissions: ['android.permission.RECORD_AUDIO'] }, {});
    expect(out.blockedPermissions).toEqual(['android.permission.RECORD_AUDIO', INTERNET_PERMISSION]);
  });
});
