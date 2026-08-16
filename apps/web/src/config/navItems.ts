export type NavItem = {
  id: string;
  label: string;
  route: string;
  shortDescription: string;
  iconName: 'BookOpen' | 'Search' | 'PenLine' | 'CalendarDays' | 'Library' | 'MonitorPlay';
  isBuilt: boolean;
};

export const navItems: NavItem[] = [
  {
    id: 'read-scripture',
    label: 'Read Scripture',
    route: '/read-scripture',
    shortDescription: 'Open the Bible and settle into the passage you want to prepare from.',
    iconName: 'BookOpen',
    isBuilt: false,
  },
  {
    id: 'study',
    label: 'Study',
    route: '/study',
    shortDescription: 'Explore the meaning of a passage with clear study helps.',
    iconName: 'Search',
    isBuilt: false,
  },
  {
    id: 'build-sermon-lesson',
    label: 'Build Sermon/Lesson',
    route: '/build-sermon-lesson',
    shortDescription: 'Shape your notes into one sermon or Bible lesson.',
    iconName: 'PenLine',
    isBuilt: false,
  },
  {
    id: 'plan-series',
    label: 'Plan Series',
    route: '/plan-series',
    shortDescription: 'Plan several weeks of sermons or lessons in one calm place.',
    iconName: 'CalendarDays',
    isBuilt: false,
  },
  {
    id: 'library',
    label: 'Library',
    route: '/library',
    shortDescription: 'Find sermons, lessons, notes, and study material you have saved.',
    iconName: 'Library',
    isBuilt: false,
  },
  {
    id: 'present',
    label: 'Present',
    route: '/present',
    shortDescription: 'Use a clean preaching or teaching view when it is time to share.',
    iconName: 'MonitorPlay',
    isBuilt: false,
  },
];
