import {
  BarChart3,
  Clock,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Pause,
  Play,
  Settings,
  Square,
  X,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { formatTimerClock } from '../lib/formatters';
import type { WorkspaceTab } from '../types/models';

interface SidebarProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  onOpenSettings: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: Array<{ id: WorkspaceTab; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'timer', label: 'Timer & Logs', icon: Clock },
  { id: 'projects', label: 'Projects & Tasks', icon: FolderKanban },
  { id: 'reports', label: 'Weekly Report', icon: BarChart3 },
];

export function Sidebar({
  activeTab,
  onSelectTab,
  onOpenSettings,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const {
    user,
    settings,
    projects,
    activeTimer,
    elapsedSeconds,
    pauseTimer,
    resumeTimer,
    stopAndSaveTimer,
    signOutUser,
  } = useWorkspace();

  const activeProject = activeTimer
    ? projects.find((p) => p.id === activeTimer.projectId)
    : undefined;

  const content = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200 w-[248px]">
      {/* Brand header */}
      <div className="h-16 px-6 flex items-center justify-between border-b border-slate-200 shrink-0">
        <span className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
          Cadence
        </span>
        <button
          type="button"
          onClick={onCloseMobile}
          className="lg:hidden p-2 -mr-2 text-slate-500 hover:text-slate-900 rounded-lg"
          aria-label="Close navigation menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Primary navigation */}
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto" aria-label="Workspace navigation">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectTab(item.id);
                onCloseMobile();
              }}
              className={`w-full min-h-[40px] flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 ${
                  isActive ? 'text-blue-600' : 'text-slate-400'
                }`}
              />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Live active timer compact dock */}
      {activeTimer && (
        <div className="mx-3 mb-3 p-3.5 rounded-lg bg-slate-900 text-white">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-xs font-medium text-slate-300 truncate">
              {activeTimer.isPaused ? 'Timer Paused' : 'Session Running'}
            </span>
            <span className="font-mono tabular-nums text-sm font-semibold text-white">
              {formatTimerClock(elapsedSeconds)}
            </span>
          </div>
          <p className="text-xs text-slate-300 truncate mb-3">
            {activeProject ? activeProject.name : 'Unassigned'}
            {activeTimer.description ? ` · ${activeTimer.description}` : ''}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void (activeTimer.isPaused ? resumeTimer() : pauseTimer())}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-white rounded-md transition-colors whitespace-nowrap"
            >
              {activeTimer.isPaused ? (
                <>
                  <Play className="w-3.5 h-3.5" />
                  Resume
                </>
              ) : (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  Pause
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => void stopAndSaveTimer()}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors whitespace-nowrap"
            >
              <Square className="w-3 h-3 fill-current" />
              Stop
            </button>
          </div>
        </div>
      )}

      {/* Footer account & targets */}
      <div className="p-3 border-t border-slate-200 space-y-1 shrink-0">
        <button
          type="button"
          onClick={() => {
            onOpenSettings();
            onCloseMobile();
          }}
          className="w-full min-h-[40px] flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors whitespace-nowrap"
        >
          <Settings className="w-4 h-4 text-slate-400 shrink-0" />
          <span>Targets &amp; Settings</span>
        </button>

        <div className="px-3 py-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-900 truncate">
              {settings?.displayName || user?.displayName || 'Workspace Member'}
            </p>
            <p className="text-xs text-slate-500 truncate">
              {settings ? `${settings.weeklyTargetHours}h / week goal` : '40h / week goal'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void signOutUser()}
            title="Sign out"
            aria-label="Sign out"
            className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop persistent sidebar */}
      <aside className="hidden lg:block shrink-0 no-print">{content}</aside>

      {/* Mobile slide-over drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex no-print">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 flex h-full">{content}</div>
        </div>
      )}
    </>
  );
}
