import React, { useState, useEffect, useCallback } from 'react';
import { aiApi } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import SearchBar from '../components/SearchBar';
import SortableHeader from '../components/SortableHeader';
import Pagination from '../components/Pagination';
import ExportButtons from '../components/ExportButtons';
import { SkeletonTable } from '../components/Skeleton';
import { exportToCSV } from '../utils/export';

export default function NlpLogs() {
  const { showSuccess, showError } = useToast();
  const confirm = useConfirm();

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [testInput, setTestInput] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  const [aiStatus, setAiStatus] = useState(null);
  const [insights, setInsights] = useState(null);
  const [insightsPeriod, setInsightsPeriod] = useState('week');
  const [chatMode, setChatMode] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('created_at');
  const [order, setOrder] = useState('desc');

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await aiApi.getLogs({ page, limit, search, sort, order });
      if (data.data) {
        setLogs(data.data);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      } else {
        const list = Array.isArray(data) ? data : [];
        setLogs(list);
        setTotal(list.length);
        setTotalPages(1);
      }
    } catch (err) {
      console.error('Failed to load logs:', err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, sort, order]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  useEffect(() => {
    checkAIStatus();
  }, []);

  const checkAIStatus = async () => {
    try { const status = await aiApi.getStatus(); setAiStatus(status); } catch (err) { console.error('Failed to check AI status:', err); }
  };

  const loadInsights = async (period) => {
    setInsightsPeriod(period);
    try { const data = await aiApi.getInsights(period); setInsights(data); } catch (err) { console.error('Failed to load insights:', err); }
  };

  const handleSearchChange = (v) => { setSearch(v); setPage(1); };
  const handleSort = (f, o) => { setSort(f); setOrder(o); setPage(1); };

  const handleRowClick = async (log) => {
    try {
      const details = await aiApi.getLogById(log.id);
      setSelectedLog(details);
      setShowDetailModal(true);
    } catch (err) { console.error('Failed to load log details:', err); }
  };

  const handleDelete = async (log) => {
    const ok = await confirm({ title: 'Delete Log', message: 'Delete this log entry?', confirmText: 'Delete', danger: true });
    if (!ok) return;
    try {
      await aiApi.deleteLog(log.id);
      setShowDetailModal(false);
      showSuccess('Log deleted');
      loadLogs();
    } catch (err) { showError('Failed to delete log'); }
  };

  const handleTest = async () => {
    if (!testInput.trim()) return;
    setTesting(true);
    try {
      if (chatMode) {
        const result = await aiApi.chat(testInput);
        setChatHistory(prev => [
          ...prev,
          { role: 'user', content: testInput },
          { role: 'assistant', content: result.response || result.text, suggestions: result.suggestions }
        ]);
        setTestResult(null);
      } else {
        const result = await aiApi.parse(testInput);
        setTestResult(result);
      }
      loadLogs();
    } catch (err) {
      setTestResult({ error: err.message });
    } finally {
      setTesting(false);
      setTestInput('');
    }
  };

  const handleExportCSV = () => {
    exportToCSV(logs, [
      { label: 'Input', key: 'input_text' },
      { label: 'Action', accessor: (r) => r.parsed_result?.action || 'unknown' },
      { label: 'Status', accessor: (r) => r.success ? 'Success' : 'Failed' },
      { label: 'Date', accessor: (r) => formatDate(r.created_at) }
    ], 'nlp-logs');
  };

  const formatDate = (dateString) => new Date(dateString).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  if (loading && logs.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center"><h1 className="text-2xl font-bold text-gray-800">AI & NLP Center</h1></div>
        <SkeletonTable rows={5} cols={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">AI & NLP Center</h1>
        <div className="flex items-center gap-2">
          {aiStatus && (
            <span className={`px-3 py-1 text-sm rounded-full ${aiStatus.configured ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
              AI {aiStatus.configured ? 'Active' : 'Limited Mode'}
            </span>
          )}
          <ExportButtons onExportCSV={handleExportCSV} />
        </div>
      </div>

      {/* AI Status Card */}
      {aiStatus && (
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">🤖</span>
            <div>
              <h2 className="text-xl font-bold">AI Features</h2>
              <p className="text-sm opacity-80">
                {aiStatus.configured ? 'All features powered by OpenRouter AI' : 'Using fallback pattern matching. Add your OpenRouter API key for full AI.'}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
            {aiStatus.features?.map((feature, i) => (
              <div key={i} className="bg-white/20 rounded-lg px-3 py-2 text-sm">{feature}</div>
            ))}
          </div>
        </div>
      )}

      {/* AI Insights Section */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">📊</span>
            <h2 className="text-lg font-semibold text-gray-800">Schedule Insights</h2>
          </div>
          <div className="flex gap-2">
            {['day', 'week', 'month'].map(period => (
              <button key={period} onClick={() => loadInsights(period)} className={`px-3 py-1 text-sm rounded-lg ${insightsPeriod === period ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </button>
            ))}
          </div>
        </div>
        {insights ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 rounded-lg p-4"><p className="text-sm text-blue-600">Appointments</p><p className="text-2xl font-bold text-blue-700">{insights.appointment_count}</p></div>
              <div className="bg-purple-50 rounded-lg p-4"><p className="text-sm text-purple-600">Total Hours</p><p className="text-2xl font-bold text-purple-700">{insights.total_hours}h</p></div>
              <div className="bg-green-50 rounded-lg p-4"><p className="text-sm text-green-600">Balance Score</p><p className="text-2xl font-bold text-green-700">{insights.work_life_balance}/10</p></div>
              <div className="bg-orange-50 rounded-lg p-4"><p className="text-sm text-orange-600">Busiest Day</p><p className="text-lg font-bold text-orange-700">{insights.busiest_day || 'N/A'}</p></div>
            </div>
            {insights.summary && (<div className="bg-gray-50 rounded-lg p-4"><p className="text-sm font-medium text-gray-700 mb-1">AI Summary</p><p className="text-gray-600">{insights.summary}</p></div>)}
            {insights.recommendations && insights.recommendations.length > 0 && (
              <div><p className="text-sm font-medium text-gray-700 mb-2">Recommendations</p><ul className="space-y-2">{insights.recommendations.map((rec, i) => (<li key={i} className="flex items-start gap-2 text-sm text-gray-600"><span className="text-indigo-500">💡</span> {rec}</li>))}</ul></div>
            )}
          </div>
        ) : (
          <button onClick={() => loadInsights('week')} className="text-indigo-600 hover:underline">Load insights for this week</button>
        )}
      </div>

      {/* Test AI Section */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">{chatMode ? '💬' : '🧪'}</span>
            <h2 className="text-lg font-semibold text-gray-800">{chatMode ? 'AI Chat Assistant' : 'Test NLP Parser'}</h2>
          </div>
          <button onClick={() => { setChatMode(!chatMode); setChatHistory([]); setTestResult(null); }} className="px-3 py-1 text-sm bg-gray-100 rounded-lg hover:bg-gray-200">
            Switch to {chatMode ? 'Parser' : 'Chat'}
          </button>
        </div>
        {chatMode && chatHistory.length > 0 && (
          <div className="mb-4 space-y-2 max-h-64 overflow-y-auto">
            {chatHistory.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-lg ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                  <p className="text-sm">{msg.content}</p>
                  {msg.suggestions && (<div className="mt-2 space-y-1">{msg.suggestions.map((s, j) => (<p key={j} className="text-xs opacity-80">• {s}</p>))}</div>)}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input type="text" value={testInput} onChange={(e) => setTestInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleTest()}
            placeholder={chatMode ? 'Ask me anything about scheduling...' : 'Try: "Book me Tuesday afternoon" or "Cancel my 3pm meeting"'}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
          <button onClick={handleTest} disabled={testing || !testInput.trim()} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {testing ? 'Processing...' : chatMode ? 'Send' : 'Parse'}
          </button>
        </div>
        {testResult && !chatMode && (
          <div className={`mt-4 p-4 rounded-lg ${testResult.error ? 'bg-red-50 border border-red-200' : 'bg-indigo-50 border border-indigo-200'}`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-gray-800">Parsed Result:</h3>
              {testResult.ai_powered && (<span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">AI Powered</span>)}
            </div>
            <pre className="text-sm text-gray-700 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(testResult, null, 2)}</pre>
          </div>
        )}
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-800">Interaction History</h2>
          <span className="text-sm text-gray-500">{total} interactions</span>
        </div>

        <div className="px-6 py-3">
          <SearchBar value={search} onChange={handleSearchChange} placeholder="Search logs..." />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <SortableHeader label="Input Text" field="input_text" currentSort={sort} currentOrder={order} onSort={handleSort} />
                <SortableHeader label="Action" field="parsed_action" currentSort={sort} currentOrder={order} onSort={handleSort} />
                <SortableHeader label="Status" field="success" currentSort={sort} currentOrder={order} onSort={handleSort} />
                <SortableHeader label="Date" field="created_at" currentSort={sort} currentOrder={order} onSort={handleSort} />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {logs.map((log) => (
                <tr key={log.id} onClick={() => handleRowClick(log)} className="hover:bg-gray-50 cursor-pointer transition-colors">
                  <td className="px-4 py-4"><div className="text-sm text-gray-900 max-w-md truncate">{log.input_text}</div></td>
                  <td className="px-4 py-4 whitespace-nowrap"><span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">{log.parsed_result?.action || 'unknown'}</span></td>
                  <td className="px-4 py-4 whitespace-nowrap"><span className={`px-2 py-1 text-xs rounded-full ${log.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{log.success ? 'Success' : 'Failed'}</span></td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(log.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {logs.length === 0 && !loading && (
          <div className="text-center py-12 text-gray-500">No NLP logs found. Try the test parser above!</div>
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} limit={limit} onPageChange={(p) => setPage(p)} onLimitChange={(l) => { setLimit(l); setPage(1); }} />

      {/* Detail Modal */}
      {showDetailModal && selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white">
              <div className="flex justify-between items-start">
                <h2 className="text-xl font-bold text-gray-800">NLP Log Details</h2>
                <button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div><label className="text-sm font-medium text-gray-500">Input Text</label><p className="text-gray-800 mt-1 p-3 bg-gray-50 rounded-lg">{selectedLog.input_text}</p></div>
              <div><label className="text-sm font-medium text-gray-500">Status</label><div className="mt-1"><span className={`px-2 py-1 text-xs rounded-full ${selectedLog.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{selectedLog.success ? 'Success' : 'Failed'}</span></div></div>
              <div><label className="text-sm font-medium text-gray-500">Parsed Result</label><pre className="text-sm text-gray-800 mt-1 p-3 bg-gray-50 rounded-lg overflow-x-auto whitespace-pre-wrap">{JSON.stringify(selectedLog.parsed_result, null, 2)}</pre></div>
              <div><label className="text-sm font-medium text-gray-500">Date</label><p className="text-gray-800 mt-1">{formatDate(selectedLog.created_at)}</p></div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => handleDelete(selectedLog)} className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors">Delete</button>
              <button onClick={() => { setTestInput(selectedLog.input_text); setShowDetailModal(false); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">Re-test</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
