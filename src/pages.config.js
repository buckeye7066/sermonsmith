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
import BulkImport from './pages/BulkImport';
import Community from './pages/Community';
import Forum from './pages/Forum';
import StudyGroups from './pages/StudyGroups';
import SharedContent from './pages/SharedContent';
import Downloads from './pages/Downloads';
import ImportStatus from './pages/ImportStatus';
import Home from './pages/Home';
import SermonLibrary from './pages/SermonLibrary';
import PlanLibrary from './pages/PlanLibrary';
import WorldviewExplorer from './pages/WorldviewExplorer';
import ChristianEthics from './pages/ChristianEthics';
import PrayerGenerator from './pages/PrayerGenerator';
import SystemDiagnostics from './pages/SystemDiagnostics';
import Layout from './Layout.jsx';


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
    "BulkImport": BulkImport,
    "Community": Community,
    "Forum": Forum,
    "StudyGroups": StudyGroups,
    "SharedContent": SharedContent,
    "Downloads": Downloads,
    "ImportStatus": ImportStatus,
    "Home": Home,
    "SermonLibrary": SermonLibrary,
    "PlanLibrary": PlanLibrary,
    "WorldviewExplorer": WorldviewExplorer,
    "ChristianEthics": ChristianEthics,
    "PrayerGenerator": PrayerGenerator,
    "SystemDiagnostics": SystemDiagnostics,
}

export const pagesConfig = {
    mainPage: "Reader",
    Pages: PAGES,
    Layout: Layout,
};