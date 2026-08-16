import { NavLink } from 'react-router-dom';
import { navItems } from '../../lib/navItems.js';

export function PrimaryNav({ className = '' }) {
  const items = navItems.filter((item) => item.visibleToOrdinaryUsers !== false);

  return (
    <nav className={className} aria-label="Primary navigation">
      <ul className="flex flex-wrap items-center gap-2">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                [
                  'inline-flex rounded-full px-4 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-300',
                  isActive
                    ? 'bg-sky-700 text-white dark:bg-sky-400 dark:text-slate-950'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white',
                ].join(' ')
              }
              title={item.description}
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default PrimaryNav;
