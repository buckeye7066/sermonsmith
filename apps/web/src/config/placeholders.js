// PlaceholderContent: { route, areaName, comingSoonMessage, whatYouCanDoNow }
// One record per not-yet-built area. PlaceholderPage falls back to a
// generic friendly message if a route has no matching record here.

export const placeholders = [
  {
    route: '/present',
    areaName: 'Present',
    comingSoonMessage:
      'This is where you will show your finished sermon or lesson on a big screen, one point at a time, while you preach or teach.',
    whatYouCanDoNow:
      'For now you can build your message under "Build Sermon/Lesson" and save it to your Library. Presenting will be added soon.',
  },
];

export function getPlaceholder(route) {
  const match = placeholders.find((p) => p.route === route);
  if (match) return match;
  return {
    route,
    areaName: 'This area',
    comingSoonMessage:
      'This part of SermonSmith is being built. It will be ready for you soon.',
    whatYouCanDoNow:
      'In the meantime you can go back to Home and start Reading, Studying, or Building.',
  };
}

export default placeholders;
