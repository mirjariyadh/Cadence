import { useMemo, useState } from 'react';
import {
  Pause,
  Pencil,
  Play,
  Plus,
  Search,
  Square,
  Trash2,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import {
  formatDayHeading,
  formatHoursMinutes,
  formatTimeRange,
  formatTimerClock,
} from '../lib/formatters';
import {
  FIELD_LIMITS,
  WORK_TYPE_META,
  type TimeEntry,
  type TimerMode,
  type WorkType,
} from '../types/models';

interface TimerLogsViewProps {
  onOpenManualEntry: (entry: TimeEntry | null) => void;
}

const TIMER_MODES: Array<{ id: TimerMode; label: string; targetSeconds: number | null }> = [
  { id: 'stopwatch', label: 'Stopwatch', targetSeconds: null },
  { id: 'focus_25', label: '25m Focus', targetSeconds: 25 * 60 },
  { id: 'focus_50', label: '50m Deep Focus', targetSeconds: 50 * 60 },
];

export function TimerLogsView({ onOpenManualEntry }: TimerLogsViewProps) {
  const {
    projects,
    tasks,
    timeEntries,
    activeTimer,
    elapsedSeconds,
    startTimer,
    pauseTimer,
    resumeTimer,
    updateLiveTimer,
    stopAndSaveTimer,
    discardTimer,
    deleteEntry,
  } = useWorkspace();

  const activeProjects = useMemo(
    () => projects.filter((p) => p.status === 'active'),
    [projects]
  );

  // Draft timer fields when idle
  const [draftProjectId, setDraftProjectId] = useState('');
  const [draftTaskId, setDraftTaskId] = useState('');
  const [draftDesc, setDraftDesc] = useState('');
  const [liveDescDraft, setLiveDescDraft] = useState<string | null>(null);
  const [draftWorkType, setDraftWorkType] = useState<WorkType>('deep_work');
  const [draftBillable, setDraftBillable] = useState(true);
  const [draftMode, setDraftMode] = useState<TimerMode>('stopwatch');

  // Filters for time log table
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProject, setFilterProject] = useState('all');
  const [filterCategory, setFilterCategory] = useState<'all' | WorkType>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const currentProjectId = activeTimer
    ? activeTimer.projectId
    : draftProjectId || activeProjects[0]?.id || '';
  const currentTaskId = activeTimer ? activeTimer.taskId : draftTaskId;
  const currentDesc = activeTimer
    ? liveDescDraft ?? activeTimer.description
    : draftDesc;
  const currentWorkType = activeTimer ? activeTimer.workType : draftWorkType;
  const currentBillable = activeTimer ? activeTimer.billable : draftBillable;
  const currentMode = activeTimer ? activeTimer.mode : draftMode;

  const projectTasks = useMemo(
    () => tasks.filter((t) => t.projectId === currentProjectId && t.status !== 'done'),
    [tasks, currentProjectId]
  );

  const projectMap = useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects]
  );
  const taskMap = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const activeModeConfig = TIMER_MODES.find((m) => m.id === currentMode) ?? TIMER_MODES[0];
  const focusTargetSeconds = activeModeConfig.targetSeconds;
  const focusProgressPercent =
    focusTargetSeconds && activeTimer
      ? Math.min(100, Math.round((elapsedSeconds / focusTargetSeconds) * 100))
      : 0;
  const remainingFocusSeconds =
    focusTargetSeconds && activeTimer
      ? Math.max(0, focusTargetSeconds - elapsedSeconds)
      : focusTargetSeconds ?? 0;

  const handleMetaUpdate = (
    patch: Partial<{
      projectId: string;
      taskId: string;
      description: string;
      workType: WorkType;
      billable: boolean;
      mode: TimerMode;
    }>
  ) => {
    if (activeTimer) {
      void updateLiveTimer({
        projectId: patch.projectId ?? activeTimer.projectId,
        taskId: patch.taskId ?? activeTimer.taskId,
        description: patch.description ?? activeTimer.description,
        workType: patch.workType ?? activeTimer.workType,
        billable: patch.billable ?? activeTimer.billable,
        mode: patch.mode ?? activeTimer.mode,
      });
    } else {
      if (patch.projectId !== undefined) setDraftProjectId(patch.projectId);
      if (patch.taskId !== undefined) setDraftTaskId(patch.taskId);
      if (patch.description !== undefined) setDraftDesc(patch.description);
      if (patch.workType !== undefined) setDraftWorkType(patch.workType);
      if (patch.billable !== undefined) setDraftBillable(patch.billable);
      if (patch.mode !== undefined) setDraftMode(patch.mode);
    }
  };

  const handleStart = async () => {
    await startTimer({
      projectId: currentProjectId,
      taskId: currentTaskId,
      description: currentDesc.trim() || 'Focused working session',
      workType: currentWorkType,
      billable: currentBillable,
      mode: currentMode,
    });
  };

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return timeEntries.filter((entry) => {
      if (filterProject !== 'all' && entry.projectId !== filterProject) return false;
      if (filterCategory !== 'all' && entry.workType !== filterCategory) return false;
      if (q) {
        const projName = projectMap.get(entry.projectId)?.name.toLowerCase() ?? '';
        const taskTitle = entry.taskId ? taskMap.get(entry.taskId)?.title.toLowerCase() ?? '' : '';
        const matches =
          entry.description.toLowerCase().includes(q) ||
          projName.includes(q) ||
          taskTitle.includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [timeEntries, searchQuery, filterProject, filterCategory, projectMap, taskMap]);

  const groupedByDay = useMemo(() => {
    const groups = new Map<string, { dateKey: string; totalSeconds: number; entries: TimeEntry[] }>();
    for (const entry of filteredEntries) {
      const group = groups.get(entry.dateKey) ?? {
        dateKey: entry.dateKey,
        totalSeconds: 0,
        entries: [],
      };
      group.totalSeconds += entry.durationSeconds;
      group.entries.push(entry);
      groups.set(entry.dateKey, group);
    }
    return Array.from(groups.values()).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [filteredEntries]);

  return (
    <div className="space-y-6">
      {/* Live Timer Instrument Panel */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit mb-4">
              {TIMER_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleMetaUpdate({ mode: m.id })}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    currentMode === m.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <div className="flex items-baseline gap-4">
              <span className="font-mono tabular-nums text-5xl sm:text-6xl font-semibold tracking-tight text-slate-900">
                {formatTimerClock(elapsedSeconds)}
              </span>
              {focusTargetSeconds && (
                <span className="font-mono tabular-nums text-sm text-slate-500">
                  {activeTimer
                    ? remainingFocusSeconds === 0
                      ? 'Interval complete'
                      : `${formatTimerClock(remainingFocusSeconds)} left`
                    : `Target ${formatTimerClock(focusTargetSeconds)}`}
                </span>
              )}
            </div>

            {focusTargetSeconds && activeTimer && (
              <div className="mt-3 max-w-sm h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    remainingFocusSeconds === 0 ? 'bg-emerald-600' : 'bg-blue-600'
                  }`}
                  style={{ width: `${focusProgressPercent}%` }}
                />
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {!activeTimer ? (
              <button
                type="button"
                onClick={() => void handleStart()}
                className="min-h-[44px] inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap"
              >
                <Play className="w-4 h-4 fill-current" />
                Start Focus Session
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => void (activeTimer.isPaused ? resumeTimer() : pauseTimer())}
                  className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors whitespace-nowrap"
                >
                  {activeTimer.isPaused ? (
                    <>
                      <Play className="w-4 h-4" />
                      Resume
                    </>
                  ) : (
                    <>
                      <Pause className="w-4 h-4" />
                      Pause
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => void stopAndSaveTimer()}
                  className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors whitespace-nowrap"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  Stop &amp; Log
                </button>
                <button
                  type="button"
                  onClick={() => void discardTimer()}
                  className="min-h-[44px] px-3.5 py-2.5 text-xs font-medium text-slate-500 hover:text-red-600 rounded-lg transition-colors whitespace-nowrap"
                >
                  Discard
                </button>
              </>
            )}
          </div>
        </div>

        {/* Session Details Controls */}
        <div className="pt-5 grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-5">
            <label htmlFor="timer-desc" className="block text-xs font-medium text-slate-600 mb-1.5">
              Session Note
            </label>
            <input
              id="timer-desc"
              type="text"
              maxLength={FIELD_LIMITS.ENTRY_DESCRIPTION_MAX}
              placeholder="Describe the milestone or deliverable..."
              value={currentDesc}
              onChange={(e) => {
                if (activeTimer) {
                  setLiveDescDraft(e.target.value);
                } else {
                  setDraftDesc(e.target.value);
                }
              }}
              onBlur={() => {
                if (activeTimer && liveDescDraft !== null && liveDescDraft !== activeTimer.description) {
                  handleMetaUpdate({ description: liveDescDraft });
                }
                setLiveDescDraft(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && activeTimer && liveDescDraft !== null) {
                  handleMetaUpdate({ description: liveDescDraft });
                  setLiveDescDraft(null);
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="w-full min-h-[40px] px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          <div className="md:col-span-3">
            <label htmlFor="timer-project" className="block text-xs font-medium text-slate-600 mb-1.5">
              Project
            </label>
            <select
              id="timer-project"
              value={currentProjectId}
              onChange={(e) =>
                handleMetaUpdate({ projectId: e.target.value, taskId: '' })
              }
              className="w-full min-h-[40px] px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            >
              {activeProjects.length === 0 && <option value="">Default General Work</option>}
              {activeProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="timer-task" className="block text-xs font-medium text-slate-600 mb-1.5">
              Task
            </label>
            <select
              id="timer-task"
              value={currentTaskId}
              onChange={(e) => handleMetaUpdate({ taskId: e.target.value })}
              disabled={!currentProjectId}
              className="w-full min-h-[40px] px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 disabled:bg-slate-50"
            >
              <option value="">None</option>
              {projectTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="timer-category" className="block text-xs font-medium text-slate-600 mb-1.5">
              Category
            </label>
            <select
              id="timer-category"
              value={currentWorkType}
              onChange={(e) => handleMetaUpdate({ workType: e.target.value as WorkType })}
              className="w-full min-h-[40px] px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            >
              {(Object.keys(WORK_TYPE_META) as WorkType[]).map((key) => (
                <option key={key} value={key}>
                  {WORK_TYPE_META[key].shortLabel}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-4">
          <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={currentBillable}
              onChange={(e) => handleMetaUpdate({ billable: e.target.checked })}
              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Billable session</span>
          </label>
          <button
            type="button"
            onClick={() => onOpenManualEntry(null)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            Log Past Hours Manually
          </button>
        </div>
      </section>

      {/* Filterable Time Logs Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Time Log Ledger</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {filteredEntries.length} {filteredEntries.length === 1 ? 'session' : 'sessions'} · Total{' '}
              <span className="font-mono tabular-nums font-medium text-slate-700">
                {formatHoursMinutes(
                  filteredEntries.reduce((s, e) => s + e.durationSeconds, 0)
                )}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search notes or projects..."
                className="min-h-[36px] pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 w-48"
              />
            </div>

            <select
              aria-label="Filter logs by project"
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
              className="min-h-[36px] px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            >
              <option value="all">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter logs by category"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as 'all' | WorkType)}
              className="min-h-[36px] px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            >
              <option value="all">All Categories</option>
              {(Object.keys(WORK_TYPE_META) as WorkType[]).map((key) => (
                <option key={key} value={key}>
                  {WORK_TYPE_META[key].shortLabel}
                </option>
              ))}
            </select>
          </div>
        </div>

        {groupedByDay.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-slate-500 mb-4">
              {timeEntries.length === 0
                ? 'No working hours logged yet.'
                : 'No entries match your active filters.'}
            </p>
            <button
              type="button"
              onClick={() => onOpenManualEntry(null)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              Log First Entry
            </button>
          </div>
        ) : (
          <div>
            {groupedByDay.map((group) => (
              <div key={group.dateKey} className="border-b border-slate-200 last:border-b-0">
                <div className="px-6 py-2.5 bg-slate-50 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">
                    {formatDayHeading(group.dateKey)}
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900">
                    {formatHoursMinutes(group.totalSeconds)}
                  </span>
                </div>

                <div className="divide-y divide-slate-100">
                  {group.entries.map((entry) => {
                    const project = projectMap.get(entry.projectId);
                    const task = entry.taskId ? taskMap.get(entry.taskId) : undefined;
                    return (
                      <div
                        key={entry.id}
                        className="px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {entry.description || 'Working session'}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 mt-0.5">
                            <span className="inline-flex items-center gap-1.5 text-slate-700 font-medium">
                              <span
                                className="w-2 h-2 rounded-[2px] shrink-0"
                                style={{ backgroundColor: project?.color ?? '#64748B' }}
                                aria-hidden="true"
                              />
                              {project?.name ?? 'Deleted Project'}
                            </span>
                            {task && (
                              <>
                                <span aria-hidden="true">/</span>
                                <span className="truncate max-w-[240px]">{task.title}</span>
                              </>
                            )}
                            <span aria-hidden="true">·</span>
                            <span>{WORK_TYPE_META[entry.workType].shortLabel}</span>
                            <span aria-hidden="true">·</span>
                            <span className={entry.billable ? 'text-emerald-700' : 'text-slate-400'}>
                              {entry.billable ? 'Billable' : 'Non-billable'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0">
                          <span className="font-mono tabular-nums text-xs text-slate-500">
                            {formatTimeRange(entry.startTime, entry.endTime)}
                          </span>
                          <span className="font-mono tabular-nums text-sm font-semibold text-slate-900 w-16 text-right">
                            {formatHoursMinutes(entry.durationSeconds)}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onOpenManualEntry(entry)}
                              aria-label="Edit entry"
                              className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            {confirmDeleteId === entry.id ? (
                              <button
                                type="button"
                                onClick={() => {
                                  void deleteEntry(entry.id);
                                  setConfirmDeleteId(null);
                                }}
                                className="px-2 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-md whitespace-nowrap"
                              >
                                Delete
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(entry.id)}
                                aria-label="Delete entry"
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
