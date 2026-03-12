import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function NavigationTracker() {
    const location = useLocation();

    useEffect(() => {
        const pageName = location.pathname === '/' ? 'Home' : location.pathname.replace(/^\//, '').split('/')[0];
        if (pageName) {
            document.title = `${pageName} | SermonSmith`;
        }
    }, [location]);

    return null;
}
