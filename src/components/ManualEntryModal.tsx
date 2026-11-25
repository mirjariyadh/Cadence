import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { toDateKey } from '../lib/formatters';
import {
  FIELD_LIMITS,
  WORK_TYPE_META,
  type TimeEntry,
  type WorkType,
} from '../types/models';

interface ManualEntryModalProps {
  open: boolean;
  editingEntry: TimeEntry | null;
  defaultProjectId?: string;
  onClose: () => void;
}

export function ManualEntryModal({
  open,
  editingEntry,
  defaultProjectId,
  onClose,
}: ManualEntryModalProps) {
  const { projects, tasks, createManualEntry, updateEntry } = useWorkspace();

  const activeProjects = projects.filter((p) => p.status === 'active');
  const selectableProjects = editingEntry ? projects : activeProjects.length > 0 ? activeProjects : projects;

  const [projectId, setProjectId] = useState('');
  const [taskId, setTaskId] = useState('');
  const [dateKey, setDateKey] = useState(toDateKey(new Date()));
  const [startTimeStr, setStartTimeStr] = useState('09:00');
  const [hours, setHours] = useState('1');
  const [minutes, setMinutes] = useState('30');
  const [workType, setWorkType] = useState<WorkType>('deep_work');
  const [billable, setBillable] = useState(true);
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    if (editingEntry) {
      setProjectId(editingEntry.projectId);
      setTaskId(editingEntry.taskId);
      setDateKey(editingEntry.dateKey);
      const start = new Date(editingEntry.startTime);
      if (!Number.isNaN(start.getTime())) {
        const hh = String(start.getHours()).padStart(2, '0');
        const mm = String(start.getMinutes()).padStart(2, '0');
        setStartTimeStr(`${hh}:${mm}`);
      } else {
        setStartTimeStr('09:00');
      }
      const totalMins = Math.max(1, Math.round(editingEntry.durationSeconds / 60));
      setHours(String(Math.floor(totalMins / 60)));
      setMinutes(String(totalMins % 60));
      setWorkType(editingEntry.workType);
      setBillable(editingEntry.billable);
      setDescription(editingEntry.description);
    } else {
      const initialProject =
        defaultProjectId || activeProjects[0]?.id || projects[0]?.id || '';
      setProjectId(initialProject);
      setTaskId('');
      setDateKey(toDateKey(new Date()));
      setStartTimeStr('09:00');
      setHours('1');
      setMinutes('0');
      setWorkType('deep_work');
      setBillable(true);
      setDescription('');
    }
  }, [open, editingEntry, defaultProjectId, projects]);

  if (!open) return null;

  const projectTasks = tasks.filter((t) => t.projectId === projectId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!projectId) {
      setError('Select a project before logging hours.');
      return;
    }

    const totalSeconds = (Number(hours) || 0) * 3600 + (Number(minutes) || 0) * 60;
    if (totalSeconds < 60 || totalSeconds > FIELD_LIMITS.MAX_DURATION_SECONDS) {
      setError('Duration must be between 1 minute and 24 hours.');
      return;
    }

    const [y, m, d] = dateKey.split('-').map(Number);
    const [hh, mm] = startTimeStr.split(':').map(Number);
    const start = new Date(y, m - 1, d, hh || 9, mm || 0, 0, 0);
    const end = new Date(start.getTime() + totalSeconds * 1000);

    setSaving(true);
    try {
      const payload = {
        projectId,
        taskId,
        description: description.trim() || 'Logged working session',
        workType,
        billable,
        dateKey,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        durationSeconds: totalSeconds,
      };
      if (editingEntry) {
        await updateEntry(editingEntry.id, payload);
      } else {
        await createManualEntry(payload);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save time entry.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 no-print"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-entry-title"
    >
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 id="manual-entry-title" className="text-base font-semibold text-slate-900">
            {editingEntry ? 'Edit Time Entry' : 'Log Working Hours'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="entry-project" className="block text-xs font-medium text-slate-700 mb-1.5">
                Project
              </label>
              <select
                id="entry-project"
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  setTaskId('');
                }}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                required
              >
                <option value="">Select project...</option>
                {selectableProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="entry-task" className="block text-xs font-medium text-slate-700 mb-1.5">
                Linked Task (Optional)
              </label>
              <select
                id="entry-task"
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
                disabled={!projectId}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="">No specific task</option>
                {projectTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="entry-desc" className="block text-xs font-medium text-slate-700 mb-1.5">
              Work Description
            </label>
            <input
              id="entry-desc"
              type="text"
              maxLength={FIELD_LIMITS.ENTRY_DESCRIPTION_MAX}
              placeholder="What did you work on?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="col-span-2 sm:col-span-2">
              <label htmlFor="entry-date" className="block text-xs font-medium text-slate-700 mb-1.5">
                Date
              </label>
              <input
                id="entry-date"
                type="date"
                value={dateKey}
                onChange={(e) => setDateKey(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                required
              />
            </div>

            <div>
              <label htmlFor="entry-start" className="block text-xs font-medium text-slate-700 mb-1.5">
                Start
              </label>
              <input
                id="entry-start"
                type="time"
                value={startTimeStr}
                onChange={(e) => setStartTimeStr(e.target.value)}
                className="w-full px-2.5 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Duration
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={23}
                  aria-label="Duration hours"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  className="w-full px-2 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
                <span className="text-xs text-slate-400">h</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  aria-label="Duration minutes"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  className="w-full px-2 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
                <span className="text-xs text-slate-400">m</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
            <div>
              <label htmlFor="entry-worktype" className="block text-xs font-medium text-slate-700 mb-1.5">
                Work Category
              </label>
              <select
                id="entry-worktype"
                value={workType}
                onChange={(e) => setWorkType(e.target.value as WorkType)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              >
                {(Object.keys(WORK_TYPE_META) as WorkType[]).map((key) => (
                  <option key={key} value={key}>
                    {WORK_TYPE_META[key].label}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2.5 h-[38px] px-3 border border-slate-200 rounded-lg cursor-pointer select-none">
              <input
                type="checkbox"
                checked={billable}
                onChange={(e) => setBillable(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-700">Billable working hours</span>
            </label>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 rounded-lg transition-colors whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
            >
              {saving ? 'Saving...' : editingEntry ? 'Update Entry' : 'Save Hours'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
