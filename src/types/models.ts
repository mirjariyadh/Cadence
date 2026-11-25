import type { Timestamp } from 'firebase/firestore';

export type WorkType = 'deep_work' | 'meetings' | 'planning' | 'admin';
export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type ProjectStatus = 'active' | 'archived';
export type TimerMode = 'stopwatch' | 'focus_25' | 'focus_50';
export type WorkweekStart = 'monday' | 'sunday';

export type WorkspaceTab = 'overview' | 'timer' | 'projects' | 'reports';

// Synchronized verbatim with firebase-blueprint.json & firestore.rules
export const FIELD_LIMITS = {
  DISPLAY_NAME_MAX: 80,
  PROJECT_NAME_MAX: 80,
  PROJECT_CLIENT_MAX: 80,
  TASK_TITLE_MAX: 160,
  TASK_NOTES_MAX: 1000,
  ENTRY_DESCRIPTION_MAX: 240,
  REPORT_SUMMARY_MAX: 600,
  MIN_WEEKLY_HOURS: 1,
  MAX_WEEKLY_HOURS: 168,
  MIN_DAILY_HOURS: 1,
  MAX_DAILY_HOURS: 24,
  MAX_HOURLY_RATE: 10000,
  MAX_BUDGET_HOURS: 10000,
  MAX_ESTIMATED_MINUTES: 100000,
  MIN_DURATION_SECONDS: 1,
  MAX_DURATION_SECONDS: 86400,
} as const;

export const WORK_TYPE_META: Record<
  WorkType,
  { label: string; shortLabel: string; color: string }
> = {
  deep_work: { label: 'Deep Work', shortLabel: 'Deep Work', color: '#2563EB' },
  meetings: { label: 'Meetings & Syncs', shortLabel: 'Meetings', color: '#D97706' },
  planning: { label: 'Planning & Review', shortLabel: 'Planning', color: '#0D9488' },
  admin: { label: 'Admin & Ops', shortLabel: 'Admin', color: '#64748B' },
};

export const PROJECT_PALETTE = [
  '#2563EB', // Cobalt
  '#0D9488', // Teal
  '#7C3AED', // Indigo Violet
  '#D97706', // Amber
  '#DC2626', // Crimson
  '#059669', // Emerald
  '#0284C7', // Sky
  '#475569', // Slate
] as const;

export interface UserSettings {
  id: string;
  userId: string;
  displayName: string;
  weeklyTargetHours: number;
  dailyTargetHours: number;
  workweekStart: WorkweekStart;
  defaultHourlyRate: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  client: string;
  color: string;
  hourlyRate: number;
  budgetHours: number;
  status: ProjectStatus;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Task {
  id: string;
  userId: string;
  projectId: string;
  title: string;
  notes: string;
  priority: TaskPriority;
  status: TaskStatus;
  estimatedMinutes: number;
  dueDate: string; // YYYY-MM-DD or ''
  completedAt: string; // ISO string or ''
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface TimeEntry {
  id: string;
  userId: string;
  projectId: string;
  taskId: string; // '' when unassigned
  description: string;
  workType: WorkType;
  billable: boolean;
  dateKey: string; // YYYY-MM-DD
  startTime: string; // ISO string
  endTime: string; // ISO string
  durationSeconds: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ActiveTimer {
  id: string;
  userId: string;
  projectId: string;
  taskId: string;
  description: string;
  workType: WorkType;
  billable: boolean;
  mode: TimerMode;
  isPaused: boolean;
  startedAtMs: number;
  accumulatedSeconds: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface WeeklyReportSnapshot {
  id: string;
  userId: string;
  weekStart: string;
  weekEnd: string;
  totalSeconds: number;
  deepWorkSeconds: number;
  billableSeconds: number;
  billableAmount: number;
  tasksCompleted: number;
  targetHours: number;
  summaryNote: string;
  status: 'finalized';
  createdAt?: Timestamp;
}
