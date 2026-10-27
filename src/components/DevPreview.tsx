import React from 'react';
import '../../styles/pipeline-mockup.css';
import { UserInfo } from '../types/user';
import DealClosedBanner from './DealClosedBanner';
import { MOCK_CLOSED_TODAY } from '../data/pipelineMock';
import MyPipelineCard from './MyPipelineCard';
import SalesforceHealthBanner, { SALESFORCE_HEALTH_PREVIEW } from './SalesforceHealthBanner';

/**
 * /dev — previews of features in progress, for DEV_PREVIEW_ALLOWLIST only (route-guarded in
 * App.tsx). Everything here is sample data shown as another user would see it.
 */
const DevPreview: React.FC<{ userInfo: UserInfo }> = ({ userInfo }) => (
  <div className="dev-preview">
    <header className="dev-preview-header">
      <h1>Dev preview</h1>
      <p>Only visible to you. Sample data, shown as Ethan Sanandaji would see it.</p>
    </header>

    <h2 className="dev-preview-section">Deal closed banner (live on the home page; sample shown as the closing AM)</h2>
    <DealClosedBanner viewerName="Ethan Sanandaji" previewDeals={MOCK_CLOSED_TODAY} />

    <h2 className="dev-preview-section">My Pipeline card (home page, Acquisitions Managers)</h2>
    <MyPipelineCard />

    <h2 className="dev-preview-section">Salesforce admin warning (near-expiry state)</h2>
    <SalesforceHealthBanner userInfo={userInfo} previewHealth={SALESFORCE_HEALTH_PREVIEW} />
  </div>
);

export default DevPreview;
