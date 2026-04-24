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

export default function NoShowPredictor() {
  const { showSuccess, showError } = useToast();
  const confirm = useConfirm();

  const [predictions, setPredictions] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [predicting, setPredicting] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState('');
  const [currentPrediction, setCurrentPrediction] = useState(null);
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
      const [predictionsData, appointmentsData] = await Promise.all([
        advancedAiApi.getNoShowPredictions({ page, limit, search, sort, order }),
        appointmentsApi.getUpcoming()
      ]);
      if (predictionsData.data) {
        setPredictions(predictionsData.data);
        setTotal(predictionsData.total || 0);
        setTotalPages(predictionsData.totalPages || 1);
      } else {
        const list = Array.isArray(predictionsData) ? predictionsData : [];
        setPredictions(list);
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

  const handlePredict = async () => {
    if (!selectedAppointment) return;
    setPredicting(true);
    try {
      const result = await advancedAiApi.predictNoShow(parseInt(selectedAppointment));
      setCurrentPrediction(result);
      showSuccess('No-show risk predicted');
      loadData();
    } catch (err) {
      console.error('Prediction failed:', err);
      showError('Prediction failed');
    } finally {
      setPredicting(false);
    }
  };

  const handleUpdateOutcome = async (id, outcome) => {
    try {
      await advancedAiApi.updateNoShowOutcome(id, outcome);
      showSuccess('Outcome updated');
      loadData();
    } catch (err) {
      showError('Failed to update outcome');
    }
  };

  const handleDelete = async (id) => {
    const ok = await confirm({ title: 'Delete Prediction', message: 'Delete this prediction?', confirmText: 'Delete', danger: true });
    if (!ok) return;
    try {
      await advancedAiApi.deleteNoShowPrediction(id);
      setShowDetailModal(false);
      showSuccess('Prediction deleted');
      loadData();
    } catch (err) {
      showError('Failed to delete prediction');
    }
  };

  const handleRowClick = (prediction) => {
    setSelectedDetail(prediction);
    setShowDetailModal(true);
  };

  const handleExportCSV = () => {
    exportToCSV(predictions, [
      { label: 'Appointment', key: 'appointment_title' },
      { label: 'Contact', key: 'contact_name' },
      { label: 'Risk Score', accessor: (r) => Math.round(r.prediction_score * 100) + '%' },
      { label: 'Risk Level', key: 'risk_level' },
      { label: 'Outcome', accessor: (r) => r.actual_outcome || 'Pending' }
    ], 'no-show-predictions');
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
    });
  };

  const getRiskColor = (level) => {
    switch (level) {
      case 'high': return 'bg-red-100 text-red-700';
      case 'medium': return 'bg-yellow-100 text-yellow-700';
      case 'low': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const getRiskGradient = (score) => {
    const percent = Math.round(score * 100);
    if (percent >= 70) return 'from-red-500 to-red-600';
    if (percent >= 40) return 'from-yellow-500 to-orange-500';
    return 'from-green-500 to-emerald-500';
  };

  if (loading && predictions.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-orange-500 to-red-600 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
              <span className="text-3xl">📊</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold">AI No-Show Predictor</h1>
              <p className="opacity-90">Predict appointment no-shows and take preventive action</p>
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
      <div className="bg-gradient-to-r from-orange-500 to-red-600 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
            <span className="text-3xl">📊</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold">AI No-Show Predictor</h1>
            <p className="opacity-90">Predict appointment no-shows and take preventive action</p>
          </div>
        </div>
      </div>

      {/* Predict Section */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Analyze No-Show Risk</h2>
        <div className="flex gap-4 flex-wrap">
          <select
            value={selectedAppointment}
            onChange={(e) => setSelectedAppointment(e.target.value)}
            className="flex-1 min-w-[300px] px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          >
            <option value="">Select an appointment to predict...</option>
            {appointments.map((apt) => (
              <option key={apt.id} value={apt.id}>
                {apt.title} - {formatDate(apt.start_time)} {apt.contact_name ? `(${apt.contact_name})` : ''}
              </option>
            ))}
          </select>
          <button
            onClick={handlePredict}
            disabled={!selectedAppointment || predicting}
            className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-lg font-medium hover:from-orange-600 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            {predicting ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Predicting...
              </>
            ) : (
              <>
                <span>🤖</span> Predict with AI
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
                className="px-3 py-1.5 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 text-sm border border-orange-200"
              >
                Load 1st Appointment
              </button>
              {appointments.length > 1 && (
                <button
                  onClick={() => { setSelectedAppointment(String(appointments[1]?.id)); }}
                  className="px-3 py-1.5 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 text-sm border border-orange-200"
                >
                  Load 2nd Appointment
                </button>
              )}
              {appointments.length > 2 && (
                <button
                  onClick={() => { setSelectedAppointment(String(appointments[2]?.id)); }}
                  className="px-3 py-1.5 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 text-sm border border-orange-200"
                >
                  Load 3rd Appointment
                </button>
              )}
              <button
                onClick={async () => {
                  if (appointments.length > 0) {
                    const aptId = appointments[0].id;
                    setSelectedAppointment(String(aptId));
                    setPredicting(true);
                    try {
                      const result = await advancedAiApi.predictNoShow(aptId);
                      setCurrentPrediction(result);
                      showSuccess('No-show risk predicted');
                      loadData();
                    } catch (err) {
                      showError('Prediction failed');
                    } finally {
                      setPredicting(false);
                    }
                  }
                }}
                className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 text-sm border border-red-200 font-medium"
              >
                Auto-Load & Predict
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Current Prediction Result */}
      {currentPrediction && (
        <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-6 border border-orange-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <span className="text-2xl">✨</span> AI Prediction Result
              {currentPrediction.ai_powered && (
                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">AI Powered</span>
              )}
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className={`bg-gradient-to-br ${getRiskGradient(currentPrediction.details?.prediction_score)} rounded-lg p-4 text-white`}>
              <p className="text-sm opacity-90">No-Show Risk</p>
              <p className="text-4xl font-bold">{Math.round((currentPrediction.details?.prediction_score || 0) * 100)}%</p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <p className="text-sm text-gray-500">Risk Level</p>
              <p className={`text-2xl font-bold capitalize ${currentPrediction.details?.risk_level === 'high' ? 'text-red-600' : currentPrediction.details?.risk_level === 'medium' ? 'text-yellow-600' : 'text-green-600'}`}>
                {currentPrediction.details?.risk_level || 'Unknown'}
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <p className="text-sm text-gray-500">Suggested Actions</p>
              <p className="text-2xl font-bold text-blue-600">{currentPrediction.details?.suggested_actions?.length || 0}</p>
            </div>
          </div>

          {currentPrediction.details?.contributing_factors && currentPrediction.details.contributing_factors.length > 0 && (
            <div className="bg-white rounded-lg p-4 mb-4">
              <p className="text-sm font-medium text-gray-700 mb-3">Contributing Factors:</p>
              <div className="space-y-2">
                {currentPrediction.details.contributing_factors.map((factor, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <div>
                      <span className="font-medium text-gray-800">{factor.factor}</span>
                      <p className="text-sm text-gray-500">{factor.description}</p>
                    </div>
                    <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-orange-400 to-red-500"
                        style={{ width: `${factor.weight * 100}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentPrediction.details?.suggested_actions && currentPrediction.details.suggested_actions.length > 0 && (
            <div className="bg-white rounded-lg p-4 mb-4">
              <p className="text-sm font-medium text-gray-700 mb-3">Suggested Actions:</p>
              <div className="space-y-2">
                {currentPrediction.details.suggested_actions.map((action, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-100">
                    <span className="text-green-500 text-lg">✓</span>
                    <div>
                      <p className="font-medium text-gray-800">{action.action}</p>
                      <p className="text-sm text-gray-500">{action.expected_impact}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentPrediction.details?.reasoning && (
            <div className="bg-white rounded-lg p-4">
              <p className="text-sm font-medium text-gray-700 mb-2">AI Reasoning:</p>
              <p className="text-gray-600">{currentPrediction.details.reasoning}</p>
            </div>
          )}
        </div>
      )}

      {/* Predictions History */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-800">Prediction History</h2>
          <div className="flex items-center gap-3">
            <ExportButtons onExportCSV={handleExportCSV} />
            <span className="text-sm text-gray-500">{total} predictions</span>
          </div>
        </div>

        <div className="px-6 py-3">
          <SearchBar value={search} onChange={handleSearchChange} placeholder="Search predictions..." />
        </div>

        {predictions.length === 0 && !loading ? (
          <div className="p-8 text-center text-gray-500">
            <span className="text-4xl mb-4 block">📊</span>
            <p>{search ? 'No predictions match your search.' : 'No predictions yet. Select an appointment above to predict no-show risk!'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <SortableHeader label="Appointment" field="appointment_title" currentSort={sort} currentOrder={order} onSort={handleSort} />
                  <SortableHeader label="Contact" field="contact_name" currentSort={sort} currentOrder={order} onSort={handleSort} />
                  <SortableHeader label="Risk Score" field="prediction_score" currentSort={sort} currentOrder={order} onSort={handleSort} />
                  <SortableHeader label="Risk Level" field="risk_level" currentSort={sort} currentOrder={order} onSort={handleSort} />
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Outcome</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {predictions.map((prediction) => (
                  <tr
                    key={prediction.id}
                    onClick={() => handleRowClick(prediction)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{prediction.appointment_title || 'Unknown'}</div>
                      <div className="text-sm text-gray-500">{prediction.start_time ? formatDate(prediction.start_time) : 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {prediction.contact_name || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${prediction.prediction_score >= 0.7 ? 'bg-red-500' : prediction.prediction_score >= 0.4 ? 'bg-yellow-500' : 'bg-green-500'}`}
                            style={{ width: `${prediction.prediction_score * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium">{Math.round(prediction.prediction_score * 100)}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRiskColor(prediction.risk_level)}`}>
                        {prediction.risk_level}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {prediction.actual_outcome ? (
                        <span className={`px-2 py-1 rounded-full text-xs ${prediction.actual_outcome === 'attended' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {prediction.actual_outcome}
                        </span>
                      ) : (
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleUpdateOutcome(prediction.id, 'attended')}
                            className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200"
                          >
                            Attended
                          </button>
                          <button
                            onClick={() => handleUpdateOutcome(prediction.id, 'no-show')}
                            className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200"
                          >
                            No-Show
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(prediction.id); }}
                        className="px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm"
                      >
                        Delete
                      </button>
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
            <div className="p-6 border-b bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-t-xl">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold">{selectedDetail.appointment_title}</h2>
                  <p className="opacity-90">No-Show Prediction Details</p>
                </div>
                <button onClick={() => setShowDetailModal(false)} className="text-white/80 hover:text-white text-2xl">
                  &times;
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className={`rounded-lg p-4 ${getRiskColor(selectedDetail.risk_level)}`}>
                  <p className="text-sm opacity-80">Risk Score</p>
                  <p className="text-3xl font-bold">{Math.round(selectedDetail.prediction_score * 100)}%</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Risk Level</p>
                  <p className="text-2xl font-bold text-gray-800 capitalize">{selectedDetail.risk_level}</p>
                </div>
              </div>

              {selectedDetail.ai_reasoning && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">AI Reasoning</p>
                  <p className="text-gray-600">{selectedDetail.ai_reasoning}</p>
                </div>
              )}

              {selectedDetail.contributing_factors && (() => {
                const factors = typeof selectedDetail.contributing_factors === 'string'
                  ? JSON.parse(selectedDetail.contributing_factors)
                  : selectedDetail.contributing_factors;
                return factors.length > 0 ? (
                  <div className="bg-orange-50 rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-700 mb-3">Contributing Factors</p>
                    <div className="space-y-2">
                      {factors.map((factor, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-white rounded-lg">
                          <div className="flex-1">
                            <span className="font-medium text-gray-800">{factor.factor}</span>
                            <p className="text-sm text-gray-500">{factor.description}</p>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-orange-400 to-red-500"
                                style={{ width: `${(factor.weight || 0) * 100}%` }}
                              ></div>
                            </div>
                            <span className="text-xs text-gray-500 w-8">{Math.round((factor.weight || 0) * 100)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}

              {selectedDetail.suggested_actions && (() => {
                const actions = typeof selectedDetail.suggested_actions === 'string'
                  ? JSON.parse(selectedDetail.suggested_actions)
                  : selectedDetail.suggested_actions;
                return actions.length > 0 ? (
                  <div className="bg-green-50 rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-700 mb-3">Suggested Actions</p>
                    <div className="space-y-2">
                      {actions.map((action, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-green-100">
                          <span className="text-green-500 text-lg mt-0.5">✓</span>
                          <div>
                            <p className="font-medium text-gray-800">{action.action}</p>
                            {action.expected_impact && (
                              <p className="text-sm text-gray-500">{action.expected_impact}</p>
                            )}
                            {action.priority && (
                              <span className="inline-block mt-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                Priority: {action.priority}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}

              {selectedDetail.recommended_reminders && (() => {
                const reminders = typeof selectedDetail.recommended_reminders === 'string'
                  ? JSON.parse(selectedDetail.recommended_reminders)
                  : selectedDetail.recommended_reminders;
                return reminders && reminders.length > 0 ? (
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-700 mb-3">Recommended Reminders</p>
                    <div className="space-y-2">
                      {reminders.map((reminder, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-blue-100">
                          <span className="text-blue-500 text-lg">🔔</span>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-800">{reminder.timing}</span>
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full capitalize">{reminder.method}</span>
                            </div>
                            {reminder.message_tone && (
                              <p className="text-sm text-gray-500">Tone: {reminder.message_tone}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
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
