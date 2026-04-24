import React, { useState, useEffect, useCallback } from 'react';
import { advancedAiApi, appointmentsApi } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import SearchBar from '../components/SearchBar';
import SortableHeader from '../components/SortableHeader';
import Pagination from '../components/Pagination';
import ExportButtons from '../components/ExportButtons';
import { SkeletonTable } from '../components/Skeleton';
import { exportToCSV } from '../utils/export';

export default function RescheduleSuggester() {
  const { showSuccess, showError } = useToast();
  const confirm = useConfirm();

  const [suggestions, setSuggestions] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [suggesting, setSuggesting] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState('');
  const [reason, setReason] = useState('');
  const [currentSuggestion, setCurrentSuggestion] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState(null);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('created_at');
  const [order, setOrder] = useState('desc');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [suggestionsData, appointmentsData] = await Promise.all([
        advancedAiApi.getRescheduleSuggestions({ page, limit, search, sort, order }),
        appointmentsApi.getAll()
      ]);
      if (suggestionsData.data) {
        setSuggestions(suggestionsData.data);
        setTotal(suggestionsData.total || 0);
        setTotalPages(suggestionsData.totalPages || 1);
      } else {
        const list = Array.isArray(suggestionsData) ? suggestionsData : [];
        setSuggestions(list);
        setTotal(list.length);
        setTotalPages(1);
      }
      setAppointments(Array.isArray(appointmentsData) ? appointmentsData : (appointmentsData.data || []));
    } catch (err) {
      console.error('Failed to load data:', err);
      showError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, sort, order]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSearchChange = (v) => { setSearch(v); setPage(1); };
  const handleSort = (f, o) => { setSort(f); setOrder(o); setPage(1); };

  const handleSuggest = async () => {
    if (!selectedAppointment) return;
    setSuggesting(true);
    try {
      const result = await advancedAiApi.suggestReschedule(parseInt(selectedAppointment), reason);
      setCurrentSuggestion(result);
      showSuccess('Reschedule suggestions generated');
      loadData();
    } catch (err) {
      console.error('Suggestion failed:', err);
      showError('Failed to generate suggestions');
    } finally {
      setSuggesting(false);
    }
  };

  const handleAccept = async (id, suggestionIndex) => {
    try {
      await advancedAiApi.acceptRescheduleSuggestion(id, suggestionIndex);
      showSuccess('Suggestion accepted');
      loadData();
    } catch (err) {
      showError('Failed to accept suggestion');
    }
  };

  const handleDelete = async (id) => {
    const ok = await confirm({ title: 'Delete Suggestion', message: 'Delete this suggestion?', confirmText: 'Delete', danger: true });
    if (!ok) return;
    try {
      await advancedAiApi.deleteRescheduleSuggestion(id);
      setShowDetailModal(false);
      showSuccess('Suggestion deleted');
      loadData();
    } catch (err) {
      showError('Failed to delete suggestion');
    }
  };

  const handleRowClick = (suggestion) => {
    setSelectedDetail(suggestion);
    setShowDetailModal(true);
  };

  const handleExportCSV = () => {
    exportToCSV(suggestions, [
      { label: 'Appointment', key: 'appointment_title' },
      { label: 'Reason', key: 'reason_for_reschedule' },
      { label: 'Status', accessor: (r) => r.accepted_suggestion !== null ? 'Accepted' : 'Pending' },
      { label: 'Date', accessor: (r) => formatDate(r.created_at) }
    ], 'reschedule-suggestions');
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
    });
  };

  const formatShortDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric'
    });
  };

  if (loading && suggestions.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-purple-500 to-pink-600 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
              <span className="text-3xl">📅</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold">AI Reschedule Suggester</h1>
              <p className="opacity-90">Get AI-powered suggestions for rescheduling appointments</p>
            </div>
          </div>
        </div>
        <SkeletonTable rows={5} cols={6} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-500 to-pink-600 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
            <span className="text-3xl">📅</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold">AI Reschedule Suggester</h1>
            <p className="opacity-90">Get AI-powered suggestions for rescheduling appointments</p>
          </div>
        </div>
      </div>

      {/* Suggest Section */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Get Reschedule Suggestions</h2>
        <div className="space-y-4">
          <div className="flex gap-4 flex-wrap">
            <select
              value={selectedAppointment}
              onChange={(e) => setSelectedAppointment(e.target.value)}
              className="flex-1 min-w-[300px] px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">Select an appointment to reschedule...</option>
              {appointments.map((apt) => (
                <option key={apt.id} value={apt.id}>
                  {apt.title} - {formatDate(apt.start_time)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-4 flex-wrap">
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for rescheduling (optional)"
              className="flex-1 min-w-[300px] px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <button
              onClick={handleSuggest}
              disabled={!selectedAppointment || suggesting}
              className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg font-medium hover:from-purple-600 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {suggesting ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Finding Times...
                </>
              ) : (
                <>
                  <span>🤖</span> Get AI Suggestions
                </>
              )}
            </button>
          </div>
        </div>
        {/* Load Sample Data */}
        {appointments.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-500 mb-2">Quick Test:</p>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => {
                  setSelectedAppointment(String(appointments[0]?.id));
                  setReason('Schedule conflict with another meeting');
                }}
                className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 text-sm border border-purple-200"
              >
                Conflict Reason
              </button>
              <button
                onClick={() => {
                  setSelectedAppointment(String(appointments[0]?.id));
                  setReason('Need more preparation time');
                }}
                className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 text-sm border border-purple-200"
              >
                Prep Time Reason
              </button>
              <button
                onClick={() => {
                  setSelectedAppointment(String(appointments[0]?.id));
                  setReason('Client requested a different time');
                }}
                className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 text-sm border border-purple-200"
              >
                Client Request Reason
              </button>
              <button
                onClick={async () => {
                  if (appointments.length > 0) {
                    const aptId = appointments[0].id;
                    const sampleReason = 'Emergency reschedule needed';
                    setSelectedAppointment(String(aptId));
                    setReason(sampleReason);
                    setSuggesting(true);
                    try {
                      const result = await advancedAiApi.suggestReschedule(aptId, sampleReason);
                      setCurrentSuggestion(result);
                      showSuccess('Reschedule suggestions generated');
                      loadData();
                    } catch (err) {
                      showError('Failed to generate suggestions');
                    } finally {
                      setSuggesting(false);
                    }
                  }
                }}
                className="px-3 py-1.5 bg-pink-50 text-pink-700 rounded-lg hover:bg-pink-100 text-sm border border-pink-200 font-medium"
              >
                Auto-Load & Suggest
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Current Suggestion Result */}
      {currentSuggestion && (
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <span className="text-2xl">✨</span> AI Suggested Times
              {currentSuggestion.ai_powered && (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">AI Powered</span>
              )}
            </h3>
          </div>

          {currentSuggestion.details?.suggested_times && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {currentSuggestion.details.suggested_times.slice(0, 6).map((slot, i) => (
                <div
                  key={i}
                  className="bg-white rounded-lg p-4 shadow-sm border-2 border-transparent hover:border-purple-300 cursor-pointer transition-all"
                  onClick={() => handleAccept(currentSuggestion.suggestion.id, i)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-500">Option {i + 1}</span>
                    <div className="flex items-center gap-1">
                      <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-purple-400 to-pink-500"
                          style={{ width: `${(slot.score || 0.8) * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-500">{Math.round((slot.score || 0.8) * 100)}%</span>
                    </div>
                  </div>
                  <p className="text-lg font-bold text-gray-800">{formatShortDate(slot.date)}</p>
                  <p className="text-2xl font-bold text-purple-600">{slot.time} - {slot.end_time}</p>
                  <p className="text-sm text-gray-500 mt-2">{slot.reasoning}</p>
                  <button className="mt-3 w-full py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 text-sm font-medium">
                    Select This Time
                  </button>
                </div>
              ))}
            </div>
          )}

          {currentSuggestion.details?.impact_analysis && (
            <div className="bg-white rounded-lg p-4 mb-4">
              <p className="text-sm font-medium text-gray-700 mb-3">Impact Analysis:</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Affected Appointments</p>
                  <p className="text-xl font-bold text-gray-800">{currentSuggestion.details.impact_analysis.affected_appointments}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Productivity Impact</p>
                  <p className="text-sm font-medium text-gray-800">{currentSuggestion.details.impact_analysis.productivity_impact}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Recommendations</p>
                  <p className="text-xs text-gray-600">
                    {currentSuggestion.details.impact_analysis.recommendations?.join(', ')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {currentSuggestion.details?.alternative_approaches && currentSuggestion.details.alternative_approaches.length > 0 && (
            <div className="bg-white rounded-lg p-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Alternative Approaches:</p>
              <div className="flex flex-wrap gap-2">
                {currentSuggestion.details.alternative_approaches.map((approach, i) => (
                  <span key={i} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                    💡 {approach}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Suggestions History */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-800">Suggestion History</h2>
          <div className="flex items-center gap-3">
            <ExportButtons onExportCSV={handleExportCSV} />
            <span className="text-sm text-gray-500">{total} suggestions</span>
          </div>
        </div>

        <div className="px-6 py-3">
          <SearchBar value={search} onChange={handleSearchChange} placeholder="Search suggestions..." />
        </div>

        {suggestions.length === 0 && !loading ? (
          <div className="p-8 text-center text-gray-500">
            <span className="text-4xl mb-4 block">📅</span>
            <p>{search ? 'No suggestions match your search.' : 'No reschedule suggestions yet. Select an appointment above to get suggestions!'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <SortableHeader label="Original Appointment" field="appointment_title" currentSort={sort} currentOrder={order} onSort={handleSort} />
                  <SortableHeader label="Reason" field="reason_for_reschedule" currentSort={sort} currentOrder={order} onSort={handleSort} />
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Options</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <SortableHeader label="Date" field="created_at" currentSort={sort} currentOrder={order} onSort={handleSort} />
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {suggestions.map((suggestion) => {
                  const suggestedTimes = suggestion.suggested_times ?
                    (typeof suggestion.suggested_times === 'string' ?
                      JSON.parse(suggestion.suggested_times) : suggestion.suggested_times) : [];

                  return (
                    <tr
                      key={suggestion.id}
                      onClick={() => handleRowClick(suggestion)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{suggestion.appointment_title || 'Unknown'}</div>
                        <div className="text-sm text-gray-500">
                          {suggestion.original_time ? formatDate(suggestion.original_time) : 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {suggestion.reason_for_reschedule || '-'}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-lg font-semibold text-purple-600">{suggestedTimes.length} times</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs ${suggestion.accepted_suggestion !== null ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {suggestion.accepted_suggestion !== null ? 'Accepted' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {formatDate(suggestion.created_at)}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(suggestion.id); }}
                          className="px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} limit={limit} onPageChange={(p) => setPage(p)} onLimitChange={(l) => { setLimit(l); setPage(1); }} />

      {/* Detail Modal */}
      {showDetailModal && selectedDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-t-xl">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold">{selectedDetail.appointment_title}</h2>
                  <p className="opacity-90">Reschedule Suggestions</p>
                </div>
                <button onClick={() => setShowDetailModal(false)} className="text-white/80 hover:text-white text-2xl">
                  &times;
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {selectedDetail.reason_for_reschedule && (
                <div className="bg-purple-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Reason for Rescheduling</p>
                  <p className="font-medium text-gray-800">{selectedDetail.reason_for_reschedule}</p>
                </div>
              )}

              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-700 mb-3">Suggested Times</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(typeof selectedDetail.suggested_times === 'string' ?
                    JSON.parse(selectedDetail.suggested_times) : selectedDetail.suggested_times || []).map((slot, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-lg border-2 ${selectedDetail.accepted_suggestion === i ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white'}`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-gray-800">{slot.date} at {slot.time}</span>
                        {selectedDetail.accepted_suggestion === i && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Accepted</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{slot.reasoning}</p>
                    </div>
                  ))}
                </div>
              </div>

              {selectedDetail.ai_reasoning && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">AI Reasoning</p>
                  <p className="text-gray-600">{selectedDetail.ai_reasoning}</p>
                </div>
              )}

              {selectedDetail.impact_analysis && (() => {
                const impact = typeof selectedDetail.impact_analysis === 'string'
                  ? JSON.parse(selectedDetail.impact_analysis)
                  : selectedDetail.impact_analysis;
                return impact ? (
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-700 mb-3">Impact Analysis</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="p-3 bg-white rounded-lg">
                        <p className="text-sm text-gray-500">Affected Appointments</p>
                        <p className="text-xl font-bold text-gray-800">{impact.affected_appointments || 0}</p>
                      </div>
                      <div className="p-3 bg-white rounded-lg">
                        <p className="text-sm text-gray-500">Productivity Impact</p>
                        <p className="text-sm font-medium text-gray-800">{impact.productivity_impact || 'N/A'}</p>
                      </div>
                      {impact.recommendations && impact.recommendations.length > 0 && (
                        <div className="p-3 bg-white rounded-lg">
                          <p className="text-sm text-gray-500">Recommendations</p>
                          <ul className="mt-1 space-y-1">
                            {impact.recommendations.map((rec, i) => (
                              <li key={i} className="text-xs text-gray-600 flex items-start gap-1">
                                <span className="text-blue-500">-</span> {rec}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null;
              })()}

              {selectedDetail.alternative_approaches && (() => {
                const approaches = typeof selectedDetail.alternative_approaches === 'string'
                  ? JSON.parse(selectedDetail.alternative_approaches)
                  : selectedDetail.alternative_approaches;
                return approaches && approaches.length > 0 ? (
                  <div className="bg-purple-50 rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">Alternative Approaches</p>
                    <ul className="space-y-2">
                      {approaches.map((approach, i) => (
                        <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                          <span className="text-purple-500 mt-0.5">💡</span> {approach}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null;
              })()}
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button
                onClick={() => handleDelete(selectedDetail.id)}
                className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
              >
                Delete
              </button>
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
