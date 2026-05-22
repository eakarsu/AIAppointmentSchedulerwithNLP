import React, { useEffect, useState } from 'react';

export default function ApptConfirmPDF() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);

  useEffect(() => {
    let alive = true;
    const token = localStorage.getItem('token');
    fetch('/api/custom-views/patients', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then((r) => r.ok ? r.json() : r.json().then((e) => Promise.reject(e)))
      .then((j) => {
        if (alive) {
          setPatients(j.patients || []);
          if (j.patients?.length > 0) setSelectedId(j.patients[0].appointment_id);
          setLoading(false);
        }
      })
      .catch((e) => { if (alive) { setError(e?.error || 'Failed to load'); setLoading(false); } });
    return () => { alive = false; };
  }, []);

  // Revoke object URL on change/unmount
  useEffect(() => {
    return () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); };
  }, [pdfUrl]);

  const generate = async () => {
    if (!selectedId) return;
    setGenerating(true);
    if (pdfUrl) { URL.revokeObjectURL(pdfUrl); setPdfUrl(null); }
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/custom-views/confirmation-pdf/${selectedId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      setPdfUrl(URL.createObjectURL(blob));
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <div className="p-4 text-gray-500" data-testid="pdf-loading">Loading patients…</div>;

  return (
    <div className="bg-white rounded-lg shadow p-4" data-testid="appt-confirm-pdf">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-gray-800">Appointment Confirmation PDF</h3>
        <p className="text-sm text-gray-500">Pick a patient/appointment and generate a confirmation document</p>
      </div>

      {error && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800">{error}</div>
      )}

      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <select
          value={selectedId || ''}
          onChange={(e) => setSelectedId(parseInt(e.target.value, 10))}
          className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
          data-testid="patient-picker"
        >
          {patients.map((p) => (
            <option key={p.appointment_id} value={p.appointment_id}>
              {p.patient_name} — {p.title} ({new Date(p.start_time).toLocaleDateString()})
            </option>
          ))}
        </select>
        <button
          onClick={generate}
          disabled={!selectedId || generating}
          data-testid="generate-pdf-btn"
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm disabled:opacity-50"
        >
          {generating ? 'Generating…' : 'Generate PDF'}
        </button>
        {pdfUrl && (
          <a
            href={pdfUrl}
            download={`confirmation-${selectedId}.pdf`}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm text-center"
          >Download</a>
        )}
      </div>

      {pdfUrl && (
        <div className="border rounded overflow-hidden" style={{ height: 500 }}>
          <iframe src={pdfUrl} title="Confirmation PDF" className="w-full h-full" />
        </div>
      )}

      {!pdfUrl && (
        <div className="text-xs text-gray-500">
          PDF includes date, provider, location, and preparation instructions.
        </div>
      )}
    </div>
  );
}
