/**
 * Active employee directory (Microsoft Graph /users) shared by /directory and the
 * birthday cross-reference. Requires User.Read.All; under BYPASS_AUTH returns mock users.
 */
import { BYPASS_AUTH } from '../authConfig';
import { MOCK_DIRECTORY_USERS } from '../data/mockContent';
import { acquireTokenSilentOnly, DIRECTORY_SCOPES } from '../utils/msalToken';

export interface GraphUser {
  id: string;
  displayName: string;
  givenName?: string | null;
  surname?: string | null;
  jobTitle: string | null;
  department: string | null;
  companyName?: string | null;
  mail: string | null;
  accountEnabled?: boolean;
  photoUrl?: string; // resolved client-side
}

const ALLOWED_COMPANY = 'symphony';

const ACTIVE_USERS_URL =
  'https://graph.microsoft.com/v1.0/users' +
  '?$filter=accountEnabled%20eq%20true' +
  '&$count=true' +
  '&$top=999' +
  '&$select=id,displayName,givenName,surname,mail,jobTitle,department,companyName,accountEnabled';

function hasFirstAndLastName(user: GraphUser): boolean {
  const given = user.givenName?.trim();
  const family = user.surname?.trim();
  if (given && family) return true;

  const parts = user.displayName.trim().split(/\s+/).filter((p) => p.length > 0);
  return parts.length >= 2;
}

function isRoomResource(user: GraphUser): boolean {
  return user.displayName.trim().toLowerCase().startsWith('room -');
}

function hasAllowedCompany(user: GraphUser): boolean {
  return user.companyName?.trim().toLowerCase() === ALLOWED_COMPANY;
}

function hasJobTitle(user: GraphUser): boolean {
  return !!user.jobTitle?.trim();
}

function isConsultant(user: GraphUser): boolean {
  return (user.jobTitle ?? '').toLowerCase().includes('(consultant)');
}

/** Consultants and contractors are excluded from birthday announcements. */
export function isContractorOrConsultant(user: GraphUser): boolean {
  const title = (user.jobTitle ?? '').toLowerCase();
  return isConsultant(user) || title.includes('contractor') || title.includes('consultant');
}

export async function getDirectoryToken(msalInstance: any): Promise<string | null> {
  return acquireTokenSilentOnly(msalInstance, DIRECTORY_SCOPES);
}

/** Active Symphony employees as shown on /directory (sorted by display name). */
export async function fetchDirectoryUsers(token: string): Promise<GraphUser[]> {
  const users: GraphUser[] = [];
  let url: string | null = ACTIVE_USERS_URL;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ConsistencyLevel: 'eventual',
  };

  while (url) {
    const res: Response = await fetch(url, { headers });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`/users failed: ${res.status}${body ? ` — ${body.slice(0, 240)}` : ''}`);
    }
    const data: { value?: GraphUser[]; '@odata.nextLink'?: string } = await res.json();
    users.push(...(data.value ?? []));
    url = data['@odata.nextLink'] ?? null;
  }

  return users
    .filter(
      (u) =>
        u.displayName &&
        u.accountEnabled !== false &&
        hasFirstAndLastName(u) &&
        !isRoomResource(u) &&
        hasAllowedCompany(u) &&
        hasJobTitle(u) &&
        !isConsultant(u)
    )
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

let cachedUsers: GraphUser[] | null = null;
let pendingUsers: Promise<GraphUser[] | null> | null = null;

/**
 * Directory users, fetched once per page load and shared by all callers.
 * Returns null when the directory can't be read (no consent / token) so callers can degrade.
 */
export function getDirectoryUsersCached(msalInstance: any): Promise<GraphUser[] | null> {
  if (BYPASS_AUTH) return Promise.resolve(MOCK_DIRECTORY_USERS);
  if (cachedUsers) return Promise.resolve(cachedUsers);
  if (pendingUsers) return pendingUsers;

  pendingUsers = (async () => {
    try {
      const token = await getDirectoryToken(msalInstance);
      if (!token) return null;
      cachedUsers = await fetchDirectoryUsers(token);
      return cachedUsers;
    } catch (err) {
      console.warn('[directoryService] directory load failed:', err);
      return null;
    } finally {
      pendingUsers = null;
    }
  })();
  return pendingUsers;
}
