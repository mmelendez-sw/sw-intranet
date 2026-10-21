import React, { useState } from 'react';
import '../../styles/pipeline-mockup.css';
import { MOCK_MY_PIPELINE } from '../data/pipelineMock';

/** Preview of an AM's own Salesforce pipeline (sample data; /dev only). */
const MyPipelineCard: React.FC = () => {
  const p = MOCK_MY_PIPELINE;
  const [showHow, setShowHow] = useState(false);
  const max = Math.max(...p.stages.map((s) => s.count));

  return (
    <section className="pipeline-card" aria-labelledby="pipeline-card-heading">
      <header className="pipeline-card-header">
        <div>
          <h2 id="pipeline-card-heading">My Pipeline</h2>
          <p>
            {p.amName} · {p.monthLabel}
          </p>
        </div>
        <span className="pipeline-mock-badge">Mockup · sample data</span>
      </header>

      <div className="pipeline-stats">
        <div className="pipeline-stat">
          <strong>{p.openCount}</strong>
          <span>Open opportunities</span>
        </div>
        <div className="pipeline-stat">
          <strong>{p.termSheetsSignedThisMonth}</strong>
          <span>Term sheets signed this month · #{p.leaderboardRank} on the leaderboard</span>
        </div>
        <div className="pipeline-stat">
          <strong>{p.closedThisMonth}</strong>
          <span>Closed this month</span>
        </div>
      </div>

      <h3 className="pipeline-subhead">Open deals by stage</h3>
      <ul className="pipeline-stages">
        {p.stages.map((s) => (
          <li key={s.stage}>
            <span className="pipeline-stage-name">{s.stage}</span>
            <span className="pipeline-stage-bar">
              <span style={{ width: `${(s.count / max) * 100}%` }} />
            </span>
            <span className="pipeline-stage-count">{s.count}</span>
          </li>
        ))}
      </ul>

      <h3 className="pipeline-subhead">Needs attention</h3>
      <ul className="pipeline-attention">
        {p.attention.map((d) => (
          <li key={d.name}>
            <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
            <span>
              <strong>{d.name}</strong> · {d.city} · {d.stage}
              <em>{d.note}</em>
            </span>
          </li>
        ))}
      </ul>

      <footer className="pipeline-card-footer">
        <button type="button" className="pipeline-how-btn" onClick={() => setShowHow((v) => !v)} aria-expanded={showHow}>
          {showHow ? 'Hide' : 'How this would work'}
        </button>
        <a href="https://symphonyinfra.my.salesforce.com/lightning/o/Opportunity/list" target="_blank" rel="noreferrer">
          Open in Salesforce
        </a>
      </footer>

      {showHow && (
        <div className="pipeline-how">
          <p>
            A new signed-in Lambda route, <code>/api/salesforce/my-pipeline</code>, reads the user's email from their
            Entra token (so nobody can ask for someone else's pipeline) and runs, with the integration user:
          </p>
          <pre>{`SELECT StageName, COUNT(Id) FROM Opportunity
WHERE Acquisition_Advisor_Manager__r.Email = :email
  AND IsClosed = false
GROUP BY StageName`}</pre>
          <p>
            Term sheets reuse the leaderboard query (<code>Term_Sheet_Signed_Date__c = THIS_MONTH</code>, Proprietary).
            Closed this month counts <code>StageName = 'Asset Acquired'</code> with{' '}
            <code>Current_Investment_Date__c = THIS_MONTH</code>. "Needs attention" flags{' '}
            <code>Term_Sheet_Expiration_Date__c</code> within 14 days, <code>LastStageChangeInDays</code> over 45, and
            diligence statuses (<code>Title_Status__c</code>, <code>Survey_Status__c</code>) not started. Cached 5
            minutes per user, like the leaderboard. Shown only to Acquisitions Managers.
          </p>
        </div>
      )}
    </section>
  );
};

export default MyPipelineCard;
