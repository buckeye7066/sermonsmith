export const assistants = [
  {
    id: 'larry',
    name: 'Larry',
    title: 'Sermon helper',
    oneLineDescription: 'Larry helps you turn a Scripture passage into a clear sermon draft with a main point, outline, and next steps.',
    description: 'Larry helps you turn a Scripture passage into a clear sermon draft with a main point, outline, and next steps.',
    ctaLabel: 'Build a message',
    route: '/build',
  },
  {
    id: 'arlynn',
    name: 'Arlynn',
    title: 'Series planning helper',
    oneLineDescription: 'Arlynn helps you plan a sermon or teaching series across multiple weeks so each week has a clear passage, theme, and next step.',
    description: 'Arlynn helps you plan a sermon or teaching series across multiple weeks so each week has a clear passage, theme, and next step.',
    ctaLabel: 'Plan a series',
    route: '/plan-series',
  },
];

export const assistantMap = Object.fromEntries(assistants.map((assistant) => [assistant.id, assistant]));

export function getAssistant(idOrName) {
  const normalized = String(idOrName || '').trim().toLowerCase();
  return assistants.find((assistant) => assistant.id === normalized || assistant.name.toLowerCase() === normalized);
}

export default assistants;
