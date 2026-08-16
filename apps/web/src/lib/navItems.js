const ordinaryNavItems = [
  {
    id: 'home',
    label: 'Home',
    href: '/',
    path: '/',
    to: '/',
    description: 'Start here and choose the next sermon or teaching task.',
  },
  {
    id: 'read-scripture',
    label: 'Read Scripture',
    href: '/read',
    path: '/read',
    to: '/read',
    description: 'Open the passage and gather the main details before you write.',
  },
  {
    id: 'study',
    label: 'Study',
    href: '/study',
    path: '/study',
    to: '/study',
    description: 'Collect observations, questions, and helpful notes from the passage.',
  },
  {
    id: 'build',
    label: 'Build',
    href: '/build',
    path: '/build',
    to: '/build',
    description: 'Turn your passage and notes into a clear message outline.',
  },
  {
    id: 'plan-series',
    label: 'Plan Series',
    href: '/plan-series',
    path: '/plan-series',
    to: '/plan-series',
    description: 'Map a multi-week sermon or teaching series with a clear focus for each week.',
  },
  {
    id: 'library',
    label: 'Library',
    href: '/library',
    path: '/library',
    to: '/library',
    description: 'Find saved sermons, studies, notes, and series plans.',
  },
  {
    id: 'present',
    label: 'Present',
    href: '/present',
    path: '/present',
    to: '/present',
    description: 'Use a clean presentation view when you are ready to teach or preach.',
  },
];

export const navItems = ordinaryNavItems;
export const primaryNavItems = ordinaryNavItems;
export const workflowNavItems = ordinaryNavItems.filter((item) => item.id !== 'home');
export const ORDINARY_NAV_ITEMS = ordinaryNavItems;
export const NAV_ITEMS = ordinaryNavItems;

export function getOrdinaryNavItems() {
  return ordinaryNavItems;
}

export function getPrimaryNavItems() {
  return primaryNavItems;
}

export default ordinaryNavItems;
