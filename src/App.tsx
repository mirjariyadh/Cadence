import { useState } from 'react';
import { Menu, Play, Plus, Square } from 'lucide-react';
import { AuthScreen } from './components/AuthScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ManualEntryModal } from './components/ManualEntryModal';
import { OverviewView } from './components/OverviewView';
import { ProjectsTasksView } from './components/ProjectsTasksView';
import { SettingsModal } from './components/SettingsModal';
import { Sidebar } from './components/Sidebar';
import { TimerLogsView } from './components/TimerLogsView';
import { WeeklyReportView } from './components/WeeklyReportView';
import { useWorkspace, WorkspaceProvider } from './context/WorkspaceContext';
import { formatTimerClock } from './lib/formatters';
import type { Task, TimeEntry, WorkspaceTab } from './types/models';

const TAB_TITLES: Record<WorkspaceTab, string> = {
  overview: 'Overview',
  timer: 'Timer & Logs',
  projects: 'Projects & Tasks',
  reports: 'Weekly Report',
};

function WorkspaceShell() {
  const {
    user,
    authReady,
    projects,
    activeTimer,
    elapsedSeconds,
    startTimer,
    stopAndSaveTimer,
  } = useWorkspace();

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-sm text-slate-500">Loading workspace...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  const handleOpenManualEntry = (entry: TimeEntry | null = null) => {
    setEditingEntry(entry);
    setManualModalOpen(true);
  };

  const handleStartTaskTimer = async (task: Task) => {
    await startTimer({
      projectId: task.projectId,
      taskId: task.id,
      description: task.title,
      workType: 'deep_work',
      billable: true,
      mode: 'stopwatch',
    });
    setActiveTab('timer');
  };

  const handleHeaderPrimaryTimer = async () => {
    if (activeTimer) {
      await stopAndSaveTimer();
    } else {
      const defaultProject = projects.find((p) => p.status === 'active')?.id || '';
      await startTimer({
        projectId: defaultProject,
        taskId: '',
        description: 'Focused working session',
        workType: 'deep_work',
        billable: true,
        mode: 'stopwatch',
      });
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenSettings={() => setSettingsOpen(true)}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top contextual header */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 shrink-0 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-lg"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 hidden sm:inline whitespace-nowrap">
                Workspace
              </span>
              <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
                /
              </span>
              <h1 className="font-semibold text-slate-900 truncate">
                {TAB_TITLES[activeTab]}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {projects.length > 0 && (
              <button
                type="button"
                onClick={() => handleOpenManualEntry(null)}
                className="hidden sm:inline-flex min-h-[38px] items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Log Hours
              </button>
            )}

            <button
              type="button"
              onClick={() => void handleHeaderPrimaryTimer()}
              className={`min-h-[38px] inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                activeTimer
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {activeTimer ? (
                <>
                  <Square className="w-3 h-3 fill-current" />
                  <span className="font-mono tabular-nums">
                    {formatTimerClock(elapsedSeconds)}
                  </span>
                  <span>Stop</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Start Timer</span>
                </>
              )}
            </button>
          </div>
        </header>

        {/* Main scrollable viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1280px] w-full mx-auto">
          {activeTab === 'overview' && (
            <OverviewView
              onNavigate={setActiveTab}
              onOpenManualEntry={() => handleOpenManualEntry(null)}
              onStartTaskTimer={(task) => void handleStartTaskTimer(task)}
            />
          )}
          {activeTab === 'timer' && (
            <TimerLogsView onOpenManualEntry={handleOpenManualEntry} />
          )}
          {activeTab === 'projects' && (
            <ProjectsTasksView
              onStartTaskTimer={(task) => void handleStartTaskTimer(task)}
            />
          )}
          {activeTab === 'reports' && <WeeklyReportView />}
        </main>
      </div>

      <ManualEntryModal
        open={manualModalOpen}
        editingEntry={editingEntry}
        onClose={() => {
          setManualModalOpen(false);
          setEditingEntry(null);
        }}
      />

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <WorkspaceProvider>
        <WorkspaceShell />
      </WorkspaceProvider>
    </ErrorBoundary>
  );
}
