export default function AssistantCard({ assistant }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <p className="text-sm font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">{assistant.role}</p>
      <h3 className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">{assistant.name}</h3>
      <p className="mt-3 text-lg leading-8 text-slate-700 dark:text-slate-300">{assistant.oneLineDescription}</p>
    </article>
  );
}
