import React, { useState, useEffect, useCallback } from 'react';
import { appointmentsApi, contactsApi, aiApi, categoriesApi } from '../services/api';
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

export default function Appointments() {
  const { showSuccess, showError } = useToast();
  const confirm = useConfirm();

  const [appointments, setAppointments] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location: '',
    start_time: '',
    end_time: '',
    contact_id: '',
    status: 'scheduled'
  });

  // Pagination, search, sort state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('start_time');
  const [order, setOrder] = useState('desc');

  // AI Features State
  const [aiConflicts, setAiConflicts] = useState(null);
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [aiCategory, setAiCategory] = useState(null);
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [nlpInput, setNlpInput] = useState('');
  const [nlpLoading, setNlpLoading] = useState(false);

  // Bulk selection
  const { selectedIds, selectedSet, toggleSelect, toggleSelectAll, clearSelection } = useBulkSelection();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [aptsData, contactsData, categoriesData] = await Promise.all([
        appointmentsApi.getAll({ page, limit, search, sort, order }),
        contactsApi.getAll(),
        categoriesApi.getAll()
      ]);
      // Handle paginated response (supports both legacy and new {data, pagination} shape)
      if (aptsData.data) {
        setAppointments(aptsData.data);
        const pg = aptsData.pagination || {};
        setTotal(pg.total ?? aptsData.total ?? 0);
        setTotalPages(pg.totalPages ?? aptsData.totalPages ?? 1);
      } else {
        setAppointments(Array.isArray(aptsData) ? aptsData : []);
        setTotal(Array.isArray(aptsData) ? aptsData.length : 0);
        setTotalPages(1);
      }
      const contactsList = contactsData.data || contactsData;
      setContacts(Array.isArray(contactsList) ? contactsList : []);
      const categoriesList = categoriesData.data || categoriesData;
      setCategories(Array.isArray(categoriesList) ? categoriesList : []);
    } catch (err) {
      console.error('Failed to load data:', err);
      showError('Failed to load appointments');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, sort, order]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reset to page 1 when search changes
  const handleSearchChange = (value) => {
    setSearch(value);
    setPage(1);
    clearSelection();
  };

  const handleSort = (field, newOrder) => {
    setSort(field);
    setOrder(newOrder);
    setPage(1);
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    clearSelection();
  };

  const handleLimitChange = (newLimit) => {
    setLimit(newLimit);
    setPage(1);
    clearSelection();
  };

  const handleRowClick = async (appointment) => {
    try {
      const details = await appointmentsApi.getById(appointment.id);
      setSelectedAppointment(details);
      setShowDetailModal(true);
    } catch (err) {
      console.error('Failed to load appointment details:', err);
    }
  };

  const handleCreate = () => {
    setEditMode(false);
    setFormData({
      title: '',
      description: '',
      location: '',
      start_time: '',
      end_time: '',
      contact_id: '',
      status: 'scheduled'
    });
    setAiConflicts(null);
    setAiCategory(null);
    setShowModal(true);
    loadAiSuggestions();
  };

  const handleEdit = (appointment) => {
    setEditMode(true);
    setSelectedAppointment(appointment);
    setFormData({
      title: appointment.title,
      description: appointment.description || '',
      location: appointment.location || '',
      start_time: formatDateTimeLocal(appointment.start_time),
      end_time: formatDateTimeLocal(appointment.end_time),
      contact_id: appointment.contact_id || '',
      status: appointment.status
    });
    setShowDetailModal(false);
    setAiConflicts(null);
    setShowModal(true);
  };

  const handleDelete = async (appointment) => {
    const ok = await confirm({
      title: 'Delete Appointment',
      message: `Are you sure you want to delete "${appointment.title}"?`,
      confirmText: 'Delete',
      danger: true
    });
    if (!ok) return;

    try {
      await appointmentsApi.delete(appointment.id);
      setShowDetailModal(false);
      showSuccess('Appointment deleted');
      loadData();
    } catch (err) {
      console.error('Failed to delete appointment:', err);
      showError('Failed to delete appointment');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editMode && selectedAppointment) {
        await appointmentsApi.update(selectedAppointment.id, formData);
        showSuccess('Appointment updated');
      } else {
        await appointmentsApi.create(formData);
        showSuccess('Appointment created');
      }
      setShowModal(false);
      loadData();
    } catch (err) {
      console.error('Failed to save appointment:', err);
      showError('Failed to save appointment');
    }
  };

  // Bulk actions
  const handleBulkDelete = async () => {
    const ok = await confirm({
      title: 'Delete Selected',
      message: `Are you sure you want to delete ${selectedIds.length} appointment(s)?`,
      confirmText: 'Delete All',
      danger: true
    });
    if (!ok) return;

    try {
      await appointmentsApi.bulkDelete(selectedIds);
      showSuccess(`${selectedIds.length} appointment(s) deleted`);
      clearSelection();
      loadData();
    } catch (err) {
      showError('Failed to delete appointments');
    }
  };

  const handleBulkStatusUpdate = async (status) => {
    try {
      await appointmentsApi.bulkUpdate(selectedIds, status);
      showSuccess(`${selectedIds.length} appointment(s) updated to ${status}`);
      clearSelection();
      loadData();
    } catch (err) {
      showError('Failed to update appointments');
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    exportToCSV(appointments, [
      { label: 'Title', key: 'title' },
      { label: 'Date', accessor: (r) => formatDate(r.start_time) },
      { label: 'Location', key: 'location' },
      { label: 'Contact', key: 'contact_name' },
      { label: 'Status', key: 'status' }
    ], 'appointments');
  };

  // AI: Create from natural language
  const handleNlpCreate = async () => {
    if (!nlpInput.trim()) return;
    setNlpLoading(true);
    try {
      const result = await appointmentsApi.createFromNlp(nlpInput);
      if (result.appointment) {
        setNlpInput('');
        showSuccess(`Created: ${result.appointment.title}`);
        loadData();
      } else if (result.parsed) {
        const parsed = result.parsed;
        setFormData(prev => ({
          ...prev,
          title: parsed.title || prev.title,
          description: parsed.description || prev.description
        }));
      }
    } catch (err) {
      console.error('NLP create failed:', err);
      showError('Failed to create appointment from text');
    } finally {
      setNlpLoading(false);
    }
  };

  // AI: Check for conflicts
  const checkForConflicts = async () => {
    if (!formData.start_time || !formData.end_time) return;
    setCheckingConflicts(true);
    try {
      const result = await aiApi.checkConflicts({
        start_time: formData.start_time,
        end_time: formData.end_time,
        id: selectedAppointment?.id
      });
      setAiConflicts(result);
    } catch (err) {
      console.error('Conflict check failed:', err);
    } finally {
      setCheckingConflicts(false);
    }
  };

  // AI: Get suggestions
  const loadAiSuggestions = async () => {
    try {
      const result = await aiApi.getSuggestions('Suggest best times for a new appointment');
      setAiSuggestions(result);
    } catch (err) {
      console.error('Failed to load suggestions:', err);
    }
  };

  // AI: Suggest category
  const suggestCategory = async () => {
    if (!formData.title) return;
    try {
      const result = await aiApi.suggestCategory({
        title: formData.title,
        description: formData.description,
        location: formData.location
      });
      setAiCategory(result);
    } catch (err) {
      console.error('Category suggestion failed:', err);
    }
  };

  // AI: Generate title
  const generateTitle = async () => {
    try {
      const contact = contacts.find(c => c.id === parseInt(formData.contact_id));
      const result = await aiApi.generateTitle({
        contact: contact?.name,
        location: formData.location,
        time: formData.start_time
      });
      if (result.title) {
        setFormData(prev => ({ ...prev, title: result.title }));
      }
    } catch (err) {
      console.error('Title generation failed:', err);
    }
  };

  // Apply AI suggestion to form
  const applySuggestion = (slot) => {
    const startDate = new Date(`${slot.date}T${slot.time}`);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    setFormData(prev => ({
      ...prev,
      start_time: formatDateTimeLocal(startDate.toISOString()),
      end_time: formatDateTimeLocal(endDate.toISOString())
    }));
  };

  const formatDateTimeLocal = (dateString) => {
    const date = new Date(dateString);
    return date.toISOString().slice(0, 16);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading && appointments.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">Appointments</h1>
        </div>
        <SkeletonTable rows={5} cols={5} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Appointments</h1>
        <div className="flex items-center gap-3">
          <ExportButtons onExportCSV={handleExportCSV} />
          <button
            onClick={handleCreate}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <span>+</span> New Appointment
          </button>
        </div>
      </div>

      {/* AI Quick Create */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">🤖</span>
          <h3 className="font-medium text-gray-800">AI Quick Create</h3>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={nlpInput}
            onChange={(e) => setNlpInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleNlpCreate()}
            placeholder='Try: "Meeting with Dr. Smith tomorrow at 2pm" or "Lunch on Friday"'
            className="flex-1 px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          />
          <button
            onClick={handleNlpCreate}
            disabled={nlpLoading || !nlpInput.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {nlpLoading ? 'Creating...' : 'Create with AI'}
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <SearchBar value={search} onChange={handleSearchChange} placeholder="Search appointments..." />

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.length > 0 && selectedIds.length === appointments.length}
                    onChange={() => toggleSelectAll(appointments.map(a => a.id))}
                    className="rounded border-gray-300"
                  />
                </th>
                <SortableHeader label="Title" field="title" currentSort={sort} currentOrder={order} onSort={handleSort} />
                <SortableHeader label="Date & Time" field="start_time" currentSort={sort} currentOrder={order} onSort={handleSort} />
                <SortableHeader label="Location" field="location" currentSort={sort} currentOrder={order} onSort={handleSort} />
                <SortableHeader label="Contact" field="contact_name" currentSort={sort} currentOrder={order} onSort={handleSort} />
                <SortableHeader label="Status" field="status" currentSort={sort} currentOrder={order} onSort={handleSort} />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {appointments.map((apt) => (
                <tr
                  key={apt.id}
                  onClick={() => handleRowClick(apt)}
                  className={`hover:bg-gray-50 cursor-pointer transition-colors ${selectedSet.has(apt.id) ? 'bg-blue-50' : ''}`}
                >
                  <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedSet.has(apt.id)}
                      onChange={() => toggleSelect(apt.id)}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{apt.title}</div>
                    {apt.description && (
                      <div className="text-sm text-gray-500 truncate max-w-xs">{apt.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(apt.start_time)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                    {apt.location || '-'}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                    {apt.contact_name || '-'}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(apt.status)}`}>
                      {apt.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {appointments.length === 0 && !loading && (
          <div className="text-center py-12 text-gray-500">
            {search ? 'No appointments match your search.' : 'No appointments found. Create your first appointment!'}
          </div>
        )}
      </div>

      {/* Pagination */}
      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        limit={limit}
        onPageChange={handlePageChange}
        onLimitChange={handleLimitChange}
      />

      {/* Bulk Action Bar */}
      <BulkActionBar
        count={selectedIds.length}
        onDelete={handleBulkDelete}
        onStatusUpdate={handleBulkStatusUpdate}
        statusOptions={['scheduled', 'completed', 'cancelled']}
      />

      {/* Detail Modal */}
      {showDetailModal && selectedAppointment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="p-6 border-b">
              <div className="flex justify-between items-start">
                <h2 className="text-xl font-bold text-gray-800">{selectedAppointment.title}</h2>
                <button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-600">
                  ✕
                </button>
              </div>
              <span className={`inline-block mt-2 px-2 py-1 text-xs rounded-full ${getStatusColor(selectedAppointment.status)}`}>
                {selectedAppointment.status}
              </span>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Date & Time</label>
                <p className="text-gray-800">{formatDate(selectedAppointment.start_time)} - {formatDate(selectedAppointment.end_time)}</p>
              </div>
              {selectedAppointment.location && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Location</label>
                  <p className="text-gray-800">{selectedAppointment.location}</p>
                </div>
              )}
              {selectedAppointment.contact_name && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Contact</label>
                  <p className="text-gray-800">{selectedAppointment.contact_name}</p>
                  {selectedAppointment.contact_email && (
                    <p className="text-sm text-gray-500">{selectedAppointment.contact_email}</p>
                  )}
                </div>
              )}
              {selectedAppointment.description && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Description</label>
                  <p className="text-gray-800">{selectedAppointment.description}</p>
                </div>
              )}
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button
                onClick={() => handleDelete(selectedAppointment)}
                className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => handleEdit(selectedAppointment)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal with AI Features */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800">
                  {editMode ? 'Edit Appointment' : 'New Appointment'}
                </h2>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                  ✕
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
              {/* Form Section */}
              <form onSubmit={handleSubmit} className="lg:col-span-2 p-6 space-y-4 border-r">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      onBlur={suggestCategory}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                    <button
                      type="button"
                      onClick={generateTitle}
                      className="px-3 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 text-sm"
                      title="AI Generate Title"
                    >
                      🤖
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Time *</label>
                    <input
                      type="datetime-local"
                      value={formData.start_time}
                      onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                      onBlur={checkForConflicts}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Time *</label>
                    <input
                      type="datetime-local"
                      value={formData.end_time}
                      onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                      onBlur={checkForConflicts}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>

                {/* AI Conflict Warning */}
                {aiConflicts && aiConflicts.hasConflicts && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-red-700 font-medium">
                      <span>⚠️</span> Scheduling Conflicts Detected
                    </div>
                    <ul className="mt-2 space-y-1">
                      {aiConflicts.conflicts.map((c, i) => (
                        <li key={i} className="text-sm text-red-600">{c.description}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact</label>
                  <select
                    value={formData.contact_id}
                    onChange={(e) => setFormData({ ...formData, contact_id: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select a contact</option>
                    {contacts.map((contact) => (
                      <option key={contact.id} value={contact.id}>{contact.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="scheduled">Scheduled</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    {editMode ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>

              {/* AI Suggestions Panel */}
              <div className="p-4 bg-gray-50">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-lg">✨</span>
                  <h3 className="font-medium text-gray-800">AI Suggestions</h3>
                </div>

                {aiSuggestions?.suggested_times && (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500 uppercase font-medium">Recommended Times</p>
                    {aiSuggestions.suggested_times.slice(0, 3).map((slot, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => applySuggestion(slot)}
                        className="w-full text-left p-2 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                      >
                        <p className="text-sm font-medium text-gray-800">{slot.date} {slot.time}</p>
                        <p className="text-xs text-gray-500">{slot.reason}</p>
                      </button>
                    ))}
                  </div>
                )}

                {aiCategory && (
                  <div className="mt-4">
                    <p className="text-xs text-gray-500 uppercase font-medium mb-2">Suggested Category</p>
                    <div className="p-2 bg-white rounded-lg border border-gray-200">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: aiCategory.category?.color }}
                        ></div>
                        <span className="text-sm font-medium">{aiCategory.category?.name}</span>
                      </div>
                      {aiCategory.reasoning && (
                        <p className="text-xs text-gray-500 mt-1">{aiCategory.reasoning}</p>
                      )}
                    </div>
                  </div>
                )}

                {aiSuggestions?.tips && (
                  <div className="mt-4">
                    <p className="text-xs text-gray-500 uppercase font-medium mb-2">Tips</p>
                    <ul className="space-y-1">
                      {aiSuggestions.tips.slice(0, 3).map((tip, i) => (
                        <li key={i} className="text-xs text-gray-600 flex items-start gap-1">
                          <span>💡</span> {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
