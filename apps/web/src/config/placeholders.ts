export type PlaceholderContent = {
  route: string;
  areaName: string;
  comingSoonMessage: string;
  whatYouCanDoNow: string;
};

export const placeholderContent = [
  {
    route: '/read-scripture',
    areaName: 'Read Scripture',
    comingSoonMessage:
      'This space will give you a calm place to read Bible passages, compare translations, and keep simple notes as you prepare.',
    whatYouCanDoNow:
      'For now, you can return Home and choose Study or Build Sermon/Lesson to keep preparing your message.',
  },
  {
    route: '/study',
    areaName: 'Study',
    comingSoonMessage:
      'This space will help you look closely at a passage, gather plain-language study notes, and understand the main ideas before you teach.',
    whatYouCanDoNow:
      'For now, start from Home, then choose Build Sermon/Lesson if you are ready to shape your notes into a message.',
  },
  {
    route: '/build-sermon-lesson',
    areaName: 'Build Sermon/Lesson',
    comingSoonMessage:
      'This space will help you turn Scripture and study notes into a clear sermon or lesson draft with Larry by your side.',
    whatYouCanDoNow:
      'For now, return Home and choose Read Scripture or Study to gather what you want to teach.',
  },
  {
    route: '/plan-series',
    areaName: 'Plan Series',
    comingSoonMessage:
      'This space will help you plan several weeks of sermons or lessons around one theme, passage list, or ministry need with Arlynn.',
    whatYouCanDoNow:
      'For now, build one sermon or lesson at a time, or return Home to choose another starting point.',
  },
  {
    route: '/library',
    areaName: 'Library',
    comingSoonMessage:
      'This space will collect your sermons, lessons, study notes, and series plans so you can find them again quickly.',
    whatYouCanDoNow:
      'For now, return Home and begin reading, studying, or building the next message you want to prepare.',
  },
  {
    route: '/present',
    areaName: 'Present',
    comingSoonMessage:
      'This space will help you preach or teach from a clean, easy-to-read view when your sermon or lesson is ready.',
    whatYouCanDoNow:
      'For now, finish building your sermon or lesson, then come back here when presentation tools are ready.',
  },
] as const satisfies readonly PlaceholderContent[];

export const fallbackPlaceholderContent: PlaceholderContent = {
  route: '/home',
  areaName: 'This area',
  comingSoonMessage:
    'This part of SermonSmith is still being prepared and is not ready to use yet.',
  whatYouCanDoNow:
    'You can return Home and choose Read Scripture, Study, or Build Sermon/Lesson to keep moving.',
};

export function getPlaceholderContent(route: string): PlaceholderContent {
  const normalizedRoute = route.startsWith('/') ? route : `/${route}`;

  return (
    placeholderContent.find((item) => item.route === normalizedRoute) ?? {
      ...fallbackPlaceholderContent,
      route: normalizedRoute,
    }
  );
}

export default placeholderContent;
