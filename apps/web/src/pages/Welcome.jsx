import { Link } from 'react-router-dom';
import { ORDINARY_NAV_ITEMS, getNavItemByRoute } from '../lib/navItems';
import { ASSISTANTS } from '../data/assistants';
import AssistantCard from '../components/nav/AssistantCard';

// The three big starting actions, pulled from the shared nav array so
// they always point at real, rendered pages.
const START_ROUTES = ['/Reader', '/BibleStudy', '/SermonBuilder'];

const START_BUTTON_LABELS = {
  '/Reader': 'Start Reading',
  '/BibleStudy': 'Start Studying',
  '/SermonBuilder': 'Start Building',
};

/**
 * The friendly opening screen. A first-time visitor should know exactly
 * what to do here with no instructions.
 */
export default function Welcome() {
  const startItems = START_ROUTES.map((route) => getNavItemByRoute(route)).filter(
    Boolean,
  );

  return (
    <main className="max-w-4xl mx-auto px-6 py-12" role="main">
      <section className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Welcome to SermonSmith
        </h1>
        <p className="text-xl text-gray-700 dark:text-gray-300 max-w-2xl mx-auto">
          SermonSmith is your calm, plain-language workspace for reading
          Scripture, studying, and building a sermon or lesson.
        </p>
      </section>

      <section className="mb-14" aria-label="Get started">
        <div className="grid gap-4 sm:grid-cols-3">
          {startItems.map((item) => (
            <Link
              key={item.id}
              to={item.route}
              className="flex flex-col items-center justify-center gap-3 px-6 py-8 rounded-2xl text-center bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-800 transition-colors shadow-sm"
            >
              <span className="text-4xl" aria-hidden="true">
                {item.icon}
              </span>
              <span className="text-xl font-semibold">
                {START_BUTTON_LABELS[item.route] || item.label}
              </span>
              <span className="text-sm text-blue-100">{item.description}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mb-14" aria-label="What can Larry and Arlynn do?">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2 text-center">
          What can Larry and Arlynn do?
        </h2>
        <p className="text-center text-gray-600 dark:text-gray-400 mb-6">
          Two friendly helpers are here whenever you want a hand.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {ASSISTANTS.map((assistant) => (
            <AssistantCard
              key={assistant.name}
              name={assistant.name}
              role={assistant.role}
              oneLineDescription={assistant.oneLineDescription}
            />
          ))}
        </div>
      </section>

      <section aria-label="Explore the workspace">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4 text-center">
          Explore the workspace
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {ORDINARY_NAV_ITEMS.map((item) => (
            <li key={item.id}>
              <Link
                to={item.route}
                className="flex items-start gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-800 transition-colors"
              >
                <span className="text-2xl" aria-hidden="true">
                  {item.icon}
                </span>
                <span>
                  <span className="block text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {item.label}
                  </span>
                  <span className="block text-sm text-gray-600 dark:text-gray-400">
                    {item.description}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
