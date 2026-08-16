import React, { Suspense, lazy } from 'react'
import { HashRouter, Link, Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell.jsx'
import FriendlyErrorBoundary from './components/FriendlyErrorBoundary.jsx'
import PlaceholderPage from './components/PlaceholderPage.jsx'
import Home from './pages/Home.jsx'
import { ThemeProvider } from './theme/ThemeProvider.jsx'

const Reader = lazy(() => import('./pages/Reader.jsx'))
const BibleStudy = lazy(() => import('./pages/BibleStudy.jsx'))
const SermonBuilder = lazy(() => import('./pages/SermonBuilder.jsx'))
const SermonLibrary = lazy(() => import('./pages/SermonLibrary.jsx'))
const PlanLibrary = lazy(() => import('./pages/PlanLibrary.jsx'))
const MySermons = lazy(() => import('./pages/MySermons.jsx'))
const MyStudies = lazy(() => import('./pages/MyStudies.jsx'))
const StudyNotes = lazy(() => import('./pages/StudyNotes.jsx'))
const Pricing = lazy(() => import('./pages/Pricing.jsx'))
const Login = lazy(() => import('./pages/Login.jsx'))
const Settings = lazy(() => import('./pages/Settings.jsx'))
const Downloads = lazy(() => import('./pages/Downloads.jsx'))
const ContactSupport = lazy(() => import('./pages/ContactSupport.jsx'))
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy.jsx'))
const TermsOfUse = lazy(() => import('./pages/TermsOfUse.jsx'))
const BibleMaps = lazy(() => import('./pages/BibleMaps.jsx'))
const ChristianEthics = lazy(() => import('./pages/ChristianEthics.jsx'))
const PrayerGenerator = lazy(() => import('./pages/PrayerGenerator.jsx'))
const QuizBuilder = lazy(() => import('./pages/QuizBuilder.jsx'))
const MyQuizzes = lazy(() => import('./pages/MyQuizzes.jsx'))
const WorldviewExplorer = lazy(() => import('./pages/WorldviewExplorer.jsx'))
const Community = lazy(() => import('./pages/Community.jsx'))
const Forum = lazy(() => import('./pages/Forum.jsx'))
const StudyGroups = lazy(() => import('./pages/StudyGroups.jsx'))
const GroupDetail = lazy(() => import('./pages/GroupDetail.jsx'))
const SharedContent = lazy(() => import('./pages/SharedContent.jsx'))
const CollaborativeSermonEditor = lazy(() => import('./pages/CollaborativeSermonEditor.jsx'))
const SermonAnalytics = lazy(() => import('./pages/SermonAnalytics.jsx'))
const GrantAccess = lazy(() => import('./pages/GrantAccess.jsx'))
const ImportStatus = lazy(() => import('./pages/ImportStatus.jsx'))
const AdminAnalytics = lazy(() => import('./pages/AdminAnalytics.jsx'))
const AdminFunctionTester = lazy(() => import('./pages/AdminFunctionTester.jsx'))
const AdminImport = lazy(() => import('./pages/AdminImport.jsx'))
const AdminMessages = lazy(() => import('./pages/AdminMessages.jsx'))
const AdminUsers = lazy(() => import('./pages/AdminUsers.jsx'))
const FunctionReviewer = lazy(() => import('./pages/FunctionReviewer.jsx'))
const BibleAPITest = lazy(() => import('./pages/BibleAPITest.jsx'))

function LoadingPage() {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">Opening this area…</p>
    </div>
  )
}

function NotFoundPage() {
  return (
    <section className="rounded-3xl border border-amber-200 bg-white p-6 shadow-sm dark:border-amber-900/60 dark:bg-slate-900 sm:p-8">
      <p className="mb-3 inline-flex rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
        Page not found
      </p>
      <h1 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white">We could not find that page.</h1>
      <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-700 dark:text-slate-200">
        The link may be old, or the page may have moved. Go back Home and choose where you want to begin.
      </p>
      <Link
        to="/"
        className="mt-8 inline-flex min-h-12 items-center justify-center rounded-2xl bg-amber-600 px-5 py-3 font-bold text-white shadow-sm transition hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
      >
        Back to Home
      </Link>
    </section>
  )
}

function AppRoutes() {
  return (
    <Suspense fallback={<LoadingPage />}>
      <Routes>
        <Route path="/" element={<Home />} />

        <Route path="/read" element={<Reader />} />
        <Route path="/reader" element={<Reader />} />
        <Route path="/study" element={<BibleStudy />} />
        <Route path="/bible-study" element={<BibleStudy />} />
        <Route path="/build" element={<SermonBuilder />} />
        <Route path="/sermon-builder" element={<SermonBuilder />} />
        <Route path="/plan-series" element={<PlaceholderPage />} />
        <Route path="/library" element={<SermonLibrary />} />
        <Route path="/sermon-library" element={<SermonLibrary />} />
        <Route path="/plan-library" element={<PlanLibrary />} />
        <Route path="/present" element={<PlaceholderPage />} />

        <Route path="/my-sermons" element={<MySermons />} />
        <Route path="/my-studies" element={<MyStudies />} />
        <Route path="/study-notes" element={<StudyNotes />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/downloads" element={<Downloads />} />
        <Route path="/support" element={<ContactSupport />} />
        <Route path="/contact-support" element={<ContactSupport />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfUse />} />
        <Route path="/bible-maps" element={<BibleMaps />} />
        <Route path="/christian-ethics" element={<ChristianEthics />} />
        <Route path="/prayer-generator" element={<PrayerGenerator />} />
        <Route path="/quiz-builder" element={<QuizBuilder />} />
        <Route path="/my-quizzes" element={<MyQuizzes />} />
        <Route path="/worldview-explorer" element={<WorldviewExplorer />} />
        <Route path="/community" element={<Community />} />
        <Route path="/forum" element={<Forum />} />
        <Route path="/study-groups" element={<StudyGroups />} />
        <Route path="/groups/:id" element={<GroupDetail />} />
        <Route path="/shared/:id" element={<SharedContent />} />
        <Route path="/collaborative-sermon-editor" element={<CollaborativeSermonEditor />} />
        <Route path="/sermon-analytics" element={<SermonAnalytics />} />
        <Route path="/grant-access" element={<GrantAccess />} />
        <Route path="/import-status" element={<ImportStatus />} />

        <Route path="/admin" element={<AdminAnalytics />} />
        <Route path="/admin/analytics" element={<AdminAnalytics />} />
        <Route path="/admin/functions" element={<AdminFunctionTester />} />
        <Route path="/admin/import" element={<AdminImport />} />
        <Route path="/admin/messages" element={<AdminMessages />} />
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/function-reviewer" element={<FunctionReviewer />} />
        <Route path="/bible-api-test" element={<BibleAPITest />} />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <HashRouter>
        <AppShell>
          <FriendlyErrorBoundary>
            <AppRoutes />
          </FriendlyErrorBoundary>
        </AppShell>
      </HashRouter>
    </ThemeProvider>
  )
}
