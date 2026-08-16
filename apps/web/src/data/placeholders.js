export const placeholders = {
  '/read': {
    route: '/read',
    title: 'Read Scripture',
    comingSoonMessage: 'This reading space will help you begin with the passage and keep your first observations close at hand.',
    nextStep: 'You can go Home to choose another step, or start building a message if your passage is already chosen.',
    actionLabel: 'Go Home',
    actionTo: '/',
  },
  '/study': {
    route: '/study',
    title: 'Study the Passage',
    comingSoonMessage: 'This study space will help you collect notes, questions, and context without losing the thread of the text.',
    nextStep: 'You can start with Reading Scripture or move to Build when you are ready to shape a draft.',
    actionLabel: 'Read Scripture',
    actionTo: '/read',
  },
  '/plan-series': {
    route: '/plan-series',
    title: 'Plan a Series',
    comingSoonMessage: 'This planning space will help you map future messages, passages, and themes in one simple view.',
    nextStep: 'You can go Home for now or build the next message in the series.',
    actionLabel: 'Build a Message',
    actionTo: '/build',
  },
  '/library': {
    route: '/library',
    title: 'Your Library',
    comingSoonMessage: 'This library will keep saved drafts, notes, and message plans easy to find when you return.',
    nextStep: 'You can go Home or begin a new message while the library area is being prepared.',
    actionLabel: 'Go Home',
    actionTo: '/',
  },
  '/present': {
    route: '/present',
    title: 'Present Your Message',
    comingSoonMessage: 'This presentation space will give you a clean, readable view for preaching, teaching, or practice.',
    nextStep: 'You can build a message first, then come back here when you are ready to present.',
    actionLabel: 'Build a Message',
    actionTo: '/build',
  },
};

export const placeholderPages = Object.values(placeholders);
export const placeholdersByPath = placeholders;

export function getPlaceholder(pathname) {
  return placeholders[pathname] || {
    route: pathname || '/',
    title: 'This area is coming soon',
    comingSoonMessage: 'This part of SermonSmith is still being prepared so it can be simple and helpful when you use it.',
    nextStep: 'Please go Home and choose one of the available preparation steps.',
    actionLabel: 'Go Home',
    actionTo: '/',
  };
}

export default placeholders;
