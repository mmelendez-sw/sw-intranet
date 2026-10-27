import React, { useEffect, useState } from 'react';
import { useMsal } from '@azure/msal-react';
import { ICEMAN_USAGE_URL } from '../authConfig';
import { intranetApiFetch } from '../services/intranetApi';

/** GET /api/iceman/usage (mirrors IcemanUsage in server/icemanUsage.ts). */
type IcemanUsageData = {
  days: number;
  totals: { runs: number; sites: number; users: number };
  users: { email: string; runs: number; sites: number; lastRunAt: string }[];
  recent: { at: string; email: string; rows: number; seconds: number; mb: number }[];
};

const shortName = (email: string) => email.replace(/@.*$/, '');

const when = (iso: string) =>
  new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** ICEMAN admins only (ICEMAN_ADMIN_ALLOWLIST): who ran it and how many sites, from the Lambda logs. */
const IcemanUsage: React.FC = () => {
  const { instance } = useMsal();
  const [usage, setUsage] = useState<IcemanUsageData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    intranetApiFetch(instance, ICEMAN_USAGE_URL, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`usage request failed (${res.status})`);
        return (await res.json()) as IcemanUsageData;
      })
      .then((data) => {
        if (!cancelled) setUsage(data);
      })
      .catch((err) => {
        console.warn('[IcemanUsage]', err);
        if (!cancelled) setError("Couldn't load usage. Check the [iceman] entries in CloudWatch.");
      });
    return () => {
      cancelled = true;
    };
  }, [instance]);

  return (
    <section className="iceman-guide iceman-usage" aria-labelledby="iceman-usage-heading">
      <h3 id="iceman-usage-heading">
        Usage{usage ? `, last ${usage.days} days` : ''}
        <span className="iceman-usage-note"> · visible to ICEMAN admins only</span>
      </h3>
      {error && <p className="iceman-usage-empty">{error}</p>}
      {!usage && !error && <p className="iceman-usage-empty">Loading…</p>}
      {usage && usage.totals.runs === 0 && <p className="iceman-usage-empty">No runs yet.</p>}
      {usage && usage.totals.runs > 0 && (
        <>
          <p className="iceman-usage-totals">
            <strong>{usage.totals.runs}</strong> runs · <strong>{usage.totals.sites}</strong> sites ·{' '}
            <strong>{usage.totals.users}</strong> {usage.totals.users === 1 ? 'person' : 'people'}
          </p>
          <div className="iceman-usage-tables">
            <table className="iceman-usage-table">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Runs</th>
                  <th>Sites</th>
                  <th>Last run</th>
                </tr>
              </thead>
              <tbody>
                {usage.users.map((u) => (
                  <tr key={u.email}>
                    <td title={u.email}>{shortName(u.email)}</td>
                    <td>{u.runs}</td>
                    <td>{u.sites}</td>
                    <td>{when(u.lastRunAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <table className="iceman-usage-table">
              <thead>
                <tr>
                  <th>Recent run</th>
                  <th>Person</th>
                  <th>Sites</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {usage.recent.map((r) => (
                  <tr key={`${r.at}-${r.email}`}>
                    <td>{when(r.at)}</td>
                    <td title={r.email}>{shortName(r.email)}</td>
                    <td>{r.rows}</td>
                    <td>{r.seconds.toFixed(0)} s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
};

export default IcemanUsage;
