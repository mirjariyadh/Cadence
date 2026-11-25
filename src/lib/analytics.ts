import {
  addDays,
  endOfWeek,
  format,
  startOfWeek,
  subWeeks,
} from 'date-fns';
import {
  WORK_TYPE_META,
  type Project,
  type Task,
  type TimeEntry,
  type UserSettings,
  type WorkType,
  type WorkweekStart,
} from '../types/models';
import { formatDecimalHours, formatHoursMinutes } from './formatters';

export interface DailyChartPoint {
  dateKey: string;
  dayLabel: string;
  fullLabel: string;
  totalHours: number;
  deep_work: number;
  meetings: number;
  planning: number;
  admin: number;
  byProject: Record<string, number>;
}

export interface ProjectAllocationRow {
  projectId: string;
  name: string;
  client: string;
  color: string;
  seconds: number;
  sharePercent: number;
  billableSeconds: number;
  billableAmount: number;
  hourlyRate: number;
  budgetHours: number;
  lifetimeHours: number;
  budgetUsedPercent: number;
  tasksCompletedThisWeek: number;
}

export interface WorkCategoryRow {
  workType: WorkType;
  label: string;
  color: string;
  seconds: number;
  sharePercent: number;
}

export interface ReportInsight {
  id: string;
  title: string;
  detail: string;
  tone: 'positive' | 'neutral' | 'attention';
}

export interface WeeklyReportData {
  weekStart: string;
  weekEnd: string;
  weekLabel: string;
  prevWeekStart: string;
  prevWeekEnd: string;
  totalSeconds: number;
  prevTotalSeconds: number;
  deltaSeconds: number;
  deltaPercent: number | null;
  targetHours: number;
  dailyTargetHours: number;
  targetAttainmentPercent: number;
  deepWorkSeconds: number;
  deepWorkPercent: number;
  prevDeepWorkPercent: number;
  billableSeconds: number;
  billablePercent: number;
  billableAmount: number;
  sessionCount: number;
  avgSessionSeconds: number;
  longestSessionSeconds: number;
  peakDayLabel: string;
  peakDayHours: number;
  daysActive: number;
  daysMeetingTarget: number;
  dailySeries: DailyChartPoint[];
  projectAllocations: ProjectAllocationRow[];
  workCategories: WorkCategoryRow[];
  weekEntries: TimeEntry[];
  completedTasks: Task[];
  insights: ReportInsight[];
  executiveSummary: string;
}

export function getWeekBounds(referenceDate: Date, weekStart: WorkweekStart) {
  const weekStartsOn = weekStart === 'sunday' ? 0 : 1;
  const start = startOfWeek(referenceDate, { weekStartsOn });
  const end = endOfWeek(referenceDate, { weekStartsOn });
  return {
    start,
    end,
    startKey: format(start, 'yyyy-MM-dd'),
    endKey: format(end, 'yyyy-MM-dd'),
    label: `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`,
  };
}

