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

export default function BufferOptimizer() {
  const { showSuccess, showError } = useToast();
  const confirm = useConfirm();

  const [analyses, setAnalyses] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState('');
  const [currentAnalysis, setCurrentAnalysis] = useState(null);
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
      const [analysesData, appointmentsData] = await Promise.all([
        advancedAiApi.getBufferAnalyses({ page, limit, search, sort, order }),
        appointmentsApi.getUpcoming()
      ]);
      if (analysesData.data) {
        setAnalyses(analysesData.data);
        setTotal(analysesData.total || 0);
        setTotalPages(analysesData.totalPages || 1);
      } else {
        const list = Array.isArray(analysesData) ? analysesData : [];
        setAnalyses(list);
        setTotal(list.length);
        setTotalPages(1);
      }
      setAppointments(appointmentsData);
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

  const handleAnalyze = async () => {
    if (!selectedAppointment) return;
    setAnalyzing(true);
    try {
      const result = await advancedAiApi.analyzeBuffer(parseInt(selectedAppointment));
      setCurrentAnalysis(result);
      showSuccess('Buffer time analyzed');
      loadData();
    } catch (err) {
      console.error('Analysis failed:', err);
      showError('Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleApply = async (id) => {
    try {
      await advancedAiApi.applyBufferSuggestion(id);
      showSuccess('Buffer suggestion applied');
      loadData();
    } catch (err) {
      showError('Failed to apply suggestion');
    }
  };

  const handleDelete = async (id) => {
    const ok = await confirm({ title: 'Delete Analysis', message: 'Delete this analysis?', confirmText: 'Delete', danger: true });
    if (!ok) return;
    try {
      await advancedAiApi.deleteBufferAnalysis(id);
      setShowDetailModal(false);
      showSuccess('Analysis deleted');
      loadData();
    } catch (err) {
      showError('Failed to delete analysis');
    }
  };

  const handleRowClick = (analysis) => {
    setSelectedDetail(analysis);
    setShowDetailModal(true);
  };

  const handleExportCSV = () => {
    exportToCSV(analyses, [
      { label: 'Appointment', key: 'appointment_title' },
      { label: 'Suggested Buffer (min)', key: 'suggested_buffer_minutes' },
      { label: 'Confidence', accessor: (r) => Math.round(r.confidence_score * 100) + '%' },
      { label: 'Status', accessor: (r) => r.applied ? 'Applied' : 'Pending' },
      { label: 'Date', accessor: (r) => formatDate(r.created_at) }
    ], 'buffer-analyses');
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
    });
  };

  const getConfidenceColor = (score) => {
    if (score >= 0.8) return 'text-green-600 bg-green-100';
    if (score >= 0.6) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  if (loading && analyses.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
              <span className="text-3xl">🕐</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold">AI Buffer Time Optimizer</h1>
              <p className="opacity-90">Analyze and optimize the time between your appointments</p>
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
      <div className="bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
            <span className="text-3xl">🕐</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold">AI Buffer Time Optimizer</h1>
            <p className="opacity-90">Analyze and optimize the time between your appointments</p>
          </div>
        </div>
      </div>

      {/* Analyze Section */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Analyze Appointment Buffer Time</h2>
        <div className="flex gap-4 flex-wrap">
          <select
            value={selectedAppointment}
            onChange={(e) => setSelectedAppointment(e.target.value)}
            className="flex-1 min-w-[300px] px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          >
            <option value="">Select an appointment to analyze...</option>
            {appointments.map((apt) => (
              <option key={apt.id} value={apt.id}>
                {apt.title} - {formatDate(apt.start_time)}
              </option>
            ))}
          </select>
          <button
            onClick={handleAnalyze}
            disabled={!selectedAppointment || analyzing}
            className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg font-medium hover:from-cyan-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            {analyzing ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Analyzing...
              </>
            ) : (
              <>
                <span>🤖</span> Analyze with AI
              </>
            )}
          </button>
        </div>
        {/* Load Sample Data */}
        {appointments.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-500 mb-2">Quick Test:</p>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => { setSelectedAppointment(String(appointments[0]?.id)); }}
                className="px-3 py-1.5 bg-cyan-50 text-cyan-700 rounded-lg hover:bg-cyan-100 text-sm border border-cyan-200"
              >
                Load 1st Appointment
              </button>
              {appointments.length > 1 && (
                <button
                  onClick={() => { setSelectedAppointment(String(appointments[1]?.id)); }}
                  className="px-3 py-1.5 bg-cyan-50 text-cyan-700 rounded-lg hover:bg-cyan-100 text-sm border border-cyan-200"
                >
                  Load 2nd Appointment
                </button>
              )}
              {appointments.length > 2 && (
                <button
                  onClick={() => { setSelectedAppointment(String(appointments[2]?.id)); }}
                  className="px-3 py-1.5 bg-cyan-50 text-cyan-700 rounded-lg hover:bg-cyan-100 text-sm border border-cyan-200"
                >
                  Load 3rd Appointment
                </button>
              )}
              <button
                onClick={async () => {
                  if (appointments.length > 0) {
                    const aptId = appointments[0].id;
                    setSelectedAppointment(String(aptId));
                    setAnalyzing(true);
                    try {
                      const result = await advancedAiApi.analyzeBuffer(aptId);
                      setCurrentAnalysis(result);
                      showSuccess('Buffer time analyzed');
                      loadData();
                    } catch (err) {
                      showError('Analysis failed');
                    } finally {
                      setAnalyzing(false);
                    }
                  }
                }}
                className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 text-sm border border-blue-200 font-medium"
              >
                Auto-Load & Analyze
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Current Analysis Result */}
      {currentAnalysis && (
        <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-xl p-6 border border-cyan-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <span className="text-2xl">✨</span> AI Analysis Result
              {currentAnalysis.ai_powered && (
                <span className="text-xs bg-cyan-100 text-cyan-700 px-2 py-1 rounded-full">AI Powered</span>
              )}
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <p className="text-sm text-gray-500">Suggested Buffer</p>
              <p className="text-3xl font-bold text-cyan-600">{currentAnalysis.details?.suggested_buffer_minutes || 0} min</p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <p className="text-sm text-gray-500">Travel Time</p>
              <p className="text-2xl font-bold text-blue-600">{currentAnalysis.details?.travel_time_estimate || 0} min</p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <p className="text-sm text-gray-500">Prep Time</p>
              <p className="text-2xl font-bold text-purple-600">{currentAnalysis.details?.preparation_time || 0} min</p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <p className="text-sm text-gray-500">Confidence</p>
              <p className="text-2xl font-bold text-green-600">{Math.round((currentAnalysis.details?.confidence_score || 0) * 100)}%</p>
            </div>
          </div>

          {currentAnalysis.details?.reasoning && (
            <div className="bg-white rounded-lg p-4 mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">AI Reasoning:</p>
              <p className="text-gray-600">{currentAnalysis.details.reasoning}</p>
            </div>
          )}

          {currentAnalysis.details?.optimization_tips && (
            <div className="bg-white rounded-lg p-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Optimization Tips:</p>
              <ul className="space-y-1">
                {currentAnalysis.details.optimization_tips.map((tip, i) => (
                  <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                    <span className="text-cyan-500">💡</span> {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Analysis History */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-800">Analysis History</h2>
          <div className="flex items-center gap-3">
            <ExportButtons onExportCSV={handleExportCSV} />
            <span className="text-sm text-gray-500">{total} analyses</span>
          </div>
        </div>

        <div className="px-6 py-3">
          <SearchBar value={search} onChange={handleSearchChange} placeholder="Search analyses..." />
        </div>

        {analyses.length === 0 && !loading ? (
          <div className="p-8 text-center text-gray-500">
            <span className="text-4xl mb-4 block">🕐</span>
            <p>{search ? 'No analyses match your search.' : 'No buffer time analyses yet. Select an appointment above to analyze!'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <SortableHeader label="Appointment" field="appointment_title" currentSort={sort} currentOrder={order} onSort={handleSort} />
                  <SortableHeader label="Suggested Buffer" field="suggested_buffer_minutes" currentSort={sort} currentOrder={order} onSort={handleSort} />
                  <SortableHeader label="Confidence" field="confidence_score" currentSort={sort} currentOrder={order} onSort={handleSort} />
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <SortableHeader label="Date" field="created_at" currentSort={sort} currentOrder={order} onSort={handleSort} />
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {analyses.map((analysis) => (
                  <tr
                    key={analysis.id}
                    onClick={() => handleRowClick(analysis)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{analysis.appointment_title || 'Unknown'}</div>
                      <div className="text-sm text-gray-500">{analysis.location || 'No location'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-lg font-semibold text-cyan-600">{analysis.suggested_buffer_minutes} min</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-sm font-medium ${getConfidenceColor(analysis.confidence_score)}`}>
                        {Math.round(analysis.confidence_score * 100)}%
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs ${analysis.applied ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {analysis.applied ? 'Applied' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatDate(analysis.created_at)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        {!analysis.applied && (
                          <button
                            onClick={() => handleApply(analysis.id)}
                            className="px-3 py-1 bg-cyan-100 text-cyan-700 rounded-lg hover:bg-cyan-200 text-sm"
                          >
                            Apply
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(analysis.id)}
                          className="px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} limit={limit} onPageChange={(p) => setPage(p)} onLimitChange={(l) => { setLimit(l); setPage(1); }} />

      {/* Detail Modal */}
      {showDetailModal && selectedDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-t-xl">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold">{selectedDetail.appointment_title}</h2>
                  <p className="opacity-90">Buffer Time Analysis Details</p>
                </div>
                <button onClick={() => setShowDetailModal(false)} className="text-white/80 hover:text-white text-2xl">
                  &times;
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-cyan-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Suggested Buffer</p>
                  <p className="text-2xl font-bold text-cyan-600">{selectedDetail.suggested_buffer_minutes} minutes</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Confidence Score</p>
                  <p className="text-2xl font-bold text-blue-600">{Math.round(selectedDetail.confidence_score * 100)}%</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Travel Time Estimate</p>
                  <p className="text-2xl font-bold text-purple-600">{selectedDetail.travel_time_estimate || 0} min</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Preparation Time</p>
                  <p className="text-2xl font-bold text-green-600">{selectedDetail.preparation_time || 0} min</p>
                </div>
              </div>

              {selectedDetail.ai_reasoning && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">AI Reasoning</p>
                  <p className="text-gray-600">{selectedDetail.ai_reasoning}</p>
                </div>
              )}

              {selectedDetail.optimization_tips && (() => {
                const tips = typeof selectedDetail.optimization_tips === 'string'
                  ? JSON.parse(selectedDetail.optimization_tips)
                  : selectedDetail.optimization_tips;
                return tips.length > 0 ? (
                  <div className="bg-cyan-50 rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">Optimization Tips</p>
                    <ul className="space-y-2">
                      {tips.map((tip, i) => (
                        <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                          <span className="text-cyan-500 mt-0.5">💡</span> {tip}
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
              {!selectedDetail.applied && (
                <button
                  onClick={() => { handleApply(selectedDetail.id); setShowDetailModal(false); }}
                  className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700"
                >
                  Apply Suggestion
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
