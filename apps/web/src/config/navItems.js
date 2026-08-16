// Primary workflow navigation for ordinary users.
// One source of truth for PrimaryNav, Home cards, and route generation.
// NavItem: { id, label, route, shortDescription, iconName, isBuilt }
// No admin or developer links belong here.

export const navItems = [
  {
    id: 'read',
    label: 'Read Scripture',
    route: '/read',
    shortDescription: 'Open the Bible and read any passage in a calm, easy-to-read view.',
    iconName: 'BookOpen',
    isBuilt: true,
  },
  {
    id: 'study',
    label: 'Study',
    route: '/study',
    shortDescription: 'Dig deeper into a passage with helpful study tools and notes.',
    iconName: 'Search',
    isBuilt: true,
  },
  {
    id: 'build',
    label: 'Build Sermon/Lesson',
    route: '/build',
    shortDescription: 'Draft a single sermon or lesson step by step with Larry.',
    iconName: 'PenLine',
    isBuilt: true,
  },
  {
    id: 'plan',
    label: 'Plan Series',
    route: '/plan',
    shortDescription: 'Plan a multi-week teaching series with Arlynn.',
    iconName: 'CalendarDays',
    isBuilt: true,
  },
  {
    id: 'library',
    label: 'Library',
    route: '/library',
    shortDescription: 'Find sermons, lessons, and series you have saved.',
    iconName: 'Library',
    isBuilt: true,
  },
  {
    id: 'present',
    label: 'Present',
    route: '/present',
    shortDescription: 'Show your finished message on a screen when you preach or teach.',
    iconName: 'MonitorPlay',
    isBuilt: false,
  },
];

export default navItems;
