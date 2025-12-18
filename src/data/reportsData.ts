export interface Report {
  title: string;
  description: string;
  link?: string;
  excludedEmails?: string[];
}

export const reports: Report[] = [
  {
    title: 'Company Progress',
    description: 'A comprehensive view of company performance metrics and progress indicators.',
    link: 'https://app.powerbi.com/reportEmbed?reportId=e091da31-91dd-42c2-9b17-099d2e07c492&autoAuth=true&ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&filterPaneEnabled=false&navContentPaneEnabled=false',
  },
  {
    title: 'All Acquisitions Summary',
    description: 'A comprehensive look at All Symphony Towers Infrastructure Acquisitions broken down by month, quarter, and year.',
    link: 'https://app.powerbi.com/links/PDJWKnYPlL?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&pbi_source=linkShare',
  },
  {
    title: 'Daily Opportunity Count',
    description: 'A comprehensive status report on all current Symphony Towers Infrastructure Opportunities, Term Sheets, and Closed Rent.',
    link: 'https://app.powerbi.com/links/cJsxxPeDQx?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&pbi_source=linkShare',
  },
  {
    title: 'Portfolio Pipeline',
    description: 'A comprehensive look at the Symphony Towers Infrastructure Portfolio pipeline.',
    link: 'https://app.powerbi.com/links/EJYOMILU2S?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&pbi_source=linkShare',
  },
  {
    title: 'Tower Purchase Opportunities',
    description: 'A complete view of all opportunities with the Tower Purchase transaction type.',
    link: 'https://app.powerbi.com/links/15otqb7SY1?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&pbi_source=linkShare&bookmarkGuid=44739935-cc8c-4072-8232-79d8be3360f8',
  },
  {
    title: 'Closing - Pipeline',
    description: 'A comprehensive look at the Symphony Towers Infrastructure Closing Pipeline.',
    link: 'https://app.powerbi.com/links/Cs4H7e-pez?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&pbi_source=linkShare',
  },
  {
    title: 'Signed LOIs - SNDA',
    description: 'A comprehensive look at Signed Letters of Intent and Subordination, Non-Disturbance, and Attornment agreements.',
    link: 'https://app.powerbi.com/links/M87CTzygq_?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&pbi_source=linkShare',
  },
  {
    title: 'Daily Acquisitions Summary',
    description: 'A comprehensive look at the Symphony Towers Infrastructure Daily Acquisitions.',
    link: 'https://app.powerbi.com/links/hMDIVOJ44O?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&pbi_source=linkShare',
  },
  {
    title: 'WIP - In-Month Conversion Tracker',
    description: 'Work In Progress - A tracker to view opportunity conversions by month.',
  },
  {
    title: 'WIP - TS and CR Trends Report',
    description: 'Work In Progress - A comprehensive look at trends in Term Sheets and Closed Rent.',
  },
  {
    title: 'TK Salesforce Sites',
    description: 'A comprehensive look at TK High Rent Relocation Sites and their status.',
    link: 'https://app.powerbi.com/links/ArNJaolb9U?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&pbi_source=linkShare',
  },
];

export const eliteReports: Report[] = [
  {
    title: 'Elite - Origination Pipeline',
    description: 'A comprehensive look at the Symphony Towers Infrastructure Origination Pipeline.',
    link: 'https://app.powerbi.com/links/lUwfP_rkT6?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&pbi_source=linkShare',
    excludedEmails: ['arivera@symphonyinfra.com'],
  },
  {
    title: 'Elite - Company Progress',
    description: 'A complete view of current GCF and Capital Acquisition activity.',
    link: 'https://app.powerbi.com/groups/me/reports/e091da31-91dd-42c2-9b17-099d2e07c492/2695a41c69787864795c?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&experience=power-bi',
    excludedEmails: ['arivera@symphonyinfra.com'],
  },
  {
    title: 'Elite - Scorecard Pipeline',
    description: 'A comprehensive look at the Symphony Towers Infrastructure Scorecard Pipeline.',
    link: 'https://app.powerbi.com/links/q75bs_ZEe2?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&pbi_source=linkShare',
    excludedEmails: ['arivera@symphonyinfra.com'],
  },
  {
    title: 'Elite - Acquisition Team Commision Report',
    description: 'A comprehensive look at the Symphony Towers Infrastructure Acquisition Team Commision Breakdown.',
    link: 'https://app.powerbi.com/links/_K3tF0sy6t?ctid=63fbe43e-8963-4cb6-8f87-2ecc3cd029b4&pbi_source=linkShare',
    excludedEmails: ['jcymbalista@symphonyinfra.com', 'cdolgon@symphonyinfra.com', 'dlaub@symphonyinfra.com'],
  },
];

export const shouldShowReport = (report: Report, userEmail?: string): boolean => {
  if (report.excludedEmails && userEmail) {
    return !report.excludedEmails.some(
      (email) => email.toLowerCase() === userEmail.toLowerCase()
    );
  }
  return true;
};

