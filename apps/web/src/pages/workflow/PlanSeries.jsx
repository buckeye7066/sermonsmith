import React, { Suspense } from 'react';
import WorkflowPage from './WorkflowPage.jsx';

// Reuse the existing, real Series Builder feature (Arlynn).
const SeriesBuilder = React.lazy(() =>
  import('../../components/sermon/SeriesBuilder.jsx'),
);

export default function PlanSeries() {
  return (
    <WorkflowPage title="Plan a Series" descriptionKey="plan" isBuilt>
      <Suspense
        fallback={
          <p className="text-gray-600 dark:text-gray-300">
            Setting up your series planner…
          </p>
        }
      >
        <SeriesBuilder />
      </Suspense>
    </WorkflowPage>
  );
}
