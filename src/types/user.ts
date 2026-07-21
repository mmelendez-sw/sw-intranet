export interface UserInfo {
  isAuthenticated: boolean;
  isEliteGroup: boolean;
  hasPowerBILicense?: boolean; // Add Power BI license check
  email?: string;
  name?: string;
} 