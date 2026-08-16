# SermonSmith welcoming navigation

This folder adds the plain-language Home screen, a persistent primary
navigation bar, a theme toggle, friendly placeholder pages, and a
catch-all "page not found" screen for the everyday (non-technical) user.

## The single source of truth

`apps/web/src/lib/navItems.js` is the one array that drives both the
navigation bar and (recommended) the route table. Because links and
routes come from the same list, there are no dead links and no blank
screens by construction. Admin/developer pages are simply left out of
this list, so they never appear in the everyday navigation.

The routes in `navItems.js` point at the app's real existing pages
(`/Reader`, `/BibleStudy`, `/SermonBuilder`, `/PlanLibrary`,
`/SermonLibrary`), so existing features and any saved drafts stay
reachable. `/present` is not built yet and renders the friendly
`PlaceholderRoute` instead of an error.

## How to wire it into the app

In `apps/web/src/App.jsx`, keep all existing routes and add:

```jsx
import { Routes, Route } from 'react-router-dom';
import WorkspaceShell from './components/nav/WorkspaceShell';
import Welcome from './pages/Welcome';
import PlaceholderRoute from './components/nav/PlaceholderRoute';
import FriendlyNotFound from './components/nav/FriendlyNotFound';

// Wrap the routed content with <WorkspaceShell> so the persistent
// nav bar shows on every page:
<WorkspaceShell>
  <Routes>
    <Route path="/" element={<Welcome />} />
    {/* ...keep all existing feature routes here, unchanged... */}
    <Route path="/present" element={<PlaceholderRoute />} />
    <Route path="*" element={<FriendlyNotFound />} />
  </Routes>
</WorkspaceShell>
```

Do NOT delete existing routes \u2014 just add the ones above around them.

## Theme

`ThemeToggle` stores the choice under the localStorage key
`sermonsmith.theme` and applies the `dark` class on `<html>`. To avoid a
flash of the wrong theme on first paint, add a tiny synchronous script in
`apps/web/index.html` before the app mounts:

```html
<script>
  try {
    var raw = localStorage.getItem('sermonsmith.theme');
    var mode = raw ? (JSON.parse(raw).mode || raw) : 'light';
    if (mode === 'dark') document.documentElement.classList.add('dark');
  } catch (e) { /* fall back to light */ }
</script>
```

Ensure `darkMode: 'class'` is set in `apps/web/tailwind.config.js`.
