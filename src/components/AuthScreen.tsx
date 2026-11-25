import { Clock, BarChart3, FolderKanban, ShieldCheck } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';

export function AuthScreen() {
  const { signInWithGoogle, authError } = useWorkspace();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="w-full max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <span className="text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
          Cadence
        </span>
        <span className="text-xs text-slate-500 whitespace-nowrap shrink-0">
          Personal Time &amp; Productivity Workspace
        </span>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 leading-[1.12]">
              Track your working hours, tasks, and weekly focus in one calm studio.
            </h1>
            <p className="text-base text-slate-600 leading-relaxed max-w-xl">
              Cadence pairs a synchronized focus timer with project task planning and automatic weekly productivity reports—showing exactly where your deep work goes every week.
            </p>

            <div className="pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div>
                <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm mb-1.5">
                  <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Live Focus Timer</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Stopwatch and 25m / 50m focus intervals synced across tabs and devices.
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm mb-1.5">
                  <FolderKanban className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Project Tasks</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Organize work by client, hourly rate, hour budget, and one-click task timers.
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm mb-1.5">
                  <BarChart3 className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Weekly Reports</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Automatic weekly pacing, deep-work ratio, billable value, and CSV or PDF exports.
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="bg-white border border-slate-200 rounded-xl p-8">
              <h2 className="text-xl font-semibold text-slate-900 mb-2">
                Sign in to your workspace
              </h2>
              <p className="text-sm text-slate-500 leading-relaxed mb-6">
                Your hours, tasks, active timer, and weekly reports stay private to your Google account.
              </p>

              {authError && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  {authError}
                </div>
              )}

              <button
                type="button"
                onClick={() => void signInWithGoogle()}
                className="w-full min-h-[44px] flex items-center justify-center gap-3 px-5 py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 rounded-lg transition-colors whitespace-nowrap"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M21.35 11.1h-9.18v2.92h5.27c-.23 1.49-1.74 4.38-5.27 4.38-3.17 0-5.76-2.63-5.76-5.87s2.59-5.87 5.76-5.87c1.81 0 3.02.77 3.71 1.44l2.53-2.44C16.79 4.15 14.69 3.2 12.17 3.2 7.1 3.2 3 7.3 3 12.53s4.1 9.33 9.17 9.33c5.29 0 8.81-3.72 8.81-8.96 0-.6-.06-1.06-.15-1.8z"
                  />
                </svg>
                Continue with Google
              </button>

              <div className="mt-6 pt-5 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500">
                <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Private owner-only Firestore storage with real-time sync.</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
