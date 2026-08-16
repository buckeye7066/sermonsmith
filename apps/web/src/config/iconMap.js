// Turns an iconName string from navItems into an actual icon component.
// Keeping this lookup separate lets navItems.js stay plain data.
// Named imports keep the bundle small.
import {
  BookOpen,
  Search,
  PenLine,
  CalendarDays,
  Library,
  MonitorPlay,
  Compass,
} from 'lucide-react';

const iconMap = {
  BookOpen,
  Search,
  PenLine,
  CalendarDays,
  Library,
  MonitorPlay,
};

// Always returns a valid component; falls back to a neutral icon so a bad
// or missing name never crashes the navigation.
export function getIcon(iconName) {
  return iconMap[iconName] || Compass;
}

export default getIcon;
