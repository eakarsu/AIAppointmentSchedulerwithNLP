import React, { useState, useEffect, useCallback } from 'react';
import { advancedAiApi, appointmentsApi } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import SearchBar from '../components/SearchBar';
import SortableHeader from '../components/SortableHeader';
import Pagination from '../components/Pagination';
import ExportButtons from '../components/ExportButtons';
import { SkeletonTable, SkeletonCard } from '../components/Skeleton';
import { exportToCSV } from '../utils/export';

export default function ResourceAllocator() {
  const { showSuccess, showError } = useToast();
  const confirm = useConfirm();

  const [resources, setResources] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [allocatingId, setAllocatingId] = useState(null);
  const [optimizationResult, setOptimizationResult] = useState(null);
  const [showResourceModal, setShowResourceModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [editingResource, setEditingResource] = useState(null);
  const [resourceForm, setResourceForm] = useState({
    name: '',
    type: 'room',
    capacity: 1,
    location: '',
    cost_per_hour: 0
  });

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('created_at');
  const [order, setOrder] = useState('desc');

  const resourceTypes = ['room', 'equipment', 'staff', 'vehicle', 'other'];

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [resourcesData, allocationsData, appointmentsData] = await Promise.all([
        advancedAiApi.getResources(),
        advancedAiApi.getAllocations({ page, limit, search, sort, order }),
        appointmentsApi.getUpcoming()
      ]);
      setResources(resourcesData);
      if (allocationsData.data) {
        setAllocations(allocationsData.data);
        setTotal(allocationsData.total || 0);
        setTotalPages(allocationsData.totalPages || 1);
      } else {
        const list = Array.isArray(allocationsData) ? allocationsData : [];
        setAllocations(list);
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

  const handleOptimizeAll = async () => {
    if (resources.length === 0) return;
    setOptimizing(true);
    try {
      const result = await advancedAiApi.optimizeAllocations(null, {});
      setOptimizationResult(result);
      showSuccess('Resources optimized');
      loadData();
    } catch (err) {
      showError('Optimization failed');
    } finally {
      setOptimizing(false);
    }
  };

  const handleAllocateSingle = async (appointmentId) => {
    if (resources.length === 0) return;
    setAllocatingId(appointmentId);
    try {
      const result = await advancedAiApi.optimizeAllocations([appointmentId], {});
      setOptimizationResult(result);
      showSuccess('Resources allocated');
      loadData();
    } catch (err) {
      showError('Allocation failed');
    } finally {
      setAllocatingId(null);
    }
  };

  const handleCreateResource = () => {
    setEditingResource(null);
    setResourceForm({ name: '', type: 'room', capacity: 1, location: '', cost_per_hour: 0 });
    setShowResourceModal(true);
  };

  const handleEditResource = (resource) => {
    setEditingResource(resource);
    setResourceForm({
      name: resource.name,
      type: resource.type,
      capacity: resource.capacity,
      location: resource.location || '',
      cost_per_hour: resource.cost_per_hour || 0
    });
    setShowResourceModal(true);
  };

  const handleSaveResource = async () => {
    try {
      if (editingResource) {
        await advancedAiApi.updateResource(editingResource.id, resourceForm);
        showSuccess('Resource updated');
      } else {
        await advancedAiApi.createResource(resourceForm);
        showSuccess('Resource created');
      }
      setShowResourceModal(false);
      loadData();
    } catch (err) {
      showError('Failed to save resource');
    }
  };

  const handleDeleteResource = async (id) => {
    const ok = await confirm({ title: 'Delete Resource', message: 'Delete this resource?', confirmText: 'Delete', danger: true });
    if (!ok) return;
    try {
      await advancedAiApi.deleteResource(id);
      showSuccess('Resource deleted');
      loadData();
    } catch (err) {
      showError('Failed to delete resource');
    }
  };

  const handleDeleteAllocation = async (id) => {
    const ok = await confirm({ title: 'Delete Allocation', message: 'Delete this allocation?', confirmText: 'Delete', danger: true });
    if (!ok) return;
    try {
      await advancedAiApi.deleteAllocation(id);
      setShowDetailModal(false);
      showSuccess('Allocation deleted');
      loadData();
    } catch (err) {
      showError('Failed to delete allocation');
    }
  };

  const handleRowClick = (allocation) => {
    setSelectedDetail(allocation);
    setShowDetailModal(true);
  };

  const handleExportCSV = () => {
    exportToCSV(allocations, [
      { label: 'Appointment', key: 'appointment_title' },
      { label: 'Resource', key: 'resource_name' },
      { label: 'Type', key: 'allocation_type' },
      { label: 'Utilization', accessor: (r) => Math.round((r.utilization_score || 0) * 100) + '%' },
      { label: 'Efficiency', accessor: (r) => Math.round((r.cost_efficiency_score || 0) * 100) + '%' }
    ], 'resource-allocations');
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
    });
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'room': return '🏢';
      case 'equipment': return '🖥️';
      case 'staff': return '👤';
      case 'vehicle': return '🚗';
      default: return '📦';
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'room': return 'bg-blue-100 text-blue-700';
      case 'equipment': return 'bg-purple-100 text-purple-700';
      case 'staff': return 'bg-green-100 text-green-700';
      case 'vehicle': return 'bg-orange-100 text-orange-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getAppointmentAllocations = (appointmentId) => {
    return allocations.filter(a => a.appointment_id === appointmentId);
  };

  if (loading && allocations.length === 0 && resources.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
              <span className="text-3xl">⚡</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold">AI Resource Allocator</h1>
              <p className="opacity-90">Optimize resource allocation for maximum efficiency</p>
            </div>
          </div>
        </div>
        <SkeletonCard count={6} />
        <SkeletonTable rows={5} cols={6} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
              <span className="text-3xl">⚡</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold">AI Resource Allocator</h1>
              <p className="opacity-90">Optimize resource allocation for maximum efficiency</p>
            </div>
          </div>
          <button
            onClick={handleOptimizeAll}
            disabled={optimizing || resources.length === 0 || appointments.length === 0}
            className="px-6 py-3 bg-white text-emerald-600 rounded-lg font-medium hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            {optimizing ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Optimizing...
              </>
            ) : (
              <>
                <span>🤖</span> Optimize All
              </>
            )}
          </button>
        </div>
      </div>

      {/* Optimization Result */}
      {optimizationResult && (
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-6 border border-emerald-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <span className="text-2xl">✨</span> AI Allocation Result
              {optimizationResult.ai_powered && (
                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">AI Powered</span>
              )}
            </h3>
            <button onClick={() => setOptimizationResult(null)} className="text-gray-400 hover:text-gray-600">&times;</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <p className="text-sm text-gray-500">Overall Efficiency</p>
              <p className="text-3xl font-bold text-emerald-600">
                {Math.round((optimizationResult.optimization?.overall_efficiency || 0) * 100)}%
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <p className="text-sm text-gray-500">Allocations Saved</p>
              <p className="text-2xl font-bold text-teal-600">
                {optimizationResult.saved_allocations?.length || 0}
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <p className="text-sm text-gray-500">Conflicts</p>
              <p className="text-2xl font-bold text-gray-600">
                {optimizationResult.optimization?.conflicts?.length || 0}
              </p>
            </div>
          </div>

          {optimizationResult.saved_allocations && optimizationResult.saved_allocations.length > 0 && (
            <div className="space-y-2 mb-4">
              <p className="text-sm font-medium text-gray-700">Allocations Created:</p>
              {optimizationResult.saved_allocations.map((alloc, i) => (
                <div key={i} className="bg-white rounded-lg p-3 border border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span>{getTypeIcon(alloc.resource_type)}</span>
                    <div>
                      <p className="font-medium text-gray-800">{alloc.appointment_title}</p>
                      <p className="text-sm text-gray-500">{alloc.resource_name} ({alloc.allocation_type})</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-emerald-600">{Math.round((alloc.utilization_score || 0) * 100)}% util</span>
                    <span className="text-teal-600">{Math.round((alloc.cost_efficiency_score || 0) * 100)}% eff</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {optimizationResult.optimization?.cost_summary && (
            <div className="bg-white rounded-lg p-4 mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Cost Summary</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Total Cost</p>
                  <p className="text-lg font-bold text-gray-800">${optimizationResult.optimization.cost_summary.total_cost || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Savings Potential</p>
                  <p className="text-lg font-bold text-green-600">${optimizationResult.optimization.cost_summary.savings_potential || 0}</p>
                </div>
              </div>
              {optimizationResult.optimization.cost_summary.optimization_suggestions?.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {optimizationResult.optimization.cost_summary.optimization_suggestions.map((s, i) => (
                    <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                      <span className="text-emerald-500">💰</span> {s}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {optimizationResult.optimization?.recommendations && optimizationResult.optimization.recommendations.length > 0 && (
            <div className="bg-white rounded-lg p-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Recommendations:</p>
              <ul className="space-y-1">
                {optimizationResult.optimization.recommendations.map((rec, i) => (
                  <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                    <span className="text-emerald-500">💡</span> {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Resources Section */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-800">Resources ({resources.length})</h2>
          <button
            onClick={handleCreateResource}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"
          >
            <span>+</span> New Resource
          </button>
        </div>

        {resources.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <span className="text-4xl mb-4 block">⚡</span>
            <p className="font-medium">No resources yet</p>
            <p className="text-sm mt-1">Add resources (rooms, equipment, staff) before allocating them to appointments.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
            {resources.map((resource) => (
              <div
                key={resource.id}
                className="border border-gray-200 rounded-lg p-4 hover:border-emerald-300 hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{getTypeIcon(resource.type)}</span>
                    <span className={`px-2 py-1 rounded-full text-xs ${getTypeColor(resource.type)}`}>
                      {resource.type}
                    </span>
                  </div>
                  <span className={`w-2 h-2 rounded-full ${resource.is_active ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                </div>
                <h3 className="font-semibold text-gray-800">{resource.name}</h3>
                <p className="text-sm text-gray-500">{resource.location || 'No location'}</p>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-gray-500">Capacity: {resource.capacity}</span>
                  {resource.cost_per_hour > 0 && (
                    <span className="text-emerald-600 font-medium">${resource.cost_per_hour}/hr</span>
                  )}
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => handleEditResource(resource)}
                    className="flex-1 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteResource(resource.id)}
                    className="flex-1 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Appointments - Allocate with AI */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">Upcoming Appointments</h2>
          <p className="text-sm text-gray-500 mt-1">Select an appointment to allocate resources with AI</p>
        </div>

        {appointments.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <span className="text-4xl mb-4 block">📅</span>
            <p>No upcoming appointments to allocate resources to.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {appointments.map((apt) => {
              const aptAllocations = getAppointmentAllocations(apt.id);
              const hasAllocation = aptAllocations.length > 0;
              const isAllocating = allocatingId === apt.id;

              return (
                <div key={apt.id} className={`p-4 hover:bg-gray-50 transition-colors ${hasAllocation ? 'bg-emerald-50/50' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{apt.title}</p>
                        {hasAllocation && (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full">
                            {aptAllocations.length} resource{aptAllocations.length > 1 ? 's' : ''} allocated
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {formatDate(apt.start_time)} - {formatDate(apt.end_time)}
                      </p>
                      {apt.location && (
                        <p className="text-sm text-gray-400">{apt.location}</p>
                      )}
                      {hasAllocation && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {aptAllocations.map((alloc) => (
                            <span key={alloc.id} className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-emerald-200 rounded-lg text-xs text-gray-700">
                              {getTypeIcon(alloc.resource_type)} {alloc.resource_name}
                              <span className="text-emerald-600 ml-1">{Math.round((alloc.utilization_score || 0) * 100)}%</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleAllocateSingle(apt.id)}
                      disabled={isAllocating || resources.length === 0}
                      className="ml-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center gap-2 whitespace-nowrap"
                    >
                      {isAllocating ? (
                        <>
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Allocating...
                        </>
                      ) : (
                        <>
                          <span>🤖</span> Allocate with AI
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {resources.length === 0 && appointments.length > 0 && (
          <div className="p-4 bg-yellow-50 border-t border-yellow-200">
            <p className="text-sm text-yellow-700">Add resources above before allocating them to appointments.</p>
          </div>
        )}
      </div>

      {/* Allocations History */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-800">Resource Allocations</h2>
          <div className="flex items-center gap-3">
            <ExportButtons onExportCSV={handleExportCSV} />
            <span className="text-sm text-gray-500">{total} allocations</span>
          </div>
        </div>

        <div className="px-6 py-3">
          <SearchBar value={search} onChange={handleSearchChange} placeholder="Search allocations..." />
        </div>

        {allocations.length === 0 && !loading ? (
          <div className="p-8 text-center text-gray-500">
            <span className="text-4xl mb-4 block">📋</span>
            <p>{search ? 'No allocations match your search.' : 'No allocations yet. Use "Allocate with AI" on an appointment above!'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <SortableHeader label="Appointment" field="appointment_title" currentSort={sort} currentOrder={order} onSort={handleSort} />
                  <SortableHeader label="Resource" field="resource_name" currentSort={sort} currentOrder={order} onSort={handleSort} />
                  <SortableHeader label="Type" field="allocation_type" currentSort={sort} currentOrder={order} onSort={handleSort} />
                  <SortableHeader label="Utilization" field="utilization_score" currentSort={sort} currentOrder={order} onSort={handleSort} />
                  <SortableHeader label="Efficiency" field="cost_efficiency_score" currentSort={sort} currentOrder={order} onSort={handleSort} />
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {allocations.map((allocation) => (
                  <tr
                    key={allocation.id}
                    onClick={() => handleRowClick(allocation)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{allocation.appointment_title || 'Unknown'}</div>
                      <div className="text-sm text-gray-500">{allocation.start_time ? formatDate(allocation.start_time) : 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span>{getTypeIcon(allocation.resource_type)}</span>
                        <span className="font-medium text-gray-800">{allocation.resource_name || 'Unassigned'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs ${allocation.allocation_type === 'primary' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {allocation.allocation_type || 'primary'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500"
                            style={{ width: `${(allocation.utilization_score || 0) * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-sm">{Math.round((allocation.utilization_score || 0) * 100)}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-teal-500"
                            style={{ width: `${(allocation.cost_efficiency_score || 0) * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-sm">{Math.round((allocation.cost_efficiency_score || 0) * 100)}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteAllocation(allocation.id); }}
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

      {/* Resource Modal */}
      {showResourceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800">
                  {editingResource ? 'Edit Resource' : 'New Resource'}
                </h2>
                <button onClick={() => setShowResourceModal(false)} className="text-gray-400 hover:text-gray-600">
                  &times;
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={resourceForm.name}
                  onChange={(e) => setResourceForm({ ...resourceForm, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                <select
                  value={resourceForm.type}
                  onChange={(e) => setResourceForm({ ...resourceForm, type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  {resourceTypes.map((type) => (
                    <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
                  <input
                    type="number"
                    value={resourceForm.capacity}
                    onChange={(e) => setResourceForm({ ...resourceForm, capacity: parseInt(e.target.value) || 1 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cost/Hour ($)</label>
                  <input
                    type="number"
                    value={resourceForm.cost_per_hour}
                    onChange={(e) => setResourceForm({ ...resourceForm, cost_per_hour: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input
                  type="text"
                  value={resourceForm.location}
                  onChange={(e) => setResourceForm({ ...resourceForm, location: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button
                onClick={() => setShowResourceModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveResource}
                disabled={!resourceForm.name}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {editingResource ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="p-6 border-b bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-t-xl">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold">{selectedDetail.appointment_title}</h2>
                  <p className="opacity-90">Allocation Details</p>
                </div>
                <button onClick={() => setShowDetailModal(false)} className="text-white/80 hover:text-white text-2xl">
                  &times;
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-emerald-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Resource</p>
                  <p className="text-lg font-bold text-emerald-600">{selectedDetail.resource_name}</p>
                </div>
                <div className="bg-teal-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Type</p>
                  <p className="text-lg font-bold text-teal-600 capitalize">{selectedDetail.resource_type}</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Utilization</p>
                  <p className="text-lg font-bold text-blue-600">{Math.round((selectedDetail.utilization_score || 0) * 100)}%</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Cost Efficiency</p>
                  <p className="text-lg font-bold text-purple-600">{Math.round((selectedDetail.cost_efficiency_score || 0) * 100)}%</p>
                </div>
              </div>

              {selectedDetail.allocation_type && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-700 mb-1">Allocation Type</p>
                  <span className={`px-3 py-1 rounded-full text-sm ${selectedDetail.allocation_type === 'primary' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {selectedDetail.allocation_type}
                  </span>
                </div>
              )}

              {selectedDetail.ai_reasoning && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">AI Reasoning</p>
                  <p className="text-gray-600">{selectedDetail.ai_reasoning}</p>
                </div>
              )}

              {selectedDetail.start_time && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-700 mb-1">Appointment Time</p>
                  <p className="text-gray-600">{formatDate(selectedDetail.start_time)}</p>
                </div>
              )}
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button
                onClick={() => handleDeleteAllocation(selectedDetail.id)}
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
