import React from 'react';
import {
  BookOpen,
  Search,
  PenLine,
  CalendarDays,
  Library,
  MonitorPlay,
  Circle,
} from 'lucide-react';

const ICONS = {
  BookOpen,
  Search,
  PenLine,
  CalendarDays,
  Library,
  MonitorPlay,
};

export function NavIcon({ name, size = 24, className }) {
  const Cmp = ICONS[name] || Circle;
  return <Cmp size={size} className={className} aria-hidden="true" />;
}

export default NavIcon;
