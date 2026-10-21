import React, { useEffect, useState } from 'react';
import { useMsal } from '@azure/msal-react';
import '../../styles/salesforce-health.css';
import { BYPASS_AUTH, SALESFORCE_HEALTH_URL, isSalesforceAdminAllowlisted } from '../authConfig';
import { intranetApiFetch } from '../services/intranetApi';
import { UserInfo } from '../types/user';

/** Mirrors SalesforceHealth in server/salesforce.ts. */
interface SalesforceHealth {
  ok: boolean;
  problem?: 'password_expired' | 'login_failed' | 'check_failed';
  checkedAt: string;
  passwordChangedAt?: string;
  passwordExpiresInDays?: number;
}

/** Start warning this many days before the integration password expires. */
const WARN_DAYS = 14;
/** Dismissing hides the banner for the rest of the browser session. */
const DISMISS_KEY = 'salesforce-health-dismissed';

/** BYPASS_AUTH has no Lambda token; show the near-expiry state so the banner can be reviewed. */
const MOCK_HEALTH: SalesforceHealth = {
  ok: true,
  checkedAt: new Date().toISOString(),
  passwordChangedAt: new Date(Date.now() - 84 * 24 * 60 * 60 * 1000).toISOString(),
  passwordExpiresInDays: 6,
};

const FIX_STEPS =
  'Reset the integration user\'s password in Salesforce (or turn on "Password Never Expires" on its profile), ' +
  'then update SF_PASSWORD and SF_SECURITY_TOKEN on the sw-intranet-api Lambda.';

function describe(health: SalesforceHealth): { tone: 'error' | 'warn'; title: string; body: string } | null {
  if (!health.ok) {
    if (health.problem === 'password_expired') {
      return { tone: 'error', title: 'Salesforce integration password has expired.', body: `The leaderboard can't load. ${FIX_STEPS}` };
    }
    if (health.problem === 'login_failed') {
      return {
        tone: 'error',
        title: 'Salesforce integration sign-in is failing.',
        body: `Salesforce rejected the integration user's login. ${FIX_STEPS} CloudWatch has the exact fault.`,
      };
    }
    return { tone: 'error', title: "Couldn't check the Salesforce integration.", body: 'See the [salesforce] entries in the sw-intranet-api CloudWatch logs.' };
  }
  const days = health.passwordExpiresInDays;
  if (days !== undefined && days <= WARN_DAYS) {
    const when = days <= 0 ? 'today' : `in ${days} day${days === 1 ? '' : 's'}`;
    return { tone: 'warn', title: `Salesforce integration password expires ${when}.`, body: FIX_STEPS };
  }
  return null;
}

/** Admin-only warning for the Salesforce integration user (see SALESFORCE_ADMIN_ALLOWLIST). */
const SalesforceHealthBanner: React.FC<{ userInfo: UserInfo }> = ({ userInfo }) => {
  const { instance } = useMsal();
  const isAdmin = userInfo.isAuthenticated && isSalesforceAdminAllowlisted(userInfo.email);
  const [health, setHealth] = useState<SalesforceHealth | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!isAdmin || dismissed) return;
    if (BYPASS_AUTH) {
      setHealth(MOCK_HEALTH);
      return;
    }
    let cancelled = false;
    intranetApiFetch(instance, SALESFORCE_HEALTH_URL, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: SalesforceHealth | null) => {
        if (!cancelled && data) setHealth(data);
      })
      .catch(() => {
        /* the Lambda itself is down; the leaderboard shows its own notice */
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, dismissed, instance]);

  const message = isAdmin && !dismissed && health ? describe(health) : null;
  if (!message) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* storage blocked — hidden until reload */
    }
  };

  return (
    <div className={`sf-health-banner is-${message.tone}`} role="alert">
      <i className="fa-solid fa-triangle-exclamation sf-health-icon" aria-hidden="true" />
      <div className="sf-health-text">
        <strong>{message.title}</strong> {message.body}
        <span className="sf-health-meta"> Visible to Salesforce admins only.</span>
      </div>
      <button type="button" className="sf-health-dismiss" onClick={dismiss} aria-label="Dismiss">
        &times;
      </button>
    </div>
  );
};

export default SalesforceHealthBanner;
