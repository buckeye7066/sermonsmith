import React, { Suspense } from 'react';
import WorkflowPage from './WorkflowPage.jsx';

// Reuse the existing, real Bible Study feature.
const BibleStudy = React.lazy(() => import('../BibleStudy.jsx'));

export default function Study() {
  return (
    <WorkflowPage title="Study" descriptionKey="study" isBuilt>
      <Suspense
        fallback={
          <p className="text-gray-600 dark:text-gray-300">Opening your study tools…</p>
        }
      >
        <BibleStudy />
      </Suspense>
    </WorkflowPage>
  );
}
