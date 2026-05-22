import React, { useEffect, useState } from 'react';

export default function ReminderDispatch() {
  const [appts, setAppts] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dispatching, setDispatching] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    let alive = true;
    const token = localStorage.getItem('token');
    fetch('/api/custom-views/upcoming', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then((r) => r.ok ? r.json() : r.json().then((e) => Promise.reject(e)))
      .then((j) => { if (alive) { setAppts(j.appointments || []); setLoading(false); } })
      .catch((e) => { if (alive) { setError(e?.error || 'Failed to load'); setLoading(false); } });
    return () => { alive = false; };
  }, []);

  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const selectAll = () => {
    if (selected.size === appts.length) setSelected(new Set());
    else setSelected(new Set(appts.map((a) => a.id)));
  };

  const dispatch = async () => {
    if (selected.size === 0) return;
    setDispatching(true);
    setResult(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/custom-views/dispatch-reminders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ appointmentIds: Array.from(selected) })
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Dispatch failed');
      setResult(j);
    } catch (e) {
      setResult({ error: e.message });
    } finally {
      setDispatching(false);
    }
  };

  if (loading) return <div className="p-4 text-gray-500" data-testid="reminder-loading">Loading…</div>;
  if (error) return <div className="p-4 text-red-600" data-testid="reminder-error">Error: {error}</div>;

  return (
    <div className="bg-white rounded-lg shadow p-4" data-testid="reminder-dispatch">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-800">SMS Reminder Dispatch</h3>
          <p className="text-sm text-gray-500">{appts.length} upcoming · {selected.size} selected</p>
        </div>
        <div className="flex gap-2">
          <button onClick={selectAll} className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded">
            {selected.size === appts.length && appts.length > 0 ? 'Clear' : 'Select All'}
          </button>
          <button
            onClick={dispatch}
            disabled={dispatching || selected.size === 0}
            data-testid="dispatch-btn"
            className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {dispatching ? 'Sending…' : `Send ${selected.size} Reminder${selected.size === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>

      {result && !result.error && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-800" data-testid="dispatch-result">
          Sent: <strong>{result.sent}</strong> · Failed: <strong>{result.failed}</strong>
          {result.sids?.length > 0 && (
            <div className="mt-1 text-xs text-green-700 break-all">SIDs: {result.sids.join(', ')}</div>
          )}
        </div>
      )}
      {result?.error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
          {result.error}
        </div>
      )}

      <div className="border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-gray-600">
              <th className="p-2 w-8"></th>
              <th className="p-2">Title</th>
              <th className="p-2">When</th>
              <th className="p-2">Contact</th>
              <th className="p-2">Phone</th>
            </tr>
          </thead>
          <tbody>
            {appts.map((a) => (
              <tr key={a.id} className="border-t hover:bg-gray-50">
                <td className="p-2">
                  <input
                    type="checkbox"
                    checked={selected.has(a.id)}
                    onChange={() => toggle(a.id)}
                  />
                </td>
                <td className="p-2 text-gray-800">{a.title}</td>
                <td className="p-2 text-gray-600">{new Date(a.start_time).toLocaleString()}</td>
                <td className="p-2 text-gray-600">{a.contact_name}</td>
                <td className="p-2 text-gray-600">{a.contact_phone || <span className="text-gray-400">—</span>}</td>
              </tr>
            ))}
            {appts.length === 0 && (
              <tr><td colSpan={5} className="p-4 text-center text-gray-400">No upcoming appointments</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
