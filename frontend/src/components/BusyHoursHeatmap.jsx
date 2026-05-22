import React, { useEffect, useState } from 'react';

function colorFor(value, max) {
  if (!max || value === 0) return '#F3F4F6';
  const intensity = Math.min(1, value / max);
  // Blue-to-purple gradient
  const r = Math.round(59 + (139 - 59) * intensity);
  const g = Math.round(130 + (92 - 130) * intensity);
  const b = Math.round(246 + (246 - 246) * intensity);
  return `rgba(${r}, ${g}, ${b}, ${0.25 + intensity * 0.75})`;
}

export default function BusyHoursHeatmap() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    const token = localStorage.getItem('token');
    fetch('/api/custom-views/heatmap', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then((r) => r.ok ? r.json() : r.json().then((e) => Promise.reject(e)))
      .then((j) => { if (alive) { setData(j); setLoading(false); } })
      .catch((e) => { if (alive) { setError(e?.error || 'Failed to load'); setLoading(false); } });
    return () => { alive = false; };
  }, []);

  if (loading) return <div className="p-4 text-gray-500" data-testid="heatmap-loading">Loading heatmap…</div>;
  if (error) return <div className="p-4 text-red-600" data-testid="heatmap-error">Heatmap error: {error}</div>;

  const { grid, days, hours, max, total } = data;

  return (
    <div className="bg-white rounded-lg shadow p-4" data-testid="busy-hours-heatmap">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-800">Busy Hours Heatmap</h3>
          <p className="text-sm text-gray-500">7 days × 24 hours · {total} bookings · peak {max}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <span>low</span>
          <div className="flex">
            {[0, 0.25, 0.5, 0.75, 1].map((v) => (
              <span key={v} className="w-4 h-4 inline-block" style={{ backgroundColor: colorFor(v * (max || 1), max || 1) }} />
            ))}
          </div>
          <span>high</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="text-xs" style={{ borderCollapse: 'separate', borderSpacing: 2 }}>
          <thead>
            <tr>
              <th className="text-gray-500 px-2 py-1 text-left">Day \ Hr</th>
              {hours.map((h) => (
                <th key={h} className="text-gray-500 px-1 py-1 text-center w-6">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((row, d) => (
              <tr key={d}>
                <td className="text-gray-700 font-semibold pr-2">{days[d]}</td>
                {row.map((v, h) => (
                  <td
                    key={h}
                    title={`${days[d]} ${h}:00 — ${v} booking${v === 1 ? '' : 's'}`}
                    className="text-center rounded"
                    style={{
                      backgroundColor: colorFor(v, max),
                      color: v > 0 && max > 0 && v / max > 0.5 ? '#fff' : '#374151',
                      width: 22,
                      height: 22,
                      minWidth: 22
                    }}
                  >
                    {v > 0 ? v : ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
