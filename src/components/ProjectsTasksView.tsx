import React, { useMemo, useState } from 'react';
import {
  Archive,
  CheckCircle2,
  Circle,
  Clock,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import {
  formatDecimalHours,
  formatHoursMinutes,
  formatMinutesAsDuration,
  formatShortDate,
} from '../lib/formatters';
import {
  FIELD_LIMITS,
  PROJECT_PALETTE,
  type Project,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from '../types/models';

interface ProjectsTasksViewProps {
  onStartTaskTimer: (task: Task) => void;
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export function ProjectsTasksView({ onStartTaskTimer }: ProjectsTasksViewProps) {
  const {
    settings,
    projects,
    tasks,
    timeEntries,
    activeTimer,
    createProject,
    updateProject,
    toggleProjectStatus,
    deleteProject,
    createTask,
    updateTask,
    setTaskStatus,
    deleteTask,
  } = useWorkspace();

  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | TaskPriority>('all');
  const [showArchivedProjects, setShowArchivedProjects] = useState(false);
  const [taskSearch, setTaskSearch] = useState('');

  // Quick-add task inline state
  const [quickTaskTitle, setQuickTaskTitle] = useState('');
  const [quickTaskProjectId, setQuickTaskProjectId] = useState('');

  // Modals
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [confirmDeleteProjectId, setConfirmDeleteProjectId] = useState<string | null>(null);
  const [confirmDeleteTaskId, setConfirmDeleteTaskId] = useState<string | null>(null);

  // Project form state
  const [pName, setPName] = useState('');
  const [pClient, setPClient] = useState('');
  const [pColor, setPColor] = useState<string>(PROJECT_PALETTE[0]);
  const [pRate, setPRate] = useState('95');
  const [pBudget, setPBudget] = useState('40');
  const [savingProject, setSavingProject] = useState(false);

  // Task form state
  const [tProjectId, setTProjectId] = useState('');
  const [tTitle, setTTitle] = useState('');
  const [tNotes, setTNotes] = useState('');
  const [tPriority, setTPriority] = useState<TaskPriority>('medium');
  const [tStatus, setTStatus] = useState<TaskStatus>('todo');
  const [tEstimate, setTEstimate] = useState('60');
  const [tDueDate, setTDueDate] = useState('');
  const [savingTask, setSavingTask] = useState(false);

  const activeProjects = useMemo(
    () => projects.filter((p) => p.status === 'active'),
    [projects]
  );

  const visibleProjects = useMemo(
    () =>
      showArchivedProjects ? projects : projects.filter((p) => p.status === 'active'),
    [projects, showArchivedProjects]
  );

  const projectMap = useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects]
  );

  const secondsByProject = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of timeEntries) {
      map.set(e.projectId, (map.get(e.projectId) ?? 0) + e.durationSeconds);
    }
    return map;
  }, [timeEntries]);

  const secondsByTask = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of timeEntries) {
      if (e.taskId) {
        map.set(e.taskId, (map.get(e.taskId) ?? 0) + e.durationSeconds);
      }
    }
    return map;
  }, [timeEntries]);

  const openNewProjectModal = () => {
    setEditingProject(null);
    setPName('');
    setPClient('');
    setPColor(PROJECT_PALETTE[projects.length % PROJECT_PALETTE.length]);
    setPRate(String(settings?.defaultHourlyRate ?? 95));
    setPBudget('40');
    setProjectModalOpen(true);
  };

  const openEditProjectModal = (proj: Project) => {
    setEditingProject(proj);
    setPName(proj.name);
    setPClient(proj.client);
    setPColor(proj.color);
    setPRate(String(proj.hourlyRate));
    setPBudget(String(proj.budgetHours));
    setProjectModalOpen(true);
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pName.trim()) return;
    setSavingProject(true);
    try {
      const payload = {
        name: pName.trim(),
        client: pClient.trim(),
        color: pColor,
        hourlyRate: Number(pRate) || 0,
        budgetHours: Number(pBudget) || 0,
      };
      if (editingProject) {
        await updateProject(editingProject.id, payload);
      } else {
        await createProject(payload);
      }
      setProjectModalOpen(false);
    } finally {
      setSavingProject(false);
    }
  };

  const openNewTaskModal = () => {
    setEditingTask(null);
    setTProjectId(
      selectedProjectFilter !== 'all'
        ? selectedProjectFilter
        : activeProjects[0]?.id || ''
    );
    setTTitle('');
    setTNotes('');
    setTPriority('medium');
    setTStatus('todo');
    setTEstimate('60');
    setTDueDate('');
    setTaskModalOpen(true);
  };

  const openEditTaskModal = (task: Task) => {
    setEditingTask(task);
    setTProjectId(task.projectId);
    setTTitle(task.title);
    setTNotes(task.notes);
    setTPriority(task.priority);
    setTStatus(task.status);
    setTEstimate(String(task.estimatedMinutes));
    setTDueDate(task.dueDate);
    setTaskModalOpen(true);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tTitle.trim() || !tProjectId) return;
    setSavingTask(true);
    try {
      const payload = {
        projectId: tProjectId,
        title: tTitle.trim(),
        notes: tNotes.trim(),
        priority: tPriority,
        status: tStatus,
        estimatedMinutes: Number(tEstimate) || 0,
        dueDate: tDueDate,
      };
      if (editingTask) {
        await updateTask(editingTask.id, payload, editingTask.completedAt);
      } else {
        await createTask(payload);
      }
      setTaskModalOpen(false);
    } finally {
      setSavingTask(false);
    }
  };

  const handleQuickAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetProject =
      quickTaskProjectId ||
      (selectedProjectFilter !== 'all' ? selectedProjectFilter : activeProjects[0]?.id || '');
    if (!quickTaskTitle.trim() || !targetProject) return;

    await createTask({
      projectId: targetProject,
      title: quickTaskTitle.trim(),
      notes: '',
      priority: 'medium',
      status: 'todo',
      estimatedMinutes: 60,
      dueDate: '',
    });
    setQuickTaskTitle('');
  };

  const filteredTasks = useMemo(() => {
    const q = taskSearch.trim().toLowerCase();
    const statusRank: Record<TaskStatus, number> = { in_progress: 0, todo: 1, done: 2 };
    const priorityRank: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };

    return tasks
      .filter((t) => {
        if (selectedProjectFilter !== 'all' && t.projectId !== selectedProjectFilter) {
          return false;
        }
        if (statusFilter !== 'all' && t.status !== statusFilter) return false;
        if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
        if (q) {
          const pNameMatch = projectMap.get(t.projectId)?.name.toLowerCase().includes(q) ?? false;
          if (!t.title.toLowerCase().includes(q) && !t.notes.toLowerCase().includes(q) && !pNameMatch) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (statusRank[a.status] !== statusRank[b.status]) {
          return statusRank[a.status] - statusRank[b.status];
        }
        if (priorityRank[a.priority] !== priorityRank[b.priority]) {
          return priorityRank[a.priority] - priorityRank[b.priority];
        }
        return (a.dueDate || '9999-12-31').localeCompare(b.dueDate || '9999-12-31');
      });
  }, [tasks, selectedProjectFilter, statusFilter, priorityFilter, taskSearch, projectMap]);

  return (
    <div className="space-y-6">
      {/* Projects Portfolio Section */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Projects</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select a project to filter tasks, or track logged hours against budget
            </p>
          </div>
          <div className="flex items-center gap-3">
            {projects.some((p) => p.status === 'archived') && (
              <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showArchivedProjects}
                  onChange={(e) => setShowArchivedProjects(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600"
                />
                Show archived
              </label>
            )}
            <button
              type="button"
              onClick={openNewProjectModal}
              className="min-h-[38px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              New Project
            </button>
          </div>
        </div>

        {visibleProjects.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
            <p className="text-sm text-slate-600 mb-4">
              Create your first project to organize work tasks, hourly rates, and time budgets.
            </p>
            <button
              type="button"
              onClick={openNewProjectModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              Create Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {visibleProjects.map((project) => {
              const loggedSeconds = secondsByProject.get(project.id) ?? 0;
              const loggedHours = loggedSeconds / 3600;
              const budgetPercent =
                project.budgetHours > 0
                  ? Math.min(100, Math.round((loggedHours / project.budgetHours) * 100))
                  : 0;
              const isOverBudget =
                project.budgetHours > 0 && loggedHours > project.budgetHours;
              const openCount = tasks.filter(
                (t) => t.projectId === project.id && t.status !== 'done'
              ).length;
              const isSelected = selectedProjectFilter === project.id;

              return (
                <div
                  key={project.id}
                  onClick={() =>
                    setSelectedProjectFilter((prev) =>
                      prev === project.id ? 'all' : project.id
                    )
                  }
                  className={`bg-white rounded-xl p-5 border transition-colors cursor-pointer ${
                    isSelected
                      ? 'border-blue-600 ring-1 ring-blue-600/20'
                      : 'border-slate-200 hover:border-slate-300'
                  } ${project.status === 'archived' ? 'opacity-70' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-[2px] shrink-0"
                          style={{ backgroundColor: project.color }}
                          aria-hidden="true"
                        />
                        <h3 className="text-sm font-semibold text-slate-900 truncate">
                          {project.name}
                        </h3>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 truncate">
                        {project.client || 'Internal'} ·{' '}
                        <span className="font-mono tabular-nums">
                          {project.hourlyRate > 0 ? `$${project.hourlyRate}/h` : 'Non-billable'}
                        </span>
                        {project.status === 'archived' && ' · Archived'}
                      </p>
                    </div>

                    <div
                      className="flex items-center gap-1 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => openEditProjectModal(project)}
                        aria-label={`Edit ${project.name}`}
                        className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-md"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void toggleProjectStatus(
                            project.id,
                            project.status === 'active' ? 'archived' : 'active'
                          )
                        }
                        aria-label={
                          project.status === 'active'
                            ? `Archive ${project.name}`
                            : `Restore ${project.name}`
                        }
                        className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-md"
                      >
                        {project.status === 'active' ? (
                          <Archive className="w-3.5 h-3.5" />
                        ) : (
                          <RotateCcw className="w-3.5 h-3.5" />
                        )}
                      </button>
                      {confirmDeleteProjectId === project.id ? (
                        <button
                          type="button"
                          onClick={() => {
                            void deleteProject(project.id);
                            if (selectedProjectFilter === project.id) {
                              setSelectedProjectFilter('all');
                            }
                            setConfirmDeleteProjectId(null);
                          }}
                          className="px-2 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-md whitespace-nowrap"
                        >
                          Delete
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteProjectId(project.id)}
                          aria-label={`Delete ${project.name}`}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="font-mono tabular-nums font-semibold text-slate-900">
                        {formatDecimalHours(loggedSeconds)} logged
                      </span>
                      <span className="font-mono tabular-nums text-slate-500">
                        {project.budgetHours > 0
                          ? `of ${project.budgetHours}h budget`
                          : `${openCount} open tasks`}
                      </span>
                    </div>
                    {project.budgetHours > 0 && (
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${budgetPercent}%`,
                            backgroundColor: isOverBudget ? '#DC2626' : project.color,
                          }}
                        />
                      </div>
                    )}
                    <div className="flex items-center justify-between text-xs text-slate-500 pt-0.5">
                      <span>
                        {openCount} open {openCount === 1 ? 'task' : 'tasks'}
                      </span>
                      {project.budgetHours > 0 && (
                        <span
                          className={`font-mono tabular-nums ${
                            isOverBudget ? 'text-red-600 font-medium' : 'text-slate-500'
                          }`}
                        >
                          {Math.round((loggedHours / project.budgetHours) * 100)}% used
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Tasks Workspace Section */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-base font-semibold text-slate-900">
              Work Tasks
              {selectedProjectFilter !== 'all' && projectMap.get(selectedProjectFilter) && (
                <span className="text-slate-400 font-normal">
                  {' '}
                  / {projectMap.get(selectedProjectFilter)?.name}
                </span>
              )}
            </h2>
            {selectedProjectFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setSelectedProjectFilter('all')}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 whitespace-nowrap"
              >
                Show All Projects
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(['all', 'todo', 'in_progress', 'done'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    statusFilter === st
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {st === 'all' ? 'All' : STATUS_LABELS[st]}
                </button>
              ))}
            </div>

            <select
              aria-label="Filter tasks by priority"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as 'all' | TaskPriority)}
              className="min-h-[34px] px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-lg"
            >
              <option value="all">All Priorities</option>
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
                placeholder="Search tasks..."
                className="min-h-[34px] pl-8 pr-3 py-1 text-xs bg-white border border-slate-300 rounded-lg w-40"
              />
            </div>

            <button
              type="button"
              disabled={activeProjects.length === 0}
              onClick={openNewTaskModal}
              className="min-h-[34px] inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Task
            </button>
          </div>
        </div>

        {/* Inline quick-add task bar */}
        {activeProjects.length > 0 && (
          <form
            onSubmit={(e) => void handleQuickAddTask(e)}
            className="px-6 py-3 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
          >
            <input
              type="text"
              maxLength={FIELD_LIMITS.TASK_TITLE_MAX}
              value={quickTaskTitle}
              onChange={(e) => setQuickTaskTitle(e.target.value)}
              placeholder="Quick add a task title and press Enter..."
              className="flex-1 min-h-[36px] px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
            {selectedProjectFilter === 'all' && (
              <select
                aria-label="Project for quick task"
                value={quickTaskProjectId || activeProjects[0]?.id || ''}
                onChange={(e) => setQuickTaskProjectId(e.target.value)}
                className="min-h-[36px] px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg max-w-[180px]"
              >
                {activeProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
            <button
              type="submit"
              className="min-h-[36px] px-4 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors whitespace-nowrap"
            >
              Quick Add
            </button>
          </form>
        )}

        {/* Task rows */}
        {filteredTasks.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">
            {activeProjects.length === 0
              ? 'Create a project above before adding tasks.'
              : 'No tasks match your current filters.'}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredTasks.map((task) => {
              const project = projectMap.get(task.projectId);
              const trackedSeconds = secondsByTask.get(task.id) ?? 0;
              const isRunning = activeTimer?.taskId === task.id;

              return (
                <div
                  key={task.id}
                  className="px-6 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() =>
                        void setTaskStatus(task.id, task.status === 'done' ? 'todo' : 'done')
                      }
                      aria-label={`Toggle completion for ${task.title}`}
                      className="mt-0.5 text-slate-400 hover:text-emerald-600 transition-colors shrink-0"
                    >
                      {task.status === 'done' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Circle className="w-4 h-4" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm font-medium leading-snug ${
                          task.status === 'done'
                            ? 'line-through text-slate-400'
                            : 'text-slate-900'
                        }`}
                      >
                        {task.title}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 mt-1">
                        <span className="inline-flex items-center gap-1.5 text-slate-700 font-medium">
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
                          {PRIORITY_LABELS[task.priority]} priority
                        </span>
                        {task.dueDate && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>Due {formatShortDate(task.dueDate)}</span>
                          </>
                        )}
                        {task.notes && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="truncate max-w-[260px] text-slate-400">
                              {task.notes}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap sm:flex-nowrap items-center justify-between md:justify-end gap-3 shrink-0 pl-7 md:pl-0">
                    <div className="inline-flex items-center gap-1.5 text-xs font-mono tabular-nums text-slate-600">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{formatHoursMinutes(trackedSeconds)}</span>
                      {task.estimatedMinutes > 0 && (
                        <span className="text-slate-400">
                          / {formatMinutesAsDuration(task.estimatedMinutes)}
                        </span>
                      )}
                    </div>

                    <select
                      aria-label={`Status for ${task.title}`}
                      value={task.status}
                      onChange={(e) =>
                        void setTaskStatus(task.id, e.target.value as TaskStatus)
                      }
                      className="min-h-[32px] px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-md text-slate-700"
                    >
                      <option value="todo">To Do</option>
                      <option value="in_progress">In Progress</option>
                      <option value="done">Done</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => onStartTaskTimer(task)}
                      disabled={isRunning}
                      className={`min-h-[32px] inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        isRunning
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-slate-700 hover:text-blue-700 hover:bg-blue-50 border border-slate-200'
                      }`}
                    >
                      <Play className="w-3 h-3 fill-current" />
                      {isRunning ? 'Tracking' : 'Track'}
                    </button>

                    <button
                      type="button"
                      onClick={() => openEditTaskModal(task)}
                      aria-label={`Edit ${task.title}`}
                      className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-md"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>

                    {confirmDeleteTaskId === task.id ? (
                      <button
                        type="button"
                        onClick={() => {
                          void deleteTask(task.id);
                          setConfirmDeleteTaskId(null);
                        }}
                        className="px-2 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-md whitespace-nowrap"
                      >
                        Delete
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteTaskId(task.id)}
                        aria-label={`Delete ${task.title}`}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Project Create / Edit Modal */}
      {projectModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="project-modal-title"
        >
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 id="project-modal-title" className="text-base font-semibold text-slate-900">
                {editingProject ? 'Edit Project' : 'New Project'}
              </h2>
              <button
                type="button"
                onClick={() => setProjectModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={(e) => void handleSaveProject(e)} className="p-6 space-y-4">
              <div>
                <label htmlFor="proj-name" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Project Name
                </label>
                <input
                  id="proj-name"
                  type="text"
                  maxLength={FIELD_LIMITS.PROJECT_NAME_MAX}
                  value={pName}
                  onChange={(e) => setPName(e.target.value)}
                  placeholder="e.g. Core Platform v3"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  required
                />
              </div>

              <div>
                <label htmlFor="proj-client" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Client or Team (Optional)
                </label>
                <input
                  id="proj-client"
                  type="text"
                  maxLength={FIELD_LIMITS.PROJECT_CLIENT_MAX}
                  value={pClient}
                  onChange={(e) => setPClient(e.target.value)}
                  placeholder="e.g. Northstar Logistics or Internal"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="proj-rate" className="block text-xs font-medium text-slate-700 mb-1.5">
                    Hourly Rate (USD)
                  </label>
                  <input
                    id="proj-rate"
                    type="number"
                    min={0}
                    max={FIELD_LIMITS.MAX_HOURLY_RATE}
                    value={pRate}
                    onChange={(e) => setPRate(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label htmlFor="proj-budget" className="block text-xs font-medium text-slate-700 mb-1.5">
                    Hour Budget
                  </label>
                  <input
                    id="proj-budget"
                    type="number"
                    min={0}
                    max={FIELD_LIMITS.MAX_BUDGET_HOURS}
                    value={pBudget}
                    onChange={(e) => setPBudget(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <span className="block text-xs font-medium text-slate-700 mb-2">
                  Project Swatch Color
                </span>
                <div className="flex items-center gap-2.5">
                  {PROJECT_PALETTE.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setPColor(hex)}
                      aria-label={`Select color ${hex}`}
                      className={`w-7 h-7 rounded-md transition-transform ${
                        pColor === hex ? 'ring-2 ring-offset-2 ring-slate-900 scale-105' : ''
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setProjectModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProject}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg whitespace-nowrap"
                >
                  {savingProject ? 'Saving...' : editingProject ? 'Update Project' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Create / Edit Modal */}
      {taskModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="task-modal-title"
        >
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 id="task-modal-title" className="text-base font-semibold text-slate-900">
                {editingTask ? 'Edit Task' : 'New Work Task'}
              </h2>
              <button
                type="button"
                onClick={() => setTaskModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={(e) => void handleSaveTask(e)} className="p-6 space-y-4">
              <div>
                <label htmlFor="task-title" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Task Title
                </label>
                <input
                  id="task-title"
                  type="text"
                  maxLength={FIELD_LIMITS.TASK_TITLE_MAX}
                  value={tTitle}
                  onChange={(e) => setTTitle(e.target.value)}
                  placeholder="e.g. Finalize Q4 metrics query optimization"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="task-project" className="block text-xs font-medium text-slate-700 mb-1.5">
                    Project
                  </label>
                  <select
                    id="task-project"
                    value={tProjectId}
                    onChange={(e) => setTProjectId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                    required
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="task-status" className="block text-xs font-medium text-slate-700 mb-1.5">
                    Status
                  </label>
                  <select
                    id="task-status"
                    value={tStatus}
                    onChange={(e) => setTStatus(e.target.value as TaskStatus)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                  >
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="task-priority" className="block text-xs font-medium text-slate-700 mb-1.5">
                    Priority
                  </label>
                  <select
                    id="task-priority"
                    value={tPriority}
                    onChange={(e) => setTPriority(e.target.value as TaskPriority)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="task-est" className="block text-xs font-medium text-slate-700 mb-1.5">
                    Estimate (Mins)
                  </label>
                  <input
                    id="task-est"
                    type="number"
                    min={0}
                    max={FIELD_LIMITS.MAX_ESTIMATED_MINUTES}
                    step={15}
                    value={tEstimate}
                    onChange={(e) => setTEstimate(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label htmlFor="task-due" className="block text-xs font-medium text-slate-700 mb-1.5">
                    Due Date
                  </label>
                  <input
                    id="task-due"
                    type="date"
                    value={tDueDate}
                    onChange={(e) => setTDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="task-notes" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Notes (Optional)
                </label>
                <textarea
                  id="task-notes"
                  rows={3}
                  maxLength={FIELD_LIMITS.TASK_NOTES_MAX}
                  value={tNotes}
                  onChange={(e) => setTNotes(e.target.value)}
                  placeholder="Scope details, acceptance criteria, or links..."
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg resize-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setTaskModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingTask}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg whitespace-nowrap"
                >
                  {savingTask ? 'Saving...' : editingTask ? 'Update Task' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