export function buildWeeklyReport(
  referenceDate: Date,
  entries: TimeEntry[],
  tasks: Task[],
  projects: Project[],
  settings: UserSettings | null
): WeeklyReportData {
  const workweekStart: WorkweekStart = settings?.workweekStart ?? 'monday';
  const targetHours = settings?.weeklyTargetHours ?? 40;
  const dailyTargetHours = settings?.dailyTargetHours ?? 8;

  const currentBounds = getWeekBounds(referenceDate, workweekStart);
  const prevBounds = getWeekBounds(subWeeks(referenceDate, 1), workweekStart);

  const projectMap = new Map<string, Project>();
  for (const p of projects) {
    projectMap.set(p.id, p);
  }

  // Lifetime hours per project (for budget burn calculation)
  const lifetimeSecondsByProject = new Map<string, number>();
  for (const e of entries) {
    lifetimeSecondsByProject.set(
      e.projectId,
      (lifetimeSecondsByProject.get(e.projectId) ?? 0) + e.durationSeconds
    );
  }

  const weekEntries = entries
    .filter((e) => e.dateKey >= currentBounds.startKey && e.dateKey <= currentBounds.endKey)
    .sort((a, b) => b.startTime.localeCompare(a.startTime));

  const prevWeekEntries = entries.filter(
    (e) => e.dateKey >= prevBounds.startKey && e.dateKey <= prevBounds.endKey
  );

  const totalSeconds = weekEntries.reduce((sum, e) => sum + e.durationSeconds, 0);
  const prevTotalSeconds = prevWeekEntries.reduce((sum, e) => sum + e.durationSeconds, 0);
  const deltaSeconds = totalSeconds - prevTotalSeconds;
  const deltaPercent =
    prevTotalSeconds > 0 ? Math.round((deltaSeconds / prevTotalSeconds) * 100) : null;

  const deepWorkSeconds = weekEntries
    .filter((e) => e.workType === 'deep_work')
    .reduce((sum, e) => sum + e.durationSeconds, 0);
  const prevDeepWorkSeconds = prevWeekEntries
    .filter((e) => e.workType === 'deep_work')
    .reduce((sum, e) => sum + e.durationSeconds, 0);

  const deepWorkPercent =
    totalSeconds > 0 ? Math.round((deepWorkSeconds / totalSeconds) * 100) : 0;
  const prevDeepWorkPercent =
    prevTotalSeconds > 0 ? Math.round((prevDeepWorkSeconds / prevTotalSeconds) * 100) : 0;

  let billableSeconds = 0;
  let billableAmount = 0;

  for (const e of weekEntries) {
    if (e.billable) {
      billableSeconds += e.durationSeconds;
      const rate = projectMap.get(e.projectId)?.hourlyRate ?? settings?.defaultHourlyRate ?? 0;
      billableAmount += (e.durationSeconds / 3600) * rate;
    }
  }

  const billablePercent =
    totalSeconds > 0 ? Math.round((billableSeconds / totalSeconds) * 100) : 0;

  const targetSeconds = targetHours * 3600;
  const targetAttainmentPercent =
    targetSeconds > 0 ? Math.round((totalSeconds / targetSeconds) * 100) : 0;

  // Completed tasks in selected week
  const completedTasks = tasks.filter((t) => {
    if (t.status !== 'done' || !t.completedAt) return false;
    const completedDay = t.completedAt.slice(0, 10);
    return completedDay >= currentBounds.startKey && completedDay <= currentBounds.endKey;
  });

  // Daily series (7 days)
  const dailySeries: DailyChartPoint[] = [];
  for (let i = 0; i < 7; i++) {
    const dayDate = addDays(currentBounds.start, i);
    const dateKey = format(dayDate, 'yyyy-MM-dd');
    const dayEntries = weekEntries.filter((e) => e.dateKey === dateKey);

    const byType: Record<WorkType, number> = {
      deep_work: 0,
      meetings: 0,
      planning: 0,
      admin: 0,
    };
    const byProject: Record<string, number> = {};

    for (const e of dayEntries) {
      const hrs = e.durationSeconds / 3600;
      byType[e.workType] += hrs;
      byProject[e.projectId] = Number(((byProject[e.projectId] ?? 0) + hrs).toFixed(2));
    }

    const totalHours = Number(
      (dayEntries.reduce((s, e) => s + e.durationSeconds, 0) / 3600).toFixed(2)
    );

    dailySeries.push({
      dateKey,
      dayLabel: format(dayDate, 'EEE'),
      fullLabel: format(dayDate, 'EEE, MMM d'),
      totalHours,
      deep_work: Number(byType.deep_work.toFixed(2)),
      meetings: Number(byType.meetings.toFixed(2)),
      planning: Number(byType.planning.toFixed(2)),
      admin: Number(byType.admin.toFixed(2)),
      byProject,
    });
  }

  // Peak day & consistency
  let peakDayLabel = '—';
  let peakDayHours = 0;
  let daysActive = 0;
  let daysMeetingTarget = 0;

  for (const day of dailySeries) {
    if (day.totalHours > 0) daysActive += 1;
    if (day.totalHours >= dailyTargetHours) daysMeetingTarget += 1;
    if (day.totalHours > peakDayHours) {
      peakDayHours = day.totalHours;
      peakDayLabel = day.fullLabel;
    }
  }

  const sessionCount = weekEntries.length;
  const avgSessionSeconds = sessionCount > 0 ? Math.round(totalSeconds / sessionCount) : 0;
  const longestSessionSeconds = weekEntries.reduce(
    (max, e) => Math.max(max, e.durationSeconds),
    0
  );

  // Project Allocations
  const projectWeekMap = new Map<
    string,
    { seconds: number; billableSeconds: number; billableAmount: number }
  >();
  for (const e of weekEntries) {
    const existing = projectWeekMap.get(e.projectId) ?? {
      seconds: 0,
      billableSeconds: 0,
      billableAmount: 0,
    };
    existing.seconds += e.durationSeconds;
    if (e.billable) {
      existing.billableSeconds += e.durationSeconds;
      const rate = projectMap.get(e.projectId)?.hourlyRate ?? 0;
      existing.billableAmount += (e.durationSeconds / 3600) * rate;
    }
    projectWeekMap.set(e.projectId, existing);
  }

  const projectAllocations: ProjectAllocationRow[] = Array.from(projectWeekMap.entries())
    .map(([projectId, agg]) => {
      const proj = projectMap.get(projectId);
      const lifetimeHours = Number(
        ((lifetimeSecondsByProject.get(projectId) ?? 0) / 3600).toFixed(1)
      );
      const budgetHours = proj?.budgetHours ?? 0;
      const budgetUsedPercent =
        budgetHours > 0 ? Math.round((lifetimeHours / budgetHours) * 100) : 0;
      const tasksCompletedThisWeek = completedTasks.filter(
        (t) => t.projectId === projectId
      ).length;

      return {
        projectId,
        name: proj?.name ?? 'Deleted Project',
        client: proj?.client || 'Internal',
        color: proj?.color ?? '#64748B',
        seconds: agg.seconds,
        sharePercent: totalSeconds > 0 ? Math.round((agg.seconds / totalSeconds) * 100) : 0,
        billableSeconds: agg.billableSeconds,
        billableAmount: Math.round(agg.billableAmount * 100) / 100,
        hourlyRate: proj?.hourlyRate ?? 0,
        budgetHours,
        lifetimeHours,
        budgetUsedPercent,
        tasksCompletedThisWeek,
      };
    })
    .sort((a, b) => b.seconds - a.seconds);

  // Work Categories
  const categoryTypes: WorkType[] = ['deep_work', 'meetings', 'planning', 'admin'];
  const workCategories: WorkCategoryRow[] = categoryTypes.map((type) => {
    const secs = weekEntries
      .filter((e) => e.workType === type)
      .reduce((s, e) => s + e.durationSeconds, 0);
    return {
      workType: type,
      label: WORK_TYPE_META[type].label,
      color: WORK_TYPE_META[type].color,
      seconds: secs,
      sharePercent: totalSeconds > 0 ? Math.round((secs / totalSeconds) * 100) : 0,
    };
  });

  // Deterministic, data-backed automated insights
  const insights: ReportInsight[] = [];

  if (totalSeconds === 0) {
    insights.push({
      id: 'empty',
      title: 'No working hours logged for this week',
      detail:
        'Start a live focus session or log manual hours to generate automatic pacing, focus ratio, and project allocation insights.',
      tone: 'neutral',
    });
  } else {
    // 1. Weekly Target Pacing
    if (targetAttainmentPercent >= 95 && targetAttainmentPercent <= 115) {
      insights.push({
        id: 'pacing-strong',
        title: `On target at ${targetAttainmentPercent}% of weekly goal`,
        detail: `Logged ${formatDecimalHours(totalSeconds)} against your ${targetHours}h target across ${daysActive} active ${daysActive === 1 ? 'day' : 'days'}.`,
        tone: 'positive',
      });
    } else if (targetAttainmentPercent > 115) {
      insights.push({
        id: 'pacing-overtime',
        title: `Overtime alert: ${targetAttainmentPercent}% of weekly target`,
        detail: `You logged ${formatDecimalHours(totalSeconds)} (+${formatDecimalHours(totalSeconds - targetSeconds)} over your ${targetHours}h cap). Consider protecting recovery time next week.`,
        tone: 'attention',
      });
    } else {
      const remaining = Math.max(0, targetSeconds - totalSeconds);
      insights.push({
        id: 'pacing-remaining',
        title: `${formatDecimalHours(remaining)} remaining to hit your ${targetHours}h goal`,
        detail: `Current progress stands at ${targetAttainmentPercent}% across ${daysActive} active ${daysActive === 1 ? 'day' : 'days'}${deltaPercent !== null ? ` (${deltaPercent >= 0 ? '+' : ''}${deltaPercent}% vs. prior week)` : ''}.`,
        tone: 'neutral',
      });
    }

    // 2. Deep Work Quality
    if (deepWorkPercent >= 65) {
      insights.push({
        id: 'deep-work-high',
        title: `High deep-work concentration (${deepWorkPercent}%)`,
        detail: `${formatHoursMinutes(deepWorkSeconds)} spent in uninterrupted focus with an average session of ${formatHoursMinutes(avgSessionSeconds)} and longest block of ${formatHoursMinutes(longestSessionSeconds)}.`,
        tone: 'positive',
      });
    } else if (deepWorkPercent < 45) {
      const meetingsRow = workCategories.find((c) => c.workType === 'meetings');
      insights.push({
        id: 'deep-work-low',
        title: `Deep work dipped to ${deepWorkPercent}% of logged time`,
        detail: `Meetings and overhead accounted for ${100 - deepWorkPercent}% (${meetingsRow ? `${meetingsRow.sharePercent}% meetings` : 'mixed categories'}). Blocking 90-minute morning focus intervals can restore depth.`,
        tone: 'attention',
      });
    } else {
      insights.push({
        id: 'deep-work-balanced',
        title: `Balanced focus ratio (${deepWorkPercent}% deep work)`,
        detail: `Average session duration was ${formatHoursMinutes(avgSessionSeconds)}, peaking on ${peakDayLabel} with ${peakDayHours.toFixed(1)}h logged.`,
        tone: 'neutral',
      });
    }

    // 3. Top Project Concentration & Budget Watch
    const topProject = projectAllocations[0];
    if (topProject) {
      const overBudget = projectAllocations.find(
        (p) => p.budgetHours > 0 && p.budgetUsedPercent >= 85
      );
      if (overBudget) {
        insights.push({
          id: 'budget-watch',
          title: `${overBudget.name} reached ${overBudget.budgetUsedPercent}% of budget`,
          detail: `${overBudget.lifetimeHours}h logged out of ${overBudget.budgetHours}h planned. Review remaining scope before scheduling additional hours.`,
          tone: 'attention',
        });
      } else {
        insights.push({
          id: 'project-lead',
          title: `Primary effort invested in ${topProject.name} (${topProject.sharePercent}%)`,
          detail: `${formatHoursMinutes(topProject.seconds)} logged across ${projectAllocations.length} active ${projectAllocations.length === 1 ? 'project' : 'projects'}${completedTasks.length > 0 ? `, with ${completedTasks.length} ${completedTasks.length === 1 ? 'task' : 'tasks'} completed this week` : ''}.`,
          tone: 'positive',
        });
      }
    }
  }

  const executiveSummary =
    totalSeconds === 0
      ? `No hours logged for ${currentBounds.label}.`
      : `During ${currentBounds.label}, you logged ${formatDecimalHours(totalSeconds)} (${targetAttainmentPercent}% of your ${targetHours}h weekly target) across ${sessionCount} sessions and ${projectAllocations.length} ${projectAllocations.length === 1 ? 'project' : 'projects'}. Deep work represented ${deepWorkPercent}% of total hours, ${completedTasks.length} ${completedTasks.length === 1 ? 'task was' : 'tasks were'} completed, and billable output reached $${Math.round(billableAmount).toLocaleString()}.`;

  return {
    weekStart: currentBounds.startKey,
    weekEnd: currentBounds.endKey,
    weekLabel: currentBounds.label,
    prevWeekStart: prevBounds.startKey,
    prevWeekEnd: prevBounds.endKey,
    totalSeconds,
    prevTotalSeconds,
    deltaSeconds,
    deltaPercent,
    targetHours,
    dailyTargetHours,
    targetAttainmentPercent,
    deepWorkSeconds,
    deepWorkPercent,
    prevDeepWorkPercent,
    billableSeconds,
    billablePercent,
    billableAmount,
    sessionCount,
    avgSessionSeconds,
    longestSessionSeconds,
    peakDayLabel,
    peakDayHours,
    daysActive,
    daysMeetingTarget,
    dailySeries,
    projectAllocations,
    workCategories,
    weekEntries,
    completedTasks,
    insights,
    executiveSummary,
  };
}

export function buildWeeklyCsv(
  report: WeeklyReportData,
  projects: Project[],
  tasks: Task[]
): string {
  const projectMap = new Map(projects.map((p) => [p.id, p]));
  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  const escapeCsv = (val: string) => `"${val.replace(/"/g, '""')}"`;

  const headers = [
    'Date',
    'Project',
    'Client',
    'Task',
    'Category',
    'Description',
    'Billable',
    'Duration (Hours)',
    'Rate (USD)',
    'Billable Value (USD)',
  ];

  const rows = report.weekEntries.map((entry) => {
    const project = projectMap.get(entry.projectId);
    const task = entry.taskId ? taskMap.get(entry.taskId) : undefined;
    const hours = entry.durationSeconds / 3600;
    const rate = project?.hourlyRate ?? 0;
    const value = entry.billable ? hours * rate : 0;

    return [
      entry.dateKey,
      project?.name ?? 'Deleted Project',
      project?.client ?? '',
      task?.title ?? '',
      WORK_TYPE_META[entry.workType].label,
      entry.description,
      entry.billable ? 'Yes' : 'No',
      hours.toFixed(2),
      rate.toFixed(2),
      value.toFixed(2),
    ]
      .map((cell) => escapeCsv(String(cell)))
      .join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}
