import AdminAnalytics from '../pages/AdminAnalytics.jsx';
import AdminFunctionTester from '../pages/AdminFunctionTester.jsx';
import AdminImport from '../pages/AdminImport.jsx';
import AdminMessages from '../pages/AdminMessages.jsx';
import AdminUsers from '../pages/AdminUsers.jsx';
import BibleAPITest from '../pages/BibleAPITest.jsx';
import BibleMaps from '../pages/BibleMaps.jsx';
import BibleStudy from '../pages/BibleStudy.jsx';
import ChristianEthics from '../pages/ChristianEthics.jsx';
import CollaborativeSermonEditor from '../pages/CollaborativeSermonEditor.jsx';
import Community from '../pages/Community.jsx';
import ContactSupport from '../pages/ContactSupport.jsx';
import Downloads from '../pages/Downloads.jsx';
import Forum from '../pages/Forum.jsx';
import FunctionReviewer from '../pages/FunctionReviewer.jsx';
import GrantAccess from '../pages/GrantAccess.jsx';
import GroupDetail from '../pages/GroupDetail.jsx';
import Home from '../pages/Home.jsx';
import ImportStatus from '../pages/ImportStatus.jsx';
import Library from '../pages/Library.jsx';
import Login from '../pages/Login.jsx';
import MyQuizzes from '../pages/MyQuizzes.jsx';
import MySermons from '../pages/MySermons.jsx';
import MyStudies from '../pages/MyStudies.jsx';
import PlanLibrary from '../pages/PlanLibrary.jsx';
import PrayerGenerator from '../pages/PrayerGenerator.jsx';
import Pricing from '../pages/Pricing.jsx';
import PrivacyPolicy from '../pages/PrivacyPolicy.jsx';
import QuizBuilder from '../pages/QuizBuilder.jsx';
import Reader from '../pages/Reader.jsx';
import SermonAnalytics from '../pages/SermonAnalytics.jsx';
import SermonBuilder from '../pages/SermonBuilder.jsx';
import SermonLibrary from '../pages/SermonLibrary.jsx';
import Settings from '../pages/Settings.jsx';
import SharedContent from '../pages/SharedContent.jsx';
import StudyGroups from '../pages/StudyGroups.jsx';
import StudyNotes from '../pages/StudyNotes.jsx';
import TermsOfUse from '../pages/TermsOfUse.jsx';
import WorldviewExplorer from '../pages/WorldviewExplorer.jsx';

export const workflowRoutes = [
  {
    id: 'home',
    label: 'Home',
    route: '/',
    description: 'Start your sermon or Bible lesson preparation in the clearest place.',
    icon: '🏠',
    isBuilt: true,
    visibleToOrdinaryUser: false,
    showWorkflowHeader: false,
    component: Home,
  },
  {
    id: 'read-scripture',
    label: 'Read Scripture',
    route: '/read',
    description: 'Open the Bible, choose a passage, and read with room to notice what matters.',
    icon: '📖',
    isBuilt: true,
    visibleToOrdinaryUser: true,
    component: Reader,
  },
  {
    id: 'study',
    label: 'Study',
    route: '/study',
    description: 'Explore the passage, compare ideas, and collect helpful notes for teaching.',
    icon: '🔎',
    isBuilt: true,
    visibleToOrdinaryUser: true,
    component: BibleStudy,
  },
  {
    id: 'build-message',
    label: 'Build Sermon/Lesson',
    route: '/build',
    description: 'Turn your passage and notes into a clear sermon, lesson, or teaching outline.',
    icon: '✍️',
    isBuilt: true,
    visibleToOrdinaryUser: true,
    component: SermonBuilder,
  },
  {
    id: 'plan-series',
    label: 'Plan Series',
    route: '/series',
    description: 'Shape several weeks of sermons or lessons into one connected plan.',
    icon: '🗓️',
    isBuilt: false,
    visibleToOrdinaryUser: true,
  },
  {
    id: 'library',
    label: 'Library',
    route: '/library',
    description: 'Find your saved sermons, studies, series plans, and shared resources.',
    icon: '🗂️',
    isBuilt: true,
    visibleToOrdinaryUser: true,
    component: Library,
  },
  {
    id: 'present',
    label: 'Present',
    route: '/present',
    description: 'Prepare a clean, easy-to-read view for teaching, preaching, or sharing.',
    icon: '🎤',
    isBuilt: false,
    visibleToOrdinaryUser: true,
  },
];

