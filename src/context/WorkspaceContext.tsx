import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import {
  createProjectDoc,
  createTaskDoc,
  createTimeEntryDoc,
  createWeeklySnapshotDoc,
  deleteProjectDoc,
  deleteTaskDoc,
  deleteTimeEntryDoc,
  deleteWeeklySnapshotDoc,
  discardActiveTimerDoc,
  ensureUserSettings,
  pauseOrResumeTimerDoc,
  seedSampleWorkspaceDocs,
  setProjectStatusDoc,
  setTaskStatusDoc,
  startActiveTimerDoc,
  stopAndSaveActiveTimerDoc,
  updateActiveTimerMetaDoc,
  updateProjectDetailsDoc,
  updateTaskDetailsDoc,
  updateTimeEntryDoc,
  updateUserSettingsDoc,
  type ProjectInput,
  type StartTimerInput,
  type TaskInput,
  type TimeEntryInput,
  type WeeklySnapshotInput,
} from '../lib/firestoreService';
import { toDateKey } from '../lib/formatters';
import type {
  ActiveTimer,
  Project,
  ProjectStatus,
  Task,
  TaskStatus,
  TimeEntry,
  UserSettings,
  WeeklyReportSnapshot,
} from '../types/models';

interface WorkspaceContextValue {
  user: User | null;
  authReady: boolean;
  dataLoading: boolean;
  authError: string | null;
  settings: UserSettings | null;
  projects: Project[];
  tasks: Task[];
  timeEntries: TimeEntry[];
  activeTimer: ActiveTimer | null;
  weeklySnapshots: WeeklyReportSnapshot[];
  elapsedSeconds: number;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  startTimer: (input: StartTimerInput) => Promise<void>;
  pauseTimer: () => Promise<void>;
  resumeTimer: () => Promise<void>;
  updateLiveTimer: (
    meta: Pick<ActiveTimer, 'projectId' | 'taskId' | 'description' | 'workType' | 'billable' | 'mode'>
  ) => Promise<void>;
  stopAndSaveTimer: (overrideProjectId?: string) => Promise<void>;
  discardTimer: () => Promise<void>;
  createProject: (input: ProjectInput) => Promise<string>;
  updateProject: (projectId: string, input: ProjectInput) => Promise<void>;
  toggleProjectStatus: (projectId: string, status: ProjectStatus) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  createTask: (input: TaskInput) => Promise<string>;
  updateTask: (taskId: string, input: TaskInput, existingCompletedAt: string) => Promise<void>;
  setTaskStatus: (taskId: string, status: TaskStatus) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  createManualEntry: (input: TimeEntryInput) => Promise<string>;
  updateEntry: (entryId: string, input: TimeEntryInput) => Promise<void>;
  deleteEntry: (entryId: string) => Promise<void>;
  saveWeeklySnapshot: (input: WeeklySnapshotInput) => Promise<string>;
  deleteWeeklySnapshot: (reportId: string) => Promise<void>;
  updateSettings: (
    updates: Pick<
      UserSettings,
      'displayName' | 'weeklyTargetHours' | 'dailyTargetHours' | 'workweekStart' | 'defaultHourlyRate'
    >
  ) => Promise<void>;
  loadSampleWorkspace: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

function computeElapsedSeconds(timer: ActiveTimer | null): number {
  if (!timer) return 0;
  if (timer.isPaused) return Math.max(0, Math.floor(timer.accumulatedSeconds));
  const runningDelta = Math.max(0, Math.floor((Date.now() - timer.startedAtMs) / 1000));
  return Math.max(0, Math.floor(timer.accumulatedSeconds) + runningDelta);
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(false);

  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);
  const [weeklySnapshots, setWeeklySnapshots] = useState<WeeklyReportSnapshot[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // 1. Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
      if (!firebaseUser) {
        setSettings(null);
        setProjects([]);
        setTasks([]);
        setTimeEntries([]);
        setActiveTimer(null);
        setWeeklySnapshots([]);
        setDataLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Real-time Firestore subscriptions (attached strictly after authReady && user)
  useEffect(() => {
    if (!authReady || !user) return;

    setDataLoading(true);
    let loadedMask = 0;
    const markLoaded = (bit: number) => {
      loadedMask |= bit;
      if (loadedMask === 63) {
        setDataLoading(false);
      }
    };

    const userId = user.uid;

    // Settings doc
    const unsubSettings = onSnapshot(
      doc(db, 'users', userId),
      (snap) => {
        if (snap.exists()) {
          setSettings({ id: snap.id, ...(snap.data() as Omit<UserSettings, 'id'>) });
        } else {
          void ensureUserSettings(userId, user.displayName || 'Workspace Member');
        }
        markLoaded(1);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `users/${userId}`);
      }
    );

    // Projects
    const unsubProjects = onSnapshot(
      query(collection(db, 'projects'), where('userId', '==', userId)),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<Project, 'id'>) }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setProjects(list);
        markLoaded(2);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'projects');
      }
    );

    // Tasks
    const unsubTasks = onSnapshot(
      query(collection(db, 'tasks'), where('userId', '==', userId)),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<Task, 'id'>) }))
          .sort((a, b) => {
            const aTime = a.createdAt?.toMillis?.() ?? 0;
            const bTime = b.createdAt?.toMillis?.() ?? 0;
            return bTime - aTime;
          });
        setTasks(list);
        markLoaded(4);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'tasks');
      }
    );

    // Time Entries
    const unsubEntries = onSnapshot(
      query(collection(db, 'timeEntries'), where('userId', '==', userId)),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<TimeEntry, 'id'>) }))
          .sort((a, b) => b.startTime.localeCompare(a.startTime));
        setTimeEntries(list);
        markLoaded(8);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'timeEntries');
      }
    );

    // Active Timer
    const unsubTimer = onSnapshot(
      doc(db, 'activeTimers', userId),
      (snap) => {
        if (snap.exists()) {
          const timerData = { id: snap.id, ...(snap.data() as Omit<ActiveTimer, 'id'>) };
          setActiveTimer(timerData);
          setElapsedSeconds(computeElapsedSeconds(timerData));
        } else {
          setActiveTimer(null);
          setElapsedSeconds(0);
        }
        markLoaded(16);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `activeTimers/${userId}`);
      }
    );

    // Weekly Snapshots
    const unsubReports = onSnapshot(
      query(collection(db, 'weeklyReports'), where('userId', '==', userId)),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<WeeklyReportSnapshot, 'id'>) }))
          .sort((a, b) => b.weekStart.localeCompare(a.weekStart));
        setWeeklySnapshots(list);
        markLoaded(32);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'weeklyReports');
      }
    );

    return () => {
      unsubSettings();
      unsubProjects();
      unsubTasks();
      unsubEntries();
      unsubTimer();
      unsubReports();
    };
  }, [authReady, user]);

  // 3. Live 1-second timer ticker
  useEffect(() => {
    if (!activeTimer) {
      setElapsedSeconds(0);
      return;
    }
    setElapsedSeconds(computeElapsedSeconds(activeTimer));
    if (activeTimer.isPaused) return;

    const interval = window.setInterval(() => {
      setElapsedSeconds(computeElapsedSeconds(activeTimer));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [activeTimer]);

  // Auth actions
  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to sign in with Google.';
      if (!msg.includes('popup-closed-by-user')) {
        setAuthError(msg);
      }
    }
  }, []);

  const signOutUser = useCallback(async () => {
    await signOut(auth);
  }, []);

  // Timer actions
  const startTimer = useCallback(
    async (input: StartTimerInput) => {
      if (!user) return;
      if (activeTimer) {
        const currentSecs = computeElapsedSeconds(activeTimer);
        if (currentSecs >= 30 && (activeTimer.projectId || projects.length > 0)) {
          const targetProjectId =
            activeTimer.projectId ||
            projects.find((p) => p.status === 'active')?.id ||
            projects[0]?.id ||
            '';
          if (targetProjectId) {
            const endDate = new Date();
            const startDate = new Date(endDate.getTime() - currentSecs * 1000);
            await stopAndSaveActiveTimerDoc(user.uid, {
              projectId: targetProjectId,
              taskId: activeTimer.taskId || '',
              description: activeTimer.description || 'Focused work session',
              workType: activeTimer.workType,
              billable: activeTimer.billable,
              dateKey: toDateKey(endDate),
              startTime: startDate.toISOString(),
              endTime: endDate.toISOString(),
              durationSeconds: currentSecs,
            });
          } else {
            await discardActiveTimerDoc(user.uid);
          }
        } else {
          await discardActiveTimerDoc(user.uid);
        }
      }
      await startActiveTimerDoc(user.uid, input);
    },
    [user, activeTimer, projects]
  );

  const pauseTimer = useCallback(async () => {
    if (!user || !activeTimer || activeTimer.isPaused) return;
    const total = computeElapsedSeconds(activeTimer);
    await pauseOrResumeTimerDoc(user.uid, {
      isPaused: true,
      startedAtMs: activeTimer.startedAtMs,
      accumulatedSeconds: total,
    });
  }, [user, activeTimer]);

  const resumeTimer = useCallback(async () => {
    if (!user || !activeTimer || !activeTimer.isPaused) return;
    await pauseOrResumeTimerDoc(user.uid, {
      isPaused: false,
      startedAtMs: Date.now(),
      accumulatedSeconds: activeTimer.accumulatedSeconds,
    });
  }, [user, activeTimer]);

  const updateLiveTimer = useCallback(
    async (
      meta: Pick<ActiveTimer, 'projectId' | 'taskId' | 'description' | 'workType' | 'billable' | 'mode'>
    ) => {
      if (!user || !activeTimer) return;
      await updateActiveTimerMetaDoc(user.uid, meta);
    },
    [user, activeTimer]
  );

  const stopAndSaveTimer = useCallback(
    async (overrideProjectId?: string) => {
      if (!user || !activeTimer) return;
      const totalSecs = Math.max(1, computeElapsedSeconds(activeTimer));
      const targetProjectId =
        overrideProjectId ||
        activeTimer.projectId ||
        projects.find((p) => p.status === 'active')?.id ||
        projects[0]?.id ||
        '';

      let resolvedProjectId = targetProjectId;
      if (!resolvedProjectId) {
        resolvedProjectId = await createProjectDoc(user.uid, {
          name: 'General Work',
          client: 'Personal',
          color: '#2563EB',
          hourlyRate: settings?.defaultHourlyRate ?? 95,
          budgetHours: 40,
        });
      }

      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - totalSecs * 1000);

      await stopAndSaveActiveTimerDoc(user.uid, {
        projectId: resolvedProjectId,
        taskId: activeTimer.taskId || '',
        description: activeTimer.description || 'Focused work session',
        workType: activeTimer.workType,
        billable: activeTimer.billable,
        dateKey: toDateKey(endDate),
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        durationSeconds: totalSecs,
      });
    },
    [user, activeTimer, projects, settings]
  );

  const discardTimer = useCallback(async () => {
    if (!user) return;
    await discardActiveTimerDoc(user.uid);
  }, [user]);

  // Project actions
  const createProject = useCallback(
    async (input: ProjectInput) => {
      if (!user) throw new Error('Not signed in');
      return createProjectDoc(user.uid, input);
    },
    [user]
  );

  const updateProject = useCallback(async (projectId: string, input: ProjectInput) => {
    await updateProjectDetailsDoc(projectId, input);
  }, []);

  const toggleProjectStatus = useCallback(async (projectId: string, status: ProjectStatus) => {
    await setProjectStatusDoc(projectId, status);
  }, []);

  const deleteProject = useCallback(async (projectId: string) => {
    await deleteProjectDoc(projectId);
  }, []);

  // Task actions
  const createTask = useCallback(
    async (input: TaskInput) => {
      if (!user) throw new Error('Not signed in');
      return createTaskDoc(user.uid, input);
    },
    [user]
  );

  const updateTask = useCallback(
    async (taskId: string, input: TaskInput, existingCompletedAt: string) => {
      await updateTaskDetailsDoc(taskId, input, existingCompletedAt);
    },
    []
  );

  const setTaskStatus = useCallback(async (taskId: string, status: TaskStatus) => {
    await setTaskStatusDoc(taskId, status);
  }, []);

  const deleteTask = useCallback(async (taskId: string) => {
    await deleteTaskDoc(taskId);
  }, []);

  // Time entry actions
  const createManualEntry = useCallback(
    async (input: TimeEntryInput) => {
      if (!user) throw new Error('Not signed in');
      return createTimeEntryDoc(user.uid, input);
    },
    [user]
  );

  const updateEntry = useCallback(async (entryId: string, input: TimeEntryInput) => {
    await updateTimeEntryDoc(entryId, input);
  }, []);

  const deleteEntry = useCallback(async (entryId: string) => {
    await deleteTimeEntryDoc(entryId);
  }, []);

  // Weekly Report Snapshots
  const saveWeeklySnapshot = useCallback(
    async (input: WeeklySnapshotInput) => {
      if (!user) throw new Error('Not signed in');
      return createWeeklySnapshotDoc(user.uid, input);
    },
    [user]
  );

  const deleteWeeklySnapshot = useCallback(async (reportId: string) => {
    await deleteWeeklySnapshotDoc(reportId);
  }, []);

  // Settings
  const updateSettings = useCallback(
    async (
      updates: Pick<
        UserSettings,
        'displayName' | 'weeklyTargetHours' | 'dailyTargetHours' | 'workweekStart' | 'defaultHourlyRate'
      >
    ) => {
      if (!user) return;
      await updateUserSettingsDoc(user.uid, updates);
    },
    [user]
  );

  const loadSampleWorkspace = useCallback(async () => {
    if (!user) return;
    await seedSampleWorkspaceDocs(user.uid);
  }, [user]);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      user,
      authReady,
      dataLoading,
      authError,
      settings,
      projects,
      tasks,
      timeEntries,
      activeTimer,
      weeklySnapshots,
      elapsedSeconds,
      signInWithGoogle,
      signOutUser,
      startTimer,
      pauseTimer,
      resumeTimer,
      updateLiveTimer,
      stopAndSaveTimer,
      discardTimer,
      createProject,
      updateProject,
      toggleProjectStatus,
      deleteProject,
      createTask,
      updateTask,
      setTaskStatus,
      deleteTask,
      createManualEntry,
      updateEntry,
      deleteEntry,
      saveWeeklySnapshot,
      deleteWeeklySnapshot,
      updateSettings,
      loadSampleWorkspace,
    }),
    [
      user,
      authReady,
      dataLoading,
      authError,
      settings,
      projects,
      tasks,
      timeEntries,
      activeTimer,
      weeklySnapshots,
      elapsedSeconds,
      signInWithGoogle,
      signOutUser,
      startTimer,
      pauseTimer,
      resumeTimer,
      updateLiveTimer,
      stopAndSaveTimer,
      discardTimer,
      createProject,
      updateProject,
      toggleProjectStatus,
      deleteProject,
      createTask,
      updateTask,
      setTaskStatus,
      deleteTask,
      createManualEntry,
      updateEntry,
      deleteEntry,
      saveWeeklySnapshot,
      deleteWeeklySnapshot,
      updateSettings,
      loadSampleWorkspace,
    ]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}
