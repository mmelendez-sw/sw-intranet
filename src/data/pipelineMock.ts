import type { ClosedDeal } from '../components/DealClosedBanner';

/**
 * Sample data for the /dev preview (DEV_PREVIEW_ALLOWLIST only), in the shape the Lambda would
 * return. Stage names are the org's real active Opportunity stages; the deals are made up.
 */

export interface PipelineStageCount {
  stage: string;
  count: number;
}

export interface PipelineDeal {
  name: string;
  city: string;
  stage: string;
  /** Short reason it needs attention. */
  note: string;
}

export interface MyPipeline {
  amName: string;
  monthLabel: string;
  openCount: number;
  termSheetsSignedThisMonth: number;
  leaderboardRank: number;
  closedThisMonth: number;
  stages: PipelineStageCount[];
  attention: PipelineDeal[];
}


const today = new Date();

export const MOCK_MY_PIPELINE: MyPipeline = {
  amName: 'Ethan Sanandaji',
  monthLabel: today.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
  openCount: 23,
  termSheetsSignedThisMonth: 3,
  leaderboardRank: 2,
  closedThisMonth: 1,
  stages: [
    { stage: 'DealSheet Approved', count: 4 },
    { stage: 'Sent to Pricing Review', count: 3 },
    { stage: 'Opportunity Approved', count: 2 },
    { stage: 'Offer Sent', count: 5 },
    { stage: 'TS Sent', count: 3 },
    { stage: 'TS Executed/Signed', count: 2 },
    { stage: 'Due Diligence', count: 3 },
    { stage: 'Closing', count: 1 },
  ],
  attention: [
    { name: 'Harbor View Rooftop', city: 'Jacksonville, FL', stage: 'TS Sent', note: 'Term sheet expires in 5 days' },
    { name: 'Cedar Hill Tower', city: 'Marietta, GA', stage: 'Offer Sent', note: '52 days in stage' },
    { name: 'Lakeside Monopole', city: 'Orlando, FL', stage: 'Due Diligence', note: 'Title status not started' },
  ],
};

/** Deal-closed banner preview, in the shape GET /api/salesforce/closed-today returns. */
export const MOCK_CLOSED_TODAY: ClosedDeal[] = [
  { name: '26-FL0042', city: 'Tampa', state: 'FL', amName: 'Ethan Sanandaji' },
];
