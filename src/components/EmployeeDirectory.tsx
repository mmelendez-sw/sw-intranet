import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useMsal } from '@azure/msal-react';
import '../../styles/employee-directory.css';
import { BYPASS_AUTH } from '../authConfig';
import { MOCK_DIRECTORY_USERS } from '../data/mockContent';
import { GraphUser, getDirectoryToken, getDirectoryUsersCached } from '../services/directoryService';

// ─── Fetch helpers ────────────────────────────────────────────────────────────

/** Avatars render at ~72 px, so ask Graph for its 96×96 rendition, not the 648 px original. */
const PHOTO_SIZE = '96x96';
/** Parallel photo downloads — enough to fill the grid fast without tripping Graph throttling. */
const PHOTO_CONCURRENCY = 6;

async function fetchPhoto(token: string, userId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/users/${userId}/photos/${PHOTO_SIZE}/$value`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return null;
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

/** Run `worker` over `items` with at most `limit` in flight; results arrive via `onResult`. */
async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
  onResult: (item: T, result: R) => void
): Promise<void> {
  let next = 0;
  const lane = async () => {
    while (next < items.length) {
      const item = items[next++];
      onResult(item, await worker(item));
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane));
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
  /** Object URLs created for avatars this mount; revoked on unmount / reload. */
  const photoUrlsRef = useRef<string[]>([]);
  const loadGenerationRef = useRef(0);

  const releasePhotoUrls = useCallback(() => {
    photoUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    photoUrlsRef.current = [];
  }, []);

  const loadDirectory = useCallback(async () => {
    const generation = ++loadGenerationRef.current;
    const isCurrent = () => loadGenerationRef.current === generation;
    releasePhotoUrls();
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

      // Shared with the homepage/sidebar birthday cross-reference: one /users download per page load.
      const rawUsers = await getDirectoryUsersCached(instance);
      if (!isCurrent()) return;
      if (!rawUsers) {
        setError('Failed to load employee directory.');
        return;
      }
      setUsers(rawUsers);
      setLoading(false);

      // Photos stream in a few at a time and each card updates as its own photo lands,
      // instead of one re-render after the slowest of ~100 downloads.
      await runWithConcurrency(
        rawUsers,
        PHOTO_CONCURRENCY,
        (u) => fetchPhoto(token, u.id),
        (u, photoUrl) => {
          if (!photoUrl) return;
          if (!isCurrent()) {
            URL.revokeObjectURL(photoUrl);
            return;
          }
          photoUrlsRef.current.push(photoUrl);
          setUsers((current) => current.map((x) => (x.id === u.id ? { ...x, photoUrl } : x)));
        }
      );
    } catch (err: any) {
      if (isCurrent()) setError(err.message ?? 'Failed to load employee directory.');
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [instance, releasePhotoUrls]);

  useEffect(() => { loadDirectory(); }, [loadDirectory]);
  useEffect(() => () => {
    loadGenerationRef.current++;
    releasePhotoUrls();
  }, [releasePhotoUrls]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return users;
    return users.filter(u =>
      u.displayName.toLowerCase().includes(q) ||
      (u.department ?? '').toLowerCase().includes(q) ||
      (u.jobTitle ?? '').toLowerCase().includes(q) ||
      (u.mail ?? '').toLowerCase().includes(q)
    );
  }, [users, search]);

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
