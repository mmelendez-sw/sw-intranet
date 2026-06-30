import React, { useEffect, useState, useCallback } from 'react';
import { useMsal } from '@azure/msal-react';
import '../../styles/employee-directory.css';

interface GraphUser {
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

// ─── Fetch helpers ────────────────────────────────────────────────────────────

const DIRECTORY_SCOPES = ['User.Read.All'];
const ALLOWED_EMAIL_SUFFIX = '@symphonyinfra.com';
const ALLOWED_COMPANY = 'symphony';

const ACTIVE_USERS_URL =
  'https://graph.microsoft.com/v1.0/users' +
  '?$filter=accountEnabled%20eq%20true' +
  '&$count=true' +
  '&$top=999' +
  '&$select=id,displayName,givenName,surname,mail,jobTitle,department,companyName,accountEnabled';

function hasAllowedEmail(mail: string | null | undefined): boolean {
  return !!mail && mail.toLowerCase().endsWith(ALLOWED_EMAIL_SUFFIX);
}

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

async function getGraphToken(msalInstance: any): Promise<string | null> {
  const accounts = msalInstance.getAllAccounts();
  if (!accounts.length) return null;

  const account = accounts[0];
  const tokenRequest = { scopes: DIRECTORY_SCOPES, account };

  try {
    const result = await msalInstance.acquireTokenSilent(tokenRequest);
    return result.accessToken;
  } catch (silentError) {
    console.warn('[EmployeeDirectory] acquireTokenSilent failed, refreshing token', silentError);
  }

  try {
    const result = await msalInstance.acquireTokenSilent({ ...tokenRequest, forceRefresh: true });
    return result.accessToken;
  } catch (refreshError) {
    console.warn('[EmployeeDirectory] forceRefresh failed, trying popup', refreshError);
  }

  try {
    if (typeof msalInstance.acquireTokenPopup === 'function') {
      const result = await msalInstance.acquireTokenPopup(tokenRequest);
      return result.accessToken;
    }
  } catch (popupError) {
    console.error('[EmployeeDirectory] acquireTokenPopup failed:', popupError);
  }

  return null;
}

async function fetchUsers(token: string): Promise<GraphUser[]> {
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
        // hasAllowedEmail(u.mail) &&
        u.accountEnabled !== false &&
        hasFirstAndLastName(u) &&
        !isRoomResource(u) &&
        hasAllowedCompany(u)
    )
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

async function fetchPhoto(token: string, userId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/users/${userId}/photo/$value`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return null;
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const Avatar: React.FC<{ user: GraphUser }> = ({ user }) => {
  if (user.photoUrl) {
    return <img src={user.photoUrl} alt={user.displayName} className="directory-avatar" />;
  }
  const initials = user.displayName
    .split(' ')
    .slice(0, 2)
    .map(p => p[0])
    .join('')
    .toUpperCase();
  return <div className="directory-avatar-placeholder">{initials}</div>;
};

const SkeletonCards: React.FC = () => (
  <div className="directory-skeleton-grid">
    {Array.from({ length: 12 }).map((_, i) => (
      <div key={i} className="directory-skeleton-card">
        <div className="skeleton-circle" />
        <div className="skeleton-line" style={{ width: '70%' }} />
        <div className="skeleton-line" style={{ width: '50%' }} />
        <div className="skeleton-line" style={{ width: '40%' }} />
      </div>
    ))}
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

const EmployeeDirectory: React.FC = () => {
  const { instance } = useMsal();
  const [users, setUsers] = useState<GraphUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const loadDirectory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getGraphToken(instance);
      if (!token) {
        setError('Unable to load directory permissions. If prompted, approve access — you do not need to sign out. Otherwise ask IT to grant User.Read.All for this app.');
        return;
      }

      const rawUsers = await fetchUsers(token);
      setUsers(rawUsers);
      setLoading(false);

      // Load photos in the background — don't block the initial render
      const withPhotos = await Promise.all(
        rawUsers.map(async (u) => {
          const photoUrl = await fetchPhoto(token, u.id);
          return { ...u, photoUrl: photoUrl ?? undefined };
        })
      );
      setUsers(withPhotos);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load employee directory.');
    } finally {
      setLoading(false);
    }
  }, [instance]);

  useEffect(() => { loadDirectory(); }, [loadDirectory]);

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return (
      u.displayName.toLowerCase().includes(q) ||
      (u.department ?? '').toLowerCase().includes(q) ||
      (u.jobTitle ?? '').toLowerCase().includes(q) ||
      (u.mail ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="directory-page">
      <div className="directory-header">
        <h1>Employee Directory</h1>
        {/* <p>Active Symphony Towers Infrastructure team members (@symphonyinfra.com)</p> */}
      </div>

      <div className="directory-search-bar">
        <i className="fa-solid fa-magnifying-glass directory-search-icon" />
        <input
          type="search"
          placeholder="Search by name, department, or title…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
        />
      </div>

      {!loading && !error && (
        <div className="directory-stats">
          Showing {filtered.length} of {users.length} employees
          {search && <> matching "<strong>{search}</strong>"</>}
        </div>
      )}

      {loading && <SkeletonCards />}

      {error && (
        <div className="directory-empty">
          <strong>Could not load directory</strong>
          {error}
          <br />
          <button
            onClick={loadDirectory}
            style={{ marginTop: 14, padding: '8px 20px', background: '#0d6efd', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && users.length === 0 && !search && (
        <div className="directory-empty">
          <strong>No employees found</strong>
          No active users with @symphonyinfra.com email addresses were returned from Microsoft 365.
        </div>
      )}

      {!loading && !error && filtered.length === 0 && users.length > 0 && (
        <div className="directory-empty">
          <strong>No results</strong>
          No employees match "{search}".
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="directory-grid">
          {filtered.map(user => (
            <div key={user.id} className="directory-card">
              <Avatar user={user} />
              <div className="directory-card-name">{user.displayName}</div>
              {user.jobTitle && <div className="directory-card-title">{user.jobTitle}</div>}
              {user.department && <span className="directory-card-dept">{user.department}</span>}
              {user.mail && (
                <a href={`mailto:${user.mail}`} className="directory-card-email">
                  {user.mail}
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmployeeDirectory;
