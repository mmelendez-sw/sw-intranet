// HomePage data structure - This file can be easily updated by departments
// In the future, this could be replaced with a CMS or database

import img3 from '../../images/site_3.jpg';
import img4 from '../../images/coat.jpg';
import img7 from '../../images/quiz.jpg';
import img9 from '../../images/site_2.jpg';
import img10 from '../../images/alida.jpg';
import img11 from '../../images/santa.jpg';

export interface CardItem {
  text: string;
  link?: {
    url: string;
    text: string;
  };
}

export interface HomePageCard {
  id: string;
  image: string;
  imageAlt: string;
  title: string;
  items: CardItem[];
  cardType: 'odd' | 'even';
}

export interface QuickLink {
  label: string;
  url: string;
  openInNewTab?: boolean;
  requiresElite?: boolean;
  eliteLabel?: string;
}

export interface SidebarSection {
  id: string;
  type: 'quick-links' | 'updates';
  title?: string;
  content?: string;
  links?: QuickLink[];
  buttons?: QuickLink[];
}

export const homePageCards: HomePageCard[] = [
  {
    id: 'important-dates',
    image: img9,
    imageAlt: 'Team Accomplishments',
    title: 'Important Dates',
    cardType: 'odd',
    items: [
      { text: '12/24: Christmas Eve Early Out at 1:00PM' },
      { text: '12/25: Christmas Day' },
      { text: '12/31: New Year\'s Eve Early Out at 1:00PM' },
      { text: '1/1: New Year\'s Day' },
      { text: '1/19: Martin Luther King Jr. Day' },
    ],
  },
  {
    id: 'holiday-party',
    image: img11,
    imageAlt: 'Holiday Party',
    title: 'Happy Holidays from Symphony Towers Infrastructure!',
    cardType: 'even',
    items: [
      {
        text: 'Thank you to everyone who joined us for the Holiday Party! It was a wonderful opportunity to celebrate the year and look ahead to 2026. The photos are linked below.',
      },
      {
        text: 'Holiday Party 2025',
        link: {
          url: 'https://symphonyinfrastructure.sharepoint.com/sites/SymphonyWirelessTeam/Shared%20Documents/Forms/AllItems.aspx?id=%2Fsites%2FSymphonyWirelessTeam%2FShared%20Documents%2FHoliday%20Party%202025&viewid=3b4a3ca3%2D1062%2D4eb5%2Dbf26%2Db84eea8abbcd&CT=1765897007566&OR=OWA%2DNT%2DMail&CID=3f303088%2D887e%2D5f5d%2Dc796%2D8c05e6dfe58c&csf=1&web=1&e=KiM4Nf&FolderCTID=0x012000AAC1A88E36691940A87DC692E832396C',
          text: 'Holiday Party 2025',
        },
      },
    ],
  },
  {
    id: 'halloween',
    image: img7,
    imageAlt: 'Halloween Team Building',
    title: 'Halloween Team Building',
    cardType: 'odd',
    items: [
      {
        text: 'Spooktacular times at our Halloween celebration! Thanks to everyone who joined in the fun and brought their creativity to life.',
      },
    ],
  },
  {
    id: 'coat-drive',
    image: img4,
    imageAlt: 'Person to Person Coat Drive',
    title: 'Person to Person Coat Drive',
    cardType: 'even',
    items: [
      {
        text: 'Thank you to our volunteers who joined us for the Person to Person coat drive in Darien, CT! Your kindness keeps our community warm.',
      },
    ],
  },
  {
    id: 'marketing-updates',
    image: img3,
    imageAlt: 'Marketing Updates',
    title: 'Marketing Updates',
    cardType: 'odd',
    items: [
      {
        text: 'We\'re excited to share that our company logo has been updated as part of our ongoing brand refresh. To support this update, we\'ve created a shared folder with updated logo files, templates, and brand collateral for your use. This folder will continue to be updated as additional materials become available. If you have any questions or need assistance, please feel free to reach out to Justin or Arwa. Thank you for helping us maintain a consistent and professional brand presence.',
      },
      {
        text: 'New Symphony Branding',
        link: {
          url: 'https://symphonyinfrastructure.sharepoint.com/sites/SymphonyWirelessTeam/Shared%20Documents/Forms/AllItems.aspx?csf=1&web=1&e=XUzv8z&ovuser=63fbe43e%2D8963%2D4cb6%2D8f87%2D2ecc3cd029b4&id=%2Fsites%2FSymphonyWirelessTeam%2FShared%20Documents%2FMarketing&viewid=3b4a3ca3%2D1062%2D4eb5%2Dbf26%2Db84eea8abbcd',
          text: 'New Symphony Branding',
        },
      },
      {
        text: 'Additionally, linked below are marketing reports from our Inside Towers company subscription and a link to their most recent quarterly briefing.',
      },
      {
        text: 'Inside Towers Market Reports',
        link: {
          url: 'https://symphonyinfrastructure.sharepoint.com/sites/SymphonyWirelessTeam/Shared%20Documents/Forms/AllItems.aspx?csf=1&web=1&e=XUzv8z&ovuser=63fbe43e%2D8963%2D4cb6%2D8f87%2D2ecc3cd029b4&id=%2Fsites%2FSymphonyWirelessTeam%2FShared%20Documents%2FMarketing%2FInside%20Towers%20Market%20Reports&viewid=3b4a3ca3%2D1062%2D4eb5%2Dbf26%2Db84eea8abbcd',
          text: 'Inside Towers Market Reports',
        },
      },
      {
        text: 'Inside Towers Quarterly Briefing',
        link: {
          url: 'https://www.youtube.com/watch?v=W3ttrJHdPoM',
          text: 'Inside Towers Quarterly Briefing',
        },
      },
    ],
  },
  {
    id: 'topgolf-tournament',
    image: img10,
    imageAlt: 'InspirASIAN SoCal Topgolf Tournament',
    title: 'InspirASIAN SoCal Topgolf Tournament',
    cardType: 'even',
    items: [
      {
        text: 'Great day connecting for a cause! Alida Montiel represented at the InspirASIAN SoCal Topgolf Tournament, an event organized with AT&T. This tournament serves as a key gathering for AT&T executives, vendors, and partners committed to supporting Asian & Pacific Islander communities. All proceeds go toward InspirASIAN\'s scholarship fund for deserving high school students.',
      },
    ],
  },
];

