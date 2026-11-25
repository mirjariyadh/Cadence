import {
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { subDays, format } from 'date-fns';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  FIELD_LIMITS,
  PROJECT_PALETTE,
  type ActiveTimer,
  type Project,
  type ProjectStatus,
  type Task,
  type TaskPriority,
  type TaskStatus,
  type TimeEntry,
  type TimerMode,
  type UserSettings,
  type WorkType,
  type WorkweekStart,
} from '../types/models';

function createValidId(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/[^a-zA-Z0-9_-]/g, '')
      : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${random}`.slice(0, 64);
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function cleanText(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}

function cleanHexColor(value: string): string {
  return /^#[0-9A-Fa-f]{6}$/.test(value) ? value : PROJECT_PALETTE[0];
}

function cleanDateKey(value: string, fallback: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}

function cleanOptionalDateKey(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
}

// --- User Settings ---
export async function ensureUserSettings(
  userId: string,
  displayName: string
): Promise<void> {
  const path = `users/${userId}`;
  try {
    await setDoc(doc(db, 'users', userId), {
      userId,
      displayName: cleanText(displayName || 'Workspace Member', FIELD_LIMITS.DISPLAY_NAME_MAX),
      weeklyTargetHours: 40,
      dailyTargetHours: 8,
      workweekStart: 'monday' as WorkweekStart,
      defaultHourlyRate: 95,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateUserSettingsDoc(
  userId: string,
  updates: Pick<
    UserSettings,
    'displayName' | 'weeklyTargetHours' | 'dailyTargetHours' | 'workweekStart' | 'defaultHourlyRate'
  >
): Promise<void> {
  const path = `users/${userId}`;
  try {
    await updateDoc(doc(db, 'users', userId), {
      displayName: cleanText(updates.displayName || 'Workspace Member', FIELD_LIMITS.DISPLAY_NAME_MAX),
      weeklyTargetHours: clampNumber(
        Number(updates.weeklyTargetHours),
        FIELD_LIMITS.MIN_WEEKLY_HOURS,
        FIELD_LIMITS.MAX_WEEKLY_HOURS
      ),
      dailyTargetHours: clampNumber(
        Number(updates.dailyTargetHours),
        FIELD_LIMITS.MIN_DAILY_HOURS,
        FIELD_LIMITS.MAX_DAILY_HOURS
      ),
      workweekStart: updates.workweekStart === 'sunday' ? 'sunday' : 'monday',
      defaultHourlyRate: clampNumber(
        Number(updates.defaultHourlyRate),
        0,
        FIELD_LIMITS.MAX_HOURLY_RATE
      ),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// --- Projects ---
export interface ProjectInput {
  name: string;
  client: string;
  color: string;
  hourlyRate: number;
  budgetHours: number;
}

export async function createProjectDoc(userId: string, input: ProjectInput): Promise<string> {
  const id = createValidId('proj');
  const path = `projects/${id}`;
  const name = cleanText(input.name, FIELD_LIMITS.PROJECT_NAME_MAX);
  if (!name) throw new Error('Project name is required.');

  try {
    await setDoc(doc(db, 'projects', id), {
      userId,
      name,
      client: cleanText(input.client, FIELD_LIMITS.PROJECT_CLIENT_MAX),
      color: cleanHexColor(input.color),
      hourlyRate: clampNumber(Number(input.hourlyRate), 0, FIELD_LIMITS.MAX_HOURLY_RATE),
      budgetHours: clampNumber(Number(input.budgetHours), 0, FIELD_LIMITS.MAX_BUDGET_HOURS),
      status: 'active' as ProjectStatus,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateProjectDetailsDoc(
  projectId: string,
  input: ProjectInput
): Promise<void> {
  const path = `projects/${projectId}`;
  const name = cleanText(input.name, FIELD_LIMITS.PROJECT_NAME_MAX);
  if (!name) throw new Error('Project name is required.');

  try {
    await updateDoc(doc(db, 'projects', projectId), {
      name,
      client: cleanText(input.client, FIELD_LIMITS.PROJECT_CLIENT_MAX),
      color: cleanHexColor(input.color),
      hourlyRate: clampNumber(Number(input.hourlyRate), 0, FIELD_LIMITS.MAX_HOURLY_RATE),
      budgetHours: clampNumber(Number(input.budgetHours), 0, FIELD_LIMITS.MAX_BUDGET_HOURS),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function setProjectStatusDoc(
  projectId: string,
  status: ProjectStatus
): Promise<void> {
  const path = `projects/${projectId}`;
  try {
    await updateDoc(doc(db, 'projects', projectId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteProjectDoc(projectId: string): Promise<void> {
  const path = `projects/${projectId}`;
  try {
    await deleteDoc(doc(db, 'projects', projectId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Tasks ---
export interface TaskInput {
  projectId: string;
  title: string;
  notes: string;
  priority: TaskPriority;
  status: TaskStatus;
  estimatedMinutes: number;
  dueDate: string;
}

export async function createTaskDoc(userId: string, input: TaskInput): Promise<string> {
  const id = createValidId('task');
  const path = `tasks/${id}`;
  const title = cleanText(input.title, FIELD_LIMITS.TASK_TITLE_MAX);
  if (!title) throw new Error('Task title is required.');

  try {
    await setDoc(doc(db, 'tasks', id), {
      userId,
      projectId: input.projectId,
      title,
      notes: cleanText(input.notes, FIELD_LIMITS.TASK_NOTES_MAX),
      priority: input.priority,
      status: input.status,
      estimatedMinutes: clampNumber(
        Math.round(Number(input.estimatedMinutes) || 0),
        0,
        FIELD_LIMITS.MAX_ESTIMATED_MINUTES
      ),
      dueDate: cleanOptionalDateKey(input.dueDate),
      completedAt: input.status === 'done' ? new Date().toISOString().slice(0, 40) : '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateTaskDetailsDoc(
  taskId: string,
  input: TaskInput,
  existingCompletedAt: string
): Promise<void> {
  const path = `tasks/${taskId}`;
  const title = cleanText(input.title, FIELD_LIMITS.TASK_TITLE_MAX);
  if (!title) throw new Error('Task title is required.');

  const completedAt =
    input.status === 'done'
      ? existingCompletedAt || new Date().toISOString().slice(0, 40)
      : '';

  try {
    await updateDoc(doc(db, 'tasks', taskId), {
      projectId: input.projectId,
      title,
      notes: cleanText(input.notes, FIELD_LIMITS.TASK_NOTES_MAX),
      priority: input.priority,
      status: input.status,
      estimatedMinutes: clampNumber(
        Math.round(Number(input.estimatedMinutes) || 0),
        0,
        FIELD_LIMITS.MAX_ESTIMATED_MINUTES
      ),
      dueDate: cleanOptionalDateKey(input.dueDate),
      completedAt,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function setTaskStatusDoc(taskId: string, status: TaskStatus): Promise<void> {
  const path = `tasks/${taskId}`;
  try {
    await updateDoc(doc(db, 'tasks', taskId), {
      status,
      completedAt: status === 'done' ? new Date().toISOString().slice(0, 40) : '',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteTaskDoc(taskId: string): Promise<void> {
  const path = `tasks/${taskId}`;
  try {
    await deleteDoc(doc(db, 'tasks', taskId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Time Entries ---
export interface TimeEntryInput {
  projectId: string;
  taskId: string;
  description: string;
  workType: WorkType;
  billable: boolean;
  dateKey: string;
  startTime: string;
  endTime: string;
  durationSeconds: number;
}

export async function createTimeEntryDoc(
  userId: string,
  input: TimeEntryInput
): Promise<string> {
  const id = createValidId('entry');
  const path = `timeEntries/${id}`;
  const todayKey = format(new Date(), 'yyyy-MM-dd');

  try {
    await setDoc(doc(db, 'timeEntries', id), {
      userId,
      projectId: input.projectId,
      taskId: input.taskId || '',
      description: cleanText(input.description, FIELD_LIMITS.ENTRY_DESCRIPTION_MAX),
      workType: input.workType,
      billable: Boolean(input.billable),
      dateKey: cleanDateKey(input.dateKey, todayKey),
      startTime: input.startTime.slice(0, 40),
      endTime: input.endTime.slice(0, 40),
      durationSeconds: clampNumber(
        Math.round(input.durationSeconds),
        FIELD_LIMITS.MIN_DURATION_SECONDS,
        FIELD_LIMITS.MAX_DURATION_SECONDS
      ),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateTimeEntryDoc(
  entryId: string,
  input: TimeEntryInput
): Promise<void> {
  const path = `timeEntries/${entryId}`;
  const todayKey = format(new Date(), 'yyyy-MM-dd');

  try {
    await updateDoc(doc(db, 'timeEntries', entryId), {
      projectId: input.projectId,
      taskId: input.taskId || '',
      description: cleanText(input.description, FIELD_LIMITS.ENTRY_DESCRIPTION_MAX),
      workType: input.workType,
      billable: Boolean(input.billable),
      dateKey: cleanDateKey(input.dateKey, todayKey),
      startTime: input.startTime.slice(0, 40),
      endTime: input.endTime.slice(0, 40),
      durationSeconds: clampNumber(
        Math.round(input.durationSeconds),
        FIELD_LIMITS.MIN_DURATION_SECONDS,
        FIELD_LIMITS.MAX_DURATION_SECONDS
      ),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteTimeEntryDoc(entryId: string): Promise<void> {
  const path = `timeEntries/${entryId}`;
  try {
    await deleteDoc(doc(db, 'timeEntries', entryId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Active Timer ---
export interface StartTimerInput {
  projectId: string;
  taskId: string;
  description: string;
  workType: WorkType;
  billable: boolean;
  mode: TimerMode;
}

export async function startActiveTimerDoc(
  userId: string,
  input: StartTimerInput
): Promise<void> {
  const path = `activeTimers/${userId}`;
  try {
    await setDoc(doc(db, 'activeTimers', userId), {
      userId,
      projectId: input.projectId || '',
      taskId: input.taskId || '',
      description: cleanText(input.description, FIELD_LIMITS.ENTRY_DESCRIPTION_MAX),
      workType: input.workType,
      billable: Boolean(input.billable),
      mode: input.mode,
      isPaused: false,
      startedAtMs: Date.now(),
      accumulatedSeconds: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function pauseOrResumeTimerDoc(
  userId: string,
  state: { isPaused: boolean; startedAtMs: number; accumulatedSeconds: number }
): Promise<void> {
  const path = `activeTimers/${userId}`;
  try {
    await updateDoc(doc(db, 'activeTimers', userId), {
      isPaused: state.isPaused,
      startedAtMs: Math.max(0, Math.round(state.startedAtMs)),
      accumulatedSeconds: clampNumber(
        Math.round(state.accumulatedSeconds),
        0,
        FIELD_LIMITS.MAX_DURATION_SECONDS
      ),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateActiveTimerMetaDoc(
  userId: string,
  meta: Pick<ActiveTimer, 'projectId' | 'taskId' | 'description' | 'workType' | 'billable' | 'mode'>
): Promise<void> {
  const path = `activeTimers/${userId}`;
  try {
    await updateDoc(doc(db, 'activeTimers', userId), {
      projectId: meta.projectId || '',
      taskId: meta.taskId || '',
      description: cleanText(meta.description, FIELD_LIMITS.ENTRY_DESCRIPTION_MAX),
      workType: meta.workType,
      billable: Boolean(meta.billable),
      mode: meta.mode,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function discardActiveTimerDoc(userId: string): Promise<void> {
  const path = `activeTimers/${userId}`;
  try {
    await deleteDoc(doc(db, 'activeTimers', userId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function stopAndSaveActiveTimerDoc(
  userId: string,
  entry: TimeEntryInput
): Promise<string> {
  const entryId = createValidId('entry');
  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const path = `timeEntries/${entryId}`;

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'timeEntries', entryId), {
      userId,
      projectId: entry.projectId,
      taskId: entry.taskId || '',
      description: cleanText(entry.description, FIELD_LIMITS.ENTRY_DESCRIPTION_MAX),
      workType: entry.workType,
      billable: Boolean(entry.billable),
      dateKey: cleanDateKey(entry.dateKey, todayKey),
      startTime: entry.startTime.slice(0, 40),
      endTime: entry.endTime.slice(0, 40),
      durationSeconds: clampNumber(
        Math.round(entry.durationSeconds),
        FIELD_LIMITS.MIN_DURATION_SECONDS,
        FIELD_LIMITS.MAX_DURATION_SECONDS
      ),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.delete(doc(db, 'activeTimers', userId));
    await batch.commit();
    return entryId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// --- Weekly Report Snapshots ---
export interface WeeklySnapshotInput {
  weekStart: string;
  weekEnd: string;
  totalSeconds: number;
  deepWorkSeconds: number;
  billableSeconds: number;
  billableAmount: number;
  tasksCompleted: number;
  targetHours: number;
  summaryNote: string;
}

export async function createWeeklySnapshotDoc(
  userId: string,
  input: WeeklySnapshotInput
): Promise<string> {
  const id = createValidId('report');
  const path = `weeklyReports/${id}`;
  const todayKey = format(new Date(), 'yyyy-MM-dd');

  try {
    await setDoc(doc(db, 'weeklyReports', id), {
      userId,
      weekStart: cleanDateKey(input.weekStart, todayKey),
      weekEnd: cleanDateKey(input.weekEnd, todayKey),
      totalSeconds: clampNumber(Math.round(input.totalSeconds), 0, 604800),
      deepWorkSeconds: clampNumber(Math.round(input.deepWorkSeconds), 0, 604800),
      billableSeconds: clampNumber(Math.round(input.billableSeconds), 0, 604800),
      billableAmount: clampNumber(Math.round(input.billableAmount * 100) / 100, 0, 10000000),
      tasksCompleted: clampNumber(Math.round(input.tasksCompleted), 0, 10000),
      targetHours: clampNumber(
        Number(input.targetHours),
        FIELD_LIMITS.MIN_WEEKLY_HOURS,
        FIELD_LIMITS.MAX_WEEKLY_HOURS
      ),
      summaryNote: cleanText(input.summaryNote, FIELD_LIMITS.REPORT_SUMMARY_MAX),
      status: 'finalized',
      createdAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteWeeklySnapshotDoc(reportId: string): Promise<void> {
  const path = `weeklyReports/${reportId}`;
  try {
    await deleteDoc(doc(db, 'weeklyReports', reportId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Sample Workspace Seeder (Multi-stage commit honoring relational exists() rules) ---
export async function seedSampleWorkspaceDocs(userId: string): Promise<void> {
  const now = new Date();

  const pCore = createValidId('proj');
  const pClient = createValidId('proj');
  const pDesign = createValidId('proj');
  const pOps = createValidId('proj');

  const projectsData: Array<{ id: string; data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'> }> = [
    {
      id: pCore,
      data: {
        userId,
        name: 'Core Platform v3',
        client: 'Internal Product',
        color: '#2563EB',
        hourlyRate: 120,
        budgetHours: 60,
        status: 'active',
      },
    },
    {
      id: pClient,
      data: {
        userId,
        name: 'Northstar Analytics Portal',
        client: 'Northstar Logistics',
        color: '#0D9488',
        hourlyRate: 145,
        budgetHours: 45,
        status: 'active',
      },
    },
    {
      id: pDesign,
      data: {
        userId,
        name: 'Design System Audit',
        client: 'Meridian Health',
        color: '#7C3AED',
        hourlyRate: 130,
        budgetHours: 24,
        status: 'active',
      },
    },
    {
      id: pOps,
      data: {
        userId,
        name: 'Operations & Planning',
        client: 'Personal Studio',
        color: '#64748B',
        hourlyRate: 0,
        budgetHours: 16,
        status: 'active',
      },
    },
  ];

  // Batch 1: Projects
  try {
    const batch1 = writeBatch(db);
    for (const p of projectsData) {
      batch1.set(doc(db, 'projects', p.id), {
        ...p.data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await batch1.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'projects');
  }

  // Batch 2: Tasks
  const t1 = createValidId('task');
  const t2 = createValidId('task');
  const t3 = createValidId('task');
  const t4 = createValidId('task');
  const t5 = createValidId('task');
  const t6 = createValidId('task');
  const t7 = createValidId('task');
  const t8 = createValidId('task');

  const dateOffsetKey = (daysAgo: number) => format(subDays(now, daysAgo), 'yyyy-MM-dd');
  const isoOffset = (daysAgo: number, hour: number, minute = 0) => {
    const d = subDays(now, daysAgo);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  };

  const tasksData: Array<{ id: string; data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> }> = [
    {
      id: t1,
      data: {
        userId,
        projectId: pCore,
        title: 'Refactor streaming aggregation pipeline',
        notes: 'Reduce memory footprint on large date-range queries and add unit benchmarks.',
        priority: 'high',
        status: 'in_progress',
        estimatedMinutes: 300,
        dueDate: format(subDays(now, -2), 'yyyy-MM-dd'),
        completedAt: '',
      },
    },
    {
      id: t2,
      data: {
        userId,
        projectId: pCore,
        title: 'Implement role-based export permissions',
        notes: 'Verify CSV and PDF export endpoints respect workspace scope.',
        priority: 'high',
        status: 'done',
        estimatedMinutes: 180,
        dueDate: dateOffsetKey(1),
        completedAt: isoOffset(1, 15, 30),
      },
    },
    {
      id: t3,
      data: {
        userId,
        projectId: pClient,
        title: 'Build weekly shipment latency chart module',
        notes: 'Interactive stacked bar breakdown by warehouse hub.',
        priority: 'high',
        status: 'done',
        estimatedMinutes: 240,
        dueDate: dateOffsetKey(2),
        completedAt: isoOffset(2, 16, 45),
      },
    },
    {
      id: t4,
      data: {
        userId,
        projectId: pClient,
        title: 'Client architecture review & sprint sign-off',
        notes: 'Walk through Q4 milestone checklist with Northstar engineering lead.',
        priority: 'medium',
        status: 'todo',
        estimatedMinutes: 90,
        dueDate: format(subDays(now, -1), 'yyyy-MM-dd'),
        completedAt: '',
      },
    },
    {
      id: t5,
      data: {
        userId,
        projectId: pDesign,
        title: 'Audit WCAG AA contrast across data tables',
        notes: 'Standardize tabular numerals and border tokens.',
        priority: 'medium',
        status: 'in_progress',
        estimatedMinutes: 150,
        dueDate: format(subDays(now, -3), 'yyyy-MM-dd'),
        completedAt: '',
      },
    },
    {
      id: t6,
      data: {
        userId,
        projectId: pDesign,
        title: 'Publish component spacing spec v2.1',
        notes: 'Document 4px grid rhythm and modal hierarchy.',
        priority: 'low',
        status: 'done',
        estimatedMinutes: 120,
        dueDate: dateOffsetKey(4),
        completedAt: isoOffset(4, 14, 15),
      },
    },
    {
      id: t7,
      data: {
        userId,
        projectId: pOps,
        title: 'Monthly invoicing & time reconciliation',
        notes: 'Review billable hours and generate client summaries.',
        priority: 'medium',
        status: 'todo',
        estimatedMinutes: 60,
        dueDate: format(subDays(now, -4), 'yyyy-MM-dd'),
        completedAt: '',
      },
    },
    {
      id: t8,
      data: {
        userId,
        projectId: pClient,
        title: 'Optimize API pagination cache invalidation',
        notes: 'Fix stale cursor edge case on filter reset.',
        priority: 'high',
        status: 'done',
        estimatedMinutes: 210,
        dueDate: dateOffsetKey(8),
        completedAt: isoOffset(8, 17, 0),
      },
    },
  ];

  try {
    const batch2 = writeBatch(db);
    for (const t of tasksData) {
      batch2.set(doc(db, 'tasks', t.id), {
        ...t.data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await batch2.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'tasks');
  }

  // Batch 3: Time Entries across current & previous week
  const entriesSpec: Array<{
    daysAgo: number;
    startHour: number;
    durationMinutes: number;
    projectId: string;
    taskId: string;
    workType: WorkType;
    billable: boolean;
    description: string;
  }> = [
    // Recent days (this week)
    {
      daysAgo: 0,
      startHour: 9,
      durationMinutes: 135,
      projectId: pCore,
      taskId: t1,
      workType: 'deep_work',
      billable: true,
      description: 'Streaming aggregation memory profiling and query refactor',
    },
    {
      daysAgo: 0,
      startHour: 13,
      durationMinutes: 45,
      projectId: pClient,
      taskId: t4,
      workType: 'meetings',
      billable: true,
      description: 'Mid-week architecture sync with Northstar stakeholders',
    },
    {
      daysAgo: 0,
      startHour: 14,
      durationMinutes: 95,
      projectId: pDesign,
      taskId: t5,
      workType: 'deep_work',
      billable: true,
      description: 'Table typography and contrast verification across views',
    },
    {
      daysAgo: 1,
      startHour: 9,
      durationMinutes: 165,
      projectId: pCore,
      taskId: t2,
      workType: 'deep_work',
      billable: true,
      description: 'Export permission guards and regression test coverage',
    },
    {
      daysAgo: 1,
      startHour: 13,
      durationMinutes: 120,
      projectId: pClient,
      taskId: t3,
      workType: 'deep_work',
      billable: true,
      description: 'Warehouse latency tooltip formatting and edge cases',
    },
    {
      daysAgo: 1,
      startHour: 16,
      durationMinutes: 60,
      projectId: pOps,
      taskId: t7,
      workType: 'admin',
      billable: false,
      description: 'Weekly backlog triage and milestone schedule update',
    },
    {
      daysAgo: 2,
      startHour: 8,
      durationMinutes: 180,
      projectId: pClient,
      taskId: t3,
      workType: 'deep_work',
      billable: true,
      description: 'Stacked shipment latency chart implementation and state wiring',
    },
    {
      daysAgo: 2,
      startHour: 13,
      durationMinutes: 90,
      projectId: pCore,
      taskId: t1,
      workType: 'planning',
      billable: true,
      description: 'Draft pipeline streaming benchmark plan and schema specs',
    },
    {
      daysAgo: 2,
      startHour: 15,
      durationMinutes: 75,
      projectId: pDesign,
      taskId: t5,
      workType: 'deep_work',
      billable: true,
      description: 'Audit badge replacement and tabular metric alignment',
    },
    {
      daysAgo: 3,
      startHour: 9,
      durationMinutes: 150,
      projectId: pCore,
      taskId: t2,
      workType: 'deep_work',
      billable: true,
      description: 'Implement CSV export serialization and auth middleware',
    },
    {
      daysAgo: 3,
      startHour: 13,
      durationMinutes: 60,
      projectId: pClient,
      taskId: '',
      workType: 'meetings',
      billable: true,
      description: 'Sprint review and roadmap alignment call',
    },
    {
      daysAgo: 4,
      startHour: 9,
      durationMinutes: 140,
      projectId: pDesign,
      taskId: t6,
      workType: 'deep_work',
      billable: true,
      description: 'Finalize spacing documentation and token table v2.1',
    },
    {
      daysAgo: 4,
      startHour: 14,
      durationMinutes: 110,
      projectId: pClient,
      taskId: t3,
      workType: 'deep_work',
      billable: true,
      description: 'Integrate real-time filter controls for hub metrics',
    },
    // Prior week entries for WoW delta comparisons
    {
      daysAgo: 7,
      startHour: 9,
      durationMinutes: 195,
      projectId: pClient,
      taskId: t8,
      workType: 'deep_work',
      billable: true,
      description: 'Pagination cursor invalidation fix and cache tests',
    },
    {
      daysAgo: 7,
      startHour: 14,
      durationMinutes: 90,
      projectId: pOps,
      taskId: '',
      workType: 'planning',
      billable: false,
      description: 'Weekly sprint planning and capacity forecasting',
    },
    {
      daysAgo: 8,
      startHour: 9,
      durationMinutes: 180,
      projectId: pCore,
      taskId: t1,
      workType: 'deep_work',
      billable: true,
      description: 'Core architecture benchmarking on 100k synthetic rows',
    },
    {
      daysAgo: 8,
      startHour: 14,
      durationMinutes: 120,
      projectId: pClient,
      taskId: t8,
      workType: 'deep_work',
      billable: true,
      description: 'Deploy pagination fix to staging and verify telemetry',
    },
    {
      daysAgo: 9,
      startHour: 10,
      durationMinutes: 150,
      projectId: pDesign,
      taskId: t6,
      workType: 'deep_work',
      billable: true,
      description: 'Draft component elevation rules and divider scale',
    },
    {
      daysAgo: 9,
      startHour: 14,
      durationMinutes: 75,
      projectId: pClient,
      taskId: '',
      workType: 'meetings',
      billable: true,
      description: 'Weekly client status checkpoint and demo',
    },
    {
      daysAgo: 10,
      startHour: 9,
      durationMinutes: 210,
      projectId: pCore,
      taskId: t2,
      workType: 'deep_work',
      billable: true,
      description: 'Design permission matrix and audit log structure',
    },
  ];

  try {
    const batch3 = writeBatch(db);
    for (const item of entriesSpec) {
      const id = createValidId('entry');
      const start = subDays(now, item.daysAgo);
      start.setHours(item.startHour, 0, 0, 0);
      const end = new Date(start.getTime() + item.durationMinutes * 60 * 1000);
      const entryData: Omit<TimeEntry, 'id' | 'createdAt' | 'updatedAt'> = {
        userId,
        projectId: item.projectId,
        taskId: item.taskId,
        description: item.description,
        workType: item.workType,
        billable: item.billable,
        dateKey: format(start, 'yyyy-MM-dd'),
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        durationSeconds: item.durationMinutes * 60,
      };
      batch3.set(doc(db, 'timeEntries', id), {
        ...entryData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await batch3.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'timeEntries');
  }
}
