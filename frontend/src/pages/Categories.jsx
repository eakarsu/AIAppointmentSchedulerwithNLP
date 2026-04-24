import React, { useState, useEffect, useCallback } from 'react';
import { categoriesApi } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import useBulkSelection from '../hooks/useBulkSelection';
import SearchBar from '../components/SearchBar';
import Pagination from '../components/Pagination';
import ExportButtons from '../components/ExportButtons';
import BulkActionBar from '../components/BulkActionBar';
import { SkeletonCard } from '../components/Skeleton';
import { exportToCSV } from '../utils/export';

export default function Categories() {
  const { showSuccess, showError } = useToast();
  const confirm = useConfirm();

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({ name: '', color: '#3B82F6', description: '' });

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(12);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('name');
  const [order, setOrder] = useState('asc');

  const { selectedIds, selectedSet, toggleSelect, toggleSelectAll, clearSelection } = useBulkSelection();

  const colorOptions = [
    '#EF4444', '#F97316', '#F59E0B', '#84CC16', '#22C55E',
    '#10B981', '#14B8A6', '#06B6D4', '#3B82F6', '#6366F1',
    '#8B5CF6', '#A855F7', '#EC4899', '#F472B6', '#64748B'
  ];

  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const data = await categoriesApi.getAll({ page, limit, search, sort, order });
      if (data.data) {
        setCategories(data.data);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      } else {
        const list = Array.isArray(data) ? data : [];
        setCategories(list);
        setTotal(list.length);
        setTotalPages(1);
      }
    } catch (err) {
      showError('Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, sort, order]);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  const handleSearchChange = (v) => { setSearch(v); setPage(1); clearSelection(); };

  const handleRowClick = async (category) => {
    try {
      const details = await categoriesApi.getById(category.id);
      setSelectedCategory(details);
      setShowDetailModal(true);
    } catch (err) {
      console.error('Failed to load category details:', err);
    }
  };

  const handleCreate = () => {
    setEditMode(false);
    setFormData({ name: '', color: '#3B82F6', description: '' });
    setShowModal(true);
  };

  const handleEdit = (category) => {
    setEditMode(true);
    setSelectedCategory(category);
    setFormData({ name: category.name, color: category.color || '#3B82F6', description: category.description || '' });
    setShowDetailModal(false);
    setShowModal(true);
  };

  const handleDelete = async (category) => {
    const ok = await confirm({ title: 'Delete Category', message: `Delete "${category.name}"?`, confirmText: 'Delete', danger: true });
    if (!ok) return;
    try {
      await categoriesApi.delete(category.id);
      setShowDetailModal(false);
      showSuccess('Category deleted');
      loadCategories();
    } catch (err) { showError('Failed to delete category'); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editMode && selectedCategory) {
        await categoriesApi.update(selectedCategory.id, formData);
        showSuccess('Category updated');
      } else {
        await categoriesApi.create(formData);
        showSuccess('Category created');
      }
      setShowModal(false);
      loadCategories();
    } catch (err) { showError('Failed to save category'); }
  };

  const handleBulkDelete = async () => {
    const ok = await confirm({ title: 'Delete Selected', message: `Delete ${selectedIds.length} category(ies)?`, confirmText: 'Delete All', danger: true });
    if (!ok) return;
    try {
      await categoriesApi.bulkDelete(selectedIds);
      showSuccess(`${selectedIds.length} category(ies) deleted`);
      clearSelection();
      loadCategories();
    } catch (err) { showError('Failed to delete categories'); }
  };

  const handleExportCSV = () => {
    exportToCSV(categories, [
      { label: 'Name', key: 'name' },
      { label: 'Color', key: 'color' },
      { label: 'Description', key: 'description' }
    ], 'categories');
  };

  if (loading && categories.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center"><h1 className="text-2xl font-bold text-gray-800">Categories</h1></div>
        <SkeletonCard count={8} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Categories</h1>
        <div className="flex items-center gap-3">
          <ExportButtons onExportCSV={handleExportCSV} />
          <button onClick={handleCreate} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
            <span>+</span> New Category
          </button>
        </div>
      </div>

      <SearchBar value={search} onChange={handleSearchChange} placeholder="Search categories..." />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {categories.map((category) => (
          <div
            key={category.id}
            onClick={() => handleRowClick(category)}
            className={`bg-white rounded-xl shadow-sm p-6 cursor-pointer card-hover border-l-4 ${selectedSet.has(category.id) ? 'ring-2 ring-blue-400' : ''}`}
            style={{ borderLeftColor: category.color }}
          >
            <div className="flex items-center gap-3 mb-2">
              <input
                type="checkbox"
                checked={selectedSet.has(category.id)}
                onChange={(e) => { e.stopPropagation(); toggleSelect(category.id); }}
                onClick={(e) => e.stopPropagation()}
                className="rounded border-gray-300"
              />
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: category.color }}></div>
              <h3 className="font-semibold text-gray-800">{category.name}</h3>
            </div>
            {category.description && (
              <p className="text-sm text-gray-500 line-clamp-2">{category.description}</p>
            )}
          </div>
        ))}
      </div>

      {categories.length === 0 && !loading && (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-500">
          {search ? 'No categories match your search.' : 'No categories found. Create your first category!'}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} total={total} limit={limit} onPageChange={(p) => { setPage(p); clearSelection(); }} onLimitChange={(l) => { setLimit(l); setPage(1); clearSelection(); }} />
      <BulkActionBar count={selectedIds.length} onDelete={handleBulkDelete} />

      {/* Detail Modal */}
      {showDetailModal && selectedCategory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="p-6 border-b">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: selectedCategory.color }}></div>
                  <h2 className="text-xl font-bold text-gray-800">{selectedCategory.name}</h2>
                </div>
                <button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Color</label>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-6 h-6 rounded" style={{ backgroundColor: selectedCategory.color }}></div>
                  <span className="text-gray-800">{selectedCategory.color}</span>
                </div>
              </div>
              {selectedCategory.description && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Description</label>
                  <p className="text-gray-800 mt-1">{selectedCategory.description}</p>
                </div>
              )}
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => handleDelete(selectedCategory)} className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors">Delete</button>
              <button onClick={() => handleEdit(selectedCategory)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">Edit</button>
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
                <h2 className="text-xl font-bold text-gray-800">{editMode ? 'Edit Category' : 'New Category'}</h2>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                <div className="flex flex-wrap gap-2">
                  {colorOptions.map((color) => (
                    <button key={color} type="button" onClick={() => setFormData({ ...formData, color })}
                      className={`w-8 h-8 rounded-lg transition-transform ${formData.color === color ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`}
                      style={{ backgroundColor: color }} />
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
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
