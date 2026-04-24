import React, { useState, useEffect, useCallback } from 'react';
import { contactsApi, aiApi } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import useBulkSelection from '../hooks/useBulkSelection';
import SearchBar from '../components/SearchBar';
import Pagination from '../components/Pagination';
import ExportButtons from '../components/ExportButtons';
import BulkActionBar from '../components/BulkActionBar';
import { SkeletonCard } from '../components/Skeleton';
import { exportToCSV } from '../utils/export';

export default function Contacts() {
  const { showSuccess, showError } = useToast();
  const confirm = useConfirm();

  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', company: '', notes: '' });

  // Pagination, search, sort
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(12);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('name');
  const [order, setOrder] = useState('asc');

  // AI Search
  const [aiSearchResults, setAiSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);

  // Bulk selection
  const { selectedIds, selectedSet, toggleSelect, toggleSelectAll, clearSelection } = useBulkSelection();

  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await contactsApi.getAll({ page, limit, search, sort, order });
      if (data.data) {
        setContacts(data.data);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      } else {
        const list = Array.isArray(data) ? data : [];
        setContacts(list);
        setTotal(list.length);
        setTotalPages(1);
      }
    } catch (err) {
      console.error('Failed to load contacts:', err);
      showError('Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, sort, order]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const handleSearchChange = (value) => {
    setSearch(value);
    setPage(1);
    setAiSearchResults(null);
    clearSelection();
  };

  // AI Smart Search
  const handleAiSearch = async () => {
    if (!search.trim()) return;
    setSearching(true);
    try {
      const result = await aiApi.matchContact(search);
      setAiSearchResults(result);
    } catch (err) {
      console.error('AI search failed:', err);
    } finally {
      setSearching(false);
    }
  };

  const handleRowClick = async (contact) => {
    try {
      const details = await contactsApi.getById(contact.id);
      setSelectedContact(details);
      setShowDetailModal(true);
    } catch (err) {
      console.error('Failed to load contact details:', err);
    }
  };

  const handleCreate = () => {
    setEditMode(false);
    setFormData({ name: '', email: '', phone: '', company: '', notes: '' });
    setShowModal(true);
  };

  const handleEdit = (contact) => {
    setEditMode(true);
    setSelectedContact(contact);
    setFormData({
      name: contact.name,
      email: contact.email || '',
      phone: contact.phone || '',
      company: contact.company || '',
      notes: contact.notes || ''
    });
    setShowDetailModal(false);
    setShowModal(true);
  };

  const handleDelete = async (contact) => {
    const ok = await confirm({
      title: 'Delete Contact',
      message: `Are you sure you want to delete "${contact.name}"?`,
      confirmText: 'Delete',
      danger: true
    });
    if (!ok) return;
    try {
      await contactsApi.delete(contact.id);
      setShowDetailModal(false);
      showSuccess('Contact deleted');
      loadContacts();
    } catch (err) {
      showError('Failed to delete contact');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editMode && selectedContact) {
        await contactsApi.update(selectedContact.id, formData);
        showSuccess('Contact updated');
      } else {
        await contactsApi.create(formData);
        showSuccess('Contact created');
      }
      setShowModal(false);
      loadContacts();
    } catch (err) {
      showError('Failed to save contact');
    }
  };

  const handleBulkDelete = async () => {
    const ok = await confirm({
      title: 'Delete Selected',
      message: `Are you sure you want to delete ${selectedIds.length} contact(s)?`,
      confirmText: 'Delete All',
      danger: true
    });
    if (!ok) return;
    try {
      await contactsApi.bulkDelete(selectedIds);
      showSuccess(`${selectedIds.length} contact(s) deleted`);
      clearSelection();
      loadContacts();
    } catch (err) {
      showError('Failed to delete contacts');
    }
  };

  const handleExportCSV = () => {
    exportToCSV(contacts, [
      { label: 'Name', key: 'name' },
      { label: 'Email', key: 'email' },
      { label: 'Phone', key: 'phone' },
      { label: 'Company', key: 'company' }
    ], 'contacts');
  };

  if (loading && contacts.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">Contacts</h1>
        </div>
        <SkeletonCard count={6} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Contacts</h1>
        <div className="flex items-center gap-3">
          <ExportButtons onExportCSV={handleExportCSV} />
          <button
            onClick={handleCreate}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <span>+</span> New Contact
          </button>
        </div>
      </div>

      {/* AI Smart Search */}
      <div className="bg-gradient-to-r from-green-50 to-teal-50 rounded-xl p-4 border border-green-100">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">🔍</span>
          <h3 className="font-medium text-gray-800">AI Smart Search</h3>
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <SearchBar value={search} onChange={handleSearchChange} placeholder='Try: "my doctor" or "someone at TechCorp"' />
          </div>
          <button
            onClick={handleAiSearch}
            disabled={searching || !search.trim()}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {searching ? 'Searching...' : 'AI Search'}
          </button>
        </div>
        {aiSearchResults && (
          <div className="mt-3 flex items-center gap-2">
            <span className={`text-sm ${aiSearchResults.confidence > 0.7 ? 'text-green-600' : 'text-yellow-600'}`}>
              Confidence: {Math.round(aiSearchResults.confidence * 100)}%
            </span>
            {aiSearchResults.reasoning && (
              <span className="text-sm text-gray-500">| {aiSearchResults.reasoning}</span>
            )}
            {aiSearchResults.ai_powered && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">AI Powered</span>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {contacts.map((contact) => (
          <div
            key={contact.id}
            onClick={() => handleRowClick(contact)}
            className={`bg-white rounded-xl shadow-sm p-6 cursor-pointer card-hover border ${selectedSet.has(contact.id) ? 'border-blue-400 bg-blue-50' : 'border-transparent hover:border-blue-200'}`}
          >
            <div className="flex items-center gap-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectedSet.has(contact.id)}
                  onChange={(e) => { e.stopPropagation(); toggleSelect(contact.id); }}
                  onClick={(e) => e.stopPropagation()}
                  className="rounded border-gray-300 mr-3"
                />
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-lg">
                  {contact.name.charAt(0).toUpperCase()}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-800 truncate">{contact.name}</h3>
                {contact.company && (
                  <p className="text-sm text-gray-500 truncate">{contact.company}</p>
                )}
              </div>
            </div>
            <div className="mt-4 space-y-1">
              {contact.email && (
                <p className="text-sm text-gray-600 truncate flex items-center gap-2">
                  <span>📧</span> {contact.email}
                </p>
              )}
              {contact.phone && (
                <p className="text-sm text-gray-600 flex items-center gap-2">
                  <span>📞</span> {contact.phone}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {contacts.length === 0 && !loading && (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-500">
          {search ? 'No contacts found matching your search.' : 'No contacts found. Add your first contact!'}
        </div>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        limit={limit}
        onPageChange={(p) => { setPage(p); clearSelection(); }}
        onLimitChange={(l) => { setLimit(l); setPage(1); clearSelection(); }}
      />

      <BulkActionBar count={selectedIds.length} onDelete={handleBulkDelete} />

      {/* Detail Modal */}
      {showDetailModal && selectedContact && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="p-6 border-b">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-2xl">
                    {selectedContact.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">{selectedContact.name}</h2>
                    {selectedContact.company && (
                      <p className="text-gray-500">{selectedContact.company}</p>
                    )}
                  </div>
                </div>
                <button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-600">
                  ✕
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {selectedContact.email && (
                <div className="flex items-center gap-3">
                  <span className="text-xl">📧</span>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Email</label>
                    <p className="text-gray-800">{selectedContact.email}</p>
                  </div>
                </div>
              )}
              {selectedContact.phone && (
                <div className="flex items-center gap-3">
                  <span className="text-xl">📞</span>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Phone</label>
                    <p className="text-gray-800">{selectedContact.phone}</p>
                  </div>
                </div>
              )}
              {selectedContact.notes && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Notes</label>
                  <p className="text-gray-800 mt-1">{selectedContact.notes}</p>
                </div>
              )}
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => handleDelete(selectedContact)} className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors">Delete</button>
              <button onClick={() => handleEdit(selectedContact)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">Edit</button>
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
                <h2 className="text-xl font-bold text-gray-800">{editMode ? 'Edit Contact' : 'New Contact'}</h2>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                <input type="text" value={formData.company} onChange={(e) => setFormData({ ...formData, company: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={3} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
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
