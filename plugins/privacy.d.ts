export interface AndroidPermissionConfig {
  permissions?: string[];
  blockedPermissions?: string[];
}

export declare const INTERNET_PERMISSION: 'android.permission.INTERNET';
export declare const DEV_NETWORK_FLAG: 'SENDERO_DEV_NETWORK';
export declare function networkAllowed(env: Record<string, string | undefined>): boolean;
export declare function applyPrivacy<T extends AndroidPermissionConfig>(
  android: T,
  env: Record<string, string | undefined>,
): T & { permissions: string[]; blockedPermissions: string[] };
