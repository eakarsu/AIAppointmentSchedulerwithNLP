import React from 'react';

export default function SortableHeader({ label, field, currentSort, currentOrder, onSort }) {
  const active = currentSort === field;
  const handleClick = () => {
    if (active) {
      onSort(field, currentOrder === 'asc' ? 'desc' : 'asc');
    } else {
      onSort(field, 'asc');
    }
  };

  return (
    <th
      onClick={handleClick}
      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none"
    >
      <span className="flex items-center gap-1">
        {label}
        <span className="text-gray-300">
          {active ? (currentOrder === 'asc' ? '\u25B2' : '\u25BC') : '\u25B4\u25BE'}
        </span>
      </span>
    </th>
  );
}
