import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { toast } from 'sonner';

export default function NavigationTracker() {
    const location = useLocation();

    useEffect(() => {
        // Clear any toasts left over from the previous route. Without this, an
        // error raised on (say) Admin Users — "Failed to load users" — outlives
        // the navigation and stacks on top of the next page, eventually
        // obscuring real UI. This NavigationTracker sits above the page routes
        // in the tree, so its effect runs before a newly-mounted page's own
        // effects: legitimate new-page toasts still show.
        toast.dismiss();

        const pageName = location.pathname === '/' ? 'Home' : location.pathname.replace(/^\//, '').split('/')[0];
        if (pageName) {
            document.title = `${pageName} | SermonSmith`;
        }
    }, [location]);

    return null;
}
