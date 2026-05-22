import React, { useEffect, useMemo, useState } from 'react';

const STATUS_COLORS = {
  scheduled: '#3B82F6',
  confirmed: '#10B981',
  completed: '#22C55E',
  cancelled: '#EF4444',
  'no-show': '#F59E0B',
  pending: '#A855F7'
};

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addMonths(d, n) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function daysInMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

export default function AppointmentCalendar() {
  const [data, setData] = useState({ appointments: [], providers: [], status_colors: STATUS_COLORS, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));

  useEffect(() => {
    let alive = true;
    const token = localStorage.getItem('token');
    fetch('/api/custom-views/calendar', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then((r) => r.ok ? r.json() : r.json().then((e) => Promise.reject(e)))
      .then((j) => { if (alive) { setData(j); setLoading(false); } })
      .catch((e) => { if (alive) { setError(e?.error || 'Failed to load'); setLoading(false); } });
    return () => { alive = false; };
  }, []);

  const monthlyByDay = useMemo(() => {
    const m = new Map();
    const monthStart = cursor;
    const monthEnd = addMonths(cursor, 1);
    for (const appt of data.appointments) {
      const d = new Date(appt.start_time);
      if (d >= monthStart && d < monthEnd) {
        const key = d.getDate();
        if (!m.has(key)) m.set(key, []);
        m.get(key).push(appt);
      }
    }
    return m;
  }, [data.appointments, cursor]);

  const monthLabel = cursor.toLocaleString('default', { month: 'long', year: 'numeric' });
  const firstWeekday = cursor.getDay();
  const totalDays = daysInMonth(cursor);
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= totalDays; day++) cells.push(day);

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (loading) return <div className="p-4 text-gray-500" data-testid="calendar-loading">Loading calendar…</div>;
  if (error) return <div className="p-4 text-red-600" data-testid="calendar-error">Calendar error: {error}</div>;

  return (
    <div className="bg-white rounded-lg shadow p-4" data-testid="appointment-calendar">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-800">Appointment Calendar</h3>
          <p className="text-sm text-gray-500">{data.total} total appointments · color by status</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCursor(addMonths(cursor, -1))}
            className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm"
          >‹ Prev</button>
          <div className="font-semibold text-gray-700 w-40 text-center">{monthLabel}</div>
          <button
            onClick={() => setCursor(addMonths(cursor, 1))}
            className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm"
          >Next ›</button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekdays.map((w) => (
          <div key={w} className="text-xs font-semibold text-gray-500 text-center py-1">{w}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} className="h-24 bg-gray-50 rounded" />;
          const dayAppts = monthlyByDay.get(day) || [];
          return (
            <div key={`d-${day}`} className="h-24 border border-gray-200 rounded p-1 text-xs overflow-hidden bg-white">
              <div className="font-semibold text-gray-700 mb-1">{day}</div>
              <div className="space-y-1">
                {dayAppts.slice(0, 3).map((a) => (
                  <div
                    key={a.id}
                    className="truncate rounded px-1 py-0.5 text-white"
                    style={{ backgroundColor: a.status_color || STATUS_COLORS[a.status] || '#64748B' }}
                    title={`${a.title} (${a.status}) · ${a.provider_name}`}
                  >
                    {a.title}
                  </div>
                ))}
                {dayAppts.length > 3 && (
                  <div className="text-gray-400">+{dayAppts.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: color }} />
            <span className="text-gray-600 capitalize">{status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
