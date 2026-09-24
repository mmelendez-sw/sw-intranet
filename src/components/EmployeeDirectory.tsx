import React, { useEffect, useState, useCallback } from 'react';
import { useMsal } from '@azure/msal-react';
import '../../styles/employee-directory.css';
import { BYPASS_AUTH } from '../authConfig';
import { MOCK_DIRECTORY_USERS } from '../data/mockContent';
import { GraphUser, fetchDirectoryUsers, getDirectoryToken } from '../services/directoryService';

// ─── Fetch helpers ────────────────────────────────────────────────────────────

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
    if (BYPASS_AUTH) {
      setUsers(MOCK_DIRECTORY_USERS);
      setLoading(false);
      return;
    }
    try {
      const token = await getDirectoryToken(instance);
      if (!token) {
        setError('Unable to load directory permissions. If prompted, approve access — you do not need to sign out. Otherwise ask IT to grant User.Read.All for this app.');
        return;
      }

      const rawUsers = await fetchDirectoryUsers(token);
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
