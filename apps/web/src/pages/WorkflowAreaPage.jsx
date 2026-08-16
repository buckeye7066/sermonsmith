import { Link } from 'react-router-dom'

const pageContent = {
  '/read': {
    eyebrow: 'Read Scripture',
    title: 'Start with the Bible passage.',
    body: 'This is your Scripture starting place. Choose the passage you want to read, then move into Study when you are ready to look closer.',
    primaryLabel: 'Study this passage',
    primaryRoute: '/study',
    tips: ['Read the passage slowly.', 'Notice repeated words and main ideas.', 'Write down questions you want to study.'],
  },
  '/study': {
    eyebrow: 'Study',
    title: 'Look closer before you teach.',
    body: 'This is your study workspace for gathering observations, background, meaning, and teaching ideas before shaping the message.',
    primaryLabel: 'Build a sermon or lesson',
    primaryRoute: '/build',
    tips: ['Summarize the main point in one sentence.', 'List what the passage shows about God and people.', 'Choose one clear response for hearers.'],
  },
  '/build': {
    eyebrow: 'Build Sermon/Lesson',
    title: 'Shape your study into a clear message.',
    body: 'This is where Larry will help you turn your passage and notes into one sermon, lesson, outline, or teaching plan.',
    primaryLabel: 'Plan a series',
    primaryRoute: '/plan-series',
    tips: ['Name the message goal.', 'Create a simple outline.', 'Add illustrations, application, and a closing call to respond.'],
  },
}

export default function WorkflowAreaPage({ route }) {
  const content = pageContent[route] || pageContent['/read']

  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-800 dark:bg-stone-900 sm:p-10">
      <p className="text-sm font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">{content.eyebrow}</p>
      <h1 className="mt-2 text-3xl font-black tracking-tight text-stone-950 dark:text-white sm:text-5xl">{content.title}</h1>
      <p className="mt-5 max-w-3xl text-lg leading-8 text-stone-700 dark:text-stone-200">{content.body}</p>

      <div className="mt-8 rounded-2xl bg-stone-50 p-5 dark:bg-stone-950">
        <h2 className="text-xl font-black text-stone-950 dark:text-white">A simple way to begin</h2>
        <ul className="mt-4 space-y-3 text-stone-700 dark:text-stone-200">
          {content.tips.map((tip) => (
            <li key={tip} className="flex gap-3">
              <span className="font-black text-amber-700 dark:text-amber-300" aria-hidden="true">✓</span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          to={content.primaryRoute}
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-stone-950 px-6 py-3 font-bold text-white shadow-sm transition hover:bg-stone-800 focus:outline-none focus:ring-4 focus:ring-amber-300 dark:bg-white dark:text-stone-950 dark:hover:bg-stone-200"
        >
          {content.primaryLabel}
        </Link>
        <Link
          to="/"
          className="inline-flex min-h-12 items-center justify-center rounded-full border border-stone-300 bg-white px-6 py-3 font-bold text-stone-900 shadow-sm transition hover:bg-stone-50 focus:outline-none focus:ring-4 focus:ring-amber-300 dark:border-stone-600 dark:bg-stone-900 dark:text-white dark:hover:bg-stone-800"
        >
          Back to Home
        </Link>
      </div>
    </section>
  )
}
