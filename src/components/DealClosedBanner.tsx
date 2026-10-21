import React, { useState } from 'react';
import '../../styles/pipeline-mockup.css';
import { MOCK_CLOSED_TODAY } from '../data/pipelineMock';

/**
 * Preview (sample data; /dev only): company-wide celebration when a Proprietary deal's
 * Current_Investment_Date__c is today. The AM who closed it gets a personal line.
 */
const DealClosedBanner: React.FC<{ viewerName?: string }> = ({ viewerName }) => {
  const [hidden, setHidden] = useState(false);
  if (hidden || !MOCK_CLOSED_TODAY.length) return null;

  return (
    <div className="deal-closed-banner" role="status">
      <span className="deal-closed-icon" aria-hidden="true">🎉</span>
      <div className="deal-closed-text">
        {MOCK_CLOSED_TODAY.map((d) => (
          <p key={d.name}>
            <strong>Deal closed today:</strong> {d.name} ({d.city}) · {d.sourceType} · {d.amName}
            {viewerName && viewerName === d.amName && <span className="deal-closed-you"> Congratulations, {viewerName.split(' ')[0]}!</span>}
          </p>
        ))}
        <p className="deal-closed-how">
          Mockup. Live version: <code>Source_Type__c = 'Proprietary' AND Current_Investment_Date__c = TODAY</code>,
          checked by the Lambda every 5 minutes; shown to everyone until midnight, dismissible.
        </p>
      </div>
      <button type="button" className="deal-closed-dismiss" onClick={() => setHidden(true)} aria-label="Dismiss">
        &times;
      </button>
    </div>
  );
};

export default DealClosedBanner;
