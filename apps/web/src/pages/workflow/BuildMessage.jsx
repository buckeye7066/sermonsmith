import React, { Suspense } from 'react';
import WorkflowPage from './WorkflowPage.jsx';

// Reuse the existing, real Sermon Builder feature (Larry).
const SermonBuilder = React.lazy(() => import('../SermonBuilder.jsx'));

export default function BuildMessage() {
  return (
    <WorkflowPage title="Build Sermon or Lesson" descriptionKey="build" isBuilt>
      <Suspense
        fallback={
          <p className="text-gray-600 dark:text-gray-300">
            Warming up your message builder…
          </p>
        }
      >
        <SermonBuilder />
      </Suspense>
    </WorkflowPage>
  );
}
