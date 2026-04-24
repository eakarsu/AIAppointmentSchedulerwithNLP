import React, { useState, useEffect } from 'react';
import { settingsApi, aiApi, authApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const timezones = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Phoenix',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Asia/Dubai',
  'Australia/Sydney',
  'Pacific/Auckland'
];

export default function Settings() {
  const { user } = useAuth();
  const toast = useToast();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiStatus, setAiStatus] = useState(null);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    loadSettings();
    checkAIStatus();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await settingsApi.get();
      setSettings(data);
    } catch (err) {
      console.error('Failed to load settings:', err);
      toast.showError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const checkAIStatus = async () => {
    try {
      const status = await aiApi.getStatus();
      setAiStatus(status);
    } catch (err) {
      console.error('Failed to check AI status:', err);
    }
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      const updated = await settingsApi.update(settings);
      setSettings(updated);
      toast.showSuccess('Settings saved successfully!');
    } catch (err) {
      console.error('Failed to save settings:', err);
      toast.showError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-800">Settings</h1>

      {/* AI Configuration Status */}
      <div className={`rounded-xl shadow-sm p-6 ${aiStatus?.configured ? 'bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200' : 'bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200'}`}>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">{aiStatus?.configured ? '🤖' : '⚠️'}</span>
          <div>
            <h2 className="text-lg font-semibold text-gray-800">
              AI Features {aiStatus?.configured ? 'Active' : 'Limited'}
            </h2>
            <p className="text-sm text-gray-600">
              {aiStatus?.configured
                ? 'OpenRouter AI is configured and all AI features are available.'
                : 'Add your OpenRouter API key in .env file to enable full AI features.'}
            </p>
          </div>
        </div>

        {aiStatus?.features && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Available AI Features:</p>
            <div className="flex flex-wrap gap-2">
              {aiStatus.features.map((feature, i) => (
                <span
                  key={i}
                  className={`px-3 py-1 text-xs rounded-full ${
                    aiStatus.configured
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {feature}
                </span>
              ))}
            </div>
          </div>
        )}

        {!aiStatus?.configured && (
          <div className="mt-4 p-3 bg-white rounded-lg border border-yellow-200">
            <p className="text-sm font-medium text-gray-700 mb-1">How to enable full AI:</p>
            <ol className="text-sm text-gray-600 list-decimal list-inside space-y-1">
              <li>Get an API key from <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">openrouter.ai/keys</a></li>
              <li>Add it to your <code className="bg-gray-100 px-1 rounded">.env</code> file</li>
              <li>Restart the application</li>
            </ol>
          </div>
        )}
      </div>

      {/* Profile Section */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Profile</h2>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-2xl">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-gray-800">{user?.name}</p>
            <p className="text-gray-500">{user?.email}</p>
            <span className="inline-block mt-1 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full capitalize">
              {user?.role}
            </span>
          </div>
        </div>
      </div>

      {/* Preferences Section */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Preferences</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
            <select
              value={settings?.timezone || 'UTC'}
              onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {timezones.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Theme</label>
            <select
              value={settings?.theme || 'light'}
              onChange={(e) => setSettings({ ...settings, theme: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Reminder Time</label>
            <select
              value={settings?.default_reminder_minutes || 30}
              onChange={(e) => setSettings({ ...settings, default_reminder_minutes: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value={15}>15 minutes before</option>
              <option value={30}>30 minutes before</option>
              <option value={45}>45 minutes before</option>
              <option value={60}>1 hour before</option>
              <option value={120}>2 hours before</option>
              <option value={1440}>1 day before</option>
            </select>
          </div>
        </div>
      </div>

      {/* Notifications Section */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Notifications</h2>
        <div className="space-y-4">
          <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
            <div>
              <p className="font-medium text-gray-800">Email Notifications</p>
              <p className="text-sm text-gray-500">Receive appointment reminders via email</p>
            </div>
            <div className="relative">
              <input
                type="checkbox"
                checked={settings?.notification_email ?? true}
                onChange={(e) => setSettings({ ...settings, notification_email: e.target.checked })}
                className="sr-only"
              />
              <div className={`w-11 h-6 rounded-full transition-colors ${
                settings?.notification_email ? 'bg-blue-600' : 'bg-gray-300'
              }`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                  settings?.notification_email ? 'translate-x-5' : 'translate-x-0.5'
                } mt-0.5`}></div>
              </div>
            </div>
          </label>

          <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
            <div>
              <p className="font-medium text-gray-800">SMS Notifications</p>
              <p className="text-sm text-gray-500">Receive appointment reminders via SMS</p>
            </div>
            <div className="relative">
              <input
                type="checkbox"
                checked={settings?.notification_sms ?? false}
                onChange={(e) => setSettings({ ...settings, notification_sms: e.target.checked })}
                className="sr-only"
              />
              <div className={`w-11 h-6 rounded-full transition-colors ${
                settings?.notification_sms ? 'bg-blue-600' : 'bg-gray-300'
              }`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                  settings?.notification_sms ? 'translate-x-5' : 'translate-x-0.5'
                } mt-0.5`}></div>
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* AI Preferences Section */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">AI Preferences</h2>
        <div className="space-y-4">
          <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
            <div>
              <p className="font-medium text-gray-800">AI Scheduling Suggestions</p>
              <p className="text-sm text-gray-500">Get smart time slot recommendations</p>
            </div>
            <div className="relative">
              <input
                type="checkbox"
                checked={settings?.ai_suggestions ?? true}
                onChange={(e) => setSettings({ ...settings, ai_suggestions: e.target.checked })}
                className="sr-only"
              />
              <div className={`w-11 h-6 rounded-full transition-colors ${
                settings?.ai_suggestions !== false ? 'bg-blue-600' : 'bg-gray-300'
              }`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                  settings?.ai_suggestions !== false ? 'translate-x-5' : 'translate-x-0.5'
                } mt-0.5`}></div>
              </div>
            </div>
          </label>

          <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
            <div>
              <p className="font-medium text-gray-800">AI Conflict Detection</p>
              <p className="text-sm text-gray-500">Warn about scheduling conflicts</p>
            </div>
            <div className="relative">
              <input
                type="checkbox"
                checked={settings?.ai_conflict_detection ?? true}
                onChange={(e) => setSettings({ ...settings, ai_conflict_detection: e.target.checked })}
                className="sr-only"
              />
              <div className={`w-11 h-6 rounded-full transition-colors ${
                settings?.ai_conflict_detection !== false ? 'bg-blue-600' : 'bg-gray-300'
              }`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                  settings?.ai_conflict_detection !== false ? 'translate-x-5' : 'translate-x-0.5'
                } mt-0.5`}></div>
              </div>
            </div>
          </label>

          <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
            <div>
              <p className="font-medium text-gray-800">AI Schedule Insights</p>
              <p className="text-sm text-gray-500">Show weekly schedule analysis</p>
            </div>
            <div className="relative">
              <input
                type="checkbox"
                checked={settings?.ai_insights ?? true}
                onChange={(e) => setSettings({ ...settings, ai_insights: e.target.checked })}
                className="sr-only"
              />
              <div className={`w-11 h-6 rounded-full transition-colors ${
                settings?.ai_insights !== false ? 'bg-blue-600' : 'bg-gray-300'
              }`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                  settings?.ai_insights !== false ? 'translate-x-5' : 'translate-x-0.5'
                } mt-0.5`}></div>
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* Change Password Section */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Change Password</h2>
        <div className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <input type="password" value={pwForm.currentPassword} onChange={(e) => setPwForm({...pwForm, currentPassword: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input type="password" value={pwForm.newPassword} onChange={(e) => setPwForm({...pwForm, newPassword: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            <p className="text-xs text-gray-500 mt-1">Min 8 chars, uppercase, lowercase, number, special char</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <input type="password" value={pwForm.confirmPassword} onChange={(e) => setPwForm({...pwForm, confirmPassword: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
          <button
            onClick={async () => {
              if (pwForm.newPassword !== pwForm.confirmPassword) { toast.showError('Passwords do not match'); return; }
              setPwSaving(true);
              try {
                await authApi.changePassword(pwForm.currentPassword, pwForm.newPassword);
                toast.showSuccess('Password changed successfully');
                setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
              } catch (err) {
                toast.showError(err.message);
              } finally {
                setPwSaving(false);
              }
            }}
            disabled={pwSaving || !pwForm.currentPassword || !pwForm.newPassword}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {pwSaving ? 'Changing...' : 'Change Password'}
          </button>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {saving ? (
            <>
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Saving...
            </>
          ) : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
