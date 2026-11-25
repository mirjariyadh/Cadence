import { useMemo, useState } from 'react';
import { addWeeks, subWeeks } from 'date-fns';
import {
  BookmarkCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Printer,
  Trash2,
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
import { buildWeeklyCsv, buildWeeklyReport } from '../lib/analytics';
import {
  formatCurrency,
  formatDecimalHours,
  formatHoursMinutes,
  formatShortDate,
} from '../lib/formatters';
import { WORK_TYPE_META, type WorkType } from '../types/models';

export function WeeklyReportView() {
  const {
    settings,
    projects,
    tasks,
    timeEntries,
    weeklySnapshots,
    saveWeeklySnapshot,
    deleteWeeklySnapshot,
  } = useWorkspace();

  const [weekCursor, setWeekCursor] = useState<Date>(() => new Date());
  const [chartMode, setChartMode] = useState<'category' | 'project'>('category');
  const [savingSnapshot, setSavingSnapshot] = useState(false);
  const [snapshotSavedMsg, setSnapshotSavedMsg] = useState(false);

  const report = useMemo(
    () => buildWeeklyReport(weekCursor, timeEntries, tasks, projects, settings),
    [weekCursor, timeEntries, tasks, projects, settings]
  );

  const projectMap = useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects]
  );

  // Flatten daily data for Recharts when stacking by project
  const projectChartSeries = useMemo(() => {
    return report.dailySeries.map((day) => {
      const row: Record<string, string | number> = {
        dayLabel: day.dayLabel,
        fullLabel: day.fullLabel,
      };
      for (const alloc of report.projectAllocations) {
        row[alloc.projectId] = day.byProject[alloc.projectId] ?? 0;
      }
      return row;
    });
  }, [report.dailySeries, report.projectAllocations]);

  const handleExportCsv = () => {
    const csv = buildWeeklyCsv(report, projects, tasks);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cadence-weekly-report-${report.weekStart}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSaveSnapshot = async () => {
    setSavingSnapshot(true);
    try {
      await saveWeeklySnapshot({
        weekStart: report.weekStart,
        weekEnd: report.weekEnd,
        totalSeconds: report.totalSeconds,
        deepWorkSeconds: report.deepWorkSeconds,
        billableSeconds: report.billableSeconds,
        billableAmount: report.billableAmount,
        tasksCompleted: report.completedTasks.length,
        targetHours: report.targetHours,
        summaryNote: report.executiveSummary,
      });
      setSnapshotSavedMsg(true);
      window.setTimeout(() => setSnapshotSavedMsg(false), 3000);
    } finally {
      setSavingSnapshot(false);
    }
  };

  const isCurrentWeek = useMemo(() => {
    const nowReport = buildWeeklyReport(new Date(), [], [], [], settings);
    return nowReport.weekStart === report.weekStart;
  }, [report.weekStart, settings]);

  return (
    <div className="space-y-6 print-full">
      {/* Report Header & Week Switcher */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-slate-500">
              Automated Weekly Productivity Report
              {settings?.displayName ? ` · ${settings.displayName}` : ''}
            </p>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
              {report.weekLabel}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 no-print">
            <div className="inline-flex items-center border border-slate-300 rounded-lg bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => setWeekCursor((d) => subWeeks(d, 1))}
                aria-label="Previous week"
                className="min-h-[38px] px-2.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setWeekCursor(new Date())}
                disabled={isCurrentWeek}
                className="min-h-[38px] px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 border-x border-slate-200 disabled:text-slate-400 whitespace-nowrap"
              >
                This Week
              </button>
              <button
                type="button"
                onClick={() => setWeekCursor((d) => addWeeks(d, 1))}
                aria-label="Next week"
                className="min-h-[38px] px-2.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={report.weekEntries.length === 0}
              className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / PDF
            </button>

            <button
              type="button"
              disabled={savingSnapshot || report.totalSeconds === 0}
              onClick={() => void handleSaveSnapshot()}
              className="min-h-[38px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap"
            >
              {snapshotSavedMsg ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Snapshot Saved
                </>
              ) : (
                <>
                  <BookmarkCheck className="w-3.5 h-3.5" />
                  {savingSnapshot ? 'Saving...' : 'Save Snapshot'}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Automated Executive Summary Paragraph */}
        <p className="mt-4 pt-4 border-t border-slate-100 text-sm text-slate-600 leading-relaxed max-w-4xl">
          {report.executiveSummary}
        </p>
      </section>

      {/* 4-column Executive KPI Summary */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 print-break-avoid">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500 mb-1.5">Total Hours Logged</p>
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono tabular-nums text-2xl font-bold text-slate-900">
              {formatDecimalHours(report.totalSeconds)}
            </span>
            <span className="font-mono tabular-nums text-xs text-slate-500">
              {report.targetAttainmentPercent}% of {report.targetHours}h
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500 font-mono tabular-nums">
            {report.deltaPercent !== null
              ? `${report.deltaPercent >= 0 ? '+' : ''}${report.deltaPercent}% vs prior week (${formatDecimalHours(report.prevTotalSeconds)})`
              : `${report.sessionCount} logged ${report.sessionCount === 1 ? 'session' : 'sessions'}`}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500 mb-1.5">Deep Work Ratio</p>
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono tabular-nums text-2xl font-bold text-slate-900">
              {report.deepWorkPercent}%
            </span>
            <span className="font-mono tabular-nums text-xs text-slate-500">
              {formatHoursMinutes(report.deepWorkSeconds)}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500 font-mono tabular-nums">
            {report.prevTotalSeconds > 0
              ? `Prior week ${report.prevDeepWorkPercent}%`
              : `Longest block ${formatHoursMinutes(report.longestSessionSeconds)}`}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500 mb-1.5">Tasks Completed</p>
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono tabular-nums text-2xl font-bold text-slate-900">
              {report.completedTasks.length}
            </span>
            <span className="text-xs text-slate-500">
              {report.daysActive}/7 active days
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {report.daysMeetingTarget}{' '}
            {report.daysMeetingTarget === 1 ? 'day' : 'days'} hit {report.dailyTargetHours}h daily goal
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500 mb-1.5">Billable Output</p>
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono tabular-nums text-2xl font-bold text-slate-900">
              {formatCurrency(report.billableAmount)}
            </span>
            <span className="font-mono tabular-nums text-xs text-slate-500">
              {report.billablePercent}% billable
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500 font-mono tabular-nums">
            {formatDecimalHours(report.billableSeconds)} billable hours
          </p>
        </div>
      </section>

      {/* Automated Productivity Insights */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 print-break-avoid">
        <h3 className="text-base font-semibold text-slate-900 mb-4">
          Automated Productivity Insights
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 divide-y md:divide-y-0 md:divide-x divide-slate-100">
          {report.insights.map((insight, idx) => (
            <div key={insight.id} className={idx > 0 ? 'pt-4 md:pt-0 md:pl-6' : ''}>
              <p
                className={`text-xs font-semibold mb-1.5 ${
                  insight.tone === 'positive'
                    ? 'text-emerald-700'
                    : insight.tone === 'attention'
                      ? 'text-amber-700'
                      : 'text-slate-600'
                }`}
              >
                {insight.tone === 'positive'
                  ? 'On Track'
                  : insight.tone === 'attention'
                    ? 'Attention Recommended'
                    : 'Weekly Pacing'}
              </p>
              <h4 className="text-sm font-semibold text-slate-900 mb-1">
                {insight.title}
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">{insight.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Daily Hours Chart + Work Mode & Focus Rhythm */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start print-break-avoid">
        <section className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Daily Hours Breakdown
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Stacked hours per day against {report.dailyTargetHours}h daily target
              </p>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg no-print">
              <button
                type="button"
                onClick={() => setChartMode('category')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  chartMode === 'category'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                By Category
              </button>
              <button
                type="button"
                onClick={() => setChartMode('project')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  chartMode === 'project'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                By Project
              </button>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {chartMode === 'category' ? (
                <BarChart
                  data={report.dailySeries}
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
                    y={report.dailyTargetHours}
                    stroke="#94a3b8"
                    strokeDasharray="4 4"
                  />
                  <Bar dataKey="deep_work" stackId="cat" fill="#2563EB" />
                  <Bar dataKey="planning" stackId="cat" fill="#0D9488" />
                  <Bar dataKey="meetings" stackId="cat" fill="#D97706" />
                  <Bar dataKey="admin" stackId="cat" fill="#64748B" radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : (
                <BarChart
                  data={projectChartSeries}
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
                      projectMap.get(String(name ?? ''))?.name ?? 'Project',
                    ]}
                  />
                  <ReferenceLine
                    y={report.dailyTargetHours}
                    stroke="#94a3b8"
                    strokeDasharray="4 4"
                  />
                  {report.projectAllocations.map((alloc, i) => (
                    <Bar
                      key={alloc.projectId}
                      dataKey={alloc.projectId}
                      stackId="proj"
                      fill={alloc.color}
                      radius={
                        i === report.projectAllocations.length - 1
                          ? [4, 4, 0, 0]
                          : [0, 0, 0, 0]
                      }
                    />
                  ))}
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </section>

        <section className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div>
            <h3 className="text-base font-semibold text-slate-900 mb-3">
              Work Mode Split
            </h3>
            <div className="space-y-3">
              {report.workCategories.map((cat) => (
                <div key={cat.workType}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="inline-flex items-center gap-2 text-slate-700 font-medium">
                      <span
                        className="w-2.5 h-2.5 rounded-[2px] shrink-0"
                        style={{ backgroundColor: cat.color }}
                        aria-hidden="true"
                      />
                      {cat.label}
                    </span>
                    <span className="font-mono tabular-nums text-slate-600">
                      {formatHoursMinutes(cat.seconds)} · {cat.sharePercent}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${cat.sharePercent}%`,
                        backgroundColor: cat.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-2.5 text-xs">
            <h4 className="font-semibold text-slate-900">Focus Rhythm</h4>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Peak focus day</span>
              <span className="font-mono tabular-nums font-medium text-slate-900">
                {report.peakDayHours > 0
                  ? `${report.peakDayLabel} (${report.peakDayHours.toFixed(1)}h)`
                  : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Average session length</span>
              <span className="font-mono tabular-nums font-medium text-slate-900">
                {formatHoursMinutes(report.avgSessionSeconds)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Longest uninterrupted block</span>
              <span className="font-mono tabular-nums font-medium text-slate-900">
                {formatHoursMinutes(report.longestSessionSeconds)}
              </span>
            </div>
          </div>
        </section>
      </div>

      {/* Project Allocation & Budget Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden print-break-avoid">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-900">
            Project Time Allocation &amp; Budget Health
          </h3>
        </div>

        {report.projectAllocations.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No project hours recorded during {report.weekLabel}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-3 px-6">Project</th>
                  <th className="py-3 px-4 text-right">Week Hours</th>
                  <th className="py-3 px-4 text-right">Share</th>
                  <th className="py-3 px-4 text-right">Tasks Done</th>
                  <th className="py-3 px-4 text-right">Billable Value</th>
                  <th className="py-3 px-6 text-right">Lifetime Budget</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {report.projectAllocations.map((row) => (
                  <tr key={row.projectId} className="hover:bg-slate-50/70">
                    <td className="py-3.5 px-6">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-2.5 h-2.5 rounded-[2px] shrink-0"
                          style={{ backgroundColor: row.color }}
                          aria-hidden="true"
                        />
                        <div>
                          <p className="font-medium text-slate-900">{row.name}</p>
                          <p className="text-xs text-slate-500">{row.client}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-medium text-slate-900">
                      {formatHoursMinutes(row.seconds)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-600">
                      {row.sharePercent}%
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-600">
                      {row.tasksCompletedThisWeek}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-900">
                      {row.billableAmount > 0 ? formatCurrency(row.billableAmount) : '—'}
                    </td>
                    <td className="py-3.5 px-6 text-right font-mono tabular-nums text-xs">
                      {row.budgetHours > 0 ? (
                        <span
                          className={
                            row.budgetUsedPercent >= 90
                              ? 'text-red-600 font-semibold'
                              : 'text-slate-600'
                          }
                        >
                          {row.lifetimeHours}h / {row.budgetHours}h ({row.budgetUsedPercent}%)
                        </span>
                      ) : (
                        <span className="text-slate-400">No cap</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Bottom 2-column: Completed Tasks Digest + Saved Report Snapshots */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden print-break-avoid">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">
              Completed Tasks This Week
            </h3>
            <span className="font-mono tabular-nums text-xs text-slate-500">
              {report.completedTasks.length} completed
            </span>
          </div>

          {report.completedTasks.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No tasks marked done during {report.weekLabel}.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {report.completedTasks.map((task) => {
                const project = projectMap.get(task.projectId);
                return (
                  <div key={task.id} className="px-6 py-3.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {task.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {project?.name ?? 'Project'} · Completed{' '}
                        {formatShortDate(task.completedAt.slice(0, 10))}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden no-print">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">
              Archived Weekly Snapshots
            </h3>
            <span className="font-mono tabular-nums text-xs text-slate-500">
              {weeklySnapshots.length} saved
            </span>
          </div>

          {weeklySnapshots.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Use &ldquo;Save Snapshot&rdquo; above to freeze an immutable record of any week&rsquo;s productivity report.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {weeklySnapshots.map((snap) => {
                const dwPct =
                  snap.totalSeconds > 0
                    ? Math.round((snap.deepWorkSeconds / snap.totalSeconds) * 100)
                    : 0;
                return (
                  <div
                    key={snap.id}
                    className="px-6 py-3.5 flex items-start justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        {formatShortDate(snap.weekStart)} – {formatShortDate(snap.weekEnd)}
                      </p>
                      <p className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                        {formatDecimalHours(snap.totalSeconds)} / {snap.targetHours}h · {dwPct}% deep work ·{' '}
                        {snap.tasksCompleted} tasks · {formatCurrency(snap.billableAmount)}
                      </p>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                        {snap.summaryNote}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void deleteWeeklySnapshot(snap.id)}
                      aria-label="Delete saved snapshot"
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
