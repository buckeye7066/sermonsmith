import PrimaryNav from './PrimaryNav';

/**
 * Wraps any page content with the persistent primary navigation bar
 * and a theme-aware background. Existing feature pages can be rendered
 * as children so nothing is lost.
 */
export default function WorkspaceShell({ children }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <PrimaryNav />
      {children}
    </div>
  );
}
