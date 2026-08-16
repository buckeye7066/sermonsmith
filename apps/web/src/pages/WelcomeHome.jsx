import React from 'react';
import { navItems, homeStartButtonIds } from '@/config/navItems';
import WorkflowCard from '@/components/WorkflowCard';
import AssistantExplainer from '@/components/AssistantExplainer';

// The first screen. It needs no instructions: a clear headline says what the
// app does, then three big buttons offer the obvious next steps.
export default function WelcomeHome() {
  const startButtons = homeStartButtonIds
    .map((id) => navItems.find((n) => n.id === id))
    .filter(Boolean);

  return (
    <div>
      <section aria-labelledby="home-heading">
        <h1 id="home-heading" className="text-4xl font-bold tracking-tight">
          Prepare your sermons and Bible lessons, step by step.
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-slate-700 dark:text-slate-200">
          SermonSmith is your calm, plain-language workspace for going from
          reading Scripture to preaching your message.
        </p>

        <h2 className="sr-only">Start here</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {startButtons.map((item) => (
            <WorkflowCard key={item.id} item={item} emphasize />
          ))}
        </div>
      </section>

      <AssistantExplainer />

      <section aria-labelledby="areas-heading" className="mt-12">
        <h2 id="areas-heading" className="text-2xl font-bold">
          Everything you need, in one place
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {navItems.map((item) => (
            <WorkflowCard key={item.id} item={item} />
          ))}
        </div>
      </section>
    </div>
  );
}
