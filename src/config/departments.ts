export interface DepartmentConfig {
  label: string;
  path: string;
  icon: string;
  resources: string[];
  faq: string[];
}

export const DEPARTMENTS: DepartmentConfig[] = [
  {
    label: 'Acquisitions',
    path: '/acquisitions',
    icon: 'fa-solid fa-handshake',
    resources: [],
    faq: [],
  },
  {
    label: 'Asset Management',
    path: '/asset-management',
    icon: 'fa-solid fa-building',
    resources: [],
    faq: [],
  },
  {
    label: 'Finance',
    path: '/finance',
    icon: 'fa-solid fa-coins',
    resources: [],
    faq: [],
  },
  {
    label: 'HR',
    path: '/hr',
    icon: 'fa-solid fa-people-group',
    resources: [],
    faq: [],
  },
  {
    label: 'IT',
    path: '/it',
    icon: 'fa-solid fa-laptop',
    resources: [
      'Software Downloads',
      'IT Policies & Procedures',
      'Helpful Guides',
    ],
    faq: [
      'How do I reset my password?',
      'Where can I download company software?',
      'How do I contact IT support?',
    ],
  },
  {
    label: 'Legal',
    path: '/legal',
    icon: 'fa-solid fa-scale-balanced',
    resources: [],
    faq: [],
  },
  {
    label: 'Operations',
    path: '/operations',
    icon: 'fa-solid fa-gears',
    resources: [],
    faq: [],
  },
  {
    label: 'Underwriting',
    path: '/underwriting',
    icon: 'fa-solid fa-file-signature',
    resources: [],
    faq: [],
  },
];

export const getDepartmentByPath = (path: string): DepartmentConfig | undefined =>
  DEPARTMENTS.find((department) => department.path === path);
