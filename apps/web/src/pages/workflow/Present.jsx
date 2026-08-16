import React, { Suspense } from 'react';
import WorkflowPage from './WorkflowPage.jsx';

// Reuse the existing, real Presentation Mode feature.
const PresentationMode = React.lazy(() =>
  import('../../components/sermon/PresentationMode.jsx'),
);

export default function Present() {
  return (
    <WorkflowPage title="Present" descriptionKey="present" isBuilt>
      <div className="rounded-xl bg-gray-50 p-4 text-gray-700 dark:bg-gray-800 dark:text-gray-200">
        <p>
          When your message is ready, open it here to show it on screen, big and
          clear, while you teach.
        </p>
      </div>
      <Suspense
        fallback={
          <p className="mt-4 text-gray-600 dark:text-gray-300">Preparing the screen…</p>
        }
      >
        <PresentationMode />
      </Suspense>
    </WorkflowPage>
  );
}
