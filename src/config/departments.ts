import {
  buildDefaultDepartmentContent,
  DepartmentPageContent,
} from '../services/contentService';

export interface DepartmentConfig {
  label: string;
  path: string;
  slug: string;
  icon: string;
  defaultContent: DepartmentPageContent;
}

export const DEPARTMENTS: DepartmentConfig[] = [
  {
    label: 'Acquisitions',
    path: '/acquisitions',
    slug: 'acquisitions',
    icon: 'fa-solid fa-handshake',
    defaultContent: buildDefaultDepartmentContent('Acquisitions'),
  },
  {
    label: 'Asset Management',
    path: '/asset-management',
    slug: 'asset-management',
    icon: 'fa-solid fa-building',
    defaultContent: buildDefaultDepartmentContent('Asset Management'),
  },
  {
    label: 'Finance',
    path: '/finance',
    slug: 'finance',
    icon: 'fa-solid fa-coins',
    defaultContent: buildDefaultDepartmentContent('Finance'),
  },
  {
    label: 'HR',
    path: '/hr',
    slug: 'hr',
    icon: 'fa-solid fa-people-group',
    defaultContent: buildDefaultDepartmentContent('HR'),
  },
  {
    label: 'IT',
    path: '/it',
    slug: 'it',
    icon: 'fa-solid fa-laptop',
    defaultContent: buildDefaultDepartmentContent('IT', {
      resources: {
        items: [
          'Software Downloads',
          'IT Policies & Procedures',
          'Helpful Guides',
        ],
      },
      faq: {
        items: [
          'How do I reset my password?',
          'Where can I download company software?',
          'How do I contact IT support?',
        ],
      },
    }),
  },
  {
    label: 'Legal',
    path: '/legal',
    slug: 'legal',
    icon: 'fa-solid fa-scale-balanced',
    defaultContent: buildDefaultDepartmentContent('Legal'),
  },
  {
    label: 'Operations',
    path: '/operations',
    slug: 'operations',
    icon: 'fa-solid fa-gears',
    defaultContent: buildDefaultDepartmentContent('Operations'),
  },
  {
    label: 'Underwriting',
    path: '/underwriting',
    slug: 'underwriting',
    icon: 'fa-solid fa-file-signature',
    defaultContent: buildDefaultDepartmentContent('Underwriting'),
  },
];

export const getDepartmentByPath = (path: string): DepartmentConfig | undefined =>
  DEPARTMENTS.find((department) => department.path === path);
