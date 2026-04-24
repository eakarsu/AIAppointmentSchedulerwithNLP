import { useState, useCallback } from 'react';

export default function useBulkSelection() {
  const [selectedIds, setSelectedIds] = useState(new Set());

  const toggleSelect = useCallback((id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback((allIds) => {
    setSelectedIds(prev => {
      if (prev.size === allIds.length) return new Set();
      return new Set(allIds);
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  return { selectedIds: Array.from(selectedIds), selectedSet: selectedIds, toggleSelect, toggleSelectAll, clearSelection };
}
