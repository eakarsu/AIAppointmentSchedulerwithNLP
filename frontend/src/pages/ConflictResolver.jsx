import React, { useState, useEffect } from 'react';
import { advancedAiApi, appointmentsApi } from '../services/api';
import { useToast } from '../context/ToastContext';
import { SkeletonTable } from '../components/Skeleton';

export default function ConflictResolver() {
  const { showSuccess, showError } = useToast();

  const [appointments, setAppointments] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [resolution, setResolution] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await appointmentsApi.getUpcoming();
      setAppointments(data);
      detectConflicts(data);
    } catch (err) {
      console.error('Failed to load data:', err);
      showError('Failed to load appointments');
    } finally {
      setLoading(false);
    }
  };

  const detectConflicts = (apts) => {
    const detected = [];
    const sorted = [...apts].sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const aEnd = new Date(sorted[i].end_time);
        const bStart = new Date(sorted[j].start_time);
        const aStart = new Date(sorted[i].start_time);
        const bEnd = new Date(sorted[j].end_time);

        if (aStart < bEnd && aEnd > bStart) {
          detected.push({
            appointment_index: i,
            appointment_a: sorted[i],
            appointment_b: sorted[j],
            type: aEnd > bStart && aStart < bStart ? 'overlap' : 'contained',
            overlap_minutes: Math.round((Math.min(aEnd, bEnd) - Math.max(aStart, bStart)) / 60000)
          });
        }
      }
    }
    setConflicts(detected);
  };

  const handleResolve = async () => {
    if (conflicts.length === 0) return;
    setResolving(true);
    try {
      const conflictData = conflicts.map(c => ({
        appointment_index: c.appointment_index,
        appointment_a_id: c.appointment_a.id,
        appointment_b_id: c.appointment_b.id,
        appointment_a_title: c.appointment_a.title,
        appointment_b_title: c.appointment_b.title,
        type: c.type,
        overlap_minutes: c.overlap_minutes
      }));
      const result = await advancedAiApi.resolveConflicts(conflictData);
      setResolution(result);
      showSuccess('Conflicts resolved with AI');
    } catch (err) {
      console.error('Resolution failed:', err);
      showError('Failed to resolve conflicts');
    } finally {
      setResolving(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
    });
  };

  const getStrategyColor = (strategy) => {
    switch (strategy) {
      case 'reschedule': return 'bg-purple-100 text-purple-700';
      case 'shorten': return 'bg-blue-100 text-blue-700';
      case 'virtualize': return 'bg-cyan-100 text-cyan-700';
      case 'delegate': return 'bg-green-100 text-green-700';
      case 'cancel': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-rose-500 to-red-600 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
              <span className="text-3xl">🔀</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold">AI Conflict Resolver</h1>
              <p className="opacity-90">Detect and resolve scheduling conflicts with AI</p>
            </div>
          </div>
        </div>
        <SkeletonTable rows={5} cols={5} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-rose-500 to-red-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
              <span className="text-3xl">🔀</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold">AI Conflict Resolver</h1>
              <p className="opacity-90">Detect and resolve scheduling conflicts with AI</p>
            </div>
          </div>
          <button
            onClick={handleResolve}
            disabled={resolving || conflicts.length === 0}
            className="px-6 py-3 bg-white text-rose-600 rounded-lg font-medium hover:bg-rose-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            {resolving ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Resolving...
              </>
            ) : (
              <>
                <span>🤖</span> Resolve with AI
              </>
            )}
          </button>
        </div>
      </div>

      {/* Conflict Detection Summary */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Detected Conflicts</h2>
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${conflicts.length > 0 ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></span>
            <span className="text-sm text-gray-600">
              {conflicts.length > 0 ? `${conflicts.length} conflict${conflicts.length > 1 ? 's' : ''} found` : 'No conflicts'}
            </span>
          </div>
        </div>

        {conflicts.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <span className="text-4xl mb-4 block">✅</span>
            <p className="font-medium">Your schedule is conflict-free!</p>
            <p className="text-sm mt-1">No overlapping appointments detected in your upcoming schedule.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {conflicts.map((conflict, i) => (
              <div key={i} className="border border-red-200 bg-red-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-red-500 font-bold text-sm">CONFLICT {i + 1}</span>
                  <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                    {conflict.overlap_minutes} min overlap
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-white rounded-lg p-3 border border-red-100">
                    <p className="font-medium text-gray-800">{conflict.appointment_a.title}</p>
                    <p className="text-sm text-gray-500">{formatDate(conflict.appointment_a.start_time)}</p>
                    <p className="text-sm text-gray-500">{conflict.appointment_a.location || 'No location'}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-red-100">
                    <p className="font-medium text-gray-800">{conflict.appointment_b.title}</p>
                    <p className="text-sm text-gray-500">{formatDate(conflict.appointment_b.start_time)}</p>
                    <p className="text-sm text-gray-500">{conflict.appointment_b.location || 'No location'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI Resolution Results */}
      {resolution && (
        <div className="bg-gradient-to-br from-rose-50 to-red-50 rounded-xl p-6 border border-rose-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <span className="text-2xl">✨</span> AI Resolution Strategy
              {resolution.ai_powered && (
                <span className="text-xs bg-rose-100 text-rose-700 px-2 py-1 rounded-full">AI Powered</span>
              )}
            </h3>
          </div>

          {resolution.resolutions?.impact_summary && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <p className="text-sm text-gray-500">Conflicts Resolved</p>
                <p className="text-3xl font-bold text-rose-600">{resolution.resolutions.impact_summary.conflicts_resolved}</p>
              </div>
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <p className="text-sm text-gray-500">Appointments Affected</p>
                <p className="text-2xl font-bold text-gray-800">{resolution.resolutions.impact_summary.appointments_affected}</p>
              </div>
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <p className="text-sm text-gray-500">Time Saved</p>
                <p className="text-2xl font-bold text-green-600">{resolution.resolutions.impact_summary.time_saved} min</p>
              </div>
            </div>
          )}

          {resolution.resolutions?.overall_strategy && (
            <div className="bg-white rounded-lg p-4 mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Overall Strategy</p>
              <p className="text-gray-600">{resolution.resolutions.overall_strategy}</p>
            </div>
          )}

          {resolution.resolutions?.resolutions && resolution.resolutions.resolutions.length > 0 && (
            <div className="space-y-3 mb-4">
              <p className="text-sm font-medium text-gray-700">Resolution Details:</p>
              {resolution.resolutions.resolutions.map((res, i) => (
                <div key={i} className="bg-white rounded-lg p-4 border border-gray-100">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-gray-800">Resolution {i + 1}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getStrategyColor(res.strategy)}`}>
                      {res.strategy}
                    </span>
                    <span className="text-xs text-gray-500 ml-auto">
                      Confidence: {Math.round((res.confidence || 0) * 100)}%
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{res.reasoning}</p>
                  {res.new_times && res.new_times.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {res.new_times.map((time, j) => (
                        <span key={j} className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded-lg border border-purple-100">
                          {typeof time === 'string' ? time : `${time.date} at ${time.time}`}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {resolution.resolutions?.preventive_measures && resolution.resolutions.preventive_measures.length > 0 && (
            <div className="bg-white rounded-lg p-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Preventive Measures</p>
              <ul className="space-y-2">
                {resolution.resolutions.preventive_measures.map((measure, i) => (
                  <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                    <span className="text-rose-500 mt-0.5">💡</span> {measure}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* All Upcoming Appointments */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-800">Upcoming Appointments</h2>
          <span className="text-sm text-gray-500">{appointments.length} appointments</span>
        </div>

        {appointments.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <span className="text-4xl mb-4 block">📅</span>
            <p>No upcoming appointments to check for conflicts.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Appointment</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Start</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">End</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {appointments.map((apt) => {
                  const hasConflict = conflicts.some(
                    c => c.appointment_a.id === apt.id || c.appointment_b.id === apt.id
                  );
                  return (
                    <tr key={apt.id} className={hasConflict ? 'bg-red-50' : 'hover:bg-gray-50'}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {hasConflict && <span className="text-red-500">⚠️</span>}
                          <span className="font-medium text-gray-900">{apt.title}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{formatDate(apt.start_time)}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{formatDate(apt.end_time)}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{apt.location || '-'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs ${hasConflict ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                          {hasConflict ? 'Conflict' : 'Clear'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
