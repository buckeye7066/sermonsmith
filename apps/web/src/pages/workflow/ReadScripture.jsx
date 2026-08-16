import React, { Suspense } from 'react';
import WorkflowPage from './WorkflowPage.jsx';

// Reuse the existing, real Reader feature so nothing is lost.
const Reader = React.lazy(() => import('../Reader.jsx'));

export default function ReadScripture() {
  return (
    <WorkflowPage title="Read Scripture" descriptionKey="read" isBuilt>
      <Suspense
        fallback={
          <p className="text-gray-600 dark:text-gray-300">Getting your Bible ready…</p>
        }
      >
        <Reader />
      </Suspense>
    </WorkflowPage>
  );
}
