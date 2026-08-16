/**
 * Shows one friendly helper (Larry or Arlynn) in a clear, readable card.
 * Props: name, role, oneLineDescription
 */
export default function AssistantCard({ name, role, oneLineDescription }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 text-left shadow-sm">
      <div className="flex items-center gap-3 mb-2">
        <span
          className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 text-lg font-bold"
          aria-hidden="true"
        >
          {name.charAt(0)}
        </span>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {name}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{role}</p>
        </div>
      </div>
      <p className="text-base text-gray-700 dark:text-gray-300">
        {oneLineDescription}
      </p>
    </div>
  );
}
