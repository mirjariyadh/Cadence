import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { FIELD_LIMITS, type WorkweekStart } from '../types/models';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { settings, user, updateSettings } = useWorkspace();

  const [displayName, setDisplayName] = useState('');
  const [weeklyTargetHours, setWeeklyTargetHours] = useState('40');
  const [dailyTargetHours, setDailyTargetHours] = useState('8');
  const [defaultHourlyRate, setDefaultHourlyRate] = useState('95');
  const [workweekStart, setWorkweekStart] = useState<WorkweekStart>('monday');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDisplayName(settings?.displayName || user?.displayName || '');
    setWeeklyTargetHours(String(settings?.weeklyTargetHours ?? 40));
    setDailyTargetHours(String(settings?.dailyTargetHours ?? 8));
    setDefaultHourlyRate(String(settings?.defaultHourlyRate ?? 95));
    setWorkweekStart(settings?.workweekStart ?? 'monday');
  }, [open, settings, user]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateSettings({
        displayName: displayName.trim() || 'Workspace Member',
        weeklyTargetHours: Number(weeklyTargetHours) || 40,
        dailyTargetHours: Number(dailyTargetHours) || 8,
        defaultHourlyRate: Number(defaultHourlyRate) || 0,
        workweekStart,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 no-print"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 id="settings-modal-title" className="text-base font-semibold text-slate-900">
            Targets &amp; Report Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
            aria-label="Close settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="p-6 space-y-4">
          <div>
            <label htmlFor="settings-name" className="block text-xs font-medium text-slate-700 mb-1.5">
              Report Author Name
            </label>
            <input
              id="settings-name"
              type="text"
              maxLength={FIELD_LIMITS.DISPLAY_NAME_MAX}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="settings-weekly" className="block text-xs font-medium text-slate-700 mb-1.5">
                Weekly Goal (Hours)
              </label>
              <input
                id="settings-weekly"
                type="number"
                min={FIELD_LIMITS.MIN_WEEKLY_HOURS}
                max={FIELD_LIMITS.MAX_WEEKLY_HOURS}
                step="0.5"
                value={weeklyTargetHours}
                onChange={(e) => setWeeklyTargetHours(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                required
              />
            </div>

            <div>
              <label htmlFor="settings-daily" className="block text-xs font-medium text-slate-700 mb-1.5">
                Daily Goal (Hours)
              </label>
              <input
                id="settings-daily"
                type="number"
                min={FIELD_LIMITS.MIN_DAILY_HOURS}
                max={FIELD_LIMITS.MAX_DAILY_HOURS}
                step="0.5"
                value={dailyTargetHours}
                onChange={(e) => setDailyTargetHours(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="settings-rate" className="block text-xs font-medium text-slate-700 mb-1.5">
                Default Rate (USD/h)
              </label>
              <input
                id="settings-rate"
                type="number"
                min={0}
                max={FIELD_LIMITS.MAX_HOURLY_RATE}
                step="1"
                value={defaultHourlyRate}
                onChange={(e) => setDefaultHourlyRate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                required
              />
            </div>

            <div>
              <label htmlFor="settings-weekstart" className="block text-xs font-medium text-slate-700 mb-1.5">
                Workweek Starts On
              </label>
              <select
                id="settings-weekstart"
                value={workweekStart}
                onChange={(e) => setWorkweekStart(e.target.value as WorkweekStart)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              >
                <option value="monday">Monday</option>
                <option value="sunday">Sunday</option>
              </select>
            </div>
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
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
