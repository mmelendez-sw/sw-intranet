export interface UserInfo {
  isAuthenticated: boolean;
  isEliteGroup: boolean;
  isEditor: boolean;
  /** NetSuite Admin allowlist — used for Quick Link visibility */
  isNetSuiteAdmin?: boolean;
  email?: string;
  name?: string;
}
