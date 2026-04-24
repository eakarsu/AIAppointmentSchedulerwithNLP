import React, { useState, useEffect, useCallback } from 'react';
import { remindersApi, appointmentsApi } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import useBulkSelection from '../hooks/useBulkSelection';
import SearchBar from '../components/SearchBar';
import SortableHeader from '../components/SortableHeader';
import Pagination from '../components/Pagination';
import ExportButtons from '../components/ExportButtons';
import BulkActionBar from '../components/BulkActionBar';
import { SkeletonTable } from '../components/Skeleton';
import { exportToCSV } from '../utils/export';

export default function Reminders() {
  const { showSuccess, showError } = useToast();
  const confirm = useConfirm();

  const [reminders, setReminders] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReminder, setSelectedReminder] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({ appointment_id: '', remind_at: '', type: 'email' });

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('remind_at');
  const [order, setOrder] = useState('desc');

  const { selectedIds, selectedSet, toggleSelect, toggleSelectAll, clearSelection } = useBulkSelection();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [remindersData, aptsData] = await Promise.all([
        remindersApi.getAll({ page, limit, search, sort, order }),
        appointmentsApi.getAll()
      ]);
      if (remindersData.data) {
        setReminders(remindersData.data);
        setTotal(remindersData.total || 0);
        setTotalPages(remindersData.totalPages || 1);
      } else {
        const list = Array.isArray(remindersData) ? remindersData : [];
        setReminders(list);
        setTotal(list.length);
        setTotalPages(1);
      }
      const aptsList = aptsData.data || aptsData;
      setAppointments(Array.isArray(aptsList) ? aptsList : []);
    } catch (err) {
      showError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, sort, order]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSearchChange = (v) => { setSearch(v); setPage(1); clearSelection(); };
  const handleSort = (f, o) => { setSort(f); setOrder(o); setPage(1); };

  const handleRowClick = async (reminder) => {
    try {
      const details = await remindersApi.getById(reminder.id);
      setSelectedReminder(details);
      setShowDetailModal(true);
    } catch (err) { console.error('Failed to load reminder details:', err); }
  };

  const handleCreate = () => { setEditMode(false); setFormData({ appointment_id: '', remind_at: '', type: 'email' }); setShowModal(true); };

  const handleEdit = (reminder) => {
    setEditMode(true);
    setSelectedReminder(reminder);
    setFormData({ appointment_id: reminder.appointment_id, remind_at: formatDateTimeLocal(reminder.remind_at), type: reminder.type });
    setShowDetailModal(false);
    setShowModal(true);
  };

  const handleDelete = async (reminder) => {
    const ok = await confirm({ title: 'Delete Reminder', message: 'Delete this reminder?', confirmText: 'Delete', danger: true });
    if (!ok) return;
    try {
      await remindersApi.delete(reminder.id);
      setShowDetailModal(false);
      showSuccess('Reminder deleted');
      loadData();
    } catch (err) { showError('Failed to delete reminder'); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editMode && selectedReminder) {
        await remindersApi.update(selectedReminder.id, formData);
        showSuccess('Reminder updated');
      } else {
        await remindersApi.create(formData);
        showSuccess('Reminder created');
      }
      setShowModal(false);
      loadData();
    } catch (err) { showError('Failed to save reminder'); }
  };

  const handleBulkDelete = async () => {
    const ok = await confirm({ title: 'Delete Selected', message: `Delete ${selectedIds.length} reminder(s)?`, confirmText: 'Delete All', danger: true });
    if (!ok) return;
    try {
      await remindersApi.bulkDelete(selectedIds);
      showSuccess(`${selectedIds.length} reminder(s) deleted`);
      clearSelection();
      loadData();
    } catch (err) { showError('Failed to delete reminders'); }
  };

  const handleExportCSV = () => {
    exportToCSV(reminders, [
      { label: 'Appointment', key: 'appointment_title' },
      { label: 'Remind At', accessor: (r) => formatDate(r.remind_at) },
      { label: 'Type', key: 'type' },
      { label: 'Status', accessor: (r) => r.sent ? 'Sent' : 'Pending' }
    ], 'reminders');
  };

  const formatDateTimeLocal = (dateString) => new Date(dateString).toISOString().slice(0, 16);
  const formatDate = (dateString) => new Date(dateString).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const getTypeIcon = (type) => type === 'email' ? '📧' : '📱';

  if (loading && reminders.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center"><h1 className="text-2xl font-bold text-gray-800">Reminders</h1></div>
        <SkeletonTable rows={5} cols={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Reminders</h1>
        <div className="flex items-center gap-3">
          <ExportButtons onExportCSV={handleExportCSV} />
          <button onClick={handleCreate} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
            <span>+</span> New Reminder
          </button>
        </div>
      </div>

      <SearchBar value={search} onChange={handleSearchChange} placeholder="Search reminders..." />

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input type="checkbox" checked={selectedIds.length > 0 && selectedIds.length === reminders.length} onChange={() => toggleSelectAll(reminders.map(r => r.id))} className="rounded border-gray-300" />
                </th>
                <SortableHeader label="Appointment" field="appointment_title" currentSort={sort} currentOrder={order} onSort={handleSort} />
                <SortableHeader label="Remind At" field="remind_at" currentSort={sort} currentOrder={order} onSort={handleSort} />
                <SortableHeader label="Type" field="type" currentSort={sort} currentOrder={order} onSort={handleSort} />
                <SortableHeader label="Status" field="sent" currentSort={sort} currentOrder={order} onSort={handleSort} />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {reminders.map((reminder) => (
                <tr key={reminder.id} onClick={() => handleRowClick(reminder)} className={`hover:bg-gray-50 cursor-pointer transition-colors ${selectedSet.has(reminder.id) ? 'bg-blue-50' : ''}`}>
                  <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedSet.has(reminder.id)} onChange={() => toggleSelect(reminder.id)} className="rounded border-gray-300" />
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{reminder.appointment_title}</div>
                    <div className="text-sm text-gray-500">{reminder.appointment_time ? formatDate(reminder.appointment_time) : ''}</div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(reminder.remind_at)}</td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className="flex items-center gap-2">{getTypeIcon(reminder.type)}<span className="capitalize text-sm text-gray-700">{reminder.type}</span></span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full ${reminder.sent ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{reminder.sent ? 'Sent' : 'Pending'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {reminders.length === 0 && !loading && (
          <div className="text-center py-12 text-gray-500">{search ? 'No reminders match your search.' : 'No reminders found. Create your first reminder!'}</div>
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} limit={limit} onPageChange={(p) => { setPage(p); clearSelection(); }} onLimitChange={(l) => { setLimit(l); setPage(1); clearSelection(); }} />
      <BulkActionBar count={selectedIds.length} onDelete={handleBulkDelete} />

      {/* Detail Modal */}
      {showDetailModal && selectedReminder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="p-6 border-b">
              <div className="flex justify-between items-start">
                <h2 className="text-xl font-bold text-gray-800">Reminder Details</h2>
                <button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div><label className="text-sm font-medium text-gray-500">Appointment</label><p className="text-gray-800">{selectedReminder.appointment_title}</p>{selectedReminder.appointment_time && <p className="text-sm text-gray-500">{formatDate(selectedReminder.appointment_time)}</p>}</div>
              <div><label className="text-sm font-medium text-gray-500">Remind At</label><p className="text-gray-800">{formatDate(selectedReminder.remind_at)}</p></div>
              <div><label className="text-sm font-medium text-gray-500">Type</label><p className="text-gray-800 flex items-center gap-2">{getTypeIcon(selectedReminder.type)}<span className="capitalize">{selectedReminder.type}</span></p></div>
              <div><label className="text-sm font-medium text-gray-500">Status</label><span className={`inline-block mt-1 px-2 py-1 text-xs rounded-full ${selectedReminder.sent ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{selectedReminder.sent ? 'Sent' : 'Pending'}</span></div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => handleDelete(selectedReminder)} className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors">Delete</button>
              <button onClick={() => handleEdit(selectedReminder)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">Edit</button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800">{editMode ? 'Edit Reminder' : 'New Reminder'}</h2>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Appointment *</label>
                <select value={formData.appointment_id} onChange={(e) => setFormData({ ...formData, appointment_id: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" required>
                  <option value="">Select an appointment</option>
                  {appointments.map((apt) => (
                    <option key={apt.id} value={apt.id}>{apt.title} - {formatDate(apt.start_time)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Remind At *</label>
                <input type="datetime-local" value={formData.remind_at} onChange={(e) => setFormData({ ...formData, remind_at: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">{editMode ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
