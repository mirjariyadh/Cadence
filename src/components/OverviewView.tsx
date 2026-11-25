import { useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Pause,
  Play,
  Plus,
  Square,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useWorkspace } from '../context/WorkspaceContext';
import { buildWeeklyReport } from '../lib/analytics';
import {
  formatDecimalHours,
  formatHoursMinutes,
  formatShortDate,
  formatTimerClock,
  toDateKey,
} from '../lib/formatters';
import {
  FIELD_LIMITS,
  WORK_TYPE_META,
  type Task,
  type WorkspaceTab,
  type WorkType,
} from '../types/models';

interface OverviewViewProps {
  onNavigate: (tab: WorkspaceTab) => void;
  onOpenManualEntry: () => void;
  onStartTaskTimer: (task: Task) => void;
}

export function OverviewView({
  onNavigate,
  onOpenManualEntry,
  onStartTaskTimer,
}: OverviewViewProps) {
  const {
    dataLoading,
    settings,
    projects,
    tasks,
    timeEntries,
    activeTimer,
    elapsedSeconds,
    startTimer,
    pauseTimer,
    resumeTimer,
    stopAndSaveTimer,
    setTaskStatus,
    loadSampleWorkspace,
  } = useWorkspace();

  const activeProjects = useMemo(
    () => projects.filter((p) => p.status === 'active'),
    [projects]
  );

  const [quickProjectId, setQuickProjectId] = useState('');
  const [quickDesc, setQuickDesc] = useState('');
  const [quickWorkType, setQuickWorkType] = useState<WorkType>('deep_work');
  const [seeding, setSeeding] = useState(false);

  const resolvedQuickProjectId = quickProjectId || activeProjects[0]?.id || '';

  const todayKey = toDateKey(new Date());
  const todaySeconds = useMemo(
    () =>
      timeEntries
        .filter((e) => e.dateKey === todayKey)
        .reduce((sum, e) => sum + e.durationSeconds, 0),
    [timeEntries, todayKey]
  );

  const weekReport = useMemo(
    () => buildWeeklyReport(new Date(), timeEntries, tasks, projects, settings),
    [timeEntries, tasks, projects, settings]
  );

  const projectMap = useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects]
  );

  const openTasks = useMemo(() => {
    const priorityRank = { high: 0, medium: 1, low: 2 };
    return tasks
      .filter((t) => t.status !== 'done')
      .sort((a, b) => {
        if (priorityRank[a.priority] !== priorityRank[b.priority]) {
          return priorityRank[a.priority] - priorityRank[b.priority];
        }
        return (a.dueDate || '9999-12-31').localeCompare(b.dueDate || '9999-12-31');
      })
      .slice(0, 6);
  }, [tasks]);

  const recentEntries = useMemo(() => timeEntries.slice(0, 6), [timeEntries]);

  const dailyGoalHours = settings?.dailyTargetHours ?? 8;
  const todayPercent = Math.min(
    100,
    Math.round((todaySeconds / (dailyGoalHours * 3600)) * 100)
  );

  const handleQuickStart = async () => {
    await startTimer({
      projectId: resolvedQuickProjectId,
      taskId: '',
      description: quickDesc.trim() || 'Focused working session',
      workType: quickWorkType,
      billable: true,
      mode: 'stopwatch',
    });
    setQuickDesc('');
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await loadSampleWorkspace();
    } finally {
      setSeeding(false);
    }
  };

  if (dataLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-20 bg-white border border-slate-200 rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-28 bg-white border border-slate-200 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 h-80 bg-white border border-slate-200 rounded-xl" />
          <div className="lg:col-span-5 h-80 bg-white border border-slate-200 rounded-xl" />
        </div>
      </div>
    );
  }

  // Empty workspace onboarding state
  if (projects.length === 0 && timeEntries.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 max-w-2xl mx-auto mt-8 text-center">
        <h2 className="text-xl font-semibold text-slate-900 mb-2">
          Your workspace is ready
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed max-w-md mx-auto mb-8">
          Create your first project to organize tasks and start logging hours, or load a sample 2-week workspace to preview live timers and automated weekly productivity reports.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('projects')}
            className="min-h-[42px] inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Create First Project
          </button>
          <button
            type="button"
            disabled={seeding}
            onClick={() => void handleSeed()}
            className="min-h-[42px] inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors whitespace-nowrap disabled:opacity-50"
          >
            {seeding ? 'Populating Workspace...' : 'Load Sample Workspace'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Focus Timer Strip */}
      <section className="bg-white border border-slate-200 rounded-xl p-5">
        {activeTimer ? (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                <span className="font-medium text-blue-700">
                  {activeTimer.isPaused ? 'Paused Session' : 'Tracking Live'}
                </span>
                <span aria-hidden="true">·</span>
                <span>{projectMap.get(activeTimer.projectId)?.name ?? 'General Work'}</span>
                <span aria-hidden="true">·</span>
                <span>{WORK_TYPE_META[activeTimer.workType].shortLabel}</span>
              </div>
              <p className="text-sm font-medium text-slate-900 truncate">
                {activeTimer.description || 'Focused working session'}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className="font-mono tabular-nums text-2xl font-semibold text-slate-900 tracking-tight pr-2">
                {formatTimerClock(elapsedSeconds)}
              </span>
              <button
                type="button"
                onClick={() => void (activeTimer.isPaused ? resumeTimer() : pauseTimer())}
                className="min-h-[40px] inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors whitespace-nowrap"
              >
                {activeTimer.isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                {activeTimer.isPaused ? 'Resume' : 'Pause'}
              </button>
              <button
                type="button"
                onClick={() => void stopAndSaveTimer()}
                className="min-h-[40px] inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors whitespace-nowrap"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                Stop &amp; Save
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <input
              type="text"
              maxLength={FIELD_LIMITS.ENTRY_DESCRIPTION_MAX}
              value={quickDesc}
              onChange={(e) => setQuickDesc(e.target.value)}
              placeholder="What are you working on right now?"
              className="flex-1 min-h-[40px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0">
              <select
                aria-label="Select project for quick timer"
                value={resolvedQuickProjectId}
                onChange={(e) => setQuickProjectId(e.target.value)}
                className="min-h-[40px] px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 max-w-[190px]"
              >
                {activeProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <select
                aria-label="Select work category"
                value={quickWorkType}
                onChange={(e) => setQuickWorkType(e.target.value as WorkType)}
                className="min-h-[40px] px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              >
                {(Object.keys(WORK_TYPE_META) as WorkType[]).map((wt) => (
                  <option key={wt} value={wt}>
                    {WORK_TYPE_META[wt].shortLabel}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void handleQuickStart()}
                className="min-h-[40px] inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Play className="w-4 h-4 fill-current" />
                Start Timer
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 4-column Tabular KPI Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500 mb-2">Logged Today</p>
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono tabular-nums text-2xl font-semibold text-slate-900">
              {formatHoursMinutes(todaySeconds)}
            </span>
            <span className="font-mono tabular-nums text-xs text-slate-500">
              / {dailyGoalHours}h goal
            </span>
          </div>
          <div className="mt-3 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all"
              style={{ width: `${todayPercent}%` }}
            />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500 mb-2">This Week</p>
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono tabular-nums text-2xl font-semibold text-slate-900">
              {formatDecimalHours(weekReport.totalSeconds)}
            </span>
            <span className="font-mono tabular-nums text-xs text-slate-500">
              {weekReport.targetAttainmentPercent}% of {weekReport.targetHours}h
            </span>
          </div>
          <div className="mt-3 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-slate-900 rounded-full transition-all"
              style={{ width: `${Math.min(100, weekReport.targetAttainmentPercent)}%` }}
            />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500 mb-2">Deep Work Share</p>
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono tabular-nums text-2xl font-semibold text-slate-900">
              {weekReport.deepWorkPercent}%
            </span>
            <span className="font-mono tabular-nums text-xs text-slate-500">
              {formatHoursMinutes(weekReport.deepWorkSeconds)}
            </span>
          </div>
          <p className="mt-2.5 text-xs text-slate-500">
            Avg block {formatHoursMinutes(weekReport.avgSessionSeconds)}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500 mb-2">Tasks Completed (Week)</p>
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono tabular-nums text-2xl font-semibold text-slate-900">
              {weekReport.completedTasks.length}
            </span>
            <span className="font-mono tabular-nums text-xs text-slate-500">
              {openTasks.length} open
            </span>
          </div>
          <p className="mt-2.5 text-xs text-slate-500">
            Across {activeProjects.length} active {activeProjects.length === 1 ? 'project' : 'projects'}
          </p>
        </div>
      </section>

      {/* Main 2-column Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Weekly Pace Chart + Recent Logs */}
        <div className="lg:col-span-7 space-y-6">
          <section className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center justify-between gap-4 mb-5">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Weekly Working Hours
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">{weekReport.weekLabel}</p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('reports')}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 whitespace-nowrap shrink-0"
              >
                Full Weekly Report
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={weekReport.dailySeries}
                  margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="dayLabel"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 12 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    tickFormatter={(v: number) => `${v}h`}
                  />
                  <Tooltip
                    cursor={{ fill: '#f1f5f9' }}
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderColor: '#e2e8f0',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value, name) => [
                      `${Number(value ?? 0).toFixed(2)}h`,
                      WORK_TYPE_META[String(name) as WorkType]?.shortLabel ?? String(name ?? ''),
                    ]}
                  />
                  <ReferenceLine
                    y={dailyGoalHours}
                    stroke="#94a3b8"
                    strokeDasharray="4 4"
                    label={{
                      value: `${dailyGoalHours}h target`,
                      position: 'insideTopRight',
                      fill: '#64748b',
                      fontSize: 11,
                    }}
                  />
                  <Bar dataKey="deep_work" stackId="a" fill="#2563EB" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="planning" stackId="a" fill="#0D9488" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="meetings" stackId="a" fill="#D97706" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="admin" stackId="a" fill="#64748B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600">
              {(Object.keys(WORK_TYPE_META) as WorkType[]).map((key) => (
                <span key={key} className="inline-flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-[2px] shrink-0"
                    style={{ backgroundColor: WORK_TYPE_META[key].color }}
                    aria-hidden="true"
                  />
                  {WORK_TYPE_META[key].shortLabel}
                </span>
              ))}
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <h2 className="text-base font-semibold text-slate-900">Recent Sessions</h2>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={onOpenManualEntry}
                  className="text-xs font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap"
                >
                  Log Manual Hours
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('timer')}
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 whitespace-nowrap"
                >
                  View All
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {recentEntries.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No sessions recorded yet. Start the timer above or log manual hours.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentEntries.map((entry) => {
                  const project = projectMap.get(entry.projectId);
                  return (
                    <div
                      key={entry.id}
                      className="px-6 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {entry.description || 'Working session'}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                          <span className="inline-flex items-center gap-1.5 truncate">
                            <span
                              className="w-2 h-2 rounded-[2px] shrink-0"
                              style={{ backgroundColor: project?.color ?? '#64748B' }}
                              aria-hidden="true"
                            />
                            {project?.name ?? 'Project'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{WORK_TYPE_META[entry.workType].shortLabel}</span>
                          <span aria-hidden="true">·</span>
                          <span>{formatShortDate(entry.dateKey)}</span>
                        </div>
                      </div>
                      <span className="font-mono tabular-nums text-sm font-medium text-slate-900 shrink-0">
                        {formatHoursMinutes(entry.durationSeconds)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Right: Priority Project Tasks Queue */}
        <div className="lg:col-span-5">
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Priority Tasks</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Start a live timer directly from any task
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('projects')}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 whitespace-nowrap shrink-0"
              >
                Manage Tasks
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {openTasks.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-slate-500 mb-4">
                  All caught up. Add a new task in Projects &amp; Tasks.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate('projects')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Task
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {openTasks.map((task) => {
                  const project = projectMap.get(task.projectId);
                  const isRunningThisTask = activeTimer?.taskId === task.id;
                  return (
                    <div
                      key={task.id}
                      className="px-5 py-3.5 flex items-start justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={() => void setTaskStatus(task.id, 'done')}
                          aria-label={`Mark ${task.title} complete`}
                          className="mt-0.5 text-slate-400 hover:text-emerald-600 transition-colors shrink-0"
                        >
                          {task.status === 'done' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Circle className="w-4 h-4" />
                          )}
                        </button>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 leading-snug">
                            {task.title}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 mt-1">
                            <span className="inline-flex items-center gap-1.5">
                              <span
                                className="w-2 h-2 rounded-[2px] shrink-0"
                                style={{ backgroundColor: project?.color ?? '#64748B' }}
                                aria-hidden="true"
                              />
                              {project?.name ?? 'Project'}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span
                              className={
                                task.priority === 'high'
                                  ? 'text-red-600 font-medium'
                                  : task.priority === 'medium'
                                    ? 'text-amber-700'
                                    : 'text-slate-500'
                              }
                            >
                              {task.priority === 'high'
                                ? 'High priority'
                                : task.priority === 'medium'
                                  ? 'Medium'
                                  : 'Low'}
                            </span>
                            {task.dueDate && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>Due {formatShortDate(task.dueDate)}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onStartTaskTimer(task)}
                        disabled={isRunningThisTask}
                        title={isRunningThisTask ? 'Timer running on this task' : 'Start timer for this task'}
                        className={`p-2 rounded-lg transition-colors shrink-0 ${
                          isRunningThisTask
                            ? 'text-blue-600 bg-blue-50'
                            : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'
                        }`}
                        aria-label={`Start timer for ${task.title}`}
                      >
                        <Play className="w-4 h-4 fill-current" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
