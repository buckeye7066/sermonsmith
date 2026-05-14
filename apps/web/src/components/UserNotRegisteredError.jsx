export default function UserNotRegisteredError() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="max-w-md w-full text-center space-y-4 bg-white p-6 rounded-lg shadow border border-slate-200">
        <h1 className="text-xl font-semibold text-slate-800">Account Not Found</h1>
        <p className="text-slate-600">
          We couldn&apos;t find a Sermon Smith account for you. Please sign up or contact support.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <a
            href="/Login"
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-slate-700 rounded-lg hover:bg-slate-800"
          >
            Go to login
          </a>
          <a
            href="/"
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            Home
          </a>
        </div>
      </div>
    </div>
  );
}
