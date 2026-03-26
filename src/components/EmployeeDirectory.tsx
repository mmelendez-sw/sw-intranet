import React, { useEffect, useState, useCallback } from 'react';
import { useMsal } from '@azure/msal-react';
import '../../styles/employee-directory.css';

interface GraphUser {
  id: string;
  displayName: string;
  jobTitle: string | null;
  department: string | null;
  mail: string | null;
  photoUrl?: string; // resolved client-side
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

async function getGraphToken(msalInstance: any): Promise<string | null> {
  try {
    const accounts = msalInstance.getAllAccounts();
    if (!accounts.length) return null;
    const result = await msalInstance.acquireTokenSilent({
      scopes: ['User.ReadBasic.All'],
      account: accounts[0],
    });
    return result.accessToken;
  } catch {
    return null;
  }
}

async function fetchUsers(token: string): Promise<GraphUser[]> {
  const res = await fetch(
    "https://graph.microsoft.com/v1.0/users?$select=id,displayName,jobTitle,department,mail&$top=100&$filter=accountEnabled eq true&$orderby=displayName",
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`/users failed: ${res.status}`);
  const data = await res.json();
  return (data.value as GraphUser[]).filter(u => u.mail); // exclude service accounts
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
        setError('Unable to authenticate with Microsoft Graph. Please sign in again.');
        return;
      }

      const rawUsers = await fetchUsers(token);
      setUsers(rawUsers);
      setLoading(false);

      // Load photos lazily — don't block the initial render
      const withPhotos = await Promise.all(
        rawUsers.map(async (u) => {
          const photoUrl = await fetchPhoto(token, u.id);
          return { ...u, photoUrl: photoUrl ?? undefined };
        })
      );
      setUsers(withPhotos);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load employee directory.');
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
        <p>All active Symphony Towers Infrastructure team members</p>
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

      {!loading && !error && filtered.length === 0 && (
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