export const preservedFeatureRoutes = [
  { id: 'reader-old', label: 'Bible Reader', route: '/reader', description: 'Read Scripture.', icon: '📖', isBuilt: true, visibleToOrdinaryUser: false, component: Reader },
  { id: 'bible-study-old', label: 'Bible Study', route: '/bible-study', description: 'Study Scripture.', icon: '🔎', isBuilt: true, visibleToOrdinaryUser: false, component: BibleStudy },
  { id: 'sermon-builder-old', label: 'Sermon Builder', route: '/sermon-builder', description: 'Build a sermon or lesson.', icon: '✍️', isBuilt: true, visibleToOrdinaryUser: false, component: SermonBuilder },
  { id: 'my-sermons', label: 'My Sermons', route: '/my-sermons', description: 'See saved sermons.', icon: '📝', isBuilt: true, visibleToOrdinaryUser: false, component: MySermons },
  { id: 'my-studies', label: 'My Studies', route: '/my-studies', description: 'See saved studies.', icon: '📚', isBuilt: true, visibleToOrdinaryUser: false, component: MyStudies },
  { id: 'plan-library', label: 'Plan Library', route: '/plan-library', description: 'See saved plans.', icon: '🗓️', isBuilt: true, visibleToOrdinaryUser: false, component: PlanLibrary },
  { id: 'sermon-library', label: 'Sermon Library', route: '/sermon-library', description: 'Browse sermon resources.', icon: '🗂️', isBuilt: true, visibleToOrdinaryUser: false, component: SermonLibrary },
  { id: 'study-notes', label: 'Study Notes', route: '/study-notes', description: 'Review study notes.', icon: '🧾', isBuilt: true, visibleToOrdinaryUser: false, component: StudyNotes },
  { id: 'collaborative-sermon-editor', label: 'Collaborative Sermon Editor', route: '/collaborative-sermon-editor', description: 'Work on a sermon with others.', icon: '🤝', isBuilt: true, visibleToOrdinaryUser: false, component: CollaborativeSermonEditor },
  { id: 'study-groups', label: 'Study Groups', route: '/study-groups', description: 'Meet and study with a group.', icon: '👥', isBuilt: true, visibleToOrdinaryUser: false, component: StudyGroups },
  { id: 'group-detail', label: 'Study Group', route: '/groups/:id', description: 'Open a study group.', icon: '👥', isBuilt: true, visibleToOrdinaryUser: false, component: GroupDetail },
  { id: 'community', label: 'Community', route: '/community', description: 'Share and learn with others.', icon: '🌍', isBuilt: true, visibleToOrdinaryUser: false, component: Community },
  { id: 'forum', label: 'Forum', route: '/forum', description: 'Join discussion.', icon: '💬', isBuilt: true, visibleToOrdinaryUser: false, component: Forum },
  { id: 'shared-content', label: 'Shared Content', route: '/shared/:id', description: 'Open shared content.', icon: '🔗', isBuilt: true, visibleToOrdinaryUser: false, component: SharedContent },
  { id: 'quiz-builder', label: 'Quiz Builder', route: '/quiz-builder', description: 'Create a Bible quiz.', icon: '✅', isBuilt: true, visibleToOrdinaryUser: false, component: QuizBuilder },
  { id: 'my-quizzes', label: 'My Quizzes', route: '/my-quizzes', description: 'See saved quizzes.', icon: '✅', isBuilt: true, visibleToOrdinaryUser: false, component: MyQuizzes },
  { id: 'bible-maps', label: 'Bible Maps', route: '/bible-maps', description: 'Explore Bible places.', icon: '🗺️', isBuilt: true, visibleToOrdinaryUser: false, component: BibleMaps },
  { id: 'worldview-explorer', label: 'Worldview Explorer', route: '/worldview-explorer', description: 'Compare viewpoints.', icon: '🌐', isBuilt: true, visibleToOrdinaryUser: false, component: WorldviewExplorer },
  { id: 'christian-ethics', label: 'Christian Ethics', route: '/christian-ethics', description: 'Study ethical questions.', icon: '⚖️', isBuilt: true, visibleToOrdinaryUser: false, component: ChristianEthics },
  { id: 'prayer-generator', label: 'Prayer Generator', route: '/prayer-generator', description: 'Draft a prayer.', icon: '🙏', isBuilt: true, visibleToOrdinaryUser: false, component: PrayerGenerator },
  { id: 'sermon-analytics', label: 'Sermon Analytics', route: '/sermon-analytics', description: 'Review sermon activity.', icon: '📊', isBuilt: true, visibleToOrdinaryUser: false, component: SermonAnalytics },
  { id: 'downloads', label: 'Downloads', route: '/downloads', description: 'Download SermonSmith.', icon: '⬇️', isBuilt: true, visibleToOrdinaryUser: false, component: Downloads },
  { id: 'settings', label: 'Settings', route: '/settings', description: 'Adjust your app preferences.', icon: '⚙️', isBuilt: true, visibleToOrdinaryUser: false, component: Settings },
  { id: 'login', label: 'Login', route: '/login', description: 'Sign in.', icon: '🔐', isBuilt: true, visibleToOrdinaryUser: false, component: Login },
  { id: 'pricing', label: 'Pricing', route: '/pricing', description: 'See plans.', icon: '💳', isBuilt: true, visibleToOrdinaryUser: false, component: Pricing },
  { id: 'privacy', label: 'Privacy Policy', route: '/privacy', description: 'Read the privacy policy.', icon: '🛡️', isBuilt: true, visibleToOrdinaryUser: false, component: PrivacyPolicy },
  { id: 'terms', label: 'Terms of Use', route: '/terms', description: 'Read the terms.', icon: '📄', isBuilt: true, visibleToOrdinaryUser: false, component: TermsOfUse },
  { id: 'contact-support', label: 'Contact Support', route: '/contact-support', description: 'Get help.', icon: '🙋', isBuilt: true, visibleToOrdinaryUser: false, component: ContactSupport },
  { id: 'admin-analytics', label: 'Admin Analytics', route: '/admin/analytics', description: 'Admin-only area.', icon: '📊', isBuilt: true, visibleToOrdinaryUser: false, component: AdminAnalytics },
  { id: 'admin-function-tester', label: 'Admin Function Tester', route: '/admin/function-tester', description: 'Admin-only area.', icon: '🧪', isBuilt: true, visibleToOrdinaryUser: false, component: AdminFunctionTester },
  { id: 'admin-import', label: 'Admin Import', route: '/admin/import', description: 'Admin-only area.', icon: '📥', isBuilt: true, visibleToOrdinaryUser: false, component: AdminImport },
  { id: 'admin-messages', label: 'Admin Messages', route: '/admin/messages', description: 'Admin-only area.', icon: '✉️', isBuilt: true, visibleToOrdinaryUser: false, component: AdminMessages },
  { id: 'admin-users', label: 'Admin Users', route: '/admin/users', description: 'Admin-only area.', icon: '👤', isBuilt: true, visibleToOrdinaryUser: false, component: AdminUsers },
  { id: 'function-reviewer', label: 'Function Reviewer', route: '/function-reviewer', description: 'Developer review area.', icon: '🧪', isBuilt: true, visibleToOrdinaryUser: false, component: FunctionReviewer },
  { id: 'bible-api-test', label: 'Bible API Test', route: '/bible-api-test', description: 'Developer test area.', icon: '🧪', isBuilt: true, visibleToOrdinaryUser: false, component: BibleAPITest },
  { id: 'grant-access', label: 'Grant Access', route: '/grant-access', description: 'Admin-only area.', icon: '🔑', isBuilt: true, visibleToOrdinaryUser: false, component: GrantAccess },
  { id: 'import-status', label: 'Import Status', route: '/import-status', description: 'Admin-only area.', icon: '📥', isBuilt: true, visibleToOrdinaryUser: false, component: ImportStatus },
];

export const allAppRoutes = [...workflowRoutes, ...preservedFeatureRoutes];

export const primaryNavItems = workflowRoutes.filter((route) => route.visibleToOrdinaryUser === true);
