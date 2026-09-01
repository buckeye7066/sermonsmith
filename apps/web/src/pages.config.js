import { lazyWithReload as lazy } from './lib/lazyWithReload';

const Reader = lazy(() => import('./pages/Reader'));
const SermonBuilder = lazy(() => import('./pages/SermonBuilder'));
const MySermons = lazy(() => import('./pages/MySermons'));
const Pricing = lazy(() => import('./pages/Pricing'));
const BibleStudy = lazy(() => import('./pages/BibleStudy'));
const QuizBuilder = lazy(() => import('./pages/QuizBuilder'));
const BibleMaps = lazy(() => import('./pages/BibleMaps'));
const Settings = lazy(() => import('./pages/Settings'));
const MyStudies = lazy(() => import('./pages/MyStudies'));
const MyQuizzes = lazy(() => import('./pages/MyQuizzes'));
const AdminImport = lazy(() => import('./pages/AdminImport'));
const Community = lazy(() => import('./pages/Community'));
const Forum = lazy(() => import('./pages/Forum'));
const StudyGroups = lazy(() => import('./pages/StudyGroups'));
const SharedContent = lazy(() => import('./pages/SharedContent'));
const Downloads = lazy(() => import('./pages/Downloads'));
const Home = lazy(() => import('./pages/Home'));
const SermonLibrary = lazy(() => import('./pages/SermonLibrary'));
const PlanLibrary = lazy(() => import('./pages/PlanLibrary'));
const WorldviewExplorer = lazy(() => import('./pages/WorldviewExplorer'));
const ChristianEthics = lazy(() => import('./pages/ChristianEthics'));
const PrayerGenerator = lazy(() => import('./pages/PrayerGenerator'));
const ImportStatus = lazy(() => import('./pages/ImportStatus'));
const BibleAPITest = lazy(() => import('./pages/BibleAPITest'));
const GrantAccess = lazy(() => import('./pages/GrantAccess'));
const GroupDetail = lazy(() => import('./pages/GroupDetail'));
const AdminUsers = lazy(() => import('./pages/AdminUsers'));
const CollaborativeSermonEditor = lazy(() => import('./pages/CollaborativeSermonEditor'));
const SermonAnalytics = lazy(() => import('./pages/SermonAnalytics'));
const StudyNotes = lazy(() => import('./pages/StudyNotes'));
const AdminAnalytics = lazy(() => import('./pages/AdminAnalytics'));
const ContactSupport = lazy(() => import('./pages/ContactSupport'));
const AdminMessages = lazy(() => import('./pages/AdminMessages'));
const AdminFunctionTester = lazy(() => import('./pages/AdminFunctionTester'));
const FunctionReviewer = lazy(() => import('./pages/FunctionReviewer'));

// Static (not lazy): the shell must be present on first paint, and it is
// referenced below. Deleting this import leaves `__Layout` undefined.
import __Layout from './Layout.jsx';

export const PAGES = {
    "Reader": Reader,
    "SermonBuilder": SermonBuilder,
    "MySermons": MySermons,
    "Pricing": Pricing,
    "BibleStudy": BibleStudy,
    "QuizBuilder": QuizBuilder,
    "BibleMaps": BibleMaps,
    "Settings": Settings,
    "MyStudies": MyStudies,
    "MyQuizzes": MyQuizzes,
    "AdminImport": AdminImport,
    "Community": Community,
    "Forum": Forum,
    "StudyGroups": StudyGroups,
    "SharedContent": SharedContent,
    "Downloads": Downloads,
    "Home": Home,
    "SermonLibrary": SermonLibrary,
    "PlanLibrary": PlanLibrary,
    "WorldviewExplorer": WorldviewExplorer,
    "ChristianEthics": ChristianEthics,
    "PrayerGenerator": PrayerGenerator,
    "ImportStatus": ImportStatus,
    "BibleAPITest": BibleAPITest,
    "GrantAccess": GrantAccess,
    "GroupDetail": GroupDetail,
    "AdminUsers": AdminUsers,
    "CollaborativeSermonEditor": CollaborativeSermonEditor,
    "SermonAnalytics": SermonAnalytics,
    "StudyNotes": StudyNotes,
    "AdminAnalytics": AdminAnalytics,
    "ContactSupport": ContactSupport,
    "AdminMessages": AdminMessages,
    "AdminFunctionTester": AdminFunctionTester,
    "FunctionReviewer": FunctionReviewer,
}

export const pagesConfig = {
    // Root "/" renders Home (the landing/dashboard), NOT Reader. Previously
    // mainPage was "Reader", so "/" and "/Reader" rendered the identical
    // page while the distinct sidebar "Home" link pointed at a route that
    // duplicated the Bible reader. Home is the intended landing surface.
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};
