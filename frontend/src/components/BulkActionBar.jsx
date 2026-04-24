import React from 'react';

export default function BulkActionBar({ count, onDelete, onStatusUpdate, statusOptions }) {
  if (count === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-3 flex items-center justify-between z-50 print:hidden">
      <span className="text-sm font-medium text-gray-700 ml-4">{count} item{count > 1 ? 's' : ''} selected</span>
      <div className="flex gap-2 mr-4">
        {statusOptions && (
          <select
            onChange={(e) => { if (e.target.value) onStatusUpdate(e.target.value); e.target.value = ''; }}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
            defaultValue=""
          >
            <option value="" disabled>Update Status...</option>
            {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        <button
          onClick={onDelete}
          className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
        >
          Delete Selected
        </button>
      </div>
    </div>
  );
}
