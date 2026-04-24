import React, { useState, useEffect, useCallback } from 'react';
import { voiceApi } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import SearchBar from '../components/SearchBar';
import SortableHeader from '../components/SortableHeader';
import Pagination from '../components/Pagination';
import ExportButtons from '../components/ExportButtons';
import { SkeletonTable } from '../components/Skeleton';
import { exportToCSV } from '../utils/export';

export default function VoiceCommands() {
  const { showSuccess, showError } = useToast();
  const confirm = useConfirm();

  const [commands, setCommands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCommand, setSelectedCommand] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [recognition, setRecognition] = useState(null);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('created_at');
  const [order, setOrder] = useState('desc');

  useEffect(() => { initializeSpeechRecognition(); }, []);

  const loadCommands = useCallback(async () => {
    setLoading(true);
    try {
      const data = await voiceApi.getAll({ page, limit, search, sort, order });
      if (data.data) {
        setCommands(data.data);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      } else {
        const list = Array.isArray(data) ? data : [];
        setCommands(list);
        setTotal(list.length);
        setTotalPages(1);
      }
    } catch (err) {
      console.error('Failed to load commands:', err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, sort, order]);

  useEffect(() => { loadCommands(); }, [loadCommands]);

  const handleSearchChange = (v) => { setSearch(v); setPage(1); };
  const handleSort = (f, o) => { setSort(f); setOrder(o); setPage(1); };

  const initializeSpeechRecognition = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognitionInstance = new SpeechRecognition();
      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = true;
      recognitionInstance.lang = 'en-US';
      recognitionInstance.onresult = (event) => {
        const current = event.resultIndex;
        const r = event.results[current];
        setTranscript(r[0].transcript);
        if (r.isFinal) processVoiceCommand(r[0].transcript);
      };
      recognitionInstance.onerror = (event) => { console.error('Speech recognition error:', event.error); setListening(false); };
      recognitionInstance.onend = () => { setListening(false); };
      setRecognition(recognitionInstance);
    }
  };

  const startListening = () => {
    if (recognition) { setListening(true); setTranscript(''); setResult(null); recognition.start(); }
    else { showError('Speech recognition is not supported in this browser.'); }
  };

  const stopListening = () => { if (recognition) { recognition.stop(); setListening(false); } };

  const processVoiceCommand = async (text) => {
    setProcessing(true);
    try {
      const response = await voiceApi.process(text);
      setResult(response);
      showSuccess('Voice command processed');
      loadCommands();
    } catch (err) {
      setResult({ error: err.message });
      showError('Failed to process voice command');
    } finally {
      setProcessing(false);
    }
  };

  const handleRowClick = async (command) => {
    try {
      const details = await voiceApi.getById(command.id);
      setSelectedCommand(details);
      setShowDetailModal(true);
    } catch (err) { console.error('Failed to load command details:', err); }
  };

  const handleDelete = async (command) => {
    const ok = await confirm({ title: 'Delete Command', message: 'Delete this voice command?', confirmText: 'Delete', danger: true });
    if (!ok) return;
    try {
      await voiceApi.delete(command.id);
      setShowDetailModal(false);
      showSuccess('Voice command deleted');
      loadCommands();
    } catch (err) { showError('Failed to delete command'); }
  };

  const handleExportCSV = () => {
    exportToCSV(commands, [
      { label: 'Transcript', key: 'transcript' },
      { label: 'Action', key: 'action_taken' },
      { label: 'Appointment', key: 'appointment_title' },
      { label: 'Date', accessor: (r) => formatDate(r.created_at) }
    ], 'voice-commands');
  };

  const formatDate = (dateString) => new Date(dateString).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  if (loading && commands.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center"><h1 className="text-2xl font-bold text-gray-800">Voice Commands</h1></div>
        <SkeletonTable rows={5} cols={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Voice Commands</h1>
        <div className="flex items-center gap-3">
          <ExportButtons onExportCSV={handleExportCSV} />
          <span className="text-sm text-gray-500">{total} commands</span>
        </div>
      </div>

      {/* Voice Input Section */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Voice Input</h2>
        <div className="flex flex-col items-center">
          <button
            onClick={listening ? stopListening : startListening}
            disabled={processing}
            className={`w-24 h-24 rounded-full flex items-center justify-center text-4xl transition-all ${listening ? 'bg-red-500 text-white voice-active' : 'bg-pink-100 text-pink-600 hover:bg-pink-200'} ${processing ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            🎤
          </button>
          <p className="mt-4 text-gray-600">{listening ? 'Listening... Speak now' : processing ? 'Processing...' : 'Click to start speaking'}</p>
          {transcript && (<div className="mt-4 w-full max-w-md"><label className="text-sm font-medium text-gray-500">Transcript:</label><p className="mt-1 p-3 bg-gray-50 rounded-lg text-gray-800">{transcript}</p></div>)}
          {result && (
            <div className={`mt-4 w-full max-w-md p-4 rounded-lg ${result.error ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
              {result.error ? (<p className="text-red-700">{result.error}</p>) : (
                <div>
                  <p className="text-green-700 font-medium">{result.actionTaken}</p>
                  {result.parsed && (<pre className="text-sm text-gray-600 mt-2 overflow-x-auto">{JSON.stringify(result.parsed, null, 2)}</pre>)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Commands History */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b"><h2 className="text-lg font-semibold text-gray-800">Command History</h2></div>
        <div className="px-6 py-3"><SearchBar value={search} onChange={handleSearchChange} placeholder="Search commands..." /></div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <SortableHeader label="Transcript" field="transcript" currentSort={sort} currentOrder={order} onSort={handleSort} />
                <SortableHeader label="Action Taken" field="action_taken" currentSort={sort} currentOrder={order} onSort={handleSort} />
                <SortableHeader label="Appointment" field="appointment_title" currentSort={sort} currentOrder={order} onSort={handleSort} />
                <SortableHeader label="Date" field="created_at" currentSort={sort} currentOrder={order} onSort={handleSort} />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {commands.map((command) => (
                <tr key={command.id} onClick={() => handleRowClick(command)} className="hover:bg-gray-50 cursor-pointer transition-colors">
                  <td className="px-4 py-4"><div className="text-sm text-gray-900 max-w-md truncate">{command.transcript}</div></td>
                  <td className="px-4 py-4 whitespace-nowrap"><span className="px-2 py-1 text-xs bg-pink-100 text-pink-800 rounded-full">{command.action_taken}</span></td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{command.appointment_title || '-'}</td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(command.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {commands.length === 0 && !loading && (<div className="text-center py-12 text-gray-500">No voice commands recorded. Try the voice input above!</div>)}
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} limit={limit} onPageChange={(p) => setPage(p)} onLimitChange={(l) => { setLimit(l); setPage(1); }} />

      {/* Detail Modal */}
      {showDetailModal && selectedCommand && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="p-6 border-b">
              <div className="flex justify-between items-start">
                <h2 className="text-xl font-bold text-gray-800">Voice Command Details</h2>
                <button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div><label className="text-sm font-medium text-gray-500">Transcript</label><p className="text-gray-800 mt-1 p-3 bg-gray-50 rounded-lg">{selectedCommand.transcript}</p></div>
              <div><label className="text-sm font-medium text-gray-500">Action Taken</label><p className="text-gray-800 mt-1">{selectedCommand.action_taken}</p></div>
              {selectedCommand.appointment_title && (<div><label className="text-sm font-medium text-gray-500">Related Appointment</label><p className="text-gray-800 mt-1">{selectedCommand.appointment_title}</p></div>)}
              <div><label className="text-sm font-medium text-gray-500">Date</label><p className="text-gray-800 mt-1">{formatDate(selectedCommand.created_at)}</p></div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => handleDelete(selectedCommand)} className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors">Delete</button>
              <button onClick={() => setShowDetailModal(false)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