export const sidebarSections: SidebarSection[] = [
  {
    id: 'tech-issue',
    type: 'quick-links',
    buttons: [
      {
        label: 'Report Technology Issue',
        url: 'mailto:Symphony_Tech@symphonywireless.com',
        openInNewTab: false,
      },
    ],
  },
  {
    id: 'hr-updates',
    type: 'quick-links',
    title: 'HR Updates',
    content: 'Please take a moment to fill out this survey below to help us better understand your volunteer interests and organization recommendations.',
    buttons: [
      {
        label: 'Volunteer Organization Survey',
        url: 'https://www.surveymonkey.com/r/NKSLSRW',
        openInNewTab: false,
      },
    ],
  },
  {
    id: 'it-updates',
    type: 'updates',
    title: 'IT Updates',
    content: 'Do not click any phishing links',
  },
  {
    id: 'quick-links',
    type: 'quick-links',
    title: 'Quick Links',
    buttons: [
      {
        label: 'Salesforce',
        url: 'https://symphonyinfra.my.salesforce.com/',
        openInNewTab: true,
      },
      {
        label: 'SiteTracker',
        url: 'https://symphonyinfra.my.salesforce.com/',
        openInNewTab: true,
      },
      {
        label: 'Synaptek AI Search',
        url: 'https://symphonysitesearch.app/',
        openInNewTab: true,
      },
      {
        label: 'Reports',
        url: 'https://intranet.symphonywireless.com/reports',
        openInNewTab: true,
        requiresElite: false,
      },
      {
        label: 'Elite Reports',
        url: 'https://intranet.symphonywireless.com/reports',
        openInNewTab: true,
        requiresElite: true,
        eliteLabel: 'Elite Reports',
      },
      {
        label: 'Trinet',
        url: 'https://identity.trinet.com/',
        openInNewTab: true,
      },
      {
        label: 'Concur',
        url: 'https://www.concursolutions.com/',
        openInNewTab: true,
      },
      {
        label: 'Netsuite',
        url: 'https://system.netsuite.com/app/center/card.nl?c=8089687',
        openInNewTab: true,
      },
      {
        label: 'Outlook',
        url: 'https://outlook.office.com/',
        openInNewTab: true,
      },
    ],
  },
  {
    id: 'exciting-news',
    type: 'updates',
    title: 'Exciting News',
    content: 'Palistar Capital combines Symphony Wireless with CTI Towers to form Symphony Towers Infrastructure (Symphony Towers).',
    links: [
      {
        label: 'Press Release',
        url: 'https://www.prnewswire.com/news-releases/palistar-capital-announces-combination-of-us-wireless-assets-302350144.html',
        openInNewTab: true,
      },
    ],
  },
  {
    id: 'holiday-party-photos',
    type: 'updates',
    title: '2025 Holiday Party Photos',
    content: 'Linked below are the photos from our annual Holiday Party! Please browse when you have some time!',
    links: [
      {
        label: 'Holiday Party 2025',
        url: 'https://symphonyinfrastructure.sharepoint.com/sites/SymphonyWirelessTeam/Shared%20Documents/Forms/AllItems.aspx?id=%2Fsites%2FSymphonyWirelessTeam%2FShared%20Documents%2FHoliday%20Party%202025&viewid=3b4a3ca3%2D1062%2D4eb5%2Dbf26%2Db84eea8abbcd&CT=1765897007566&OR=OWA%2DNT%2DMail&CID=3f303088%2D887e%2D5f5d%2Dc796%2D8c05e6dfe58c&csf=1&web=1&e=KiM4Nf&FolderCTID=0x012000AAC1A88E36691940A87DC692E832396C',
        openInNewTab: true,
      },
    ],
  },
];

