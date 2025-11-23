import Reader from './pages/Reader';
import SermonBuilder from './pages/SermonBuilder';
import MySermons from './pages/MySermons';
import Pricing from './pages/Pricing';
import BibleStudy from './pages/BibleStudy';
import QuizBuilder from './pages/QuizBuilder';
import BibleMaps from './pages/BibleMaps';
import Settings from './pages/Settings';
import MyStudies from './pages/MyStudies';
import MyQuizzes from './pages/MyQuizzes';
import AdminImport from './pages/AdminImport';
import Community from './pages/Community';
import Forum from './pages/Forum';
import StudyGroups from './pages/StudyGroups';
import SharedContent from './pages/SharedContent';
import Downloads from './pages/Downloads';
import Home from './pages/Home';
import SermonLibrary from './pages/SermonLibrary';
import PlanLibrary from './pages/PlanLibrary';
import WorldviewExplorer from './pages/WorldviewExplorer';
import ChristianEthics from './pages/ChristianEthics';
import PrayerGenerator from './pages/PrayerGenerator';
import SystemDiagnostics from './pages/SystemDiagnostics';
import ImportStatus from './pages/ImportStatus';
import BibleAPITest from './pages/BibleAPITest';
import GrantAccess from './pages/GrantAccess';
import GroupDetail from './pages/GroupDetail';
import AdminUsers from './pages/AdminUsers';
import CollaborativeSermonEditor from './pages/CollaborativeSermonEditor';
import SermonAnalytics from './pages/SermonAnalytics';
import StudyNotes from './pages/StudyNotes';
import AdminAnalytics from './pages/AdminAnalytics';
import ContactSupport from './pages/ContactSupport';
import AdminMessages from './pages/AdminMessages';
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
    "SystemDiagnostics": SystemDiagnostics,
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
}

export const pagesConfig = {
    mainPage: "Reader",
    Pages: PAGES,
    Layout: __Layout,
};