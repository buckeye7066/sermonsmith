import React, { Suspense } from 'react';
import WorkflowPage from './WorkflowPage.jsx';

// Reuse the existing, real Sermon Library feature.
const SermonLibrary = React.lazy(() => import('../SermonLibrary.jsx'));

export default function Library() {
  return (
    <WorkflowPage title="Library" descriptionKey="library" isBuilt>
      <Suspense
        fallback={
          <p className="text-gray-600 dark:text-gray-300">Loading your library…</p>
        }
      >
        <SermonLibrary />
      </Suspense>
    </WorkflowPage>
  );
}
