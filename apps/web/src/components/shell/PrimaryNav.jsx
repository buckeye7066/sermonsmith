import React from 'react';
import { NavLink } from 'react-router-dom';
import { navItems } from '../../config/navItems.js';
import { NavIcon } from './iconMap.jsx';

export default function PrimaryNav() {
  return (
    <nav aria-label="Main areas" className="w-full">
      <ul className="flex flex-wrap gap-2">
        {navItems.map((item) => (
          <li key={item.id}>
            <NavLink
              to={item.route}
              title={item.shortDescription}
              className={({ isActive }) =>
                [
                  'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-sky-500',
                  isActive
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700',
                ].join(' ')
              }
            >
              <NavIcon name={item.iconName} size={20} />
              <span>{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
